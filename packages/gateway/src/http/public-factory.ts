// public-factory.ts — `createHttpGateway(config)` API pubblica del @sembridge/gateway/http
// (PRD §18, §27, REQ SEC-01..SEC-05, decisioni D-71/D-72/D-99).
//
// Pattern affine a `createMapperBroker` di F2 (`packages/mapper/src/public-factory.ts`):
// factory pure function che valida la config via Valibot e ritorna una nuova istanza
// `HttpGateway`. La validazione struttuale di `auth.getToken` (function), `allowlist`
// (array di string|RegExp), `defaults` (timeout/retry/idempotency/dedupe/backpressure),
// `circuitBreaker` (false | { threshold, cooldownMs, halfOpenMaxRequests? }) avviene QUI.
//
// `safeParse` ritorna `{ success: true, output }` o `{ success: false, issues }`.
// Su fail aggreghiamo le issue messages in un singolo `Error` con prefisso "Invalid
// GatewayConfig" — pattern coerente con createBroker (F1) / createMapperBroker (F2).
//
// D-30 (no singleton): la factory è pure function — ogni call costruisce un nuovo
// `new HttpGateway(config)`.
//
// Threat coverage:
// - T-03-08-05 (Information disclosure — error messages contengono PII): accept;
//   F3 V1 best-effort. Redaction in DOC-04 al plan 03-14.

import * as v from 'valibot'
import { HttpGateway } from './http-gateway'
import type { GatewayConfig } from './types/gateway-config'

// Schema per AuthStrategyConfig (D-72).
const AuthStrategyConfigSchema = v.object({
  getToken: v.function(),
  refresh: v.optional(v.function()),
  tokenCacheMs: v.optional(v.number()),
})

// Schema per CircuitBreakerConfig (D-99).
const CircuitBreakerConfigSchema = v.object({
  threshold: v.number(),
  cooldownMs: v.number(),
  halfOpenMaxRequests: v.optional(v.number()),
})

// Schema completo GatewayConfig (sezioni opzionali, looseObject preserve future fields).
const GatewayConfigSchema = v.looseObject({
  auth: v.optional(AuthStrategyConfigSchema),
  // allowlist: array di string | RegExp (D-71)
  allowlist: v.optional(v.array(v.union([v.string(), v.instance(RegExp)]))),
  // defaults: oggetto generico, valida alla deep level via tipi TS — qui pass-through
  // strutturale per non duplicare le RoutePolicies definitions (definite in @sembridge/routing).
  defaults: v.optional(v.unknown()),
  // circuitBreaker: false | object (D-99)
  circuitBreaker: v.optional(v.union([v.literal(false), CircuitBreakerConfigSchema])),
})

/**
 * Crea una nuova istanza {@link HttpGateway} con la configurazione fornita.
 *
 * La config è validata via Valibot al confine pubblico del package (D-71/D-72/D-99
 * shape strutturale). Su validation fail throw `Error('Invalid GatewayConfig: ...')`.
 *
 * No singleton (D-30): ogni call ritorna un'istanza indipendente.
 *
 * @param config - Configurazione opzionale del gateway (default: empty object).
 * @returns Una nuova istanza {@link HttpGateway}.
 * @throws {Error} `Invalid GatewayConfig: ...` se la validation Valibot fallisce.
 *
 * @example
 * ```ts
 * import { createHttpGateway } from '@sembridge/gateway/http'
 *
 * const gateway = createHttpGateway({
 *   allowlist: ['https://api.example.com', /^https:\/\/cdn-[a-z]+\.example\.com\//],
 *   auth: {
 *     getToken: async () => storage.get('jwt') ?? undefined,
 *     refresh: async () => fetch('/auth/refresh').then((r) => r.text()),
 *     tokenCacheMs: 30_000,
 *   },
 *   defaults: { timeout: 5000 },
 *   circuitBreaker: { threshold: 5, cooldownMs: 30_000 },
 * })
 * ```
 */
export function createHttpGateway(config: GatewayConfig = {}): HttpGateway {
  const parsed = v.safeParse(GatewayConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid GatewayConfig: ${messages}`)
  }
  return new HttpGateway(config)
}
