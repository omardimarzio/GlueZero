// retry-strategy.ts — ExponentialBackoffWithJitter (D-69, ROUTE-09 chiusura PRD §39 #8).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-69: Retry differenziato 4xx/5xx + full jitter (chiusura PRD §39 #8 / ROUTE-09):
//   * Network errors → RETRY
//   * 5xx (500-599) → RETRY rispettando `Retry-After`
//   * 408 Request Timeout → RETRY
//   * 429 Too Many Requests → RETRY rispettando `Retry-After`
//   * Altre 4xx (400, 401, 403, 404, 422, ...) → NO RETRY (errore client)
//   * `maxAttempts: 3` default; `maxAttempts: 0` disabilita retry
// - PRD §23.1: retry policy con backoff + rispetto Retry-After
// - PITFALLS #5: full jitter formula esatta da AWS Architecture Blog:
//   `min(maxDelay, baseDelay * 2^attempt) * (0.5 + Math.random() * 0.5)`
//
// Pattern Strategy DI (D-68): default implementation di RetryStrategy iniettata
// dal RouterBroker plan 03-12 nel HttpGateway.execute() via HttpGatewayStrategies bundle.
//
// Threat coverage:
// - T-03-09-02 (DoS — retry storm thundering herd): full jitter randomization su
//   100 sample produce varianza > 100ms (Test 15) — previene sincronizzazione client.
// - T-03-09-04 (Tampering — retry su 4xx errato): DEFAULT_RETRY_STATUSES = {408, 429}
//   strict + 5xx range esplicito; altri 4xx → return false (no server abuse).

import { MAX_BACKOFF_MS, parseRetryAfter } from '../retry-after-parser'
import type { RetryStrategy } from '../types/http-strategies'

/**
 * Status code 4xx specifici che SONO retriabili (D-69 enforcement esatto).
 * - 408 Request Timeout: il server suggerisce di ritentare.
 * - 429 Too Many Requests: il server suggerisce di rispettare `Retry-After`.
 *
 * Tutti gli altri 4xx (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found,
 * 422 Unprocessable Entity, ...) NON sono retriabili — sono errori client che retry
 * non risolve.
 */
const DEFAULT_RETRY_STATUSES = new Set<number>([408, 429])

const SERVER_ERROR_MIN = 500
const SERVER_ERROR_MAX = 599

/**
 * Verifica se un response status è retriabile in base al policy default D-69.
 *
 * @param status - HTTP response status code
 * @param customRetryOn - Set custom di status code retriabili (override default)
 * @returns `true` se lo status è retriabile, `false` altrimenti.
 */
function isRetriableStatus(
  status: number,
  customRetryOn: ReadonlySet<number> | undefined,
): boolean {
  // Custom override: il caller ha specificato esattamente quali status ritentare.
  if (customRetryOn !== undefined) return customRetryOn.has(status)
  // Default: 408/429 retriabili + 5xx range.
  if (DEFAULT_RETRY_STATUSES.has(status)) return true
  if (status >= SERVER_ERROR_MIN && status <= SERVER_ERROR_MAX) return true
  return false
}

/**
 * Opzioni di configurazione per `createRetryStrategy`.
 *
 * Tutti i campi opzionali con default sensati per V1 SemBridge.
 */
export interface RetryStrategyOptions {
  /**
   * Numero massimo di attempt totali (incluso il primo). Default: 3.
   *
   * - `0` → retry disabilitato (solo first attempt, mai retry).
   * - `1` → solo first attempt.
   * - `n` → first attempt + (n-1) retry max.
   *
   * `Infinity` consentito ma sconsigliato (warning emesso da Inspector F6).
   */
  readonly maxAttempts?: number
  /**
   * Delay di base in millisecondi per il backoff esponenziale. Default: 300.
   *
   * Formula: `min(maxDelayMs, baseDelayMs * 2^attempt) * (0.5 + Math.random() * 0.5)`.
   */
  readonly baseDelayMs?: number
  /**
   * Cap massimo del delay esponenziale in millisecondi. Default: 10000 (10s).
   *
   * Previene crescita illimitata del backoff (Pitfall 2 — retry storm DoS auto-inflitto).
   */
  readonly maxDelayMs?: number
  /**
   * Override esplicito degli status code retriabili. Se presente, sostituisce
   * completamente il default `{408, 429, 500-599}`.
   *
   * Esempio: `[503]` → retry SOLO su 503 (nessun altro). Sconsigliato: rispettare
   * `Retry-After` sui 429 è importante per non bannare il client.
   */
  readonly retryOnStatuses?: readonly number[]
}

/**
 * Crea una `RetryStrategy` con policy `ExponentialBackoffWithJitter` (D-69 default).
 *
 * @example
 * ```ts
 * const retry = createRetryStrategy({ maxAttempts: 3, baseDelayMs: 300, maxDelayMs: 10_000 })
 * if (retry.shouldRetry(response, error, attempt)) {
 *   const delay = retry.delayMs(attempt, response.headers.get('Retry-After'))
 *   await new Promise((r) => setTimeout(r, delay))
 * }
 * ```
 *
 * @param options - Configurazione (vedi `RetryStrategyOptions`).
 * @returns Istanza `RetryStrategy` con `shouldRetry` + `delayMs`.
 */
export function createRetryStrategy(options: RetryStrategyOptions = {}): RetryStrategy {
  const maxAttempts = options.maxAttempts ?? 3
  const baseDelayMs = options.baseDelayMs ?? 300
  const maxDelayMs = options.maxDelayMs ?? 10_000
  const customRetryOn = options.retryOnStatuses ? new Set(options.retryOnStatuses) : undefined

  return {
    shouldRetry(
      response: Response | undefined,
      error: Error | undefined,
      attempt: number,
    ): boolean {
      // Boundary: max attempts raggiunto / retry disabilitato (maxAttempts:0).
      if (attempt >= maxAttempts) return false
      // Network error (fetch throw senza response) → RETRY (D-69).
      if (error !== undefined && response === undefined) return true
      // Response status check (D-69 default policy).
      if (response !== undefined) {
        return isRetriableStatus(response.status, customRetryOn)
      }
      // Caso impossibile (no response, no error) — non retry per safety.
      return false
    },
    delayMs(attempt: number, retryAfterHeader?: string | null): number {
      // D-69: rispetta `Retry-After` se presente (priority over jitter).
      // Cap a MAX_BACKOFF_MS=60s per protezione DoS auto-inflitto (T-03-09-02 ext).
      if (retryAfterHeader) {
        const parsed = parseRetryAfter(retryAfterHeader)
        if (parsed !== undefined) return Math.min(parsed, MAX_BACKOFF_MS)
      }
      // Full jitter formula esatta (Pitfall 2 fix — AWS Architecture Blog):
      // min(maxDelay, baseDelay * 2^attempt) * (0.5 + Math.random() * 0.5)
      const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt)
      const jittered = exponential * (0.5 + Math.random() * 0.5)
      return Math.floor(jittered)
    },
  }
}
