# Phase 2: Canonical Model & Mapper — Pattern Map

**Mappato:** 2026-04-29
**Source phase:** Phase 1 (`@sembridge/core`) — frozen e delivered (commit `f7faadb`).
**Target package:** `@sembridge/mapper` (placeholder scaffold-ato in plan 01-01, src vuoto).
**File F2 attesi:** ~12 file source + ~12 file test + 1 augment + 1 barrel + 1 fixture (≈26 totali).
**Analoghi F1 trovati:** 26/26 (full coverage — F2 estende moduli isomorfi a F1).
**Lingua:** italiana per commenti, identificatori, REQ-IDs descrittivi. Codice/log keywords/error codes in inglese.

> Questo documento è il **ponte fra Phase 1 (delivered) e Phase 2 (planning)**. Il planner di F2 lo usa per assegnare a ciascun nuovo file F2 il pattern F1 da copiare. Le decisioni D-31..D-59 (vedi `02-CONTEXT.md`) determinano il *cosa*; questo PATTERNS.md determina il *come* mantenendo coerenza con l'architettura F1.
>
> **Regola d'oro F2:** se un pattern F1 esiste, riusalo. Se devi divergere, motiva la deviazione (Rule 4 candidata). NON modificare i file F1 (vincolo D-49 — F2 estende per composition + declaration merging).

---

## 1. Convenzioni globali (ereditate da F1, da rispettare in F2)

### 1.1 Workflow GSD & lingua

| Aspetto | Regola |
|---------|--------|
| **Modello agent** | `claude-opus-4-7-1` per ogni sotto-agent GSD (planner, researcher, executor, tester). NON usare sonnet/haiku, anche per task brevi. Override esplicito `model: "opus"` in ogni `Agent` call. |
| **Lingua commenti & doc** | Italiano per file header/explanation block, JSDoc, success criteria, REQ-ID descrittivi, log strutturati a fini diagnostici. |
| **Lingua codice** | Inglese: identificatori, error codes (`mapping.cycle.detected`, `validation.field.missing`, ecc.), log keywords interne (es. `'Plugin handler threw'`), nomi file, tipi pubblici. |
| **Domande utente** | Minimizzare. Procedere con default ragionevoli quando il PRD/CONTEXT risolve. Solo per ambiguità reali o scelte irreversibili. |

### 1.2 TDD RED → GREEN (commit pattern obbligatorio)

Pattern F1 verificato (vedi `git log` plan 01-04..01-10):

```
test(02-XX): aggiunge test RED per <module>
feat(02-XX): implementa <module> (REQ-IDs)
```

Esempio reale F1 (commit `13dd13c` → `06212c7`):

```
test(01-04): aggiunge test RED per deepFreeze runtime
feat(01-04): implementa deepFreeze runtime con cycle protection (D-04, D-05)
```

**Vincoli:**
- Test va scritto E commitatto PRIMA del codice runtime (RED commit fa fallire `pnpm test`).
- Implementation commit DEVE far passare TUTTI i test del RED commit (GREEN).
- Nessun "fix tests dopo" — se i test sono troppo vincolanti, si rifa il RED commit (`git commit --amend` accettabile solo prima del push, non dopo).
- Plan 02-XX dedicato a `<module>` ha tipicamente 2 commit: 1 test, 1 feat. Plan grandi (es. mapper-engine) possono avere chunk atomici (vedi pattern plan 01-09/01-10: 5 commit di test + 5 di feat correlati).
- **NO `--no-verify`**, NO skip pre-commit hooks. Se hook fallisce, fix issue + new commit (mai amend).

### 1.3 File ownership disgiunta tra plan paralleli

Pattern F1 (Wave 3, plan 01-04/01-05/01-06 in parallelo): ogni plan ha **file ownership disgiunta** — plan A NON tocca file di plan B. Permette parallelizzazione agent-swarm.

Mapping F2 candidato (verifica con planner):

| Wave F2 | Plan paralleli candidati | File owned (esempi) |
|---------|--------------------------|----------------------|
| W1 (foundation tipi) | 02-01 types canonical/alias/transform | `src/types/canonical-schema.ts`, `src/types/input-output-map.ts`, `src/types/transform.ts`, `src/types/validator-adapter.ts` |
| W2 (registry modules) | 02-02 canonical-registry \|\| 02-03 alias-registry \|\| 02-04 transform-pipeline | files own: `canonical-registry.ts`, `alias-registry.ts`, `transform-pipeline.ts` |
| W3 (engine + adapter) | 02-05 valibot-adapter \|\| 02-06 mapper-engine compile/apply | files own: `valibot-adapter.ts`, `mapper-engine.ts` |
| W4 (integration) | 02-07 augment + index + broker wiring | `augment.ts`, `index.ts`, `inspector.ts` |
| W5 (integration test) | 02-08 scenario meteo + cycle detection test | `__integration__/*.test.ts`, `test-utils/mapper-harness.ts` |
| W6 (final gate) | 02-09 coverage + docs | README, JSDoc, coverage v8 |

### 1.4 Pattern di header file (italiano, codice in inglese)

Ogni file F1 inizia con un commento header esplicativo che documenta:
1. Cosa fa il file (1 riga)
2. Riferimenti REQ-ID + decisioni (D-XX) + PRD §
3. Surface pubblica esposta (lista metodi/tipi)
4. Threat coverage (T-XX-YY mitigation)
5. Note runtime (es. `exactOptionalPropertyTypes` policy, `isolatedDeclarations` enforcement)

**Esempio canonico** (da `bus.ts:1-26`):

