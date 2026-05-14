/**
 * `fallbacksModule()` factory — `BrokerModule` opt-in per `@gluezero/fallbacks`
 * (D-V2-F14-04 scaffolding W1 stub + D-V2-F14-04 3-opt scaling).
 *
 * **W1 P01 STUB no-impl**: signature definitiva + body install vuoto. W2 P04
 * sostituisce il body con logica completa:
 *   1. Lookup `SERVICE_MICROFRONTENDS` (throw se assente)
 *   2. Idempotent guard re-install
 *   3. AbortController + `RetryEngine` + `CircuitBreaker`
 *   4. Register `SERVICE_FALLBACKS` + service API
 *   5. `installErrorSubscribe(broker, ...)` — P02 hook
 *   6. AbortSignal cleanup cascade D-V2-16
 *
 * **AMENDMENT D-V2-F14-04**: factory expands a 3-opt `{defaultPolicy?,
 * retryDefault?, circuitDefault?}` (vs F13=2-opt) per scope semantically maggiore
 * — fallback + retry + circuit son 3 concept indipendenti per design F14, mentre
 * F13 isolation aggrega policyDefault + resolvers come unica responsabilità.
 *
 * **Anti-singleton D-30**: ogni call ritorna nuovo `BrokerModule`. Supporta scenario
 * 2-broker indipendenti con fallback engine separati.
 *
 * @see prd_2.0.0.md §29 — Fallback module install pattern
 * @see D-V2-F14-04 — 3-opt factory scaling
 * @see packages/isolation/src/isolation-module.ts (F13 reference template)
 */
import type { BrokerModule } from '@gluezero/core'
import type {
  CircuitBreakerPolicy,
  MicroFrontendFallbackPolicy,
  RetryPolicy,
} from './types/policy.js'

/**
 * Setup-time options per `fallbacksModule()` (D-V2-F14-04 3-opt scaling).
 *
 * - `defaultPolicy?`: host-level fallback per tutti i MF (descriptor-level override).
 *   Tipicamente `onLoadError` html generic "App unavailable" — sblocca UX consistency
 *   senza richiedere a ogni MF di definire un proprio fallback.
 * - `retryDefault?`: default RetryPolicy globale applicato a tutti i 6 onXError scope
 *   (descriptor.fallback.retry override fine-grained per-phase).
 * - `circuitDefault?`: default CircuitBreakerPolicy globale (descriptor override).
 *   Tipicamente `{enabled: true, failureThreshold: 3, resetAfterMs: 5000}` per
 *   production safety.
 *
 * Defaults applicati al call site:
 * - Tutti i campi `undefined` (no defaults applicati — pure opt-in).
 *
 * @example Setup minimale (defaults — no retry, no circuit, no fallback)
 * ```ts
 * fallbacksModule()
 * ```
 *
 * @example Setup production con retry + circuit globali + html fallback generic
 * ```ts
 * fallbacksModule({
 *   defaultPolicy: {
 *     onLoadError: { type: 'html', html: '<div>App unavailable</div>' },
 *   },
 *   retryDefault: { attempts: 3, delayMs: 100, backoff: 'exponential', jitter: true },
 *   circuitDefault: { enabled: true, failureThreshold: 3, resetAfterMs: 5000 },
 * })
 * ```
 */
export interface FallbacksModuleOptions {
  readonly defaultPolicy?: MicroFrontendFallbackPolicy
  readonly retryDefault?: RetryPolicy
  readonly circuitDefault?: CircuitBreakerPolicy
}

/**
 * Factory `BrokerModule` per `@gluezero/fallbacks` — W1 STUB no-impl.
 *
 * W1 ritorna `BrokerModule` con `install` no-op. W2 P04 sostituisce il body con
 * logica reale (vedi block-level JSDoc top file).
 *
 * @param options Setup-time options 3-opt (defaults: undefined su tutti).
 * @returns Nuovo `BrokerModule` con `install` vuoto W1 (W2 P04 wire reale).
 *
 * @example Install minimale W1 (signature funzionale, body W2)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { fallbacksModule } from '@gluezero/fallbacks'
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), fallbacksModule()],
 * })
 * // W1: install() no-op. W2: SERVICE_FALLBACKS registrato + error subscribe attivo.
 * ```
 */
export function fallbacksModule(
  options: FallbacksModuleOptions = {},
): BrokerModule {
  // Hold reference to options for W2 P04 wiring (unused in stub).
  void options
  return {
    id: 'fallbacks',
    version: '2.0.0-alpha.0',
    install(_ctx): void {
      // W1 STUB: no-op. W2 P04 sostituisce con wire reale:
      //   1. Lookup SERVICE_MICROFRONTENDS (peer required — fail-fast F11 pattern)
      //   2. Idempotent guard SERVICE_FALLBACKS already registered
      //   3. AbortController interno + RetryEngine + CircuitBreaker
      //   4. ctx.registerService(SERVICE_FALLBACKS, service)
      //   5. installErrorSubscribe(broker, ...) — subscribe MF_ERROR_TOPICS pattern
      //   6. AbortSignal cleanup cascade D-V2-16
    },
  }
}
