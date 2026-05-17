/**
 * `CircuitBreaker` — Per-MF 3-state FSM (closed / open / half-open) + threshold
 * counter + lazy transition open → half-open + topics emit
 * (`microfrontend.circuit.opened` + `microfrontend.circuit.closed`).
 *
 * Pattern Rule 2 stretto carryover da
 * `packages/gateway/src/http/strategies/circuit-breaker.ts` (F3 lazy transition
 * pattern). Diff F14:
 * - Emit 2 topics governance F14 (no equivalente in F3 — F3 è internal-only).
 * - Source descriptor F1 D-23 obbligatorio (`{type:'plugin', id:'fallbacks',
 *   name:'@gluezero/fallbacks'}`).
 * - Key per-mfId (Map<mfId, CircuitState>) invece di per-routeId F3.
 *
 * **State machine D-V2-F14-11:**
 * ```
 *  closed ──(failures >= threshold)──▶ open
 *    ▲                                  │
 *    │ recordSuccess                    │ Date.now() - openedAt >= resetAfterMs
 *    │                                  ▼
 *  closed ◀──(success)── half-open ◀────┘
 *                          │
 *                          └──(failure)──▶ open (re-emit opened, timer reset)
 * ```
 *
 * - `closed → open`: emit `circuit.opened` con `consecutiveFailures`, `openedAt`,
 *   `timestamp`. Capture `openedAt = Date.now()`.
 * - `open → half-open`: lazy transition — il prossimo `canExecute` / `recordFailure`
 *   / `recordSuccess` rileva `Date.now() - openedAt >= resetAfterMs` e transiziona.
 *   Niente `setTimeout` overhead per-MF idle (F3 pattern carryover).
 * - `half-open → closed`: emit `circuit.closed` con `closedAt`, `timestamp`. Reset
 *   counter consecutivo.
 * - `half-open → open`: re-open + re-emit `circuit.opened` (timer reset).
 *
 * **Debounce double-emit**: una volta in `open`, ulteriori `recordFailure` non
 * re-emettono `circuit.opened` (solo transizioni `closed → open` o `half-open →
 * open` emettono).
 *
 * **Default `enabled:false`**: opt-in safety (D-V2-F14-11). Quando disabled, ogni
 * API è pass-through (no state change, no topic emit, canExecute sempre true).
 *
 * **Anti-singleton D-30**: ogni `createCircuitBreaker(broker)` ritorna istanza
 * isolata con Map<string, CircuitState> privata.
 *
 * @see prd_2.0.0.md §29.3 — CircuitBreakerPolicy
 * @see D-V2-F14-11 — Per-MF state machine
 * @see D-V2-F14-12 — Circuit → retry order (caller skip retry quando canExecute=false)
 * @see D-V2-F14-03 — Topics literal F14
 * @see packages/gateway/src/http/strategies/circuit-breaker.ts (F3 reference template)
 */
import type { Broker } from '@gluezero/core'
import { MF_FALLBACK_TOPICS } from './topics.js'
import type { CircuitBreakerPolicy } from './types/policy.js'

/**
 * Topic literal cached per evitare re-indexing in publish hot path.
 *
 * - `TOPIC_OPENED = MF_FALLBACK_TOPICS[1]` → `'microfrontend.circuit.opened'`.
 * - `TOPIC_CLOSED = MF_FALLBACK_TOPICS[2]` → `'microfrontend.circuit.closed'`.
 */
const TOPIC_OPENED = MF_FALLBACK_TOPICS[1] // 'microfrontend.circuit.opened'
const TOPIC_CLOSED = MF_FALLBACK_TOPICS[2] // 'microfrontend.circuit.closed'

/**
 * Source descriptor F1 D-23 obbligatorio per ogni broker.publish — anti-spoof
 * convention F1 (host responsabilità trust, strict enforcement deferred V2.1).
 *
 * `deliveryMode:'sync'` per consistency con governance topics F8 (subscribe
 * non-bloccante ma immediato).
 */
const PUBLISH_OPTS = {
  source: {
    type: 'plugin' as const,
    id: 'fallbacks',
    name: '@gluezero/fallbacks',
  },
  deliveryMode: 'sync' as const,
}