```ts
// EventBus — il cuore del broker SemBridge (CORE-01, CORE-09, CORE-12, ERR-03).
//
// Dispatch pub/sub con:
//   - tap orchestration sui 5 step F1 della pipeline §28 (CORE-13, D-20)
//   - handler isolation try/catch sync + .catch() async (D-16) → publish system.error
//   - delivery semantics: 'async' default via queueMicrotask (D-01), 'sync' immediate (D-02),
//     'worker'/'remote' fallback async + warn (D-03)
//   ...
//
// Threat coverage:
// - T-07-02 (DoS — ricursione publish stesso topic): default async via queueMicrotask
//   svuota lo stack tra publish e delivery.
// ...
//
// `exactOptionalPropertyTypes: true` policy: campi opzionali NON valorizzati come
// `undefined`. Conditional spread `...(x !== undefined && { x })` produce proprietà
// assente vs proprietà undefined.
```

**F2 deve replicare questo pattern** per ogni file source nuovo.

### 1.5 `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` enforcement

Vincolo `tsconfig.base.json` (verificato — riga 11):

```json
"strict": true,
"noUncheckedIndexedAccess": true,
"exactOptionalPropertyTypes": true,
"isolatedDeclarations": true,
"verbatimModuleSyntax": true,
```

**Pattern enforcement F1 (da copiare in F2):**

| Costrutto | Pattern F1 | File ref |
|-----------|------------|----------|
| Field opzionale assente vs undefined | `...(value !== undefined && { value })` (conditional spread) | `event-factory.ts:73-77` |
| Field opzionale string truthy | `...(params.routeId && { routeId: params.routeId })` | `event-factory.ts:69-72` |
| Field opzionale assignment | `if (params.details) err.details = params.details` (separate `if` con assignment) | `broker-error.ts:50-57` |
| Index access su Map/array | `node.children.get(seg)` poi `if (!child) return` (no `!` non-null assertion) | `topic-matcher.ts:80-86` |
| Re-export tipi | `export type { X } from './x'` (verbatimModuleSyntax) | `types/index.ts:12-40` |
| Mutable struct internamente, readonly esposto | `type MutableX = { -readonly [K in keyof X]: X[K] }` | `broker-error.ts:19-21` |

### 1.6 Pattern import order (Biome `organizeImports: on`)

Biome (`biome.json:51-55`) auto-organizza import. Pattern F1:

```ts
// 1. External deps (ordinate alfabeticamente)
import { nanoid } from 'nanoid'
import * as v from 'valibot'

// 2. Type-only import F1 internals (verbatimModuleSyntax → `type` esplicito)
import type { BrokerEvent } from '../types/broker-event'
import type { BrokerLogger } from '../types/logger'

// 3. Runtime import F1 internals
import { createBrokerError, isBrokerError } from './broker-error'
import { deepFreeze } from './deep-freeze'
```

F2 segue la stessa struttura, con un livello in più: import da `@sembridge/core` (cross-package monorepo).

```ts
// External
import * as v from 'valibot'

// Cross-package types (da @sembridge/core)
import type { BrokerEvent, BrokerError, PluginDescriptor } from '@sembridge/core'

// Cross-package runtime (da @sembridge/core)
import { createBrokerError, isBrokerError } from '@sembridge/core'

// Local types
import type { CanonicalSchema, InputMap, OutputMap } from '../types/canonical-schema'

// Local runtime
import { CanonicalRegistry } from './canonical-registry'
```

---

## 2. Pattern map per modulo F2

> Tabella master: per ogni nuovo file F2 atteso, l'analogo F1 più vicino, l'adattamento richiesto, e le opportunità di reuse.

### 2.1 Tipi pubblici F2 (`packages/mapper/src/types/*.ts`)

| File F2 | Analogo F1 | Match | Adattamento | Reuse |
|---------|------------|-------|-------------|-------|
| `types/canonical-schema.ts` | `types/broker-event.ts` (header + JSDoc + branded type pattern) | esatto (interface readonly + branded type per schema id) | Aggiungi `requires?: string[]` (D-36), `fields: Record<name, FieldDescriptor>`, `FieldDescriptor.required: boolean` (D-42), `default: T`, `onFailure: 'block' \| 'skip' \| 'fallback'` (D-44). Branded `CanonicalSchemaId` con `unique symbol` (pattern `EventId` da `broker-event.ts:54-61`). | `DeepReadonly<T>` da `@sembridge/core` per i payload canonici |
| `types/input-output-map.ts` | `types/subscription.ts` (struttura semplice readonly) | esatto | `InputMap = Record<localField, MappingRule>`, `OutputMap = Record<localField, MappingRule>`, `MappingRule = { source?: string \| string[]; transform?: string; default?: unknown; derive?: DeriveDescriptor }`. **Nessun `unknown` lasciato — tutti i tipi specifici (D-32 chiude placeholder F1).** | — |
| `types/transform.ts` | `types/logger.ts` (interface minimale 5 metodi) | role-match | `TransformFn = (input: unknown, ctx: TransformContext) => unknown`, `TransformDescriptor = { name: string; fn: TransformFn; description?: string }`. `TransformContext` esposto come readonly. | Pattern signature minimale + Record meta opzionale |
| `types/validator-adapter.ts` | `types/tap.ts` (`EventTap` interface + JSDoc che spiega il vincolo architetturale) | esatto | `ValidatorAdapter` discriminated union return: `{ ok: true; value: T } \| { ok: false; issues: ValidationIssue[] }` (D-38). JSDoc spiega "F2 default = `valibotAdapter`; F2 V2 expandable to Zod/Ajv". | — |
| `types/mapper-error.ts` (opzionale, candidato accorpa in `index.ts`) | `types/error.ts` | esatto | Definisci union `MappingErrorCode = 'mapping.cycle.detected' \| 'mapping.transform.failed' \| 'mapping.field.missing' \| 'mapping.canonical.validation.failed' \| 'mapping.consumer.validation.failed'` come literal union per type guard runtime. NON un nuovo `BrokerError` subclass — riusa `BrokerError` di F1 con `category: 'mapping'` (già definita in `types/error.ts:25` di F1). | `BrokerError`, `ErrorCategory` da `@sembridge/core` |
| `types/index.ts` (barrel tipi F2) | `types/index.ts` (F1 — riga 1-41) | esatto | `export type { CanonicalSchema, InputMap, OutputMap, TransformFn, ValidatorAdapter, ... } from ...`. Ogni export con JSDoc 1-liner + reference REQ-ID. | — |

