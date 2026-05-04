// public-factory.ts — `createRealtimeBroker(config)` API pubblica del subpath
// `@sembridge/gateway/sse-ws` (PRD §27, REQ RT-01..07, decisione D-30 no singleton).
//
// Estende il pattern di `createRouterBroker` (F3 plan 03-12 — public-factory.ts) e
// `createMapperBroker` (F2): factory pure function che valida la config via Valibot e
// ritorna una nuova istanza `RealtimeBroker`. La validazione delle sezioni F4 (`realtime`)
// avviene QUI (al confine pubblico del subpath); le sezioni F1-F3 (runtime, debug,
// canonicalModel, aliasRegistry, transforms, routes, gateway, routing) passano via
// `looseObject` — sono validate downstream dal `createRouterBroker` interno (D-56
// validation at boundary).
//
// Differenza vs `createRouterBroker` (F3):
// - F3 valida `routes`, `gateway`, `routing.{multipleRoutesPolicy,emitAmbiguousWarning,
//   requiresRouteTopics}`
// - F4 (qui) valida `realtime.{defaults,channels[]}` — `RealtimeChannelDef` con check
//   strutturale `name: string`, `mode: 'sse'|'websocket'|'auto'` literal union, e altri
//   field opzionali via looseObject (preserve forward-compat).
// - Su fail: `Error` nativo con prefisso "Invalid RealtimeBrokerConfig" (pattern F1/F2/F3)
//
// `safeParse` ritorna `{ success: true, output }` o `{ success: false, issues }`. Su
// fallimento aggreghiamo le issue messages in un singolo `Error` — il consumer riconosce
// la stringa per gestione UX (test pattern `/Invalid RealtimeBrokerConfig/`).
//
// D-30 (no singleton): la factory è una pure function — ogni call costruisce un nuovo
// `new RealtimeBroker(config)`. Multi-tenant scenario è desired (T-04-08-06 accept).
//
// Threat coverage:
// - T-04-08-01 (Tampering — config.realtime con shape invalida): mitigate. Valibot
//   safeParse al confine pubblico. Invalid → throw `Invalid RealtimeBrokerConfig: ...`.

import * as v from 'valibot'
import { RealtimeBroker, type RealtimeBrokerConfig } from './realtime-broker'

// Schema `RealtimeChannelDef` — `name` required string, `mode` literal union,
// altri field opzionali via looseObject (preserve forward-compat: nuovi field
// aggiunti in V1.x non rompono validation).
const RealtimeChannelDefSchema = v.looseObject({
  name: v.string(),
  mode: v.optional(v.union([v.literal('sse'), v.literal('websocket'), v.literal('auto')])),
  buildUrl: v.optional(v.function()),
  url: v.optional(v.string()),
  wsSubprotocols: v.optional(v.union([v.string(), v.array(v.string())])),
  reconnect: v.optional(v.unknown()),
  heartbeat: v.optional(v.unknown()),
  backpressure: v.optional(v.unknown()),
  eventTypes: v.optional(v.array(v.string())),
  sseHeartbeatEventTypes: v.optional(v.array(v.string())),
})

// Schema `RealtimeConfig` (D-102). `defaults` passa via `unknown` (sub-sezioni
// reconnect/heartbeat/visibility validate downstream se serve in V1.x).
const RealtimeConfigSchema = v.looseObject({
  defaults: v.optional(v.unknown()),
  channels: v.optional(v.array(RealtimeChannelDefSchema)),
})

// Schema completo `RealtimeBrokerConfig` — preserve sezioni F1-F3 inherited via
// `looseObject` (validazione delegata al `createRouterBroker` interno chiamato dal
// `RealtimeBroker` constructor).
const RealtimeBrokerConfigSchema = v.looseObject({
  // Sezioni F1 (pass-through — F1 BrokerConfigSchema valida internamente).
  runtime: v.optional(v.unknown()),
  debug: v.optional(v.unknown()),
  topicSchemas: v.optional(v.unknown()),
  // Sezioni F2 (D-56 — pass-through, F2 createMapperBroker valida quando
  // inner.publish gira).
  canonicalModel: v.optional(v.unknown()),
  aliasRegistry: v.optional(v.unknown()),
  transforms: v.optional(v.unknown()),
  // Sezioni F3 (D-93/D-100) — pass-through; `createRouterBroker` valida
  // strutturalmente al RouterBroker constructor.
  routes: v.optional(v.unknown()),
  gateway: v.optional(v.unknown()),
  routing: v.optional(v.unknown()),
  // Sezione F4 (D-102, D-103) — validate strutturalmente.
  realtime: v.optional(RealtimeConfigSchema),
})

/**
 * Crea una nuova istanza {@link RealtimeBroker} con la config data.
 *
 * Estende {@link createRouterBroker} (F3) con validation della sezione F4 (`realtime`).
 * Il wrapper restante (sezioni F1-F3) passa attraverso `v.looseObject` — la validation
 * dettagliata avviene downstream nel `createRouterBroker` interno (D-56 validation at
 * boundary).
 *
 * **No singleton (D-30):** ogni call ritorna istanza indipendente. Si possono creare N
 * broker su istanza pagina (multi-tenant isolation, test isolation).
 *
 * @param config - Optional broker configuration (default: empty object).
 * @returns A fresh {@link RealtimeBroker} instance.
 * @throws {Error} `Invalid RealtimeBrokerConfig: <issues>` se Valibot validation fallisce.
 *
 * @example
 * ```ts
 * import { createRealtimeBroker } from '@sembridge/gateway/sse-ws'
 *
 * const broker = createRealtimeBroker({
 *   realtime: {
 *     channels: [
 *       { name: 'orders', mode: 'auto', url: '/events' },
 *       { name: 'feed', mode: 'websocket', url: 'wss://api.example.com/ws' },
 *     ],
 *   },
 * })
 *
 * await broker.connectRealtime({ name: 'notifications', mode: 'sse', url: '/notifications' })
 * broker.subscribe('orders.created', (ev) => console.log(ev.payload))
 * ```
 *
 * @see {@link RealtimeBroker}
 * @see {@link RealtimeBrokerConfig}
 */
export function createRealtimeBroker(config: RealtimeBrokerConfig = {}): RealtimeBroker {
  const parsed = v.safeParse(RealtimeBrokerConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid RealtimeBrokerConfig: ${messages}`)
  }
  return new RealtimeBroker(config)
}

export type { RealtimeBrokerConfig }
export { RealtimeBroker }
