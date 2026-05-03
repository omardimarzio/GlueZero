// http-strategies.ts — Strategy interfaces pluggable per il Server Gateway HTTP F3
// (PRD §17.8, §18, §23, §26, REQ ROUTE-08..ROUTE-13, SEC-01..SEC-03, D-68..D-75/D-99).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-68: Strategy Pattern per ogni policy (ARCHITECTURE.md §2.5). Ogni interface ha
//         una default implementation (`ExponentialBackoffWithJitter`, `FixedTimeout`,
//         `KeyBased`, `LatestOnly`, `BearerHook`, `AutoIdempotency`, ecc.) implementata
//         nei plan 03-08..03-12 e uno slot per custom override via `GatewayConfig`.
// - D-69: Retry differenziato 4xx/5xx + full jitter (chiusura PRD §39 #8 / ROUTE-09).
//         La `RetryStrategy` ritorna `shouldRetry` e calcola `delayMs` con full jitter.
// - D-70: Idempotency auto-key via nanoid (SEC-03). La `IdempotencyStrategy.generate`
//         persiste la stessa chiave sui retry (chiave = `BrokerEvent.id` originario).
// - D-72: AuthStrategy + Single-flight refresh (PITFALLS #5).
// - D-74: DedupeStrategy con Promise singleton condiviso (RESEARCH "Code Examples").
// - D-75: BackpressureStrategy priority-aware (PITFALLS #4: `'critical'` bypassa).
// - D-99: CircuitBreakerStrategy per-route con state machine `closed → open → half-open`.
// - Pattern: analogo `ValidatorAdapter` di F2 (validator-adapter.ts).
//
// Vincolo `exactOptionalPropertyTypes: true`: tutti i campi opzionali sono
// `readonly X?: T` (mai `readonly X: T | undefined`).

import type { BrokerError, BrokerEvent } from '@sembridge/core'
import type { RouteDefinition } from '@sembridge/routing'

/**
 * Spec di una HTTP request prodotta dal gateway prima del fetch.
 *
 * - `headers` è mutabile per design — i middleware (auth, idempotency) ne aggiungono
 *   entry durante la chain (Pattern Koa-compose).
 * - `body` è opzionale — assente per `GET`/`HEAD` (e simili).
 */
export interface HttpRequestSpec {
  readonly method: string
  readonly url: string
  readonly headers: Record<string, string>
  readonly body?: BodyInit
}

/**
 * Spec di una HTTP response normalizzata (post-parsing) usata dai middleware
 * downstream del gateway.
 */
export interface HttpResponseSpec {
  readonly ok: boolean
  readonly status: number
  readonly headers: Record<string, string>
  readonly body: unknown
}

/**
 * Contesto mutabile passato attraverso la policy chain del gateway (RESEARCH lines
 * 537-548 / Pattern Koa-compose).
 *
 * Ogni middleware può leggere/scrivere campi del context. La chain è invocata via
 * `GatewayMiddleware`. I campi opzionali popolati dai middleware:
 * - `response` — popolato dal `fetcher` middleware (terminale).
 * - `parsedBody` — popolato dal `response-parser` middleware.
 * - `canonicalResponse` — popolato dal `mapper` middleware (server → canonical).
 * - `error` — popolato dal middleware che fail (es. `retry-strategy` quando exhausted).
 */
export interface GatewayContext {
  readonly request: HttpRequestSpec
  readonly route: RouteDefinition
  readonly event: BrokerEvent
  readonly signal: AbortSignal
  attempt: number
  response?: Response
  parsedBody?: unknown
  canonicalResponse?: unknown
  error?: BrokerError
}

/**
 * Middleware Koa-compose-style per la policy chain del gateway (D-68).
 *
 * Ogni middleware:
 * 1. Pre-process (es. inject header).
 * 2. `await next()` per delegare alla chain downstream.
 * 3. Post-process (es. parse response, recordSuccess su circuit breaker).
 *
 * Pattern composto da `policy-chain.ts` (plan 03-08).
 */
export type GatewayMiddleware = (ctx: GatewayContext, next: () => Promise<void>) => Promise<void>

