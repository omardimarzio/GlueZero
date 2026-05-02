// circuit-breaker.ts — PerRouteCircuitBreaker (D-99 default + opt-in DISABLED).
//
// State machine per-route: `closed → open → half-open → closed`.
// - closed: requests pass; failure incrementa counter; success resetta counter.
// - open: fail-fast (canExecute=false); transition automatica → half-open dopo cooldownMs
//   al prossimo canExecute (lazy transition, evita timer overhead).
// - half-open: 1 prova ammessa; success → closed (recovery); failure → open ricaricato
//   (cooldown reset, nuovo timer).
//
// Default DISABLED (V1): createCircuitBreakerStrategy() senza config = pass-through
// (canExecute=true sempre). Consumer opt-in via gateway.circuitBreaker config (D-99).
// Sliding window stats (success rate over time window) → V1.x.
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-99: Per-route fail counter base. Threshold + cooldownMs configurabili.
//         createCircuitBreakerStrategy() ritorna pass-through quando config undefined
//         (consumer opt-in via gateway.circuitBreaker).
// - D-83: ZERO modifiche a packages/core/ runtime — implementazione self-contained.
//
// Pattern transitionState analogo a `lifecycle.ts` di F1: state machine atomico,
// race-free in single-threaded JS event loop.
//
// Threat coverage:
// - T-03-11-04 (DoS — cooldownMs:Infinity blocca route per sempre): accept (consumer
//   responsibility — config validation in plan 03-12 RouterBroker).

import type { CircuitBreakerConfig } from '../types/gateway-config'
import type { CircuitBreakerStrategy } from '../types/http-strategies'

/**
 * Stato interno per-route del circuit breaker.
 *
 * - `state` — stato corrente della state machine.
 * - `consecutiveFailures` — counter di fallimenti consecutivi (resettato da success).
 * - `openedAt` — timestamp `Date.now()` del passaggio a `open`. Usato per calcolare
 *   l'expiry del cooldownMs e transition automatica → half-open.
 */
interface CircuitState {
  state: 'closed' | 'open' | 'half-open'
  consecutiveFailures: number
  openedAt: number
}

/**
 * Opzioni di configurazione per `createCircuitBreakerStrategy`.
 *
 * Quando `config` è omesso, il circuit breaker è DISABILITATO (pass-through). Quando
 * presente, il circuit breaker applica state machine per-route con threshold + cooldown.
 */
export interface CircuitBreakerStrategyOptions {
  /**
   * Configurazione opt-in del circuit breaker (D-99). Se omesso, default DISABLED.
   *
   * - `threshold` — numero di fail consecutivi prima dell'open transition.
   * - `cooldownMs` — durata dello stato open prima del passaggio a half-open.
   * - `halfOpenMaxRequests` — request consentite in half-open (V1: ignorato, default 1).
   */
  readonly config?: CircuitBreakerConfig
}

/**
 * Crea una `CircuitBreakerStrategy` con policy `PerRouteCircuitBreaker` (D-99 default).
 *
 * State machine per-route con 3 stati: `closed → open → half-open → closed`. Consumer
 * opt-in: senza `config`, ritorna pass-through (canExecute sempre true). Quando attivo,
 * blocca le request con fail-fast quando in `open` per `cooldownMs`, poi tenta recovery
 * via single probe in `half-open`.
 *
 * @example
 * ```ts
 * // V1 default: DISABILITATO (consumer opt-in)
 * const cbDisabled = createCircuitBreakerStrategy()
 * cbDisabled.canExecute('r1') // sempre true
 *
 * // Opt-in
 * const cb = createCircuitBreakerStrategy({
 *   config: { threshold: 5, cooldownMs: 30_000 },
 * })
 *
 * // 5 fail consecutivi → open
 * for (let i = 0; i < 5; i++) cb.recordFailure('r1')
 * cb.canExecute('r1') // false (fail-fast)
 *
 * // Dopo 30s → half-open (al prossimo canExecute)
 * // success in half-open → closed (recovery)
 * cb.recordSuccess('r1')
 * cb.canExecute('r1') // true
 * ```
 *
 * @param options - Configurazione (vedi `CircuitBreakerStrategyOptions`).
 * @returns Istanza `CircuitBreakerStrategy` con `canExecute`, `recordSuccess`, `recordFailure`, `getState`.
 */
export function createCircuitBreakerStrategy(
  options: CircuitBreakerStrategyOptions = {},
): CircuitBreakerStrategy {
  const config = options.config
  // Map<routeId, CircuitState> — per-route state isolato (Test 8 verifica indipendenza).
  const states = new Map<string, CircuitState>()

  /**
   * Get-or-create state per `routeId` (lazy init). Lo stato è inizializzato `closed`
   * con counter 0.
   */
  function getOrCreateState(routeId: string): CircuitState {
    let s = states.get(routeId)
    if (s === undefined) {
      s = { state: 'closed', consecutiveFailures: 0, openedAt: 0 }
      states.set(routeId, s)
    }
    return s
  }

  /**
   * Transition lazy automatica `open → half-open` quando cooldownMs è expired. Chiamata
   * idempotente (no-op se non `open` o cooldown non passato). Pattern lazy invece di
   * timer evita overhead `setTimeout` per route inattive.
   */
  function maybeTransitionToHalfOpen(s: CircuitState): void {
    if (
      s.state === 'open' &&
      config !== undefined &&
      Date.now() - s.openedAt >= config.cooldownMs
    ) {
      s.state = 'half-open'
    }
  }

  return {
    canExecute(routeId: string): boolean {
      // DEFAULT DISABLED: senza config, pass-through (canExecute sempre true).
      if (config === undefined) return true
      const s = getOrCreateState(routeId)
      maybeTransitionToHalfOpen(s)
      // Fail-fast solo in 'open'. In 'half-open' permettiamo UNA prova (Test 5).
      return s.state !== 'open'
    },

    recordSuccess(routeId: string): void {
      // DEFAULT DISABLED: no-op senza config.
      if (config === undefined) return
      const s = getOrCreateState(routeId)
      // Success resetta sempre il counter consecutiveFailures.
      s.consecutiveFailures = 0
      // Da half-open → closed (recovery). Da open (edge case: recovery prima di canExecute)
      // → closed. Da closed → resta closed.
      if (s.state === 'half-open' || s.state === 'open') {
        s.state = 'closed'
        s.openedAt = 0
      }
    },

    recordFailure(routeId: string): void {
      // DEFAULT DISABLED: no-op senza config.
      if (config === undefined) return
      const s = getOrCreateState(routeId)
      s.consecutiveFailures++
      // half-open + failure → open ricaricato (cooldown reset, Test 7).
      if (s.state === 'half-open') {
        s.state = 'open'
        s.openedAt = Date.now()
        return
      }
      // closed + failure raggiunge threshold → open (Test 3).
      if (s.state === 'closed' && s.consecutiveFailures >= config.threshold) {
        s.state = 'open'
        s.openedAt = Date.now()
      }
    },

    getState(routeId: string): 'closed' | 'open' | 'half-open' {
      // DEFAULT DISABLED: pass-through reportistico (sempre 'closed').
      if (config === undefined) return 'closed'
      const s = getOrCreateState(routeId)
      // Lazy transition: getState esposto per Inspector debug rispetta semantica
      // "stato corrente effettivo" — applica anche transition open → half-open.
      maybeTransitionToHalfOpen(s)
      return s.state
    },
  }
}