/**
 * State interno per MF — mutabile (in-place transition) per perf hot path.
 *
 * - `status`: corrente stato FSM.
 * - `consecutiveFailures`: counter failure consecutivi (reset su recordSuccess in closed).
 * - `openedAt`: epoch ms in cui circuit è transizionato a `open` (0 se mai aperto).
 */
interface CircuitState {
  status: 'closed' | 'open' | 'half-open'
  consecutiveFailures: number
  openedAt: number
}

function createInitialState(): CircuitState {
  return { status: 'closed', consecutiveFailures: 0, openedAt: 0 }
}

/**
 * API stabile `CircuitBreaker` per consumer W2 P04.
 *
 * 5 methods:
 * - `canExecute`: predicato pre-retry (`!== 'open'`) — usato da error subscriber.
 * - `recordFailure` / `recordSuccess`: orchestrator chain post lifecycle phase result.
 * - `getState`: introspection (debug + Inspector W2 P05).
 * - `dispose`: cleanup memory P-02 su `microfrontend.unregistered` subscribe.
 */
export interface CircuitBreaker {
  /**
   * Predicato: puo eseguire lifecycle op per `mfId`?
   *
   * Ritorna `false` se state è `'open'`. In `'half-open'` ritorna `true` (1 attempt
   * permesso post `resetAfterMs`). In `'closed'` ritorna `true` (default).
   *
   * **NOTE**: questa API NON triggera lazy transition `open → half-open` perche
   * non ha access a `policy.resetAfterMs`. La transition è triggerata da
   * `recordFailure` / `recordSuccess` che hanno policy in scope.
   *
   * @param mfId MicroFrontend ID target.
   * @returns `true` se canExecute, `false` se circuit open.
   */
  readonly canExecute: (mfId: string) => boolean

  /**
   * Registra failure per `mfId` + policy override. Possibili transition:
   * - `closed`: incrementa `consecutiveFailures`. Se >= `failureThreshold` →
   *   transizione `open` + emit `circuit.opened`.
   * - `open`: lazy check `Date.now() - openedAt >= resetAfterMs` → se passato,
   *   transizione `half-open` poi failure → re-open + re-emit `circuit.opened`.
   * - `half-open`: re-open + re-emit `circuit.opened` (timer reset).
   *
   * No-op se `policy.enabled === false`.
   *
   * @param mfId MicroFrontend ID target.
   * @param policy Configurazione circuit (enabled / threshold / resetAfterMs).
   */
  readonly recordFailure: (mfId: string, policy: CircuitBreakerPolicy) => void

  /**
   * Registra success per `mfId` + policy override. Possibili transition:
   * - `closed`: reset `consecutiveFailures = 0` (success path standard).
   * - `open`: lazy check → se passato, transizione `half-open` poi success → `closed`
   *   + emit `circuit.closed`.
   * - `half-open`: transizione `closed` + emit `circuit.closed` + reset counter.
   *
   * No-op se `policy.enabled === false`.
   *
   * @param mfId MicroFrontend ID target.
   * @param policy Configurazione circuit.
   */
  readonly recordSuccess: (mfId: string, policy: CircuitBreakerPolicy) => void

  /**
   * Introspection state corrente. Default `'closed'` per `mfId` mai visto.
   *
   * **NOTE**: NON triggera lazy transition (consistente con `canExecute`).
   *
   * @param mfId MicroFrontend ID.
   * @returns Stato corrente (`'closed'` / `'open'` / `'half-open'`).
   */
  readonly getState: (mfId: string) => 'closed' | 'open' | 'half-open'

  /**
   * Cleanup state per `mfId` — rimuove entry da Map interno (P-02 memory leak
   * mitigation). Chiamato da W2 P04 subscribe `microfrontend.unregistered`.
   *
   * No-op se `mfId` non in Map.
   *
   * @param mfId MicroFrontend ID da rimuovere.
   */
  readonly dispose: (mfId: string) => void
}

