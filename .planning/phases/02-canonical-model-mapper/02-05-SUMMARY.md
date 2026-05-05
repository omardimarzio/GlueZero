---
phase: 02-canonical-model-mapper
plan: 05
subsystem: transform-pipeline
tags: [transform-pipeline, tdd, parallel-wave-3, on-failure-policy, close-prd-39-4]

# Dependency graph
requires:
  - phase: 02-canonical-model-mapper
    plan: 02
    provides: "TransformFn + TransformDescriptor + TransformContext da packages/mapper/src/types/transform.ts; FieldFailureMode da packages/mapper/src/types/canonical-schema.ts"
provides:
  - "packages/mapper/src/transform-pipeline.ts (183 LOC) — class TransformPipeline con register/has/get/apply/list/unregister/unregisterByOwner + RegisterTransformOptions interface"
  - "packages/mapper/src/transform-pipeline.test.ts (185 LOC, 14 test) — TDD RED→GREEN coverage completo dei 14 behavior PLAN"
  - "D-44 onFailure policy implementata (block/skip/fallback) — chiude PRD §39 open issue #4 (VAL-09)"
  - "D-45 cause chaining ES2022 via createBrokerError (originalError + cause set)"
  - "D-26 ext F2 cascade abilitato via unregisterByOwner(pluginId) — wired al broker wrapper plan 02-10"
  - "transform.id.duplicate throw pattern F1 (D-17) replicato"
  - "transform.not-found throw indipendentemente da onFailure (caller bug guard)"
  - "Closure PRD §39 open issue #4 (transform failure: skip o block) — VAL-09"
