// public-factory.ts — `createMapperBroker(config)` API pubblica del @sembridge/mapper
// (PRD §27, REQ MAP-02/MAP-03/MAP-13/MAP-14, decisioni D-18 config validation, D-30 no
// singleton, D-56 sezioni F2 augmented).
//
// Estende il pattern di `createBroker` di F1 (D-19): factory pure function che valida la
// config via Valibot e ritorna una nuova istanza `MapperBroker`. La validazione delle
// sezioni F2 (`canonicalModel`, `aliasRegistry`, `transforms`) avviene QUI (al confine
// pubblico del package), invece che nel core — coerente con D-56 (i package downstream
// validano strutturalmente le proprie sezioni al wiring).
//
// Differenza vs `createBroker` di F1:
// - F1 usa `v.looseObject` perché le sezioni F2-F6 sono pass-through al runtime F1
// - F2 (qui) valida specificamente `canonicalModel.schemas` (array di CanonicalSchema),
//   `aliasRegistry.global/scoped` (record string→string), `transforms` (record string→fn)
// - Su fail: `Error` nativo con prefisso "Invalid MapperBrokerConfig" (pattern F1)
//
// `safeParse` ritorna `{ success: true, output }` o `{ success: false, issues }`.
// Su fallimento aggreghiamo le issue messages in un singolo `Error` — il consumer
// riconosce la stringa per gestione UX (test pattern `/Invalid MapperBrokerConfig/`).
//
// D-30 (no singleton): la factory è una pure function — ogni call costruisce un
// nuovo `new MapperBroker(config)`. Test `createMapperBroker() !== createMapperBroker()` lo verifica.
//
// Pattern affine a `createBroker` di F1 (`packages/core/src/public-factory.ts`).
//
// Threat coverage:
// - T-02-10-04 (Information disclosure — error messages contengono PII): accept;
//   F2 V1 best-effort. Redaction in DOC-03 (plan 02-12) per produzione.

import * as v from 'valibot'
import { MapperBroker } from './broker-mapper-wrapper'

// Schema per FieldDescriptor (D-42, D-44).
const FieldDescriptorSchema = v.object({
  type: v.picklist(['string', 'number', 'boolean', 'object', 'array', 'any']),
  required: v.optional(v.boolean()),
  default: v.optional(v.unknown()),
  onFailure: v.optional(v.picklist(['block', 'skip', 'fallback'])),
  description: v.optional(v.string()),
})

// Schema per CanonicalSchema (D-36 requires + D-42 fields).
const CanonicalSchemaSchema = v.object({
  id: v.string(),
  requires: v.optional(v.array(v.string())),
  fields: v.record(v.string(), FieldDescriptorSchema),
  description: v.optional(v.string()),
})

// Schema completo MapperBrokerConfig (sezioni F1 looseObject + sezioni F2 validate).
// Pattern v.looseObject preserva sezioni F3-F6 augmented dai package downstream
// (coerente con BrokerConfigSchema F1 — public-factory.ts:39).
const MapperBrokerConfigSchema = v.looseObject({
  // Sezioni F1 (pass-through — F1 BrokerConfigSchema le valida internamente).
  runtime: v.optional(v.unknown()),
  debug: v.optional(v.unknown()),
  topicSchemas: v.optional(v.unknown()),
  // Sezioni F2 (D-56) — validate strutturalmente.
  canonicalModel: v.optional(
    v.object({
      schemas: v.optional(v.array(CanonicalSchemaSchema)),
    }),
  ),
  aliasRegistry: v.optional(
    v.object({
      global: v.optional(v.record(v.string(), v.string())),
      scoped: v.optional(v.record(v.string(), v.record(v.string(), v.string()))),
    }),
  ),
  transforms: v.optional(v.record(v.string(), v.function())),
})

/**
 * Creates a new {@link MapperBroker} instance with the given configuration.
 *
 * Estende {@link createBroker} (F1) con validation delle sezioni F2 (`canonicalModel`,
 * `aliasRegistry`, `transforms` — D-56). Il wrapper restante (sezioni F3-F6 augmented dai
 * package downstream) passa attraverso `v.looseObject`.
 *
 * No singleton (D-30): ogni call ritorna una istanza indipendente.
 *
 * **Differenza vs `createBroker`**: questo factory deve essere usato dai consumer F2+ che
 * vogliono il MapperEngine + Inspector wired al Broker. I consumer che usano solo F1
 * (no canonical/mapper) possono continuare con `createBroker` di `@sembridge/core`.
 *
 * @param config - Optional broker configuration (default: empty object).
 * @returns A fresh {@link MapperBroker} instance.
 * @throws {Error} `Invalid MapperBrokerConfig: ...` se config validation Valibot fallisce.
 *
 * @example
 * ```ts
 * import { createMapperBroker } from '@sembridge/mapper'
 *
 * const broker = createMapperBroker({
 *   runtime: { logLevel: 'info' },
 *   canonicalModel: {
 *     schemas: [
 *       { id: 'weather', fields: { location: { type: 'string', required: true } } },
 *     ],
 *   },
 *   transforms: {
 *     parseItalianDate: (input) => {
 *       const [d, m, y] = String(input).split('/')
 *       return `${y}-${m}-${d}`
 *     },
 *   },
 * })
 *
 * await broker.registerPlugin({
 *   id: 'form',
 *   canonicalSchemaId: 'weather',
 *   outputMap: {
 *     location: { source: 'città' },
 *     forecast_date: { source: 'data', transform: 'parseItalianDate' },
 *   },
 * })
 *
 * broker.publish('weather.requested', { città: 'Roma', data: '30/04/2026' }, {
 *   source: { type: 'plugin', id: 'form' },
 * })
 * ```
 */
export function createMapperBroker(
  config: ConstructorParameters<typeof MapperBroker>[0] = {},
): MapperBroker {
  const parsed = v.safeParse(MapperBrokerConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid MapperBrokerConfig: ${messages}`)
  }
  return new MapperBroker(config)
}

export { MapperBroker }
