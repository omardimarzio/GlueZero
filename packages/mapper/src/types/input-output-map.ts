// InputMap / OutputMap / MappingRule — descrittori di mapping per plugin
// (PRD §14, §15.2; REQ MAP-03/MAP-04/MAP-05/MAP-06/MAP-07/MAP-08/MAP-09/MAP-10).
//
// Riferimento decisioni (02-CONTEXT.md):
// - D-32: `inputMap`/`outputMap` come campi opzionali del `PluginDescriptor`
//         (estensione tipo via TS declaration merging — vedi augment.ts plan 02-09).
// - D-40: resolution order — esplicito (inputMap/outputMap) PREVALE su alias automatici.
// - D-43: `default` è valore statico (no funzioni). Per default dinamici → usa `derive`.
//
// `MappingRule` (record di field opzionali) supporta i casi PRD §14.2:
//   1. Rename: `MappingRule = { source: 'città' }` → mappa `città` su nome canonico
//   2. Nested: `MappingRule = { source: 'address.city' }` → dot-path
//   3. Default: `MappingRule = { default: 'normal' }` → applica se assente
//   4. Format transform: `MappingRule = { source: 'data', transform: 'parseItalianDate' }`
//   5. Unit normalization: `MappingRule = { source: 'temp', transform: 'parseTempCelsius' }`
//   6. Derive: `MappingRule = { derive: { sources: ['firstName','lastName'], transform: 'concat' } }`
//   7. Partial: solo i campi dichiarati nella mappa vengono mappati (D-40)
//
// `exactOptionalPropertyTypes: true` policy: tutti i field opzionali (nessun `undefined` esplicito).

/**
 * Descrittore di derive: produce un valore canonico combinando più field source via transform.
 *
 * Pattern PRD §14.5 (`fullName: $derive(['firstName','lastName'], (a,b) => `${a} ${b}`)`).
 * `transform` è il name registrato via `registerTransform` (D-31). Lo lookup avviene a runtime
 * dal `TransformPipeline` (plan 02-05).
 */
export interface DeriveDescriptor {
  readonly sources: readonly string[]
  readonly transform: string
}

/**
 * Regola di mapping per un singolo campo canonico (PRD §14.2).
 *
 * Tutti i field sono opzionali ma almeno uno tra `source` / `derive` / `default` deve essere
 * presente per produrre un valore. Validazione runtime nel mapper-engine (plan 02-07).
 *
 * - `source`: nome del field locale (string semplice oppure dot-path per nested PRD §14.2.2)
 * - `transform`: nome del transform registrato (PRD §14.6, REQ MAP-12)
 * - `default`: valore statico applicato se source assente (PRD §14.2.3, D-43)
 * - `derive`: combinazione di più source via transform (PRD §14.2.6, REQ MAP-09)
 */
export interface MappingRule {
  readonly source?: string
  readonly transform?: string
  readonly default?: unknown
  readonly derive?: DeriveDescriptor
}

/**
 * Mappa locale → canonico per un plugin publisher (PRD §15.2).
 *
 * Chiave: nome canonico del field; valore: `MappingRule` che descrive come ottenerlo
 * dal payload locale.
 *
 * @example
 * ```ts
 * const weatherFormOutputMap: OutputMap = {
 *   location: { source: 'città' },
 *   forecast_date: { source: 'data', transform: 'parseItalianDate' },
 * }
 * ```
 */
export type OutputMap = Readonly<Record<string, MappingRule>>

/**
 * Mappa canonico → locale per un plugin consumer (PRD §15.2).
 *
 * Stessa shape di `OutputMap` ma applicata in direzione inversa al passo 11
 * della pipeline §28 (canonical → consumer).
 *
 * @example
 * ```ts
 * const weatherWidgetInputMap: InputMap = {
 *   'day-prevision': { source: 'forecast_date' },
 * }
 * ```
 */
export type InputMap = Readonly<Record<string, MappingRule>>
