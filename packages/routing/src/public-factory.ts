// public-factory.ts — `createRouterBroker(config)` API pubblica del @sembridge/routing
// (PRD §27, REQ ROUTE-01, decisioni D-30 no singleton, D-93/D-100 config validation).
//
// Estende il pattern di `createMapperBroker` di F2 (D-30) e di `createBroker` di F1
// (D-19): factory pure function che valida la config via Valibot e ritorna una nuova
// istanza `RouterBroker`. La validazione delle sezioni F3 (`routes`, `gateway`,
// `routing`) avviene QUI (al confine pubblico del package), invece che nel core —
// coerente con D-56 (i package downstream validano strutturalmente le proprie sezioni
// al wiring).
//
// Differenza vs `createMapperBroker` di F2:
// - F2 valida `canonicalModel.schemas`/`aliasRegistry`/`transforms`
// - F3 (qui) valida `routes` (array di RouteDefinition), `gateway` (passthrough unknown),
//   `routing` (multipleRoutesPolicy literal + emitAmbiguousWarning + requiresRouteTopics)
// - `routing.requiresRouteTopics` (D-100, BLOCKER 4 fix Plan 03-12) — array di string
//   per opt-in esplicito alla chiusura ROUTE-16 senza dipendere dal canonical-registry.
// - Su fail: `Error` nativo con prefisso "Invalid RouterBrokerConfig" (pattern F1/F2)
//
// `safeParse` ritorna `{ success: true, output }` o `{ success: false, issues }`.
// Su fallimento aggreghiamo le issue messages in un singolo `Error` — il consumer
// riconosce la stringa per gestione UX (test pattern `/Invalid RouterBrokerConfig/`).
//
// D-30 (no singleton): la factory è una pure function — ogni call costruisce un
// nuovo `new RouterBroker(config)`.
//
// Threat coverage:
// - T-03-12-04 (Spoofing — system.* topic registrato come route da plugin malevolo):
//   accept; resolver.register valida via TopicTrie validateTopicPattern.
// - T-02-10-04 (Information disclosure — error messages contengono PII): accept,
//   F3 V1 best-effort.

import * as v from 'valibot'
import { RouterBroker, type RouterBrokerConfig } from './router-broker-wrapper'

// Schema discriminato per RouteDefinition (PRD §17, ROUTE-01..05). Usiamo
// `looseObject` per accettare i field type-specific (request/response per http,
// strategy/key/ttlMs per cache, steps per composite) senza enumerarli tutti — il
// runtime register nel resolver fa il check strutturale via TS narrowing.
const RouteDefinitionSchema = v.looseObject({
  id: v.string(),
  type: v.union([
    v.literal('local'),
    v.literal('http'),
    v.literal('cache'),
    v.literal('composite'),
  ]),
  topic: v.string(),
  priority: v.optional(v.number()),
})

// Schema completo RouterBrokerConfig (sezioni F1+F2 looseObject pass-through +
// sezioni F3 validate). Pattern v.looseObject preserva sezioni F4-F6 augmented
// dai package downstream (coerente con MapperBrokerConfigSchema F2).
const RouterBrokerConfigSchema = v.looseObject({
  // Sezioni F1 (pass-through — F1 BrokerConfigSchema valida internamente).
  runtime: v.optional(v.unknown()),
  debug: v.optional(v.unknown()),
  topicSchemas: v.optional(v.unknown()),
  // Sezioni F2 (D-56 — pass-through, F2 createMapperBroker valida quando inner.publish gira).
  canonicalModel: v.optional(v.unknown()),
  aliasRegistry: v.optional(v.unknown()),
  transforms: v.optional(v.unknown()),
  // Sezioni F3 (D-93, D-66, D-67, D-100) — validate strutturalmente.
  routes: v.optional(v.array(RouteDefinitionSchema)),
  gateway: v.optional(v.unknown()),
  routing: v.optional(
    v.object({
      multipleRoutesPolicy: v.optional(
        v.union([v.literal('first-match'), v.literal('priority-ordered'), v.literal('all')]),
      ),
      emitAmbiguousWarning: v.optional(v.boolean()),
      // BLOCKER 4 revision fix (D-100): opt-in esplicito per ROUTE-16/D-67 senza
      // dipendere dal lookup canonicalRegistry private. Vedi router-broker-wrapper.ts
      // `getCanonicalSchemaForTopic` rationale.
      requiresRouteTopics: v.optional(v.array(v.string())),
    }),
  ),
})

/**
 * Crea una nuova istanza {@link RouterBroker} con la config data.
 *
 * Estende {@link createMapperBroker} (F2) con validation delle sezioni F3 (`routes`,
 * `gateway`, `routing` — D-93). Il wrapper restante (sezioni F4-F6 augmented dai
 * package downstream) passa attraverso `v.looseObject`.
 *
 * No singleton (D-30): ogni call ritorna una istanza indipendente.
 *
 * **Differenza vs `createMapperBroker`**: questo factory deve essere usato dai consumer
 * F3+ che vogliono il routing engine (RouteResolver + RouteExecutor + HttpGateway +
 * OutcomeCollector) wired al MapperBroker. I consumer che usano solo F2 (mapping +
 * inspector) possono continuare con `createMapperBroker`.
 *
 * @param config - Optional broker configuration (default: empty object).
 * @returns A fresh {@link RouterBroker} instance.
 * @throws {Error} `Invalid RouterBrokerConfig: ...` se config validation Valibot fallisce.
 *
 * @example
 * ```ts
 * import { createRouterBroker } from '@sembridge/routing'
 *
 * const broker = createRouterBroker({
 *   gateway: { allowlist: ['https://api.example.com'] },
 *   routing: { multipleRoutesPolicy: 'first-match' },
 *   routes: [
 *     {
 *       id: 'weather-http',
 *       type: 'http',
 *       topic: 'weather.requested',
 *       request: { method: 'GET', url: 'https://api.example.com/weather' },
 *       response: { canonical: 'weather' },
 *     },
 *   ],
 * })
 *
 * broker.publish('weather.requested', { location: 'Roma' }, {
 *   source: { type: 'plugin', id: 'form' },
 * })
 * // → fetch + mapper + publish 'weather.loaded'
 * ```
 */
export function createRouterBroker(config: RouterBrokerConfig = {}): RouterBroker {
  const parsed = v.safeParse(RouterBrokerConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid RouterBrokerConfig: ${messages}`)
  }
  return new RouterBroker(config)
}

export { RouterBroker }
