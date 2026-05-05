// public-factory.ts — `createCacheBroker(config)` API pubblica del package
// `@gluezero/cache` (PRD §20, REQ CACHE-01..03, decisione D-30 no singleton).
//
// Estende il pattern di `createRouterBroker` (F3 plan 03-12), `createRealtimeBroker`
// (F4 plan 04-08) e `createWorkerBroker` (F5 plan 05-06): factory pure function
// che valida la config via Valibot e ritorna una nuova istanza `CacheBroker`. La
// validazione delle sezioni F6 (`cache`, `cacheRoutes`) avviene QUI (al confine
// pubblico del package); le sezioni F1-F5 (runtime, debug, canonicalModel,
// aliasRegistry, transforms, routes, gateway, routing, realtime, workers,
// workerRoutes) passano via `looseObject` — sono validate downstream dal
// `createRouterBroker` interno (D-56 validation at boundary).
//
// Differenza vs `createWorkerBroker` (F5):
// - F5 valida `workers.{assertSerializable,...}` + `workerRoutes[]`
// - F6 (qui) valida `cache.{maxEntries,adapter,scopeProvider}` + `cacheRoutes[].{
//   type,id,topic,strategy,ttl,...}`
// - Su fail: `Error` nativo con prefisso `Invalid CacheBrokerConfig:` (pattern
//   F1/F2/F3/F4/F5)
//
// `safeParse` ritorna `{ success: true, output }` o `{ success: false, issues }`.
// Su fallimento aggreghiamo le issue messages in un singolo `Error` — il consumer
// riconosce la stringa per gestione UX (test pattern `/Invalid CacheBrokerConfig/`).
//
// D-30 (no singleton): la factory è una pure function — ogni call costruisce un
// nuovo `new CacheBroker(config)`. Multi-tenant scenario è desired (T-06-08a-X
// accept).
//
// Threat coverage:
// - T-06-08a-X (Tampering — config.cache/cacheRoutes con shape invalida):
//   mitigate. Valibot safeParse al confine pubblico. Invalid → throw `Invalid
//   CacheBrokerConfig: ...`.

import * as v from 'valibot'
import { CacheBroker, type CacheBrokerConfig } from './cache-broker'

// Schema `CacheConfig` (D-155/D-156/D-158). `maxEntries` >= 1; `adapter` e
// `scopeProvider` pass-through `unknown` (typecheck già al constructor).
const CacheConfigSchema = v.optional(
  v.looseObject({
    maxEntries: v.optional(v.pipe(v.number(), v.minValue(1))),
    adapter: v.optional(v.unknown()),
    scopeProvider: v.optional(v.unknown()),
  }),
)

// Schema `CacheBrokerRouteDefinition` (subset di RouteCacheDefinition F3).
// `type: 'cache'` literal discriminator; `strategy` picklist 3-way; `ttl` >= 0.
const CacheBrokerRouteDefinitionSchema = v.looseObject({
  type: v.literal('cache'),
  id: v.pipe(v.string(), v.minLength(1)),
  topic: v.pipe(v.string(), v.minLength(1)),
  strategy: v.picklist(['cache-first', 'network-first', 'cache-then-network']),
  ttl: v.optional(v.pipe(v.number(), v.minValue(0))),
  key: v.optional(v.unknown()),
  scope: v.optional(v.unknown()),
  auth: v.optional(v.boolean()),
})

// Schema completo `CacheBrokerConfig` — preserve sezioni F1-F5 inherited via
// `looseObject` (validation delegata al `createRouterBroker` interno chiamato dal
// `CacheBroker` constructor).
const CacheBrokerConfigSchema = v.looseObject({
  // Sezioni F1 (pass-through — F1 BrokerConfigSchema valida internamente).
  runtime: v.optional(v.unknown()),
  debug: v.optional(v.unknown()),
  topicSchemas: v.optional(v.unknown()),
  // Sezioni F2 (D-56 — pass-through).
  canonicalModel: v.optional(v.unknown()),
  aliasRegistry: v.optional(v.unknown()),
  transforms: v.optional(v.unknown()),
  // Sezioni F3 (D-93/D-100) — pass-through; `createRouterBroker` valida.
  routes: v.optional(v.unknown()),
  gateway: v.optional(v.unknown()),
  routing: v.optional(v.unknown()),
  // Sezione F4 (D-102, D-103) — pass-through (delegato a F4 createRealtimeBroker
  // se l'utente compone esplicitamente).
  realtime: v.optional(v.unknown()),
  // Sezione F5 (D-122) — pass-through (delegato a F5 createWorkerBroker se
  // l'utente compone esplicitamente).
  workers: v.optional(v.unknown()),
  workerRoutes: v.optional(v.unknown()),
  // Sezione F6 (D-155/D-156/D-158) — validate strutturalmente.
  cache: CacheConfigSchema,
  cacheRoutes: v.optional(v.array(CacheBrokerRouteDefinitionSchema)),
})

/**
 * Crea una nuova istanza {@link CacheBroker} con la config data.
 *
 * Estende {@link createWorkerBroker} (F5) con validation della sezione F6
 * (`cache`, `cacheRoutes`). Il wrapper restante (sezioni F1-F5) passa
 * attraverso `v.looseObject` — la validation dettagliata avviene downstream nel
 * `createRouterBroker` interno (D-56 validation at boundary).
 *
 * **No singleton (D-30):** ogni call ritorna istanza indipendente. Si possono
 * creare N broker su istanza pagina (multi-tenant isolation, test isolation).
 *
 * @param config - Optional broker configuration (default: empty object).
 * @returns A fresh {@link CacheBroker} instance.
 * @throws {Error} `Invalid CacheBrokerConfig: <issues>` se Valibot validation
 *   fallisce.
 *
 * @example Quick start (config-driven cacheRoutes + maxEntries override)
 * ```ts
 * import { createCacheBroker } from '@gluezero/cache'
 *
 * const broker = createCacheBroker({
 *   cache: { maxEntries: 500 },
 *   cacheRoutes: [
 *     { type: 'cache', id: 'r1', topic: 'weather.requested',
 *       strategy: 'cache-first', ttl: 60_000 },
 *   ],
 * })
 * await broker.publish('weather.requested', { city: 'Roma' })
 * ```
 *
 * @example Multi-tenant isolation (D-30 anti-singleton)
 * ```ts
 * // Two independent broker instances on the same page (no shared state):
 * const tenantA = createCacheBroker({ cache: { maxEntries: 100 }})
 * const tenantB = createCacheBroker({ cache: { maxEntries: 1000 }})
 * // tenantA !== tenantB — separate MemoryCacheAdapter, RouterBroker
 * ```
 *
 * @throws {Error} `Invalid CacheBrokerConfig: <issues>` se Valibot fallisce.
 *
 * @see {@link CacheBroker}
 * @see {@link CacheBrokerConfig}
 * @see RESEARCH §4.2 / §11.3 — composition wrapper Opzione B + D-30 no singleton
 * @see prd.md §20 — public API factory pattern cache layer
 */
export function createCacheBroker(config: CacheBrokerConfig = {}): CacheBroker {
  const parsed = v.safeParse(CacheBrokerConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid CacheBrokerConfig: ${messages}`)
  }
  return new CacheBroker(config)
}

export type { CacheBrokerConfig }
export { CacheBroker }
