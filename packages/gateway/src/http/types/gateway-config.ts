// GatewayConfig — configurazione del Server Gateway HTTP centralizzato F3 (PRD §18,
// §26, §27, REQ SEC-01..SEC-05, D-71/D-72/D-99).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-62: declaration merging in `BrokerConfig.gateway?` da plan 03-04 (`augment.ts`).
// - D-71: URL allowlist obbligatoria (SEC-05) — `string` (prefix match) o `RegExp`
//         (pattern match). Default `undefined` → tutti URL consentiti + warning dev.
// - D-72: Auth Bearer + token refresh (SEC-01/SEC-02). Single-flight refresh evita
//         loop infiniti su 401 cluster (PITFALLS #5 / RESEARCH §"Pattern 5").
// - D-99: Circuit breaker per-route opt-in (DISABILITATO di default per V1). Threshold
//         + cooldown configurabili.
//
// Vincolo `exactOptionalPropertyTypes: true`: tutti i campi opzionali sono
// `readonly X?: T` (mai `readonly X: T | undefined`).
//
// Threat coverage:
// - T-03-02-03 (Authorization header IDB exposure): `headers: Record<string,string>`
//   accetta qualsiasi shape; sanitizzazione al log/Inspector è plan F6.
// - T-03-02-04 (Allowlist bypass via redirect): `redirect: 'manual'` + re-validation
//   è responsabilità del plan 03-15 (URL allowlist runtime).

import type {
  BackpressurePolicyConfig,
  DedupePolicyConfig,
  IdempotencyPolicyConfig,
  RetryPolicyConfig,
} from '@gluezero/routing'

/**
 * Entry singolo della URL allowlist (D-71, SEC-05).
 *
 * - `string` — prefix match con `String.startsWith` o equality (es.
 *   `'https://api.example.com'` matcha qualsiasi sub-path).
 * - `RegExp` — pattern match completo via `regex.test(url)`.
 *
 * @example
 * ```ts
 * const allowlist: ReadonlyArray<AllowlistEntry> = [
 *   'https://api.example.com',
 *   /^https:\/\/cdn-[a-z0-9]+\.example\.com\//,
 * ]
 * ```
 */
export type AllowlistEntry = string | RegExp

/**
 * Configurazione dell'auth strategy per il gateway (D-72, SEC-01/SEC-02).
 *
 * - `getToken` — chiamato prima di ogni fetch; ritorna `undefined` per skip
 *   l'`Authorization` header (es. endpoint pubblici della stessa origine).
 * - `refresh` — Single-flight (vedi RESEARCH §Pattern 5) — chiamato UNA volta su 401,
 *   le N fetch parallele coordinano sulla stessa Promise di refresh per evitare retry
 *   storm. Se omesso, il gateway propaga 401 senza retry e publica `auth.expired`.
 * - `tokenCacheMs` — cache la stessa chiamata `getToken` per N ms (default `0` = no
 *   cache, ogni fetch invoca `getToken`).
 *
 * @example
 * ```ts
 * const auth: AuthStrategyConfig = {
 *   getToken: async () => storage.get('jwt') ?? undefined,
 *   refresh: async () => fetch('/auth/refresh').then((r) => r.text()),
 *   tokenCacheMs: 30_000,
 * }
 * ```
 */
export interface AuthStrategyConfig {
  readonly getToken: () => Promise<string | undefined>
  readonly refresh?: () => Promise<string>
  readonly tokenCacheMs?: number
}

/**
 * Configurazione dei default applicati a TUTTE le route HTTP che non li overridano
 * via `RoutePolicies`.
 *
 * Permette al consumer di centralizzare i timeout/retry/idempotency/dedupe/backpressure
 * comuni in un singolo punto, mantenendo la possibilità di override per route specifica.
 */
export interface DefaultsConfig {
  readonly timeout?: number
  readonly retry?: RetryPolicyConfig
  readonly idempotency?: IdempotencyPolicyConfig
  readonly dedupe?: DedupePolicyConfig
  readonly backpressure?: BackpressurePolicyConfig
}

/**
 * Configurazione del circuit breaker per-route (D-99).
 *
 * - `threshold` — numero di fail consecutivi prima dell'open (default `5`).
 * - `cooldownMs` — ms in stato `open` prima del passaggio a `half-open` (default `30000`).
 * - `halfOpenMaxRequests` — request consentite in `half-open` per testare il recovery
 *   (default `1`).
 *
 * Default `circuitBreaker: false` → DISABILITATO. V1 implementa solo il counter base;
 * sliding window stats arrivano in V1.x.
 */
export interface CircuitBreakerConfig {
  readonly threshold: number
  readonly cooldownMs: number
  readonly halfOpenMaxRequests?: number
}

/**
 * Configurazione del Server Gateway HTTP (D-62, D-71, D-72, D-99).
 *
 * Tutti i campi opzionali — il gateway applica i default documentati in ogni
 * sub-tipo. Si dichiara nel `BrokerConfig.gateway` (declaration merging in plan 03-04).
 *
 * @example
 * ```ts
 * const config: GatewayConfig = {
 *   auth: { getToken: () => Promise.resolve('jwt-token') },
 *   allowlist: ['https://api.example.com'],
 *   defaults: { timeout: 5000, retry: { maxAttempts: 3 } },
 *   circuitBreaker: { threshold: 5, cooldownMs: 30000 },
 * }
 * ```
 */
export interface GatewayConfig {
  readonly auth?: AuthStrategyConfig
  readonly allowlist?: readonly AllowlistEntry[]
  readonly defaults?: DefaultsConfig
  /** `false` esplicito disabilita il circuit breaker (default). */
  readonly circuitBreaker?: CircuitBreakerConfig | false
}
