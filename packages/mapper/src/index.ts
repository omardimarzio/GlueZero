/**
 * @sembridge/mapper — Canonical model + bidirectional mapper per SemBridge.
 *
 * Phase 2 di SemBridge V1. Estende `@sembridge/core` (Phase 1) con:
 * - **Canonical Vocabulary Registry** — campi tipizzati, alias riconosciuti, schema versioning
 * - **Mapper bidirezionale** — locale → canonico (publisher) e canonico → consumer (subscriber)
 * - **Transform Pipeline** — rename, nested, default, transform, derive, partial, validation
 * - **Mapping Inspector** — estensione EventTap con i 5 nuovi step pipeline §28 (D-46/47/48)
 * - **Validation adapter** — Valibot 1.x default (Zod/Ajv deferred V2)
 *
 * Vincolo architetturale (D-49): il package NON modifica `bus.ts` di F1. Estende:
 * - composition wrapper (broker integration plan 02-10)
 * - TS declaration merging (`./augment`) di `PluginDescriptor` e `BrokerConfig` (D-56/D-57)
 *
 * Side-effect import: `import './augment'` PRIMA degli export per attivare il declaration
 * merging. `package.json` ha `sideEffects: ["./dist/augment.js"]` per evitare tree-shaking
 * accidentale del file (T-02-09-01 mitigation).
 *
 * I tipi interni (es. `CompiledMapping`, `RegisterOptions` del CanonicalRegistry, `AliasResolution`,
 * `RegisterTransformOptions`, `MapperEngineStats`) NON sono ri-esportati: restano accessibili
 * solo via path relativo per consumer del monorepo (pattern F1 `index.ts:18-22`).
 *
 * @packageDocumentation
 */

// Side-effect import — abilita TS declaration merging per PluginDescriptor + BrokerConfig.
// Vedi `packages/mapper/src/augment.ts` (D-49/D-56/D-57).
// Ri-esportiamo `__augmentLoaded` come simbolo pubblico per evitare il tree-shaking
// del side-effect import (T-02-09-01 mitigation). Il `package.json` ha
// `sideEffects: ["./dist/augment.js", "./src/augment.ts", ...]` array per double-safety
// in ambienti consumer (Vite/webpack/esbuild) che potrebbero ignorare l'export.

// Runtime exports — il "cuore" funzionale del package.
export { AliasRegistry } from './alias-registry'
export { __augmentLoaded } from './augment'
export { MapperBroker } from './broker-mapper-wrapper'
export { CanonicalRegistry } from './canonical-registry'
export { MappingInspector, wrapTap } from './inspector'
export { MapperEngine } from './mapper-engine'
// Public factory + broker wrapper (Broker integration, plan 02-10)
export { createMapperBroker } from './public-factory'
export { TransformPipeline } from './transform-pipeline'
export { isMappingErrorCode } from './types/mapping-error'
export { valibotAdapter } from './valibot-adapter'

// Type exports — surface tipi pubblici F2.

export type {
  /** Snapshot esteso del MapperBroker con sezione mappings (D-48). */
  MapperBrokerDebugSnapshot,
  /** Subscribe options esteso con `ownerId` per applyInputMap consumer-side (D-51). */
  MapperSubscribeOptions,
  /** Options per registerAlias (`scope: 'global' | pluginId`). */
  RegisterAliasOptions,
  /** Options per registerCanonicalSchema (`ownerId` opzionale per cascade D-26 ext F2). */
  RegisterCanonicalSchemaOptions,
  /** Options per registerTransform (`description`, `ownerId` opzionali). */
  RegisterTransformWrapperOptions,
} from './broker-mapper-wrapper'
export type {
  /** Options MappingInspector (registries DI + errorBufferSize). */
  MappingInspectorOptions,
  /** Snapshot Inspector con counter + lastErrors (D-48). */
  MappingInspectorSnapshot,
} from './inspector'
export type {
  /** Options del MapperEngine (dependency injection dei 4 moduli Wave 3). */
  MapperEngineOptions,
  /** Plugin descriptor F2 (con inputMap/outputMap/canonicalSchemaId — bridge tipo F1↔F2). */
  MapperPluginDescriptor,
} from './mapper-engine'
export type {
  /** Canonical schema definition (PRD §13, REQ MAP-01/MAP-02). */
  CanonicalSchema,
  /** Branded id canonical schema (Pitfall #12 — type confusion prevention). */
  CanonicalSchemaId,
  /** Descrittore di un campo canonico (`type`, `required`, `default`, `onFailure`). */
  FieldDescriptor,
  /** Comportamento del transform su throw — D-44 (chiusura PRD §39 #4). */
  FieldFailureMode,
  /** Field type primitivo del canonical schema. */
  FieldType,
} from './types/canonical-schema'
export type {
  /** Descrittore derive: combina più source via transform (PRD §14.5, REQ MAP-09). */
  DeriveDescriptor,
  /** Mappa canonico → locale per plugin consumer (PRD §15.2). */
  InputMap,
  /** Regola di mapping per un singolo campo canonico (rename/transform/default/derive). */
  MappingRule,
  /** Mappa locale → canonico per plugin publisher (PRD §15.2). */
  OutputMap,
} from './types/input-output-map'

export type {
  /** Literal union dei 5 codici errore mapper F2 (D-58, REQ ERR-02 extension). */
  MappingErrorCode,
} from './types/mapping-error'
export type {
  /** Contesto readonly passato al transform a runtime. */
  TransformContext,
  /** Descrittore di un transform registrato via `registerTransform(name, fn)` (D-31). */
  TransformDescriptor,
  /** Signature di un transform registrato (input/ctx → output). */
  TransformFn,
  /** Branded nome transform (Pitfall #12). */
  TransformName,
} from './types/transform'
export type {
  /** Issue di validazione (subset di Valibot.Issue). */
  ValidationIssue,
  /** Risultato discriminato di una validazione: `{ ok: true; value } | { ok: false; issues }`. */
  ValidationResult,
  /** Adapter pluggable per validazione (Valibot default; Zod/Ajv V2). */
  ValidatorAdapter,
} from './types/validator-adapter'

/**
 * F2 PipelineStep: i 5 nuovi step della pipeline §28 (D-50).
 *
 * **Limitazione TS**: `PipelineStep` di `@sembridge/core` è un type alias literal
 * union, NON un'interface — TS non supporta declaration merging di type alias.
 * Soluzione: il consumer che dichiara tap F2 importa questo super-set:
 *
 * ```ts
 * import type { PipelineStep } from '@sembridge/core'
 * import type { F2PipelineStep } from '@sembridge/mapper'
 *
 * type AllSteps = PipelineStep | F2PipelineStep
 * const tap: EventTap = {
 *   onPipelineStep(step: AllSteps, snapshot) { ... }
 * }
 * ```
 *
 * F1 step da `@sembridge/core` (subset) restano validi. F6 potrà refactor `PipelineStep`
 * da type alias a interface union per veri declaration merging (T-02-09-05 disposition).
 */
export type F2PipelineStep =
  | 'event.source.resolved'
  | 'event.mapped.canonical'
  | 'event.canonical.validated'
  | 'event.mapped.consumer'
  | 'event.final.validated'