### 2.2 Moduli runtime F2 (`packages/mapper/src/*.ts`)

| File F2 | Analogo F1 | Match | Adattamento | Reuse |
|---------|------------|-------|-------------|-------|
| `canonical-registry.ts` | `core/topic-registry.ts` (`class TopicRegistry`, riga 21-52) | esatto | `class CanonicalRegistry` con `private schemas = new Map<string, CanonicalSchema>()`. Method: `register(schema): boolean` (true se nuovo, false dup — pattern `register` riga 25-36); `has(id)`, `list()` (return `[...schemas.keys()].sort()` — pattern riga 42-44 — DIFESA da T-06-01 mutation esterna); `onRegistered(listener)` observer pattern con try/catch swallow (riga 28-34). Aggiungi `resolveDependencies(schema)` per check D-36 `requires` — throw `BrokerError` `canonical.requires.unresolved` se non risolti. | `TopicRegistry` listener swallow pattern, `Set` interno + spread copia. |
| `alias-registry.ts` | `core/topic-registry.ts` (struttura) + `core/topic-matcher.ts` (lookup ottimizzato) | role-match | `class AliasRegistry` con due Map: `globalAliases: Map<localField, canonicalField>` e `pluginScopedAliases: Map<pluginId, Map<localField, canonicalField>>`. Method: `registerGlobal(local, canonical)`, `registerScoped(pluginId, local, canonical)`, `resolve(pluginId, localField): { canonical: string; ambiguous: boolean }`. **Resolution order D-40**: 1. esplicito `inputMap` (deferred — gestito da mapper-engine); 2. plugin-scoped; 3. globale; 4. name match diretto. Quando `ambiguous: true` → mapper-engine emette `mapping.warn` (D-41 — NON throw). | Map<string, T> idiom; `[...keys()].sort()` per `list()`. |
| `transform-pipeline.ts` | `core/topic-registry.ts` (registry minimale) + `core/event-tap.ts` (`safeTapStep` pattern try/catch wrap) | role-match | `class TransformPipeline` con `private transforms = new Map<string, TransformDescriptor>()`. Method: `register(name, fn): void` (throw `BrokerError` `transform.id.duplicate` se già registrato — pattern `D-17` `plugin.id.duplicate` da `plugin-registry.ts:111-117`); `apply(name, input, ctx, onFailure): unknown`. **`apply()` adotta lo stesso pattern try/catch di `safeTapStep`** ma con escalation policy D-44: `'block'` → throw wrapped `BrokerError` `mapping.transform.failed` con `originalError` + `cause` (pattern `broker-error.ts:51-54`); `'skip'` → return `undefined`; `'fallback'` → applica default. | `safeTapStep` try/catch shape; `createBrokerError` factory con `originalError` + `cause`. |
| `valibot-adapter.ts` | `core/event-validator.ts` (intero file — riga 1-66) | esatto | `export const valibotAdapter: ValidatorAdapter = { validate(schema, payload) { const r = v.safeParse(schema, payload); return r.success ? { ok: true, value: r.output } : { ok: false, issues: r.issues } } }`. Pattern identico a `validateEvent` ma senza throw (caller decide cosa fare con `{ ok: false }`). | `v.safeParse` + issue mapping. **Schema canonical Valibot** vive nel descriptor del consumer F2 — l'adapter è agnostico. |
| `mapper-engine.ts` | `core/bus.ts` (`class EventBus`, riga 59-291) | esatto (è il "cuore" del package — analogo dell'EventBus per il mapper) | `class MapperEngine` con `private compiledMappings = new Map<pluginId, CompiledMapping>()`. Method: `compileMappings(descriptor): void` (chiamato post-`onRegister` da Broker — vedi placeholder commenti in `plugin-registry.ts:184-185` "F2 transforms"); cycle detection D-35 con `visited: Set<(pluginId, fieldName)>` (pattern `deep-freeze.ts:17` `WeakSet` cycle protection); `applyOutputMap(event, plugin): canonicalEvent` (step 5 pipeline §28); `applyInputMap(canonicalEvent, consumer): consumerEvent` (step 11 pipeline §28); `applyDefaults`, `applyDerive`, `applyTransform`. **Tap orchestration** (D-46) con `safeTapStep(tap, 'event.mapped.canonical', snap)` per i 5 nuovi step (pattern `bus.ts:79-116`). Usa `payloadBefore` + `payloadAfter` nel snapshot quando `debug: true` (riga `bus.ts:287`). | `EventBus.snap()` helper (riga 276-290), `safeTapStep` orchestration, cycle detection idiom WeakSet. |
| `inspector.ts` | `core/event-tap.ts` (intero) + struttura `BrokerDebugSnapshot` (`broker.ts:59-66`) | esatto | `getMappingInspector()` ritorna `{ schemas: number, aliases: number, transforms: number, lastErrors: BrokerError[] }` (D-48). NON un EventTap parallelo — estende il tap esistente via declaration merging di `PipelineSnapshot.metadata`. F6 sostituirà con full snapshot. | `noopEventTap` shape per default; `BrokerDebugSnapshot` shape per inspector return type. |
| `augment.ts` (TS declaration merging) | `types/tap.ts` riga 16-21 (commento sui future step F2) | esatto (questo è il file che CHIUDE i tolerant placeholder F1) | `declare module '@sembridge/core'` con augmentation di: `PipelineStep` (aggiunge 5 nuove literal D-50: `'event.source.resolved'`, `'event.mapped.canonical'`, `'event.canonical.validated'`, `'event.mapped.consumer'`, `'event.final.validated'`); `BrokerConfig.canonicalModel/aliasRegistry/transforms` (sostituisci `unknown` con tipi specifici da `@sembridge/mapper` — D-56); `PluginDescriptor.inputMap?: InputMap; outputMap?: OutputMap` (D-57). **File deve essere importato dal barrel `index.ts` per side-effect**, altrimenti TS non vede l'augmentation. | Pattern declaration merging documentato in `types/plugin.ts:48-51` (commenti "F2 will add: inputMap, outputMap"). |
| `broker-mapper-wrapper.ts` (composition decorator) | `core/plugin-registry.ts` (`createPluginScopedBroker`, riga 60-98 Proxy pattern) | role-match | Decisione D-49 critica: NON modificare `bus.ts`. F2 introduce un wrapper sul Broker che: (a) intercetta `registerPlugin(descriptor)` per chiamare `mapper.compileMappings(descriptor)` post-`onRegister`; (b) wrappa `subscribe` per applicare `inputMap` del consumer (step 11/12) prima di consegnare al handler reale. Pattern Proxy come `createPluginScopedBroker` ma con scope diverso. **Alternativa preferita (verifica con planner):** estendi la `class Broker` di F1 via subclassing in F2 oppure passa `MapperEngine` come dependency injection nel constructor (richiede modifica minima a `broker.ts` — Rule 4 trade-off). Il planner valuterà. | `createPluginScopedBroker` Proxy idiom; `Reflect.get` + bind. |
| `index.ts` (barrel public API F2) | `src/index.ts` di F1 (intero — riga 1-87) | esatto | Header JSDoc `@packageDocumentation` italiano. `export type * from './types'` (re-export tipi). `export { CanonicalRegistry, AliasRegistry, TransformPipeline, MapperEngine, valibotAdapter } from ...`. **Side-effect import `import './augment'`** per attivare declaration merging. | Header JSDoc structure (`index.ts:1-24`); ordine type-only re-export prima dei runtime export. |

### 2.3 Test files F2 (`packages/mapper/src/**/*.test.ts`)

> Co-locato con il source. Pattern F1: file `X.ts` ha sempre `X.test.ts` accanto. Vitest jsdom env (`vitest.config.ts:6`).

| File test F2 | Analogo F1 | Match | Adattamento | Reuse |
|--------------|------------|-------|-------------|-------|
| `canonical-registry.test.ts` | `core/topic-registry.test.ts` (intero — riga 1-77) | esatto | Replica i 7 test con `CanonicalRegistry` invece di `TopicRegistry`. Aggiungi test specifici: `requires` resolution OK + fail; schema duplicato throw `BrokerError` `canonical.id.duplicate`; freeze schema dopo register (D-04 deep-freeze applicato anche al canonical schema in dev mode? — verifica con planner). | `vi.fn()` per listener; `expect(...).toEqual(...)` per array immutability check; pattern "list returns fresh array on each call". |
| `alias-registry.test.ts` | `core/topic-registry.test.ts` + `core/topic-matcher.test.ts` (resolution con priorità) | role-match | Test resolution order D-40 (esplicito > scoped > globale > name match); test ambiguity → `ambiguous: true` flag (D-41); test scope isolation (plugin A scoped alias NOT seen by plugin B). | TopicMatcher resolution test idiom con multi-level priority. |
| `transform-pipeline.test.ts` | `core/event-tap.test.ts` (riga 26-66 `safeTapStep` con throw) | esatto | Test `register` + `apply`. Test transform throw con onFailure: `'block'` → throw wrapped `BrokerError` con `cause` set; `'skip'` → return undefined; `'fallback'` → return default. Test `transform.id.duplicate` throw. | `vi.fn(() => { throw new Error('boom') })` per simulate transform failure (riga `event-tap.test.ts:36-38`). |
| `valibot-adapter.test.ts` | `core/event-validator.test.ts` | esatto | Test `validate` ritorna `{ ok: true, value }` su success; `{ ok: false, issues }` su fail. Niente throw. | `v.object()` schema fixture; `safeParse` result shape. |
| `mapper-engine.test.ts` | `core/bus.test.ts` (intero — focus su dispatch + tap orchestration) | esatto | Test `compileMappings`: cycle → throw `BrokerError` `mapping.cycle.detected` con `details: { pluginId, cycle: [field1, field2, field1] }` (D-35); test `applyOutputMap` produce canonical correttamente; test `applyInputMap` per consumer; test rename, nested, default, transform, derive, partial (PRD §14.2 — ognuno è un test). Test field required mancante (D-42) → throw + publish `mapping.error`; test post-mapping validation fail (step 6/12). | `bus.test.ts` pattern: harness setup, `vi.fn()` handler, `expect(handler).toHaveBeenCalledWith(...)`. |
| `inspector.test.ts` | `core/event-tap.test.ts` | esatto | Test `getMappingInspector()` ritorna numbers correti; lastErrors array bounded (max N) per evitare memory leak; `metadata.transformsApplied` valorizzato in snapshot quando rilevante (D-47). | — |

### 2.4 Test fixture F2 (`packages/mapper/src/test-utils/`)

| File | Analogo F1 | Match | Adattamento |
|------|------------|-------|-------------|
| `mapper-harness.ts` | `core/test-utils/pipeline-harness.ts` (intero — riga 1-76) | esatto | `createMapperHarness({ debug?, transforms?, schemas? })` ritorna `{ broker, mapper, steps, byStep, defineCanonicalSchema, defineTransform, expectMappingApplied }`. **Wraps `createPipelineHarness` di F1** + esponi MapperEngine. Helper `expectMappingApplied(eventId, transformsApplied: string[])` verifica `metadata.transformsApplied` nel tap snapshot. **Ownership `src/test-utils/`** (NON `__integration__/`) per riuso in F3+. | `createPipelineHarness` shape (broker + steps + reset + byStep); type minimo `MapperHarness` per Rule 2 readability. |

### 2.5 Integration test F2 (`packages/mapper/src/__integration__/`)

| File | Analogo F1 | Match | Adattamento |
|------|------------|-------|-------------|
| `weather-scenario.integration.test.ts` (D-53) | `core/__integration__/event-tap.integration.test.ts` (riga 1-114) | esatto | Plugin form publica `weather.requested` con `città/data`; mapper produce canonical `{ location, forecast_date }`; plugin widget riceve `{ location, day-prevision }` via `inputMap` inverso. Verifica end-to-end con `harness.byStep('event.mapped.canonical')` e `harness.byStep('event.mapped.consumer')`. **Trasforma `parseItalianDate` + `normalizeLocationName` registrate al boot.** **Senza HTTP** (deferred F3). | `byStep` filtering pattern; `expect(...).toEqual(...)` su payload fra step. |
| `cycle-detection.integration.test.ts` (D-54) | `core/__integration__/plugin-cleanup.integration.test.ts` (struttura register + assert post-register) | role-match | Register plugin con descriptor che dichiara mapping circolare; assert throw `BrokerError` con `code === 'mapping.cycle.detected'` E `details.cycle === [...]`; assert plugin NON registered (rollback come `plugin-registry.ts:140-143`). | Rollback pattern + state machine assertion. |
| `mapping-error-event.integration.test.ts` (D-58) | `core/__integration__/handler-isolation.integration.test.ts` (publish system.error) | role-match | Subscriber a `mapping.error`; publish event che fallisce mapping (transform throw + onFailure 'block'); verifica subscriber riceve `mapping.error` con payload `{ error, sourceEvent, step }`. | `system.error` publish pattern (`bus.ts:225-267` `handleHandlerError`). |
| `inspector-snapshot.integration.test.ts` | `core/__integration__/event-tap.integration.test.ts` (focus su `getDebugSnapshot`) | esatto | Verifica `getDebugSnapshot().mappings = { canonicalSchemas, registeredAliases, registeredTransforms, lastMappingErrors }` (D-48). Confronta pre/post `registerCanonicalSchema/registerTransform/registerAlias`. | `getDebugSnapshot()` baseline pattern (`plugin-cleanup.integration.test.ts:38-67`). |
| `plugin-cleanup-mapper.integration.test.ts` | `core/__integration__/plugin-cleanup.integration.test.ts` (intero — riga 1-142) | esatto | LIFE-02 extension F2: `unregisterPlugin` deve rimuovere ANCHE i transform/alias registrati dal plugin (cascade). Pre/post `getDebugSnapshot().mappings.registeredTransforms` deve tornare al baseline. | Cascade test pattern; `await broker.unregisterPlugin(...)` + assert. |

---

## 3. Stack & build (replica da `@sembridge/core`)

### 3.1 `package.json` mapper (estendere placeholder esistente)

File corrente `packages/mapper/package.json` (placeholder F1 — riga 1-18). F2 deve **mantenere il name `@sembridge/mapper`** + estendere replicando `packages/core/package.json` (verificato — riga 1-57):

| Campo | Valore F2 (replica F1) | Note |
|-------|-------------------------|------|
| `"type"` | `"module"` | ESM-only |
| `"main"`, `"module"` | `"./dist/index.js"` | dual entry point |
| `"types"` | `"./dist/index.d.ts"` | bundled `.d.ts` da tsup `dts: true` |
| `"exports"."."` | `{ types, import }` | conditional exports |
| `"exports"."./package.json"` | `"./package.json"` | per attw compliance |
| `"files"` | `["dist", "README.md", "LICENSE"]` | publish surface |
| `"sideEffects"` | `false` | ⚠️ verifica con planner: il file `augment.ts` ha side-effects (declaration merging registration). **Decisione: side-effects per `augment.ts`** → `"sideEffects": ["./dist/augment.js"]` (array invece di boolean). Permette tree-shaking del resto. |
| `"engines.node"` | `">=20"` | identico F1 |
| `"scripts"` | `build/test/test:watch/test:coverage/typecheck/clean` (pattern F1 riga 31-38) | identici a `@sembridge/core` |
| `"dependencies"` | `valibot: 1.3.1` (versione locked F1); **NEW: `@sembridge/core: workspace:*`** | F2 dipende da F1 via workspace protocol pnpm |
| `"devDependencies"` | `tsup, typescript, vitest, jsdom` (versione locked F1) | identici a F1 |
| `"size-limit"` | `[{ name: "@sembridge/mapper (gzip)", path: "dist/index.js", limit: "10 KB", gzip: true }]` | budget mapper più ampio del core (~10 KB vs 8 KB) |

### 3.2 `tsup.config.ts` (replica esatta da F1)

File F1 `packages/core/tsup.config.ts` (riga 1-19). F2 replica IDENTICO con due modifiche:

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: false,
  target: 'es2022',
  platform: 'browser',
  external: [/^node:/, '@sembridge/core'], // ⚠️ DIFF F1: external @sembridge/core (peer-like)
  banner: {
    js: '/* @sembridge/mapper — MIT — https://github.com/<TBD>/sembridge */', // ⚠️ DIFF F1: name change
  },
})
```

### 3.3 `tsconfig.json` (replica esatta da F1)

File F1 `packages/core/tsconfig.json` (riga 1-12). F2 replica IDENTICO:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "ignoreDeprecations": "6.0"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "**/*.test.ts", "**/*.spec.ts"]
}
```