/**
 * RetryStrategy (D-69, ROUTE-09, chiusura PRD §39 #8).
 *
 * - `shouldRetry` — decide se ritentare in base a `Response`/`Error` e attempt.
 * - `delayMs` — calcola il delay del prossimo attempt (backoff + full jitter +
 *   `Retry-After` se presente).
 *
 * Default implementation `ExponentialBackoffWithJitter` (plan 03-09):
 * `min(maxDelayMs, baseDelayMs * 2^attempt) * (0.5 + Math.random() * 0.5)`.
 */
export interface RetryStrategy {
  shouldRetry(response: Response | undefined, error: Error | undefined, attempt: number): boolean
  delayMs(attempt: number, retryAfterHeader?: string | null): number
}

/**
 * TimeoutStrategy (D-68).
 *
 * Wrapper su `AbortSignal.timeout()` (RESEARCH §"Don't Hand-Roll"). Default
 * `FixedTimeout` con valore configurato in `RoutePolicies.timeout` o
 * `GatewayConfig.defaults.timeout` (default 30000 ms).
 */
export interface TimeoutStrategy {
  signal(timeoutMs: number): AbortSignal
}

/**
 * DedupeStrategy (D-74, ROUTE-11).
 *
 * Implementazione default `KeyBased`: `Map<key, Promise<T>>`. Due fetch con stessa
 * `key` collassano in una sola network call; entrambi i caller ricevono la stessa
 * Promise. `clear()` invocato al cascade unregister (D-86).
 */
export interface DedupeStrategy {
  execute<T>(key: string, fn: () => Promise<T>): Promise<T>
  size(): number
  clear(): void
}

/**
 * BackpressureStrategy (D-75, ROUTE-10, PITFALLS #4).
 *
 * Priority-aware: eventi `priority: 'critical'` BYPASSANO la policy (consegna
 * immediata). `schedule` accoda/throttle/drop/debounce in base alla policy della
 * route; `queueLength` per assertion test e Inspector.
 */
export interface BackpressureStrategy {
  schedule<T>(
    routeId: string,
    priority: 'critical' | 'high' | 'normal' | 'low',
    task: () => Promise<T>,
  ): Promise<T>
  queueLength(routeId: string): number
}

/**
 * AuthStrategy (D-72, SEC-01/SEC-02).
 *
 * - `getToken` — invocato prima di ogni fetch (cache opzionale via tokenCacheMs).
 * - `refresh` — Single-flight: una sola Promise concorrente; tutte le N fetch
 *   parallele su 401 coordinano sulla stessa.
 * - `isInflightRefresh` — flag per Inspector e per skip refresh ricorsivo.
 */
export interface AuthStrategy {
  getToken(): Promise<string | undefined>
  refresh?(): Promise<string>
  isInflightRefresh(): boolean
}

/**
 * IdempotencyStrategy (D-70, SEC-03).
 *
 * - `generate(eventId)` — produce la chiave idempotency. Se già generata per lo stesso
 *   `eventId` (es. retry attempt N>1), ritorna la chiave precedente — invariante
 *   richiesto da SEC-03.
 * - `headerName()` — ritorna il nome dell'header (default `'Idempotency-Key'`,
 *   override via `IdempotencyPolicyConfig.headerName`).
 */
export interface IdempotencyStrategy {
  generate(eventId: string): string
  headerName(): string
}

/**
 * CircuitBreakerStrategy (D-99).
 *
 * State machine per-route: `closed → open → half-open`. Quando in stato `open`,
 * `canExecute` ritorna `false` → fail-fast publish `<topic>.failed` con
 * `code: 'circuit.open'` (NO fetch).
 *
 * - `canExecute` — guard pre-fetch.
 * - `recordSuccess` / `recordFailure` — invocati dal middleware di terminazione
 *   per aggiornare lo state machine.
 * - `getState` — esposto per Inspector debug e test assertion.
 */
export interface CircuitBreakerStrategy {
  canExecute(routeId: string): boolean
  recordSuccess(routeId: string): void
  recordFailure(routeId: string): void
  getState(routeId: string): 'closed' | 'open' | 'half-open'
}
