// Barrel re-export tipi pubblici @sembridge/mapper (Wave 2 — gating per Wave 3 paralleli).
//
// Pattern F1 replicato (vedi packages/core/src/types/index.ts:1-41):
// - `export type { ... }` esplicito per i tipi (verbatimModuleSyntax: true)
// - `export { ... }` esplicito per i runtime symbol (es. type guard `isMappingErrorCode`)
// - JSDoc 1-liner per ciascun export per IntelliSense + TypeDoc-ready
// - I tipi internal NON sono ri-esportati (es. eventuali helper compile-time del mapper-engine)
//
// Plan 02-09 (`augment.ts` + `src/index.ts` mapper) farà `export type * from './types'`
// per esporre l'API pubblica finale del package `@sembridge/mapper`.

export type {
  /** Branded id canonical schema (Pitfall #12 — type confusion prevention). */
  CanonicalSchemaId,
  /** Canonical schema definition con `id`, `requires?`, `fields` (PRD §13, REQ MAP-01/MAP-02). */
  CanonicalSchema,
  /** Comportamento del transform su throw — D-44 (chiusura PRD §39 #4). */
  FieldFailureMode,
  /** Descrittore di un campo canonico (`type`, `required`, `default`, `onFailure`). */
  FieldDescriptor,
  /** Field type primitivo del canonical schema. */
  FieldType,
} from './canonical-schema'

export type {
  /** Mappa locale → canonico per plugin publisher (PRD §15.2). */
  OutputMap,
  /** Mappa canonico → locale per plugin consumer (PRD §15.2). */
  InputMap,
  /** Regola di mapping per un singolo campo canonico (rename/transform/default/derive). */
  MappingRule,
  /** Descrittore derive: combina più source via transform (PRD §14.5, REQ MAP-09). */
  DeriveDescriptor,
} from './input-output-map'

export type {
  /** Branded nome transform (Pitfall #12). */
  TransformName,
  /** Signature di un transform registrato (input/ctx → output). */
  TransformFn,
  /** Descrittore di un transform registrato via `registerTransform(name, fn)` (D-31). */
  TransformDescriptor,
  /** Contesto readonly passato al transform a runtime. */
  TransformContext,
} from './transform'

export type {
  /** Adapter pluggable per validazione (Valibot default; Zod/Ajv V2). */
  ValidatorAdapter,
  /** Issue di validazione (subset di Valibot.Issue). */
  ValidationIssue,
  /** Risultato discriminato di una validazione: `{ ok: true; value } | { ok: false; issues }`. */
  ValidationResult,
} from './validator-adapter'

export type {
  /** Literal union dei 5 codici errore mapper F2 (D-58, REQ ERR-02 extension). */
  MappingErrorCode,
} from './mapping-error'

export { isMappingErrorCode } from './mapping-error'
