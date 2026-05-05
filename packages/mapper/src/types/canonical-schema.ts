// CanonicalSchema — vocabolario canonico del broker (PRD §13, REQ MAP-01/MAP-02).
//
// Riferimento decisioni (02-CONTEXT.md):
// - D-36: schema versioning via `requires?: string[]` (lista altri schema id richiesti).
//         Verificato al `registerCanonicalSchema` (throw se requires non risolti).
//         Plain string version (no SemVer parsing in F2).
// - D-42: VAL-08 chiusura PRD §39 #3 — `FieldDescriptor.required: boolean` (default false).
//         required:true + missing → throw 'validation.field.missing' + publish 'mapping.error'
//         required:false + missing → applica `default` se definito, altrimenti field omesso
// - D-43: `default` è valore statico (no funzioni). Per default dinamici → usa `$derive`.
// - D-44: VAL-09 chiusura PRD §39 #4 — `FieldDescriptor.onFailure: 'block' | 'skip' | 'fallback'`
//         (default 'block'). Specifica il comportamento del transform su throw.
//
// `CanonicalSchemaId` è branded (Pitfall #12 — type confusion prevention).
// Solo cast esplicito `as CanonicalSchemaId` permette di "instanziare" il tipo.
//
// Threat coverage:
// - T-02-02-01 (Tampering — type confusion): branded id con `unique symbol` distinto.
// - T-02-02-03 (Tampering — mutation post-register): tutti i field `readonly`; runtime
//   `deepFreeze` applicato al register (plan 02-03 — D-04 pattern F1).
//
// `exactOptionalPropertyTypes: true` policy: campi opzionali NON valorizzati come `undefined`.
// `isolatedDeclarations: true` enforcement: ogni export ha shape esplicita.

declare const __canonicalSchemaIdBrand: unique symbol

/**
 * Branded type per id canonical schema (Pitfall #12 — type confusion prevention).
 * Solo cast esplicito `as CanonicalSchemaId` permette di "instanziare" il tipo.
 *
 * Pattern replicato da `EventId` di `@gluezero/core/types/broker-event.ts:54-61`.
 */
export type CanonicalSchemaId = string & { readonly [__canonicalSchemaIdBrand]: true }

/**
 * Field type primitivo del canonical schema.
 *
 * F2 supporta i tipi base + `'any'` per estensioni future (V2 tipi composti, union, ecc.).
 * La validazione effettiva del tipo è delegata al `ValidatorAdapter` (D-37/D-38) — questo
 * `FieldType` è un hint per Inspector debug e per sanity check post-mapping.
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'

/**
 * Comportamento del transform su throw (D-44 — chiusura PRD §39 #4).
 *
 * - `'block'` (default) — transform throw → mapping fallisce intero → publish `mapping.error` → no delivery
 * - `'skip'` — transform throw → field non valorizzato (come `required: false` + no default)
 * - `'fallback'` — transform throw → applica `default` se definito; se no default, comportamento `'skip'`
 */
export type FieldFailureMode = 'block' | 'skip' | 'fallback'

/**
 * Descrittore di un campo canonico (D-42, D-43, D-44).
 *
 * `required: false` (default) + `default: T` definito → applica default se field assente.
 * `required: true` + field assente → throw `BrokerError 'validation.field.missing'`.
 *
 * Per i default dinamici (es. timestamp corrente, id generato) usa `$derive` con transform
 * registrato via `registerTransform`, NON un `default` valore (D-43).
 *
 * Tutti i field readonly per impedire mutation post-register (T-02-02-03 mitigation).
 */
export interface FieldDescriptor {
  readonly type: FieldType
  readonly required?: boolean
  readonly default?: unknown
  readonly onFailure?: FieldFailureMode
  readonly description?: string
}

/**
 * Canonical schema definition (PRD §13, REQ MAP-01/MAP-02).
 *
 * `id` è branded — uso il pattern di `broker-event.ts:54-61` (EventId).
 * `requires` è una lista di schema id richiesti (D-36 — verificato al register).
 * `fields` è una mappa nome canonico → descrittore.
 *
 * @example
 * ```ts
 * const weatherSchema: CanonicalSchema = {
 *   id: 'weather' as CanonicalSchemaId,
 *   fields: {
 *     location: { type: 'string', required: true },
 *     forecast_date: { type: 'string', required: true },
 *     temperature_celsius: { type: 'number', required: false, onFailure: 'skip' },
 *   },
 * }
 * ```
 */
export interface CanonicalSchema {
  readonly id: CanonicalSchemaId
  readonly requires?: readonly string[]
  readonly fields: Readonly<Record<string, FieldDescriptor>>
  readonly description?: string
}
