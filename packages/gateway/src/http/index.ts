/**
 * `@sembridge/gateway/http` — Subpath HTTP Gateway centralizzato.
 *
 * Phase 3 di SemBridge V1. Espone:
 * - **`HttpGateway`** — entry centralizzato che applica una **policy chain** di
 *   middleware uniforme a tutte le richieste fetch generate dalle route HTTP del
 *   `RouteExecutor` di `@sembridge/routing`.
 * - **7 Strategy primitives** (Strategy Pattern, D-68):
 *   - `RetryStrategy` — default `ExponentialBackoffWithJitter`, retry 5xx/408/429
 *     + network error, NO retry su altre 4xx (D-69 / ROUTE-09 / chiusura PRD §39 #8)
 *   - `TimeoutStrategy` — default `FixedTimeout` 30000 ms via `AbortSignal.timeout()`
 *   - `DedupeStrategy` — default `KeyBased` su `dedupeKey`, fallback
 *     `'route-id+queryParams'` (ROUTE-11)
 *   - `BackpressureStrategy` — default `LatestOnly`; queue/drop/throttle/debounce
 *     supportati (ROUTE-10)
 *   - `AuthStrategy` — default `BearerHook` con `getToken()` + single-flight
 *     `refresh` su 401 (D-72 / SEC-01 / SEC-02)
 *   - `IdempotencyStrategy` — auto `Idempotency-Key` (nanoid) su POST/PATCH/PUT/DELETE
 *     riusato sui retry (D-70 / SEC-03)
 *   - `CircuitBreakerStrategy` — per-route fail counter + cooldown, opt-in
 * - **URL allowlist** (D-71 / SEC-05) — guard pre-fetch che blocca URL non in
 *   `gateway.allowlist` con `BrokerError` `gateway.url.forbidden`.
 * - **Retry-After parser** — gestione header `Retry-After` (delta-seconds + HTTP-date).
 *
 * Bundle budget: 8 KB gzip (subpath dedicato). Vedi `package.json` size-limit root.
 *
 * Vincolo D-83: zero modifiche a `@sembridge/core` runtime e `@sembridge/mapper`
 * runtime. Composition wrapper invocato dal `RouteExecutor` di `@sembridge/routing`.
 *
 * Documentazione: `prd.md` §18, §23, §26. Vedi anche
 * `.planning/phases/03-routing-server-gateway-http/03-RESEARCH.md` per dettaglio
 * pattern e tradeoff.
 *
 * Plan 03-04 popola questo barrel con i type re-export: GatewayConfig (auth/allowlist/
 * defaults/circuitBreaker — D-71/D-72/D-99), 7 Strategy interfaces (D-68), GatewayContext
 * + GatewayMiddleware (Koa-compose), HttpRequestSpec/HttpResponseSpec (request/response
 * spec), GatewayErrorCode literal union (D-80) + isGatewayErrorCode runtime type guard.
 *
 * Plan 03-08+ popolerà i runtime export: `HttpGateway`, `createHttpGateway` factory,
 * `policyChain` compose helper, `urlAllowlist` guard, `retryAfterParser` util, e le
 * 7 Strategy default implementations (`ExponentialBackoffWithJitter`, `FixedTimeout`,
 * `KeyBased`, `LatestOnly`, `BearerHook`, `AutoIdempotency`, ecc.).
 *
 * @packageDocumentation
 */

// ---------- Type re-export: GatewayConfig + sub-types (D-71/D-72/D-99) ----------

export type {
  /** Entry singolo della URL allowlist — string (prefix match) o RegExp (pattern match). D-71/SEC-05. */
  AllowlistEntry,
  /** Configurazione auth strategy (getToken + refresh single-flight + tokenCacheMs). D-72/SEC-01/SEC-02. */
  AuthStrategyConfig,
  /** Configurazione circuit breaker per-route (threshold + cooldownMs + halfOpenMaxRequests). D-99. */
  CircuitBreakerConfig,
  /** Default applicati a tutte le route HTTP che non li overridano via RoutePolicies. */
  DefaultsConfig,
  /** Configurazione del Server Gateway HTTP — root config dichiarata in BrokerConfig.gateway. */
  GatewayConfig,
} from './types/gateway-config'

// ---------- Type re-export: Strategy interfaces (D-68 — 7 Strategy + middleware shape) ----------

export type {
  /** AuthStrategy (D-72, SEC-01/SEC-02): getToken + refresh single-flight + isInflightRefresh flag. */
  AuthStrategy,
  /** BackpressureStrategy (D-75, ROUTE-10, PITFALLS #4): priority-aware schedule + queueLength. */
  BackpressureStrategy,
  /** CircuitBreakerStrategy (D-99): canExecute/recordSuccess/recordFailure + getState (closed/open/half-open). */
  CircuitBreakerStrategy,
  /** DedupeStrategy (D-74, ROUTE-11): KeyBased Promise singleton — execute/size/clear. */
  DedupeStrategy,
  /** GatewayContext: contesto mutabile passato attraverso la policy chain (Koa-compose). */
  GatewayContext,
  /** GatewayMiddleware (D-68): Koa-compose middleware (ctx, next) → Promise<void>. */
  GatewayMiddleware,
  /** Spec HTTP request prodotta dal gateway prima del fetch (method/url/headers/body). */
  HttpRequestSpec,
  /** Spec HTTP response normalizzata post-parsing (ok/status/headers/body). */
  HttpResponseSpec,
  /** IdempotencyStrategy (D-70, SEC-03): auto Idempotency-Key via nanoid + headerName. */
  IdempotencyStrategy,
  /** RetryStrategy (D-69, ROUTE-09, chiusura PRD §39 #8): shouldRetry + delayMs (backoff + jitter). */
  RetryStrategy,
  /** TimeoutStrategy (D-68): wrapper su AbortSignal.timeout() — signal(timeoutMs). */
  TimeoutStrategy,
} from './types/http-strategies'

// ---------- Type re-export: GatewayErrorCode literal union (D-80) ----------

export type {
  /** Literal union degli 11 codici errore HTTP Gateway F3 (D-80, D-87) — gateway.timeout/4xx/5xx/network/url.forbidden, response.validation.failed, route.required.missing, auth.expired, circuit.open, cache.not-implemented, route.id.duplicate. */
  GatewayErrorCode,
} from './types/http-error'

// ---------- Runtime export: type guard (pattern identico isMappingErrorCode F2) ----------

/** Runtime type guard set-based per `GatewayErrorCode` (D-80) — narrow `string → GatewayErrorCode`. */
export { isGatewayErrorCode } from './types/http-error'
