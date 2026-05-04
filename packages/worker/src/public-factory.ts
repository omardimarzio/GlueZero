// public-factory.ts — `createWorkerBroker(config)` API pubblica del package
// `@sembridge/worker` (PRD §27, REQ WK-01..WK-07, decisione D-30 no singleton).
//
// Estende il pattern di `createRouterBroker` (F3 plan 03-12) e
// `createRealtimeBroker` (F4 plan 04-08): factory pure function che valida la
// config via Valibot e ritorna una nuova istanza `WorkerBroker`. La validazione
// delle sezioni F5 (`workers`, `workerRoutes`) avviene QUI (al confine pubblico
// del package); le sezioni F1-F4 (runtime, debug, canonicalModel, aliasRegistry,
// transforms, routes, gateway, routing, realtime) passano via `looseObject` —
// sono validate downstream dal `createRouterBroker` interno (D-56 validation at
// boundary).
//
// Differenza vs `createRealtimeBroker` (F4):
// - F4 valida `realtime.{defaults,channels[]}`
// - F5 (qui) valida `workers.{assertSerializable,defaultProgressThrottleMs,
//   defaultTimeoutMs}` + `workerRoutes[].{type,id,topic,worker,task,...}`
// - Su fail: `Error` nativo con prefisso `Invalid WorkerBrokerConfig:` (pattern
//   F1/F2/F3/F4)
//
// `safeParse` ritorna `{ success: true, output }` o `{ success: false, issues }`.
// Su fallimento aggreghiamo le issue messages in un singolo `Error` — il consumer
// riconosce la stringa per gestione UX (test pattern `/Invalid WorkerBrokerConfig/`).
//
// D-30 (no singleton): la factory è una pure function — ogni call costruisce un
// nuovo `new WorkerBroker(config)`. Multi-tenant scenario è desired (T-05-06-X
// accept).
//
// Threat coverage:
// - T-05-06-X (Tampering — config.workers/workerRoutes con shape invalida):
//   mitigate. Valibot safeParse al confine pubblico. Invalid → throw `Invalid
//   WorkerBrokerConfig: ...`.

import * as v from 'valibot'
import { WorkerBroker, type WorkerBrokerConfig } from './worker-broker'

// Schema `WorkerConfig` (D-122). `assertSerializable` literal union strict;
// numeric defaults validate `>= 0`.
const WorkerConfigSchema = v.optional(
  v.looseObject({
    assertSerializable: v.optional(v.picklist(['always', 'dev', 'off'])),
    defaultProgressThrottleMs: v.optional(v.pipe(v.number(), v.minValue(0))),
    defaultTimeoutMs: v.optional(v.pipe(v.number(), v.minValue(0))),
  }),
)

// Schema `RouteWorkerDefinition` (D-143/D-146/D-141/D-137). `type: 'worker'`
// literal discriminator; sub-spec validate strutturalmente. Policies `unknown`
// pass-through (subset di RoutePolicies F3 — validate a livello D-143
// downstream se serve, ma V1 minimal).
const RouteWorkerDefinitionSchema = v.looseObject({
  type: v.literal('worker'),
  id: v.pipe(v.string(), v.minLength(1)),
  topic: v.pipe(v.string(), v.minLength(1)),
  worker: v.pipe(v.string(), v.minLength(1)),
  task: v.pipe(v.string(), v.minLength(1)),
  publishes: v.optional(
    v.looseObject({
      success: v.optional(v.string()),
      progress: v.optional(v.string()),
      error: v.optional(v.string()),
    }),
  ),
  transferable: v.optional(v.array(v.string())),
  progressThrottleMs: v.optional(v.pipe(v.number(), v.minValue(0))),
  priority: v.optional(v.number()),
  policies: v.optional(v.unknown()),
})

// Schema completo `WorkerBrokerConfig` — preserve sezioni F1-F4 inherited via
// `looseObject` (validation delegata al `createRouterBroker` interno chiamato dal
// `WorkerBroker` constructor).
const WorkerBrokerConfigSchema = v.looseObject({
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
  // Sezione F5 (D-122) — validate strutturalmente.
  workers: WorkerConfigSchema,
  workerRoutes: v.optional(v.array(RouteWorkerDefinitionSchema)),
  // DI test (Tier-1 jsdom — D-150). Pass-through `unknown` (constructor
  // typecheck già).
  WorkerCtor: v.optional(v.unknown()),
})

/**
 * Crea una nuova istanza {@link WorkerBroker} con la config data.
 *
 * Estende {@link createRealtimeBroker} (F4) con validation della sezione F5
 * (`workers`, `workerRoutes`). Il wrapper restante (sezioni F1-F4) passa
 * attraverso `v.looseObject` — la validation dettagliata avviene downstream nel
 * `createRouterBroker` interno (D-56 validation at boundary).
 *
 * **No singleton (D-30):** ogni call ritorna istanza indipendente. Si possono
 * creare N broker su istanza pagina (multi-tenant isolation, test isolation).
 *
 * @param config - Optional broker configuration (default: empty object).
 * @returns A fresh {@link WorkerBroker} instance.
 * @throws {Error} `Invalid WorkerBrokerConfig: <issues>` se Valibot validation
 *   fallisce.
 *
 * @example
 * ```ts
 * import { createWorkerBroker } from '@sembridge/worker'
 *
 * const broker = createWorkerBroker({
 *   workers: { assertSerializable: 'dev' },
 *   workerRoutes: [
 *     { type: 'worker', id: 'r1', topic: 'csv.parse.requested',
 *       worker: 'csv-parser', task: 'parseCsv' },
 *   ],
 * })
 * broker.registerWorker({
 *   id: 'csv-parser',
 *   factory: () => new Worker(new URL('./csv.worker.ts', import.meta.url), { type: 'module' }),
 *   tasks: ['parseCsv'],
 * })
 * await broker.publish('csv.parse.requested', { rows: '...' })
 * ```
 *
 * @see {@link WorkerBroker}
 * @see {@link WorkerBrokerConfig}
 */
export function createWorkerBroker(config: WorkerBrokerConfig = {}): WorkerBroker {
  const parsed = v.safeParse(WorkerBrokerConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid WorkerBrokerConfig: ${messages}`)
  }
  return new WorkerBroker(config)
}

export type { WorkerBrokerConfig }
export { WorkerBroker }
