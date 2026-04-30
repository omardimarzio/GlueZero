// public-factory.ts — `createBroker(config)` API pubblica del @sembridge/core
// (PRD §27, REQ CORE-14, decisioni D-18 config validation, D-19 imperative API,
// D-30 no singleton).
//
// Il `BrokerConfigSchema` Valibot usa `v.looseObject` per accettare le sezioni F2-F6
// aggiunte via TS declaration merging dai package downstream (D-56 — vedi
// `@sembridge/mapper/src/augment.ts`):
//   - sezione `runtime` (F1 implementata): debug, deepFreezeInDev, logLevel,
//     logger, tap — validati strutturalmente con tipi specifici dove ha senso
//     (es. picklist per logLevel) e `unknown` dove l'oggetto è opaque (logger, tap)
//   - sezione `debug` (F1 implementata): enabled, snapshotPayloadsFull (booleani)
//   - `topicSchemas` (F2 V2 deferred): kept as `v.unknown()` placeholder
//   - sezioni F2-F6 (`canonicalModel`, `aliasRegistry`, `transforms`, `routes`,
//     `transport`, `workers`, `cache`): NON dichiarate nello schema; il
//     `v.looseObject` le accetta come pass-through senza validazione strutturale
//     (i package F2-F6 hanno la responsabilità di validare le proprie sezioni
//     internamente al momento del wiring).
//
// `safeParse` ritorna `{ success: true, output }` o `{ success: false, issues }`.
// Su fallimento aggreghiamo le issue messages in un singolo `Error` con prefisso
// "Invalid BrokerConfig" — il consumer riconosce la stringa per gestione UX.
//
// `safeParse` su BrokerConfig vs createBrokerError: scelta di plan 08 di usare
// `Error` nativo (non BrokerError) qui perché:
//   1. il consumer è il developer che ha scritto il config — l'errore è di
//      development-time, non runtime broker-internal
//   2. il match pattern di test (`/Invalid BrokerConfig/`) è più semplice contro
//      un Error nativo
//   3. non serve `code`/`category` perché è 1 sola classe di errore
// (Decisione documentabile come scelta di design — non Rule 4 architectural).
//
// D-30 (no singleton): la factory è una pure function — ogni call costruisce un
// nuovo `new Broker(config)`. Test `createBroker() !== createBroker()` lo verifica.

import * as v from 'valibot'
import { Broker } from './core/broker'
import type { BrokerConfig } from './types/config'

const BrokerConfigSchema = v.looseObject({
  runtime: v.optional(
    v.object({
      debug: v.optional(v.boolean()),
      deepFreezeInDev: v.optional(v.boolean()),
      logLevel: v.optional(v.picklist(['silent', 'error', 'warn', 'info', 'debug', 'trace'])),
      logger: v.optional(v.unknown()),
      tap: v.optional(v.unknown()),
    }),
  ),
  debug: v.optional(
    v.object({
      enabled: v.optional(v.boolean()),
      snapshotPayloadsFull: v.optional(v.boolean()),
    }),
  ),
  topicSchemas: v.optional(v.unknown()),
  // Le altre sezioni F2-F6 (`canonicalModel`, `aliasRegistry`, `transforms`, `routes`,
  // `transport`, `workers`, `cache`) sono accettate come pass-through dal `v.looseObject`
  // senza validazione strutturale (D-56 — augmented via TS declaration merging dai
  // package downstream).
})

/**
 * Creates a new {@link Broker} instance with the given configuration.
 *
 * Phase 1 implements the `runtime` and `debug` config sections; Phase 2-6
 * sections (`canonicalModel`, `aliasRegistry`, `transforms`, `routes`,
 * `transport`, `workers`, `cache`) are added via TS declaration merging dai
 * package downstream (D-56) e accettate come pass-through al runtime F1
 * (`v.looseObject`).
 *
 * **WR-07 fix — IMPORTANTE per consumer F2+**: le sezioni F2-F6 sono accettate
 * dallo schema `v.looseObject` MA **non hanno effetto runtime se si usa
 * `createBroker` di `@sembridge/core` direttamente**. Per attivare il wiring
 * (canonical schema register, alias bootstrap, transform pipeline, ecc.) il
 * consumer F2 deve usare `createMapperBroker(config)` di `@sembridge/mapper`,
 * che valida strutturalmente le sezioni F2 e le bootstrappa nei registry.
 *
 * In F1-only consumer la presenza di `canonicalModel`, `aliasRegistry`,
 * `transforms` è pass-through silente — il consumer NON riceve nessun warning
 * (no dependency su `@sembridge/mapper` da core, vincolo D-49). Per attivare
 * la validation strutturale di queste sezioni → switch a `createMapperBroker`.
 *
 * No singleton (D-30): each call returns an independent instance.
 *
 * @param config - Optional broker configuration (default: empty object).
 * @returns A fresh {@link Broker} instance.
 * @throws {Error} `Invalid BrokerConfig: ...` if config validation (Valibot) fails.
 *
 * @example
 * ```ts
 * import { createBroker } from '@sembridge/core'
 *
 * const broker = createBroker({
 *   runtime: { logLevel: 'info', debug: false },
 * })
 *
 * const sub = broker.subscribe('weather.requested', (event) => {
 *   console.log('received:', event.payload)
 * })
 *
 * broker.publish('weather.requested', { city: 'Roma' }, {
 *   source: { type: 'plugin', id: 'weather-form' },
 * })
 *
 * sub.unsubscribe()
 * ```
 */
export function createBroker(config: BrokerConfig = {}): Broker {
  const parsed = v.safeParse(BrokerConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid BrokerConfig: ${messages}`)
  }
  return new Broker(config)
}
