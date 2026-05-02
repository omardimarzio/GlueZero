// timeout-strategy.ts — FixedTimeout (D-68 default TimeoutStrategy).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-68: Strategy Pattern per ogni policy (ARCHITECTURE.md §2.5). Default
//   `FixedTimeout` con valore configurato in `RoutePolicies.timeout` o
//   `GatewayConfig.defaults.timeout` (default 30000 ms).
// - D-76: AbortController per ogni request HTTP in volo. La timeout strategy
//   ritorna l'AbortSignal che il `combineSignals` (plan 03-08) coordina con
//   external + own controller.
//
// Implementazione: wrapper su `AbortSignal.timeout()` nativo (ES2022 — Chrome 103+,
// Node 17+, Firefox 100+, Safari 15.4+). RESEARCH §"Don't Hand-Roll":
// `AbortSignal.timeout()` è già la primitive idiomatica — wrapper Strategy permette
// swap futuro per polyfill custom o timeout dinamico per route senza modificare
// HttpGateway.

import type { TimeoutStrategy } from '../types/http-strategies'

/**
 * Opzioni di configurazione per `createTimeoutStrategy`.
 */
export interface TimeoutStrategyOptions {
  /**
   * Override della factory `signal(ms) → AbortSignal`. Default
   * `(ms) => AbortSignal.timeout(ms)`.
   *
   * Override usato per:
   * - Test determinismo (es. fake timer)
   * - Polyfill custom su environment legacy senza ES2022
   * - Logging/instrumentation (proxy che notifica al timeout scattato)
   */
  readonly fromMs?: (ms: number) => AbortSignal
}

/**
 * Crea una `TimeoutStrategy` con policy `FixedTimeout` (D-68 default).
 *
 * Wrapper minimale su `AbortSignal.timeout()` ES2022 nativo. Il valore `timeoutMs`
 * passato a `signal(timeoutMs)` viene usato 1:1 — nessuna trasformazione.
 *
 * @example
 * ```ts
 * const timeout = createTimeoutStrategy()
 * const signal = timeout.signal(5000)  // abort dopo 5s
 * await fetch(url, { signal })
 * ```
 *
 * @param options - Configurazione opzionale (vedi `TimeoutStrategyOptions`).
 * @returns Istanza `TimeoutStrategy` con `signal(timeoutMs)`.
 */
export function createTimeoutStrategy(
  options: TimeoutStrategyOptions = {},
): TimeoutStrategy {
  const factory = options.fromMs ?? ((ms: number): AbortSignal => AbortSignal.timeout(ms))
  return {
    signal(timeoutMs: number): AbortSignal {
      return factory(timeoutMs)
    },
  }
}
