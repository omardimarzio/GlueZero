---
phase: 02-canonical-model-mapper
plan: 02
subsystem: mapper-public-types
tags: [types, foundation, public-surface, branded-types, declaration-merging-prep, isolated-declarations]

# Dependency graph
requires:
  - phase: 02-canonical-model-mapper
    plan: 01
    provides: "@gluezero/mapper buildable + workspace link a @gluezero/core + size-limit budget 5 KB + coverage v8 abilitata"
provides:
  - "6 file packages/mapper/src/types/*.ts (5 modulo + 1 barrel) con superficie tipi pubblici F2 completa"
  - "Branded types `CanonicalSchemaId` + `TransformName` (Pitfall #12 — type confusion prevention) replicando pattern EventId di @gluezero/core"
  - "Discriminated union `ValidationResult<T>` + interface `ValidatorAdapter` NO-throw (D-37/D-38)"
  - "Literal union `MappingErrorCode` con 5 codici F2 (D-58 — chiusura ERR-02 extension) + type guard runtime `isMappingErrorCode`"
  - "Barrel `types/index.ts` re-export type-only (verbatimModuleSyntax) — wired in main barrel da plan 02-09 (augment.ts)"
  - "Chiusura `unknown` placeholder F1 al type-level (D-32) — runtime wiring in 02-09 augment.ts"