affects: [02-07-mapper-engine, 02-08-broker-wrapper, 02-09-augment, 02-10-integration-tests, 02-11-cycle-detection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern F1 try/catch wrap (safeTapStep event-tap.ts:23-34) replicato in apply() ma con escalation policy invece di silent swallow"
    - "Pattern createBrokerError cross-package con originalError + cause ES2022 (broker-error.ts:51-54) per D-45 mapping.transform.failed"
    - "Pattern duplicate throw (plugin-registry.ts:111-117 per plugin.id.duplicate) replicato per transform.id.duplicate"
    - "Pattern Map<string, Entry> con Entry { descriptor, ownerId? } — descriptor + ownership tracking separati per mantenere descrittore immutabile"
    - "Conditional spread `...(options.ownerId !== undefined && { ownerId: options.ownerId })` per exactOptionalPropertyTypes enforcement"
    - "list() ritorna `[...keys()].sort()` per immutability esterna (pattern F1 TopicRegistry/CanonicalRegistry/AliasRegistry consistente)"
    - "TDD RED→GREEN gate verificato in git history (2 commit separati: 84377d7 test prima, bf57216 feat dopo)"

key-files:
  created:
    - "packages/mapper/src/transform-pipeline.ts (183 LOC) — class TransformPipeline + RegisterTransformOptions interface"
    - "packages/mapper/src/transform-pipeline.test.ts (185 LOC, 14 test) — coverage completo dei 14 behavior PLAN"
  modified: []

key-decisions:
  - "Nessuna deviazione da PATTERNS.md §2.2 (transform-pipeline ↔ topic-registry F1 + safeTapStep) e §4.1 (createBrokerError cross-package)"
  - "ownerId è opzionale per supportare transform globali registrati al boot dal config (es. transforms registrate prima del primo plugin) — Test 'unregisterByOwner returns 0 when no transforms owned' verifica che plugin senza transform owned non vede nulla"
  - "T-02-05-03 disposition (transform anonimo no-ownerId): cascade salta entry senza ownerId. Intenzionale per transform globali. Test 13 (`unregisterByOwner removes only transforms owned by plugin`) include un transform 'd' senza ownerId che resta intatto dopo cascade"
  - "transform.not-found throw `regardless of onFailure` (Test 12 PLAN) — il caller bug (transform name typo) è considerato programmer error, non runtime mapping error"
  - "Test scrive `throw 'string error'` letterale invece di `throw new Error('string')` per verificare il fallback `String(err)` quando err non è instance of Error (T-02-05-05 mitigation)"
  - "Niente runtime deepFreeze sul TransformDescriptor post-register — coerente con T-02-03-03 disposition di plan 02-03 (deepFreeze dev mode deferred al mapper-engine plan 02-07)"

patterns-established:
  - "Pattern try/catch wrap con escalation policy `block|skip|fallback` per registry pluggable: applicabile a future estensioni (route policy F3, worker policy F5) — il discriminator literal union è il pattern di policy riusabile"
  - "Pattern Entry { descriptor, ownerId? } con register options separati dal descriptor: applicabile a tutti i registry F2+ con cascade plugin owner tracking"
  - "Pattern conditional spread per ES2022 cause + exactOptionalPropertyTypes coexistence: replicato dal core broker-error.ts ma applicato cross-package con import esplicito da `@gluezero/core`"
  - "Pattern unregisterByOwner(ownerId) cascade per cleanup proprietario: identico a AliasRegistry.unregisterScopedAll plan 02-04. Convergenza pattern F2 cross-modulo per LIFE-02 ext"

requirements-completed:
  - VAL-09
requirements-runtime-level:
  - MAP-12

# Metrics
duration: ~92min
completed: 2026-04-29
---

# Phase 2 Plan 05: TransformPipeline Summary

**Implementato `TransformPipeline` (183 LOC) + test co-locato (185 LOC, 14 test) con pattern TDD RED→GREEN: 2 commit separati, 14/14 test passing al primo run dopo GREEN. Chiude PRD §39 open issue #4 (VAL-09 — transform failure: skip o block) tramite D-44 onFailure policy esplicita per ogni `apply()` call: `'block'` (default) → throw wrapped `BrokerError 'mapping.transform.failed'` con `originalError`+`cause` ES2022 (D-45); `'skip'` → ritorna `undefined`; `'fallback'` → applica defaultValue se fornito, altrimenti downgrade a `'skip'`. D-26 ext F2 cascade abilitato via `unregisterByOwner(pluginId)`. Pronto per consumption da MapperEngine (plan 02-07) per applicare transform durante compile/runtime mapping.**

## Performance

- **Duration:** ~92 min totali (start 15:50:59Z; commit GREEN 17:21Z) — la maggior parte è onboarding contesto Phase 2 + lettura del PLAN dettagliato + lettura PATTERNS.md/CONTEXT.md/02-02..02-04 SUMMARY (file >2.5K LOC complessive). Implementazione effettiva ~5 min (file write + test + biome).
- **Started:** 2026-04-29T15:50:59Z
- **Completed:** 2026-04-29T17:22:11Z
- **Tasks:** 1/1 completed (TDD RED + GREEN come 2 commit atomici dello stesso task)
- **Files created:** 2 nuovi (368 LOC totali: 183 src + 185 test)
- **Files modified:** 0

## Accomplishments

- `class TransformPipeline` con 7 metodi pubblici: `register(name, fn, options?)`, `has(name)`, `get(name)`, `apply(name, input, ctx, onFailure, defaultValue?)`, `list()`, `unregister(name)`, `unregisterByOwner(pluginId)`
- 1 type pubblico co-esportato: `RegisterTransformOptions { description?, ownerId? }`
- D-44 onFailure policy implementata (3 modalità: `'block'`, `'skip'`, `'fallback'`) — chiude PRD §39 open issue #4 (VAL-09)
- D-45 cause chaining ES2022 via `createBrokerError` di F1: `mapping.transform.failed` ha `originalError` + `cause === originalError`
- D-26 ext F2 cascade abilitato via `unregisterByOwner(pluginId)` ritornante count rimossi — wired al broker wrapper in plan 02-10
- `transform.id.duplicate` throw su register collision (pattern F1 D-17 da `plugin-registry.ts:111-117`)
- `transform.not-found` throw indipendentemente da onFailure (caller bug guard — programmer error)
- Non-Error throw values wrapped: `err instanceof Error ? err.message : String(err)` preserva info anche su `throw 'string'` (T-02-05-05 mitigation)
- `list()` ritorna `[...keys()].sort()` per immutability esterna (pattern F1 consistente con TopicRegistry/CanonicalRegistry/AliasRegistry)
- `Entry { descriptor, ownerId? }` separato per mantenere descrittore immutabile + ownership tracking per cascade
- Cross-package import `import { createBrokerError } from '@gluezero/core'` + `category: 'mapping'` (già definita in F1 ErrorCategory union)
- Header italiano + JSDoc IntelliSense in italiano + reference D-XX/REQ-ID/Threat-ID coerente con pattern F1 e plan 02-03/02-04
- Auto-fix Biome `organizeImports` applicato post-implementazione (riordino alfabetico import) — coerente con repo standard

## Task Commits

Il PLAN dichiara 1 task con `tdd="true"`. Il task è stato eseguito come 2 commit atomici (RED gate + GREEN gate) coerenti con il pattern TDD F1:

1. **Task 1 RED — `84377d7`** `test(02-05): aggiunge test RED per TransformPipeline`
   - `transform-pipeline.test.ts` (185 LOC, 14 test cases organizzati in 3 describe block)
   - Test importa `./transform-pipeline` che non esiste → FAIL atteso (RED gate verificato: `Failed to resolve import "./transform-pipeline"`)

2. **Task 1 GREEN — `bf57216`** `feat(02-05): implementa TransformPipeline (REQ MAP-12, VAL-09 — chiude PRD §39 #4)`
   - `transform-pipeline.ts` (183 LOC) — implementazione completa
   - Test passing 14/14 al primo run dopo creazione del modulo (`Test Files 1 passed (1) | Tests 14 passed (14)`)
   - Auto-fix Biome `organizeImports` applicato pre-commit a `transform-pipeline.test.ts` (riordino alfabetico import: `@gluezero/core` prima di `vitest`, runtime prima di type-only)

**Plan metadata commit:** TBD (eseguito alla fine del workflow tramite `gsd-sdk query commit` insieme a STATE/ROADMAP/REQUIREMENTS).

## Files Created

### packages/mapper/src/transform-pipeline.ts (183 LOC)

Esporta:

- `interface RegisterTransformOptions { readonly description?: string; readonly ownerId?: string }` — opzioni `register`
- `class TransformPipeline` con private state:
  - `private readonly transforms = new Map<string, TransformEntry>()`
  - Inner `interface TransformEntry { readonly descriptor: TransformDescriptor; readonly ownerId?: string }` (NON esportato — internal scope)
- 7 metodi pubblici (vedi Accomplishments)

Threat coverage documentato in header:
- T-02-05-01 (DoS — transform throw collassa publish): try/catch + onFailure policy
- T-02-05-02 (Tampering — wrapped error perde stack trace): `createBrokerError` mantiene `originalError` + ES2022 `cause` chaining
- T-02-05-03 (Repudiation — transform anonimo no-ownerId): cascade salta entry senza ownerId (intenzionale per transform globali)
- T-02-05-04 (Spoofing — register transform name shadow): throw `transform.id.duplicate` indipendentemente da ownerId
- T-02-05-05 (Tampering — non-Error throw value): `err instanceof Error ? err.message : String(err)` preserva messaggio

### packages/mapper/src/transform-pipeline.test.ts (185 LOC, 14 test)

Test cases organizzati in 3 `describe` block:

| # | Describe | It | Behavior coperto | Decisione/Threat |
|---|----------|-----|------------------|------------------|
| 1 | register/has/get | register succeeds; duplicate throws transform.id.duplicate | Test 1 PLAN | D-17 pattern F1 |
| 2 | register/has/get | register accepts ownerId for cascade tracking | Test 2 PLAN | D-26 ext F2 |
| 3 | register/has/get | get returns descriptor or undefined | Test 3+4 PLAN | F1 pattern |
| 4 | apply (D-44 onFailure policy) | successful transform returns the result | Test 5 PLAN | core path |
| 5 | apply (D-44 onFailure policy) | block: throw wraps in mapping.transform.failed with cause + details | Test 6 PLAN | D-44 + D-45 |
| 6 | apply (D-44 onFailure policy) | skip: throw returns undefined, NO throw | Test 7 PLAN | D-44 |
| 7 | apply (D-44 onFailure policy) | fallback with default value: returns default | Test 8 PLAN | D-44 |
| 8 | apply (D-44 onFailure policy) | fallback without default: returns undefined (downgrade to skip) | Test 9 PLAN | D-44 |
| 9 | apply (D-44 onFailure policy) | unknown transform: throws transform.not-found regardless of onFailure | Test 10 PLAN | caller bug guard |
| 10 | apply (D-44 onFailure policy) | non-Error thrown values still wrap into BrokerError | Test 14 PLAN ext | T-02-05-05 |
| 11 | list/unregister/unregisterByOwner | list returns sorted names + fresh copy | Test 11 PLAN | F1 consistency |
| 12 | list/unregister/unregisterByOwner | unregister returns true on first call, false thereafter | Test 12 PLAN | F1 idempotent |
| 13 | list/unregister/unregisterByOwner | unregisterByOwner removes only transforms owned by plugin | Test 13 PLAN | D-26 ext F2 |
| 14 | list/unregister/unregisterByOwner | unregisterByOwner returns 0 when no transforms owned | Test 13 PLAN ext | D-26 ext F2 edge |

## Verification

| Comando | Risultato |
|---------|-----------|
| `pnpm --filter @gluezero/mapper test transform-pipeline` (RED, post Task 1.1) | FAIL atteso: `Failed to resolve import "./transform-pipeline"` |
| `pnpm --filter @gluezero/mapper test transform-pipeline` (GREEN, post Task 1.2) | Exit 0: **`Test Files 1 passed (1) \| Tests 14 passed (14)`** Duration 536ms |
| `pnpm --filter @gluezero/mapper test` (full mapper) | Exit 0: **`Test Files 3 passed (3) \| Tests 41 passed (41)`** (14 transform-pipeline + 16 alias-registry + 11 canonical-registry) |
| `pnpm --filter @gluezero/mapper typecheck` | Exit 0 (isolatedDeclarations enforcement OK) |
| `pnpm --filter @gluezero/core test` (regression F1) | Exit 0: **24 file/248 test passing** (no regression Phase 1) |
| `pnpm biome check packages/mapper/src/transform-pipeline*.ts` | Exit 0 dopo auto-fix `organizeImports` (riordino alfabetico import) |
| Grep verifica acceptance | 8/8 PASSED (`export class TransformPipeline`, `transform.id.duplicate`, `transform.not-found`, `mapping.transform.failed`, `originalError`, `unregisterByOwner`, file source + file test esistenti) |
| Audit `any` literal | 0 occorrenze come tipo |
| Audit `unknown` non documentato | 0 occorrenze (`unknown` solo in `defaultValue?: unknown` di apply + `details?: Record<string, unknown>` ereditato dal contratto BrokerError F1; `input: unknown` per TransformFn signature documentata) |
| Post-commit deletion check | OK: no deletions tra HEAD~2 e HEAD |

## Threat Coverage

| Threat ID | Disposition | Mitigation in commit |
|-----------|-------------|----------------------|
| T-02-05-01 (DoS — transform throw collassa publish flow) | mitigate | D-44 onFailure policy: 'block'/'skip'/'fallback'. Default 'block' è esplicito per evitare silent failure. Test 6-9 verificano i 3 path. |
| T-02-05-02 (Tampering — wrapped error perde stack trace originale) | mitigate | `createBrokerError` di F1 mantiene `originalError` + ES2022 `cause` chaining (broker-error.ts:51-54). **Test 5** verifica `expect(caught.cause).toBe(original)` E `expect(caught.originalError).toBe(original)`. |
| T-02-05-03 (Repudiation — transform anonimo no-ownerId → cascade non lo rimuove) | accept | `unregisterByOwner` salta entry senza ownerId (intenzionale: transform globali vengono mantenuti). Cleanup manuale via `unregister(name)`. **Test 13** include un transform 'd' senza ownerId che resta intatto dopo cascade. |
| T-02-05-04 (Spoofing — plugin re-register transform con stesso nome di altro plugin) | mitigate | `register` throw `transform.id.duplicate` indipendentemente da ownerId. Plugin deve usare naming distinct (convention: prefix `pluginId.transformName`). **Test 1** verifica throw. |
| T-02-05-05 (Tampering — non-Error throw value perde info) | mitigate | `apply` wrapper accetta `unknown` e fa `err instanceof Error ? err.message : String(err)`. **Test 10** verifica con `throw 'string error'` letterale → `caught.message === 'string error'`. |

## Deviations from Plan

**None — il plan è stato eseguito esattamente come scritto.** Tutti i 14 behavior listati nel PLAN `<task><behavior>` sono coperti dai 14 test cases. L'implementazione segue lo snippet di codice del PLAN con identica shape (Map interno con Entry, conditional spread per ownerId/description, conditional spread per originalError, throw policy switch su onFailure).

**Note tecniche minori (non deviazioni):**

1. **Auto-fix Biome `organizeImports`** — Lo snippet del PLAN aveva ordine import: `vitest` → `@gluezero/core` → `type` interno → runtime interno. Biome ha riordinato in alfabetico: `@gluezero/core` → `vitest` → runtime interno → type interno. Cambio cosmetico, semantica identica. Re-run test post-fix: 14/14 passing.
2. **Header file italiano + JSDoc inglese-misto** — Coerente con `02-PATTERNS.md §1.1`. Identico al pattern usato in plan 02-02/02-03/02-04.
3. **Nessun `eslint-disable` per `throw 'string error'` letterale** — Il PLAN aveva un commento `// eslint-disable-next-line @typescript-eslint/no-throw-literal` che però è specifico per ESLint. Il progetto usa Biome (non ESLint) e Biome non ha lint rule equivalente attivata, quindi il commento è superfluo e l'ho omesso. Test passa identicamente: `throw 'string error'` è valido JS e produce `String(err) === 'string error'`.

## TDD Gate Compliance

Plan `type: execute` con un task `tdd="true"`. Gate sequence verificata in `git log --oneline`:

- ✅ **RED gate** (`84377d7`): commit `test(02-05): aggiunge test RED per TransformPipeline`
- ✅ **GREEN gate** (`bf57216`): commit `feat(02-05): implementa TransformPipeline (REQ MAP-12, VAL-09 — chiude PRD §39 #4)` dopo RED

**RED fail-fast confirmed:** test ha fallito al run con messaggio `Failed to resolve import "./transform-pipeline"` PRIMA della creazione del modulo. Nessun test è passato accidentalmente in fase RED.

**GREEN single-iteration:** 14/14 test passati al primo run dopo la creazione del modulo. Nessuna iterazione di debug richiesta. L'unico cambio post-implementazione è il fix Biome `organizeImports` (riordino import, non logica).

REFACTOR gate non necessario: l'implementazione del PLAN era già completa e idiomatica; il fix Biome è cosmetico, non refactor logico.

## Auth Gates

Nessun auth gate — task interamente automatico (file creation + typecheck/test/biome local).

## Open Items / Pronto-per

- ✅ **Closed:** PRD §39 open issue **#4** (VAL-09 transform failure: skip o block) — chiusa esplicitamente: `apply(name, input, ctx, onFailure, defaultValue?)` accetta `onFailure: 'block' | 'skip' | 'fallback'` e applica D-44 in modo deterministico per ogni field.
- ✅ **Closed:** D-44 onFailure policy (3 modalità: block/skip/fallback) — runtime in `apply()`.
- ✅ **Closed:** D-45 cause chaining ES2022 (originalError + cause set by createBrokerError F1) — runtime in `apply()` block path.
- ✅ **Closed:** D-26 ext F2 cascade plugin unregister — abilitato via `unregisterByOwner(pluginId)`. Wiring al broker wrapper in plan 02-10.
- ✅ **Ready:** plan 02-07 (`MapperEngine`) può consumare `transformPipeline.apply(name, input, ctx, onFailure, defaultValue)` durante compile/runtime mapping per ciascun field secondo `FieldDescriptor.onFailure`.
- ✅ **Ready:** plan 02-10 (broker wrapper) può chiamare `transformPipeline.unregisterByOwner(pluginId)` durante cascade plugin unregister.
- ⏳ **Pending:** Wave 3 paralleli plan 02-06 con file ownership disgiunta confermata (questo plan tocca SOLO `transform-pipeline.ts`/`transform-pipeline.test.ts`, nessun overlap con `valibot-adapter.ts` plan 02-06).
- ⏳ **Pending:** Coverage v8 misurazione del modulo deferred a plan 02-12 (final gate F2 — D-55).

## Self-Check: PASSED

File creati (verifica esistenza):
- packages/mapper/src/transform-pipeline.ts: FOUND (183 LOC)
- packages/mapper/src/transform-pipeline.test.ts: FOUND (185 LOC)

Commit hash (verifica esistenza in git log):
- 84377d7 (Task 1 RED — test transform-pipeline): FOUND
- bf57216 (Task 1 GREEN — feat transform-pipeline): FOUND

REQ-IDs avanzati al runtime-level:
- **MAP-12** runtime (`registerTransform(name, fn)` API + `apply` con onFailure policy + cascade unregister via owner — pronto per wiring al `Broker.registerTransform` in plan 02-10)
- **VAL-09** runtime (chiusura PRD §39 #4 — `'block' | 'skip' | 'fallback'` esplicito; default 'block' enforced; cause chaining ES2022 preserved)

Open issues PRD §39 chiusura status:
- **#1** Precedenza alias automatici vs mapping esplicito (MAP-17) — Closed in 02-04 ✅
- **#4** Transform failure: skip o block (VAL-09) — **Closed in 02-05** ✅
- **#3** Field mancante required:true|false (VAL-08) — type-level scaffold da 02-02; runtime al mapper-engine plan 02-07 ⏳
- D-26 ext F2 (cascade unregister) — abilitato anche per TransformPipeline via `unregisterByOwner(pluginId)`. Wiring al broker wrapper in plan 02-10 ⏳