/**
 * Factory `CircuitBreaker` — Crea istanza con Map<string, CircuitState> privata
 * + broker reference per topic emit.
 *
 * Anti-singleton D-30: ogni call crea nuovo CircuitBreaker indipendente.
 *
 * @param broker Broker su cui emettere topic `circuit.opened` / `circuit.closed`.
 * @returns Nuovo `CircuitBreaker`.
 *
 * @throws Mai direttamente. `broker.publish` invocata internamente NON propaga errori
 *   sync (governance topic emit è fire-and-forget per design F1). Eventuali errori di
 *   policy invalida sono governance-time responsability del descriptor consumer.
 *
 * @example Usage da fallbacksModule.install (W2 P04 pseudo-code)
 * ```ts
 * const circuit = createCircuitBreaker(broker)
 * // Da error subscriber:
 * if (!circuit.canExecute(mfId)) {
 *   // circuit open — skip retry, applica fallback diretto (D-V2-F14-12 order)
 *   await dispatchFallback(...)
 *   return
 * }
 * try {
 *   await mfService[phase](mfId)
 *   circuit.recordSuccess(mfId, policy)
 * } catch (err) {
 *   circuit.recordFailure(mfId, policy)
 * }
 * // On microfrontend.unregistered subscribe:
 * circuit.dispose(mfId)
 * ```
 */
export function createCircuitBreaker(broker: Broker): CircuitBreaker {
  const states = new Map<string, CircuitState>()

  function getOrCreate(mfId: string): CircuitState {
    let s = states.get(mfId)
    if (s === undefined) {
      s = createInitialState()
      states.set(mfId, s)
    }
    return s
  }

  /**
   * Lazy transition `open → half-open` se cooldown elapsed.
   *
   * Chiamato da `recordFailure` / `recordSuccess` prima di applicare il nuovo
   * outcome — garantisce che state sia sincronizzato con clock corrente.
   */
  function maybeTransitionToHalfOpen(
    s: CircuitState,
    policy: CircuitBreakerPolicy,
  ): void {
    if (
      s.status === 'open' &&
      Date.now() - s.openedAt >= policy.resetAfterMs
    ) {
      s.status = 'half-open'
    }
  }

  function emitOpened(mfId: string, s: CircuitState): void {
    broker.publish(
      TOPIC_OPENED,
      {
        microFrontendId: mfId,
        consecutiveFailures: s.consecutiveFailures,
        openedAt: s.openedAt,
        timestamp: Date.now(),
      },
      PUBLISH_OPTS,
    )
  }

  function emitClosed(mfId: string): void {
    const now = Date.now()
    broker.publish(
      TOPIC_CLOSED,
      {
        microFrontendId: mfId,
        closedAt: now,
        timestamp: now,
      },
      PUBLISH_OPTS,
    )
  }

  function canExecute(mfId: string): boolean {
    const s = states.get(mfId)
    if (s === undefined) return true // mai visto = closed default
    return s.status !== 'open'
  }

  function recordFailure(mfId: string, policy: CircuitBreakerPolicy): void {
    if (policy.enabled === false) return // pass-through quando disabled
    const s = getOrCreate(mfId)
    maybeTransitionToHalfOpen(s, policy)
    if (s.status === 'half-open') {
      // half-open + failure → re-open + emit (timer reset)
      s.consecutiveFailures += 1
      s.status = 'open'
      s.openedAt = Date.now()
      emitOpened(mfId, s)
      return
    }
    if (s.status === 'closed') {
      s.consecutiveFailures += 1
      if (s.consecutiveFailures >= policy.failureThreshold) {
        s.status = 'open'
        s.openedAt = Date.now()
        emitOpened(mfId, s)
      }
      return
    }
    // s.status === 'open' AND cooldown not elapsed → debounce (no emit)
    s.consecutiveFailures += 1
  }

  function recordSuccess(mfId: string, policy: CircuitBreakerPolicy): void {
    if (policy.enabled === false) return // pass-through
    const s = getOrCreate(mfId)
    maybeTransitionToHalfOpen(s, policy)
    if (s.status === 'half-open') {
      s.status = 'closed'
      s.consecutiveFailures = 0
      s.openedAt = 0
      emitClosed(mfId)
      return
    }
    if (s.status === 'closed') {
      // success path standard — reset counter, NO emit (closed → closed transition)
      s.consecutiveFailures = 0
      return
    }
    // s.status === 'open' AND cooldown not elapsed → no-op (success non sblocca)
  }

  function getState(mfId: string): 'closed' | 'open' | 'half-open' {
    return states.get(mfId)?.status ?? 'closed'
  }

  function dispose(mfId: string): void {
    states.delete(mfId)
  }

  return { canExecute, recordFailure, recordSuccess, getState, dispose }
}