affects: [02-03-canonical-registry, 02-04-alias-registry, 02-05-transform-pipeline, 02-06-valibot-adapter, 02-07-mapper-engine, 02-08-broker-wrapper, 02-09-augment, 02-10-integration-tests, 02-11-cycle-detection, 02-12-final-gate-DOC-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Branded type con `unique symbol` distinto per ogni id (CanonicalSchemaId vs TransformName) — replicato da `EventId` di @gluezero/core/types/broker-event.ts:54-61"
    - "Tutti i field interface `readonly` (immutabilità by-default per prevenire mutation post-register — T-02-02-03 mitigation)"
    - "Result-object `{ ok: true; value } | { ok: false; issues }` invece di throw per ValidatorAdapter (D-38) — caller decide cosa fare con il fail"
    - "Literal union additive (MappingErrorCode) — aggiungere codici è non-breaking; rimuoverli sì (T-02-02-05 policy)"
    - "Type-guard runtime backed da ReadonlySet<string> per isMappingErrorCode (O(1) lookup, no array scan)"
    - "Barrel `export type { ... }` esplicito con JSDoc 1-liner per ogni export (verbatimModuleSyntax + IntelliSense ready)"

key-files:
  created:
    - "packages/mapper/src/types/canonical-schema.ts (96 LOC) — CanonicalSchema + CanonicalSchemaId branded + FieldDescriptor + FieldFailureMode + FieldType"
    - "packages/mapper/src/types/input-output-map.ts (80 LOC) — InputMap + OutputMap + MappingRule + DeriveDescriptor"
    - "packages/mapper/src/types/transform.ts (66 LOC) — TransformFn + TransformDescriptor + TransformContext + TransformName branded"
    - "packages/mapper/src/types/validator-adapter.ts (70 LOC) — ValidatorAdapter + ValidationIssue + ValidationResult discriminated union"
    - "packages/mapper/src/types/mapping-error.ts (60 LOC) — MappingErrorCode literal union 5 codici + isMappingErrorCode type guard runtime"
    - "packages/mapper/src/types/index.ts (61 LOC) — barrel type-only re-export di tutti i tipi pubblici F2 + isMappingErrorCode runtime"
  modified: []

key-decisions:
  - "Nessuna deviazione dalle decisioni D-31..D-59 di 02-CONTEXT.md — il plan è eseguito esattamente come scritto"
  - "Tutti i field readonly by-default (immutabilità compile-time; il deepFreeze runtime sarà aggiunto in plan 02-03 al CanonicalRegistry.register)"
  - "Barrel `types/index.ts` separato dal main barrel `src/index.ts` — wired in 02-09 (augment.ts) senza che questo plan tocchi `src/index.ts`. Coerente con plan 02-01 SUMMARY che ha lasciato i runtime/type export nel main barrel commentati come placeholder per i plan successivi"
  - "`unknown` mantenuto come tipo intenzionale documentato in: FieldDescriptor.default, MappingRule.default, TransformFn input/output, ValidatorAdapter.validate(schema, payload). Tutti documentati con JSDoc + commento header. Niente `any` (Biome `noExplicitAny: error`)"
  - "ValidationIssue minimal subset (path/message/expected/received) per essere mappabile da Zod/Ajv adapters in V2 senza breaking change — D-38 forward-compat"
  - "Bracket notation per accesso al brand symbol (`{ readonly [__canonicalSchemaIdBrand]: true }`) per `noPropertyAccessFromIndexSignature: true` enforcement"

patterns-established:
  - "Pattern bootstrap tipi pubblici nuovo package F2+: copia esatta della shape `packages/core/src/types/index.ts` (riga 1-41) con JSDoc 1-liner per ogni export — riusabile per @gluezero/{routing, gateway, worker, cache, devtools} in F3-F6"
  - "Pattern branded type con `unique symbol` separato per ciascun id: replicato dal pattern EventId; valido per qualsiasi nuovo branded type futuro (RouteId, WorkerId, CacheKeyId, ecc.)"
  - "Pattern discriminated union NO-throw per adapter pluggable: replicabile per HttpAdapter (F3), WorkerAdapter (F5), CacheAdapter (F6) — caller decide cosa fare col fail"
  - "Pattern literal union + ReadonlySet<string>-backed type guard per error codes: estensibile a RouteErrorCode (F3), WorkerErrorCode (F5), ecc."

requirements-completed: []
requirements-type-level:
  - MAP-01
  - MAP-02
  - MAP-03
  - MAP-12
  - VAL-03
  - VAL-04

# Metrics
duration: 9min
completed: 2026-04-29
---

# Phase 2 Plan 02: Public Types F2 Summary

**Completata la superficie tipi pubblici di `@gluezero/mapper` (Wave 2 — gating per Wave 3 paralleli): 6 file `types/*.ts` (5 modulo + 1 barrel) con `isolatedDeclarations: true` enforcement, branded types per type confusion prevention, discriminated union NO-throw per ValidatorAdapter pluggable, e literal union 5 codici `MappingErrorCode`. Chiude i `unknown` placeholder F1 (D-32) al type-level — runtime wiring in plan 02-09.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-29T10:42:38Z
- **Completed:** 2026-04-29T10:52:34Z
- **Tasks:** 2/2 completed
- **Files created:** 6 nuovi (433 LOC totali types-only)
- **Files modified:** 0

## Accomplishments

- 6 file `packages/mapper/src/types/*.ts` creati con header italiano + JSDoc IntelliSense + reference D-XX/REQ-ID/PRD §
- 2 branded types (`CanonicalSchemaId`, `TransformName`) con `unique symbol` distinto (Pitfall #12 mitigation, pattern EventId replicato)
- Tutti i field interface `readonly` (immutabilità by-default — T-02-02-03 mitigation a compile-time)
- Discriminated union `ValidationResult<T>` con vincolo NO-throw documentato in JSDoc (D-38)
- Literal union 5 codici `MappingErrorCode` (D-58) + type guard runtime `isMappingErrorCode` backed da `ReadonlySet<string>` per O(1) lookup
- Barrel `types/index.ts` con 4 blocchi `export type { ... }` (canonical-schema + input-output-map + transform + validator-adapter) + 1 export type per mapping-error + 1 export runtime per `isMappingErrorCode`; JSDoc 1-liner su ogni export
- Cross-package import `import type { BrokerLogger } from '@gluezero/core'` in `transform.ts` con `import type` esplicito (verbatimModuleSyntax)
- Build `dist/index.js` 68 B / `dist/index.d.ts` 13 B (mapper barrel non ancora popolato — coerente con plan 02-09)
- Core regression: 248/248 test passing (no break su F1)

## Task Commits

Each task was committed atomically (no TDD in questo plan: tipi-only senza runtime testabile; il primo test runtime arriva al plan 02-03 con TDD RED→GREEN sul `CanonicalRegistry`).

1. **Task 1: Tipi canonical schema + transform + input/output map** — `210013b` (feat)
   - 3 file: `canonical-schema.ts` (96 LOC), `input-output-map.ts` (80 LOC), `transform.ts` (66 LOC)
   - Branded `CanonicalSchemaId` + `TransformName`, `FieldDescriptor` con `required`/`default`/`onFailure`, `MappingRule` con i 4 modalità (rename/transform/default/derive), `TransformFn` con `TransformContext` readonly
2. **Task 2: ValidatorAdapter + MappingErrorCode + barrel index** — `af38fb0` (feat)
   - 3 file: `validator-adapter.ts` (70 LOC), `mapping-error.ts` (60 LOC), `index.ts` (61 LOC barrel)
   - `ValidatorAdapter` interface NO-throw + `ValidationResult<T>` discriminated union, `MappingErrorCode` literal union 5 codici + type guard, barrel re-export type-only

**Plan metadata commit:** TBD (eseguito alla fine del workflow tramite `gsd-sdk query commit`).

## Files Created

### packages/mapper/src/types/

- **`canonical-schema.ts`** (96 LOC) — Esporta:
  - `CanonicalSchemaId` branded `string & { readonly [__canonicalSchemaIdBrand]: unique symbol }`
  - `FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any'`
  - `FieldFailureMode = 'block' | 'skip' | 'fallback'` (D-44 — chiusura PRD §39 #4)
  - `FieldDescriptor { type, required?, default?, onFailure?, description? }` (D-42, D-43, D-44)
  - `CanonicalSchema { id, requires?, fields, description? }` (D-36, REQ MAP-01/MAP-02)

- **`input-output-map.ts`** (80 LOC) — Esporta:
  - `DeriveDescriptor { sources, transform }` (PRD §14.5, REQ MAP-09)
  - `MappingRule { source?, transform?, default?, derive? }` (PRD §14.2 — 4 modalità di mapping)
  - `OutputMap = Readonly<Record<string, MappingRule>>` (locale → canonico)
  - `InputMap = Readonly<Record<string, MappingRule>>` (canonico → consumer)

- **`transform.ts`** (66 LOC) — Esporta:
  - `TransformName` branded (Pitfall #12 — distinto da CanonicalSchemaId per prevenire type confusion)
  - `TransformContext { logger, pluginId, fieldName, canonicalSchemaId? }` readonly
  - `TransformFn = (input: unknown, ctx: TransformContext) => unknown`
  - `TransformDescriptor { name, fn, description? }` (D-31)
  - Import: `import type { BrokerLogger } from '@gluezero/core'` (verbatimModuleSyntax)

- **`validator-adapter.ts`** (70 LOC) — Esporta:
  - `ValidationIssue { path?, message, expected?, received? }` minimal subset Valibot.Issue
  - `ValidationResult<T = unknown>` discriminated union `{ ok: true; value: T } | { ok: false; issues }`
  - `ValidatorAdapter { validate<T>(schema, payload): ValidationResult<T> }` interface NO-throw (D-37/D-38)

- **`mapping-error.ts`** (60 LOC) — Esporta:
  - `MappingErrorCode` literal union 5 codici F2 (D-58):
    - `'mapping.cycle.detected'` (D-35 — circular mapping al register)
    - `'mapping.transform.failed'` (D-44/D-45 — transform throw + onFailure 'block')
    - `'mapping.field.missing'` (D-42 — field required:true mancante)
    - `'mapping.canonical.validation.failed'` (D-39 — Valibot fail al passo 6)
    - `'mapping.consumer.validation.failed'` (D-39 — Valibot fail al passo 12)
  - `isMappingErrorCode(code: string): code is MappingErrorCode` runtime type guard backed da `ReadonlySet<string>` per O(1) lookup

- **`index.ts`** (61 LOC barrel) — `export type { ... }` di:
  - canonical-schema: `CanonicalSchemaId`, `CanonicalSchema`, `FieldFailureMode`, `FieldDescriptor`, `FieldType`
  - input-output-map: `OutputMap`, `InputMap`, `MappingRule`, `DeriveDescriptor`
  - transform: `TransformName`, `TransformFn`, `TransformDescriptor`, `TransformContext`
  - validator-adapter: `ValidatorAdapter`, `ValidationIssue`, `ValidationResult`
  - mapping-error: `MappingErrorCode`
  - Plus runtime: `export { isMappingErrorCode } from './mapping-error'`
  - JSDoc 1-liner su ogni export (pattern @gluezero/core/types/index.ts)

## Verification

| Comando | Risultato |
|---------|-----------|
| `pnpm --filter @gluezero/mapper typecheck` (post Task 1) | Exit 0 (no errori TS, isolatedDeclarations enforcement OK) |
| `pnpm --filter @gluezero/mapper typecheck` (post Task 2) | Exit 0 |
| `pnpm --filter @gluezero/mapper test` | Exit 0 (passWithNoTests; nessun test runtime in questo plan, atteso — TDD inizia in 02-03) |
| `pnpm --filter @gluezero/mapper build` | Exit 0; `dist/index.js` 68 B + `dist/index.d.ts` 13 B (barrel principale ancora skeleton — coerente con plan 02-09 che attiverà il wiring) |
| `pnpm --filter @gluezero/core test` | Exit 0; **24 file/248 test passing** (no regression Phase 1) |
| Grep verifica acceptance Task 1 | PASSED (10/10 grep checks) |
| Grep verifica acceptance Task 2 | PASSED (10/10 grep checks) |
| File count `packages/mapper/src/types/*.ts` | 6/6 (5 modulo + 1 barrel) |
| Audit `any` literal | 0 occorrenze come tipo (solo `'any'` come string literal in `FieldType`, documentato) |
| Audit `unknown` non documentato | 0 occorrenze (tutte le 4 occorrenze documentate in JSDoc + header file) |

## Threat Coverage

| Threat ID | Disposition | Mitigation in commit |
|-----------|-------------|----------------------|
| T-02-02-01 (Tampering — type confusion: passare uno schema id come transform name) | mitigate | Branded types `CanonicalSchemaId` (`__canonicalSchemaIdBrand`) e `TransformName` (`__transformNameBrand`) con `unique symbol` distinti. Cast esplicito audit-able via grep. Pattern F1 replicato (`broker-event.ts:54-61` EventId). Implementato in `canonical-schema.ts:25-31` e `transform.ts:24-29`. |
| T-02-02-02 (Information disclosure — `FieldDescriptor.default: unknown` accetta qualsiasi valore) | accept | `unknown` è intenzionale per supportare default object/array/primitive senza generic explosion. `exactOptionalPropertyTypes: true` enforce field opzionale assente vs `undefined` esplicito. Documentato in JSDoc + commento header. |
| T-02-02-03 (Tampering — mutation di `CanonicalSchema.fields` post-register) | mitigate (compile-time) | Tutti i field marcati `readonly` in `CanonicalSchema` (riga 80-85), `FieldDescriptor` (riga 60-66), `MappingRule` (riga 39-44), `TransformContext` (riga 34-40), `ValidationIssue` (riga 24-29). Mitigation runtime (`deepFreeze`) deferred al plan 02-03 `CanonicalRegistry.register` (D-04 pattern F1). |
| T-02-02-04 (DoS — adapter validator throw invece di ritornare ValidationResult) | mitigate (contract) | `ValidatorAdapter.validate` ha contract NO-throw documentato in JSDoc (`validator-adapter.ts:54-58`). I 3 adapter ufficiali (Valibot V1/Zod V2/Ajv V2) wrappano internamente try/catch. Implementazione concreta in plan 02-06. |
| T-02-02-05 (Repudiation — `MappingErrorCode` aggiunti senza version bump rompono consumer) | mitigate (policy) | Literal union è additive (aggiungere codici è non-breaking; rimuoverli sì). Documentazione policy DOC-03 al plan 02-12. Header file `mapping-error.ts:5-13` documenta vincolo. |

## Deviations from Plan

**None — il plan è stato eseguito esattamente come scritto.** Tutti i 6 file sono stati creati con il contenuto specificato in `02-02-PLAN.md`. Nessuna deviazione Rule 1/2/3/4 applicata; nessun checkpoint hit.

**Note tecniche minori (non deviazioni):**

1. **Bracket notation per brand symbol** — Lo snippet del plan usa `{ readonly [__canonicalSchemaIdBrand]: true }` (bracket access). Questo è il pattern esatto richiesto da `noPropertyAccessFromIndexSignature: true` (`tsconfig.base.json:14`). Replicato dal pattern EventId di `broker-event.ts:60`. Coerente con il plan, nessuna divergenza.
2. **Header italiano + JSDoc inglese-misto** — I commenti di blocco (header file e righe `//`) sono in italiano (vincolo CLAUDE.md). I JSDoc esposti dall'IntelliSense (`@example`, `@typeParam`) sono prevalentemente in italiano con codice/identificatori in inglese, coerente con `02-PATTERNS.md §1.1`.
3. **Barrel `types/index.ts` non wired al main `src/index.ts`** — Il plan NON lo richiede (vedi `<output>` riga 56-57: "barrel mapper attivato in 02-09 augment.ts plan"). Il main `src/index.ts` rimane skeleton come lasciato dal plan 02-01. `pnpm build` continua a produrre `dist/index.js` 68 B coerentemente.

## Auth Gates

Nessun auth gate — task interamente automatico (file creation + typecheck/build local).

## TDD Gate Compliance

Plan `type: execute` (non `type: tdd`) — i tipi pubblici non hanno comportamento testabile a runtime. Il TDD pattern RED→GREEN inizierà al plan 02-03 con `CanonicalRegistry.register`. Coerente con il PLAN frontmatter (`autonomous: true`, no `tdd="true"` sui task).

## Open Items / Pronto-per

- ✅ **Closed:** D-32 placeholder F1 (`BrokerConfig.canonicalModel/aliasRegistry/transforms`, `PluginDescriptor.inputMap/outputMap`) chiusi al type-level. Runtime wiring deferred a plan 02-09 (augment.ts via TS declaration merging).
- ✅ **Ready:** plan 02-03 (`CanonicalRegistry`) può importare da `./types/canonical-schema` e `./types/mapping-error`.
- ✅ **Ready:** plan 02-04 (`AliasRegistry`) può importare da `./types/canonical-schema` (per `CanonicalSchemaId`).
- ✅ **Ready:** plan 02-05 (`TransformPipeline`) può importare da `./types/transform` e `./types/mapping-error`.
- ✅ **Ready:** plan 02-06 (`valibotAdapter`) può importare da `./types/validator-adapter` e implementare `ValidatorAdapter` interface.
- ✅ **Ready:** Wave 3 paralleli (plan 02-03/04/05/06 con file ownership disgiunta, pattern Wave 3 di F1).
- ⏳ **Pending:** plan 02-07 (`MapperEngine`) consumerà tutti i tipi di questo plan + le 4 implementazioni Wave 3.
- ⏳ **Pending:** plan 02-09 (`augment.ts`) attiverà `import './augment'` nel main barrel + sostituirà i placeholder `unknown` di F1 `BrokerConfig`/`PluginDescriptor` con i tipi specifici da `./types/`.
- ⏳ **Pending:** plan 02-12 (final gate F2) misurerà coverage v8 ≥ 90% sui file `@gluezero/mapper/`.

## Self-Check: PASSED

File creati (verifica esistenza):
- packages/mapper/src/types/canonical-schema.ts: FOUND
- packages/mapper/src/types/input-output-map.ts: FOUND
- packages/mapper/src/types/transform.ts: FOUND
- packages/mapper/src/types/validator-adapter.ts: FOUND
- packages/mapper/src/types/mapping-error.ts: FOUND
- packages/mapper/src/types/index.ts: FOUND

Commit hash (verifica esistenza in git log):
- 210013b (Task 1 — feat canonical-schema + input-output-map + transform): FOUND
- af38fb0 (Task 2 — feat validator-adapter + mapping-error + barrel): FOUND
