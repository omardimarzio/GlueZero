// http-error.ts — Literal union dei codici errore HTTP Gateway F3 (D-80, D-87, REQ
// ERR-02 ext, ROUTE-09, ROUTE-12).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-80: i 9 codici emessi via `BrokerEvent <topic>.failed` con shape estesa
//         (httpStatus/retryAttempt/retryAfterMs). Cluster `gateway.*` (network/timeout/
//         4xx/5xx/url.forbidden), `response.validation.failed` (mapping fail VAL-05),
//         `route.required.missing` (ROUTE-16), `auth.expired` (SEC-02), `circuit.open`
//         (D-99).
// - D-87: aggiunta `route.id.duplicate` per `unregisterRoute` strict mode + cache stub.
// - Pattern: identico a `MappingErrorCode` di F2 (mapping-error.ts) — literal union
//   additive + type guard runtime set-based.
//
// Threat coverage:
// - T-02-02-05 (Repudiation — codici aggiunti senza version bump): la literal union è
//   additive (aggiungere codici è non-breaking; rimuoverli sì). Documentazione DOC-04
//   al plan 03-14 specifica policy.

/**
 * Literal union dei codici errore HTTP Gateway F3 (D-80, D-87).
 *
 * Categoria di errore associata (per `BrokerError.category` in plan 03-09+):
 *
 * | Code | Category | Quando | Retry-eligibility (D-69) |
 * |------|----------|--------|--------------------------|
 * | `gateway.timeout` | `network` | Fetch > timeout (AbortSignal.timeout) | RETRY (5xx-equivalent) |
 * | `gateway.4xx` | `network` | Status 400-499 (escluso 408/429) | NO RETRY |
 * | `gateway.5xx` | `network` | Status 500-599 (post retry exhausted) | RETRY (durante retry chain) |
 * | `gateway.network` | `network` | Fetch throw (DNS/CORS/offline) | RETRY |
 * | `gateway.url.forbidden` | `config` | URL non in allowlist (SEC-05) | NO RETRY |
 * | `response.validation.failed` | `validation` | Valibot fail su canonical schema (VAL-05) | NO RETRY |
 * | `route.required.missing` | `config` | Topic richiede route ma nessuna registrata (ROUTE-16) | NO RETRY |
 * | `auth.expired` | `config` | Token refresh fallito o ritorna stesso token | NO RETRY |
 * | `circuit.open` | `network` | Circuit breaker open per route (D-99) | NO RETRY (fail-fast) |
 * | `cache.not-implemented` | `config` | Cache adapter F6 non ancora disponibile | NO RETRY |
 * | `route.id.duplicate` | `config` | `registerRoute` strict + id già registrato | NO RETRY |
 *
 * Tutti pubblicati via `BrokerEvent <topic>.failed` (D-80) con `BrokerError` arricchito
 * (httpStatus/retryAttempt/retryAfterMs/originalError/cause).
 */
export type GatewayErrorCode =
  | 'gateway.timeout'
  | 'gateway.4xx'
  | 'gateway.5xx'
  | 'gateway.network'
  | 'gateway.url.forbidden'
  | 'response.validation.failed'
  | 'route.required.missing'
  | 'auth.expired'
  | 'circuit.open'
  | 'cache.not-implemented'
  | 'route.id.duplicate'

const GATEWAY_ERROR_CODES: ReadonlySet<string> = new Set<GatewayErrorCode>([
  'gateway.timeout',
  'gateway.4xx',
  'gateway.5xx',
  'gateway.network',
  'gateway.url.forbidden',
  'response.validation.failed',
  'route.required.missing',
  'auth.expired',
  'circuit.open',
  'cache.not-implemented',
  'route.id.duplicate',
])

/**
 * Type guard runtime per `GatewayErrorCode`.
 *
 * Pattern identico a `isMappingErrorCode` di F2. Utile per branchare comportamento
 * basato su `error.code` quando si subscribe a `<topic>.failed`.
 *
 * @example
 * ```ts
 * broker.subscribe('weather.failed', (event) => {
 *   const code = event.payload.error.code
 *   if (isGatewayErrorCode(code)) {
 *     // safe narrow: code is GatewayErrorCode
 *     if (code === 'gateway.timeout') { ... }
 *   }
 * })
 * ```
 */
export function isGatewayErrorCode(code: string): code is GatewayErrorCode {
  return GATEWAY_ERROR_CODES.has(code)
}
