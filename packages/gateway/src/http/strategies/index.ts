/**
 * Barrel `@sembridge/gateway/http/strategies`.
 *
 * Strategy primitives default per il Server Gateway HTTP F3 (D-68 Strategy Pattern).
 * Il `RouterBroker` (plan 03-12) inietta queste strategy nelle `HttpGatewayStrategies`
 * bundle al momento dell'invocazione di `HttpGateway.execute()`.
 *
 * Wave 4 plan ownership (file disgiunta per parallelizzazione safe):
 * - 03-09 (questo plan): retry, timeout, idempotency
 * - 03-10: dedupe, backpressure
 * - 03-11: auth, circuit-breaker
 *
 * Plan 03-10 e 03-11 estenderanno questo file aggiungendo SOLO le proprie righe export
 * — la merge è sicura per file ownership disgiunta (ogni plan tocca solo il proprio scope).
 */

// 03-09 — RetryStrategy (D-69, ROUTE-09 chiusura PRD §39 #8)
export { createRetryStrategy } from './retry-strategy'
export type { RetryStrategyOptions } from './retry-strategy'

// 03-09 — TimeoutStrategy (D-68 default FixedTimeout)
export { createTimeoutStrategy } from './timeout-strategy'
export type { TimeoutStrategyOptions } from './timeout-strategy'

// 03-09 — IdempotencyStrategy (D-70, SEC-03 chiusura, Pitfall 3 fix)
export { createIdempotencyStrategy } from './idempotency-strategy'
export type { IdempotencyStrategyOptions } from './idempotency-strategy'

// 03-10 — DedupeStrategy (D-74, ROUTE-11 chiusura)
export { createDedupeStrategy } from './dedupe-strategy'
export type { DedupeStrategyOptions } from './dedupe-strategy'

// 03-10 — BackpressureStrategy (D-75, ROUTE-10 chiusura, Pitfall 4 fix)
export { createBackpressureStrategy } from './backpressure-strategy'
export type { BackpressureStrategyOptions } from './backpressure-strategy'

// 03-11 — AuthStrategy (D-72, SEC-01/SEC-02/ROUTE-07 chiusura, Pitfall 5 fix)
// Single-flight refresh — N caller paralleli → 1 sola config.refresh invocation
export { createAuthStrategy } from './auth-strategy'
export type { AuthStrategyOptions } from './auth-strategy'

// 03-11 — CircuitBreakerStrategy (D-99 opt-in DISABLED default)
// State machine per-route: closed → open → half-open → closed
export { createCircuitBreakerStrategy } from './circuit-breaker'
export type { CircuitBreakerStrategyOptions } from './circuit-breaker'
