// public-factory.ts — `createDevtoolsBroker(config)` API pubblica del package
// `@gluezero/devtools` (PRD §28, REQ TOOL-01..05, decisione D-30 no singleton).
//
// Estende il pattern di `createCacheBroker` (F6 plan 06-08a) e `createWorkerBroker`
// (F5 plan 05-06): factory pure function che valida la config via Valibot e ritorna
// una nuova istanza `DevtoolsBroker`. La validazione delle sezioni F6 (`devtools`,
// `taps`) avviene QUI (al confine pubblico del package); le sezioni F1-F5 (runtime,
// debug, canonicalModel, aliasRegistry, transforms, routes, gateway, routing,
// realtime, workers, workerRoutes, cache, cacheRoutes) passano via `looseObject` —
// validate downstream dal `createRouterBroker` interno (D-56 validation at boundary).
//
// Differenza vs `createCacheBroker` (F6 06-08a):
// - F6 cache valida `cache.{maxEntries,adapter,scopeProvider}` + `cacheRoutes[]`
// - F6 devtools (qui) valida `devtools.{enableByDefault,eventBufferSize,
//   routeBufferSize,histogramSamples,maxLabelCombinations,pauseQueueMaxSize}` +
//   `taps[]`
// - Su fail: `Error` nativo con prefisso `Invalid DevtoolsBrokerConfig:`
//
// `safeParse` ritorna `{ success: true, output }` o `{ success: false, issues }`.
// Su fallimento aggreghiamo le issue messages in un singolo `Error` — il consumer
// riconosce la stringa per gestione UX (test pattern `/Invalid DevtoolsBrokerConfig/`).
//
// D-30 (no singleton): la factory è una pure function — ogni call costruisce un
// nuovo `new DevtoolsBroker(config)`. Multi-tenant scenario è desired.
//
// Threat coverage:
// - T-06-08b-04 (Tampering — config.devtools/taps con shape invalida):
//   mitigate. Valibot safeParse al confine pubblico.

import * as v from 'valibot'
import { DevtoolsBroker, type DevtoolsBrokerConfig } from './devtools-broker'

// Schema `DevtoolsConfig` (D-160/D-167/D-170). Numeric `>= 1` — buffer/cap minimi.
const DevtoolsConfigSchema = v.optional(
  v.looseObject({
    enableByDefault: v.optional(v.boolean()),
    initiallyEnabled: v.optional(v.boolean()),
    eventBufferSize: v.optional(v.pipe(v.number(), v.minValue(1))),
    routeBufferSize: v.optional(v.pipe(v.number(), v.minValue(1))),
    histogramSamples: v.optional(v.pipe(v.number(), v.minValue(1))),
    maxLabelCombinations: v.optional(v.pipe(v.number(), v.minValue(1))),
    pauseQueueMaxSize: v.optional(v.pipe(v.number(), v.minValue(1))),
  }),
)

// Schema completo `DevtoolsBrokerConfig` — preserve sezioni F1-F5 via `looseObject`.
const DevtoolsBrokerConfigSchema = v.looseObject({
  // Sezioni F1 (pass-through — F1 BrokerConfigSchema valida internamente).
  runtime: v.optional(v.unknown()),
  debug: v.optional(v.unknown()),
  topicSchemas: v.optional(v.unknown()),
  // Sezioni F2 (D-56 — pass-through).
  canonicalModel: v.optional(v.unknown()),
  aliasRegistry: v.optional(v.unknown()),
  transforms: v.optional(v.unknown()),
  // Sezioni F3 (D-93/D-100) — pass-through; createRouterBroker valida.
  routes: v.optional(v.unknown()),
  gateway: v.optional(v.unknown()),
  routing: v.optional(v.unknown()),
  // Sezione F4 (D-102, D-103) — pass-through.
  realtime: v.optional(v.unknown()),
  // Sezione F5 (D-122) — pass-through.
  workers: v.optional(v.unknown()),
  workerRoutes: v.optional(v.unknown()),
  // Sezione F6 cache (D-155..D-158) — pass-through.
  cache: v.optional(v.unknown()),
  cacheRoutes: v.optional(v.unknown()),
  // Sezione F6 devtools (D-160/D-167/D-170) — validate strutturalmente.
  devtools: DevtoolsConfigSchema,
  // Tap chain (D-159) — pass-through array di unknown (typecheck già al constructor).
  taps: v.optional(v.array(v.unknown())),
})

/**
 * Crea una nuova istanza {@link DevtoolsBroker} con la config data.
 *
 * Estende {@link createCacheBroker} (F6 plan 06-08a) con validation della sezione F6
 * devtools (`devtools`, `taps`). Il wrapper restante (sezioni F1-F5) passa
 * attraverso `v.looseObject` — la validation dettagliata avviene downstream nel
 * `createRouterBroker` interno (D-56 validation at boundary).
 *
 * **No singleton (D-30):** ogni call ritorna istanza indipendente. Si possono
 * creare N broker su istanza pagina (multi-tenant isolation, test isolation).
 *
 * @param config - Optional broker configuration (default: empty object).
 * @returns A fresh {@link DevtoolsBroker} instance.
 * @throws {Error} `Invalid DevtoolsBrokerConfig: <issues>` se Valibot validation fallisce.
 *
 * @example Quick start (debug enabled di default in dev)
 * ```ts
 * import { createDevtoolsBroker } from '@gluezero/devtools'
 *
 * const broker = createDevtoolsBroker({
 *   devtools: { enableByDefault: true, eventBufferSize: 500 },
 * })
 * await broker.publish('weather.requested', { city: 'Roma' })
 * const snap = broker.getDebugSnapshot()
 * ```
 *
 * @example Multi-tenant isolation (D-30 anti-singleton)
 * ```ts
 * const tenantA = createDevtoolsBroker({ devtools: { eventBufferSize: 100 }})
 * const tenantB = createDevtoolsBroker({ devtools: { eventBufferSize: 1000 }})
 * // tenantA !== tenantB — separate Inspector buffers, MetricsCollector, RouterBroker
 * ```
 *
 * @see {@link DevtoolsBroker}
 * @see {@link DevtoolsBrokerConfig}
 * @see RESEARCH §11 / §11.3 — composition wrapper Opzione B + D-30 no singleton
 * @see prd.md §28 — public API factory pattern devtools layer
 */
export function createDevtoolsBroker(config: DevtoolsBrokerConfig = {}): DevtoolsBroker {
  const parsed = v.safeParse(DevtoolsBrokerConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid DevtoolsBrokerConfig: ${messages}`)
  }
  return new DevtoolsBroker(config)
}

export type { DevtoolsBrokerConfig }
export { DevtoolsBroker }
