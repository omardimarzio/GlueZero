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
 * @packageDocumentation
 */

// Plan 03-04 popolerà i type re-export: HttpGatewayConfig (./types/gateway-config),
//             HttpStrategies (./types/http-strategies), HttpErrorCode (./types/http-error).
// Plan 03-08+ popolerà i runtime export: HttpGateway, policyChain, urlAllowlist,
//             retryAfterParser, e le 7 Strategy default implementations.

export {}