Eredita `tsconfig.base.json` con `strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes + isolatedDeclarations + verbatimModuleSyntax`.

### 3.4 `vitest.config.ts` (replica esatta da F1)

File F1 `packages/core/vitest.config.ts` (riga 1-26). F2 replica IDENTICO con name diverso:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@sembridge/mapper', // ⚠️ DIFF F1
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
    typecheck: {
      enabled: false,
    },
  },
})
```

**Open item ereditato F1:** `@vitest/coverage-v8` come devDep root (D-55) — F2 deve installarlo nel plan dedicato 02-XX (final gate, simile a 01-11).

### 3.5 Biome / format / lint

`biome.json` root (verificato — riga 1-58) si applica a tutto il monorepo. **Nessuna config F2 necessaria** — F2 eredita:
- `quoteStyle: 'single'`, `semicolons: 'asNeeded'`, `trailingCommas: 'all'`, `arrowParentheses: 'always'`, `lineWidth: 100`
- `useImportType: 'error'` (forza `import type` quando il symbol è usato solo come tipo)
- `noNonNullAssertion: 'warn'`, `noExplicitAny: 'error'`

### 3.6 Monorepo wiring

File root `pnpm-workspace.yaml` (verificato esiste — 27 byte) include già `packages/*` glob. **Nessuna modifica root necessaria** — F2 fa solo `pnpm install` per linkare `@sembridge/mapper` al workspace.

---

## 4. Pattern reuse opportunities (cross-cutting)

### 4.1 Error handling (riusa interamente da `@sembridge/core`)

**Pattern unico F1, F2 lo riusa SENZA reinventare:**

```ts
// Da: packages/core/src/core/broker-error.ts:45-58
export function createBrokerError(params: CreateBrokerErrorParams): BrokerError {
  const err = new Error(params.message) as Error as MutableBrokerError
  err.name = 'BrokerError'
  err.code = params.code
  err.category = params.category
  if (params.details) err.details = params.details
  if (params.originalError) {
    err.originalError = params.originalError
    err.cause = params.originalError  // ES2022 chaining
  }
  if (params.routeId) err.routeId = params.routeId
  if (params.topic) err.topic = params.topic
  if (params.eventId) err.eventId = params.eventId
  return err as BrokerError
}
```

**F2 usage** (esempio cycle detection D-35):

```ts
import { createBrokerError } from '@sembridge/core'

throw createBrokerError({
  code: 'mapping.cycle.detected',
  category: 'mapping',  // già definita in F1 ErrorCategory union
  message: `Mapping cycle detected for plugin "${pluginId}": ${cycle.join(' → ')}`,
  details: { pluginId, cycle },
})
```

**F2 usage** (esempio transform failure D-44):

```ts
import { createBrokerError } from '@sembridge/core'

try {
  return transform.fn(input, ctx)
} catch (err) {
  const wrapped = createBrokerError({
    code: 'mapping.transform.failed',
    category: 'mapping',
    message: err instanceof Error ? err.message : String(err),
    ...(err instanceof Error && { originalError: err }),  // exactOptionalPropertyTypes spread
    details: { pluginId, fieldName, transformName },
  })
  if (onFailure === 'block') throw wrapped
  // onFailure === 'skip' → return undefined; 'fallback' → return default
}
```

### 4.2 Tap orchestration (riusa `safeTapStep` da F1)

```ts
// Da: packages/core/src/core/event-tap.ts:23-34
export function safeTapStep(tap, step, snapshot, onError?) {
  try { tap.onPipelineStep(step, snapshot) }
  catch (e) { onError?.(e) }
}
```

**F2 usage** nei 5 nuovi step (D-50):

```ts
import { safeTapStep } from '@sembridge/core'

// Step 5: event.mapped.canonical
safeTapStep(this.tap, 'event.mapped.canonical', {
  eventId: event.id,
  topic: event.topic,
  step: 'event.mapped.canonical',
  timestamp: Date.now(),
  durationMs: performance.now() - start,
  ...(this.debugMode && { payloadBefore: event.payload, payloadAfter: canonicalPayload }),  // D-47
  metadata: { transformsApplied },
})
```

### 4.3 Lifecycle cascade (estendi `unregister` di F1)

**Pattern F1** (`plugin-registry.ts:182-205`):

```ts
// CASCADE CLEANUP D-26 (LIFE-02 — closes PRD §39 #7):
//   1. unsubscribe everything owned by plugin
//   2. (F3) routes — not yet implemented in F1
//   3. (F2) transforms — not yet implemented in F1
//   4. fire AbortController for in-flight async handlers
const unsubCount = this.bus.unsubscribeByOwner(id)
reg.abortController.abort()
```

**F2 chiude punto 3:** `MapperEngine.unregisterPluginMappings(id)` rimuove canonical schema (se plugin-scoped), alias scoped, transforms registrate dal plugin. Il broker wrapper invoca questo metodo dentro la cascade post `bus.unsubscribeByOwner(id)` e PRIMA di `abortController.abort()`.

**Decisione D-49 critica:** se il planner sceglie il pattern wrapper/decorator (NON modifica `bus.ts`/`plugin-registry.ts`), allora il wrapper deve intercettare `unregister` ANCHE per cascadare le mapper registrazioni. Verifica con planner.

### 4.4 Conditional spread per `exactOptionalPropertyTypes`

Pattern enforcement F1 (`event-factory.ts:62-78`):

```ts
return {
  id: params.id ?? nanoid(),
  topic: params.topic,
  // ...
  ...(params.metadata && { metadata: params.metadata as never }),
  ...(params.correlationId && { correlationId: params.correlationId }),
  ...(params.ttlMs !== undefined && { ttlMs: params.ttlMs }),  // 0 valido → !== undefined
  ...(params.dedupeKey && { dedupeKey: params.dedupeKey }),
}
```

**F2 deve replicare per ogni field opzionale del canonical schema, mapping rule, validator issue, ecc.**

### 4.5 Branded type per type confusion prevention

Pattern F1 (`broker-event.ts:54-61`):

```ts
declare const __eventIdBrand: unique symbol
export type EventId = string & { readonly [__eventIdBrand]: true }
```

**F2 deve applicare questo pattern a:**

```ts
declare const __canonicalSchemaIdBrand: unique symbol
export type CanonicalSchemaId = string & { readonly [__canonicalSchemaIdBrand]: true }

declare const __transformNameBrand: unique symbol
export type TransformName = string & { readonly [__transformNameBrand]: true }
```

Solo cast esplicito `as CanonicalSchemaId` permette di "instanziare" — audit-able via grep.

---

## 5. Anti-pattern da evitare (lessons learned F1 + PITFALLS)

### 5.1 Da PITFALLS.md (specifici al mapper — Pitfall #3 + #16)

| Anti-pattern | Severità | Mitigazione F2 |
|--------------|----------|-----------------|
| **Mapping automatico via alias trattato come fonte di verità** (Pitfall 3.A, 3.B) | BLOCKING | D-40: mapping esplicito SEMPRE prevale; D-41: warning runtime su alias automatico (publish `mapping.warn`, NO throw). |
| **Mapping ricompilato a runtime su ogni publish** (Pitfall 16.B) | BLOCKING (perf) | D-34: pre-compile al `registerPlugin`. Map<localField, CompiledFieldMapping> O(1) lookup. NO compile in hot-path. |
| **Cycle detection a runtime invece che a register** (Pitfall 3.D) | HIGH | D-35: visited Set al `compileMappings`, throw IMMEDIATO al register. Mai a runtime publish. |
| **Schema canonico non versionato** (Pitfall 3.C) | HIGH | D-36: `requires?: string[]` con check al register. Plain string version (no SemVer parsing in F2 — V2). |
| **Alias globali shadow tra plugin** (Pitfall 3.B) | BLOCKING | AliasRegistry distingue `globalAliases` vs `pluginScopedAliases` (Map<pluginId, ...>). Plugin A non vede alias scoped di plugin B. |
| **Transform fail silente** (PRD §39 #4 — VAL-09) | HIGH | D-44: `onFailure: 'block' \| 'skip' \| 'fallback'` esplicito per field. Default `'block'` → publish `mapping.error` (D-58). NO silent skip default. |
| **Field mancante senza policy esplicita** (PRD §39 #3 — VAL-08) | HIGH | D-42: `required: true` → throw + publish `mapping.error`. `required: false + default` → applica default. `required: false + no default` → field assente (NO `undefined` per `exactOptionalPropertyTypes`). |
| **Publish `<topic>.failed` da F2 mapper** | HIGH | D-59: NO. `<topic>.failed` è F3 (route HTTP). F2 emette solo `mapping.error`. Niente confusione di responsabilità. |

### 5.2 Da F1 lessons learned

| Anti-pattern F1 evitato | F2 applicazione |
|--------------------------|------------------|
| **Modificare il bus.ts per estendere la pipeline** | D-49: F2 NON tocca `bus.ts`. Composition wrapper o subclassing. Vincolo architetturale RESEARCH §3.2 (EventTap pre-instrumented). |
| **Singleton broker** | D-30: NO singleton anche per MapperEngine. Ogni `createBroker(config)` istanzia un nuovo MapperEngine indipendente. |
| **Re-export tipi interni nel barrel pubblico** | F1 ha già escluso `PluginRegistration`, `EventBusOptions`, `EventBusStats`, `BrokerDebugSnapshot`, `PluginScopedBroker` dal barrel (`index.ts:18-22`). F2 fa lo stesso: `CompiledMapping`, `MapperEngineOptions`, ecc. NON ri-esportati. |
| **`unknown` come tipo pubblico** | F1 ha lasciato `PluginContext.broker: unknown` come placeholder consapevole (plan 03 → risolto in plan 08 via `createPluginScopedBroker`). F2 NON deve introdurre nuovi `unknown` non documentati. Se serve placeholder per F3, commenta esplicitamente come F1 ha fatto. |
| **`as any`** | Biome `noExplicitAny: error`. F1 usa `as never` solo dove documentato (`event-factory.ts:67-68` audit-able via grep). F2 segue stesso pattern: niente `any`, solo `unknown` + narrow + `as <specific>` motivato. |
| **Listener throw rompe propagazione** | Pattern F1 (`topic-registry.ts:28-34`): try/catch swallow per isolare listener. F2 applica a `CanonicalRegistry.onRegistered`. |
| **`!` non-null assertion** | Biome `noNonNullAssertion: warn`. F1 usa narrow + `if (!x) return` (`topic-matcher.ts:104-107`). F2 segue. |
| **Mutation esterna del state interno** | F1 espone `[...this.topics].sort()` (copia, riga 42-44). F2 fa lo stesso per `CanonicalRegistry.list()`, `AliasRegistry.list()`, `TransformPipeline.list()`. Test "list returns fresh array" (`topic-registry.test.ts:68-75`). |

### 5.3 TypeScript pitfalls (Pitfall #12) — già coperti F1

- `unique symbol` brand types (vedi §4.5).
- `verbatimModuleSyntax: true` → `import type` esplicito sempre.
- `isolatedDeclarations: true` → ogni export ha return type esplicito (vedi `plugin-registry.ts:81` `): PluginScopedBroker {`).
- `noUncheckedIndexedAccess: true` → `array[i]` è `T | undefined`, F2 deve gestirlo (vedi `topic-matcher.ts:102-104`).

---

## 6. Files con divergenza pianificata da F1 (Rule 4 candidati)

| File F2 | Divergenza vs F1 | Motivazione | Azione planner |
|---------|------------------|-------------|----------------|
| `broker-mapper-wrapper.ts` (composition) o subclassing `Broker` | F1 non ha pattern decorator equivalente | D-49 vincolo: NO modifica `bus.ts`/`broker.ts` di F1. Ma il wiring del MapperEngine richiede intercettare `registerPlugin` e `subscribe`. | Planner sceglie tra: (a) Proxy wrapper come `createPluginScopedBroker`; (b) subclass `class MapperBroker extends Broker`; (c) DI nel `Broker` constructor (richiede modifica minima a `broker.ts`). Documenta come Rule 4 con trade-off. |
| `package.json` `sideEffects` | F1 ha `sideEffects: false` (boolean) | F2 ha `augment.ts` che DEVE essere importato per side-effect (TS declaration merging). Tree-shaker non deve eliminarlo. | `"sideEffects": ["./dist/augment.js"]` (array). Documenta in plan summary. |
| `valibot-adapter.ts` | F1 `event-validator.ts` THROW su fail. F2 adapter ritorna `{ ok: false, issues }` (NO throw) | D-38: caller decide cosa fare con result (mapper-engine può publish `mapping.error` o applicare fallback). Adapter agnostic. | Planner conferma D-38 + documenta in JSDoc del file. |

---

## 7. Coverage & quality gate (replica F1 final gate plan 01-11)

Pattern F1 plan 01-11 (final gate). F2 deve avere un plan equivalente (es. 02-09 o 02-10):

| Gate | Pattern F1 | F2 |
|------|------------|-----|
| **Coverage v8** | `pnpm test:coverage` con thresholds 90/85/90/90 | Identico. **Open item ereditato:** install `@vitest/coverage-v8` come devDep root (D-55). |
| **Build** | `pnpm build` produce `dist/index.js + index.d.ts` | Identico. |
| **publint** | `pnpm ci:publint` (root) | Estendi a `@sembridge/mapper`: `pnpm --filter @sembridge/mapper exec publint`. |
| **attw** | `pnpm ci:attw` (root, ESM-only profile) | Estendi a `@sembridge/mapper`. |
| **size-limit** | `pnpm ci:size` (8 KB gzip per core) | Aggiungi entry `@sembridge/mapper (gzip): 10 KB`. |
| **Smoke import test** | F1 verifica 6 entry pubbliche | F2 verifica le entry pubbliche di `@sembridge/mapper` (CanonicalRegistry, AliasRegistry, TransformPipeline, MapperEngine, valibotAdapter, types). |
| **JSDoc copertura** | F1 plan 01-11 ha JSDoc su API pubblica runtime + tipi pubblici | F2 fa lo stesso (DOC-03). |
| **README** | F1 ha `packages/core/README.md` (11 KB, scenario meteo, API pubblica, esempi) | F2 ha `packages/mapper/README.md` con scenario meteo D-53 esteso, API canonical/alias/transform, esempi mapping (PRD §14.2). |

---

## 8. Coverage del PATTERNS.md

| Categoria nuovi file F2 | File mappati ad analogo F1 | File senza analogo |
|--------------------------|-----------------------------|---------------------|
| Tipi pubblici (`types/*.ts`) | 6/6 | 0 |
| Moduli runtime (`*.ts`) | 8/8 | 0 (tutti hanno analogo F1 esatto o role-match) |
| Test co-locati (`*.test.ts`) | 6/6 | 0 |
| Test fixture | 1/1 | 0 |
| Integration test | 5/5 | 0 |
| Build/config | 4/4 (`package.json`, `tsup.config.ts`, `tsconfig.json`, `vitest.config.ts`) | 0 |

**Totale:** 30/30 file F2 coperti. Nessun file richiede pattern "from scratch" — tutti hanno analogo F1 da copiare/adattare.

---

## 9. Metadata

**Analog search scope:** `packages/core/src/**/*.ts` + `packages/core/{package,tsup,tsconfig,vitest}.config.{json,ts}` + `tsconfig.base.json` + `biome.json` + `pnpm-workspace.yaml`.
**Files scanned:** 22 source/config + 12 integration test + 1 PRD + 1 PITFALLS + 1 CONTEXT.
**Pattern extraction date:** 2026-04-29.
**Frozen reference commit:** `f7faadb` (Phase 1 closure — verifier PASS).
**Downstream consumer:** `gsd-planner` per Phase 2 → produrrà ~6-10 plan PLAN.md secondo CONTEXT D-52.

---

*Phase: 2-Canonical Model & Mapper*
*PATTERNS.md author: gsd-pattern-mapper (model `claude-opus-4-7-1`)*
