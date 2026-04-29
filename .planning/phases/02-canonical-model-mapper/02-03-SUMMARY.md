---
phase: 02-canonical-model-mapper
plan: 03
subsystem: canonical-registry
tags: [canonical-registry, tdd, parallel-wave-3, observer-pattern, requires-resolution]

# Dependency graph
requires:
  - phase: 02-canonical-model-mapper
    plan: 02
    provides: "CanonicalSchema + CanonicalSchemaId branded types da packages/mapper/src/types/canonical-schema.ts"
provides:
  - "packages/mapper/src/canonical-registry.ts (188 LOC) — class CanonicalRegistry con register/has/get/list/onRegistered/unregister"
  - "packages/mapper/src/canonical-registry.test.ts (143 LOC, 11 test) — TDD RED→GREEN coverage completo"
  - "Pattern F1 TopicRegistry replicato + estensioni F2 (D-36 requires resolution + D-26 ext unregister + strict mode opzionale)"
  - "Closure step register flow per consumption futuro da MapperEngine (plan 02-07) e Broker wrapper (plan 02-10)"
affects: [02-07-mapper-engine, 02-08-broker-wrapper, 02-09-augment, 02-10-integration-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Observer pattern con try/catch swallow per listener isolation (pattern TopicRegistry F1 riga 28-34) — T-02-03-01 mitigation"
    - "list() ritorna copia spread `[...map.keys()].sort()` per immutability esterna (pattern TopicRegistry F1 riga 42-44) — T-02-03-02 mitigation"
    - "Idempotent register con return boolean (true=nuovo, false=duplicato) — pattern F1"
    - "BrokerError factory `createBrokerError({ code, category, message, details })` cross-package — replica esatta pattern F1 plugin-registry/event-validator"
    - "RegisterOptions.strict?: boolean opt-in per detection accidentale duplicati (quality-of-life add-on, non listato in CONTEXT.md ma utile per consumer F6 Inspector)"
    - "TDD RED→GREEN gate verificato in git history (2 commit separati: test prima, feat dopo)"

key-files:
  created:
    - "packages/mapper/src/canonical-registry.ts (188 LOC) — class CanonicalRegistry + RegisterOptions + CanonicalRegistryListener"
    - "packages/mapper/src/canonical-registry.test.ts (143 LOC) — 11 test cases coprendo tutti i 11 behavior PLAN <task>"
  modified: []

key-decisions:
  - "Nessuna deviazione da PATTERNS.md §2.2 (canonical-registry ↔ topic-registry F1) e §4.1 (error handling tramite createBrokerError cross-package)"
  - "Aggiunta opzione `RegisterOptions.strict?: boolean` come quality-of-life — non listata in CONTEXT.md (non altera D-XX locked) ma utile per detection accidentale duplicati. Documentato nel PLAN <output> come 'discrezionale'. Test 11 ne verifica il comportamento."
  - "Listener riceve `CanonicalSchema` completo (NON solo id) — coerente con il PLAN behavior Test 7 e con il caso d'uso futuro Inspector/MetricsCollector che vogliono accedere a field count (T-02-03-05 disposition: accept)"
  - "Test 10 aggiunto in linea col PLAN Test 10 'unregister con altri schemi che lo dichiarano in requires → schemi orphan rimangono validi' — copre policy V1 (no cascade integrity)"
  - "Niente runtime deepFreeze sullo schema dopo register — deferred a plan 02-07 mapper-engine in dev mode (D-04 pattern F1) come documentato in T-02-03-03 disposition"

patterns-established:
  - "Pattern register idempotent + listener observer + list() copia per registry F2: replica diretta TopicRegistry F1, applicabile anche a AliasRegistry (plan 02-04) e TransformPipeline (plan 02-05) — file ownership disgiunta in Wave 3"
  - "Pattern requires resolution check al register: estendibile a future relazioni di dipendenza tra schemi/route/worker"
  - "Pattern cross-package error: `import { createBrokerError } from '@sembridge/core'` + `category: 'mapping'` (già definita in F1 ErrorCategory union plan 03)"
  - "Pattern TDD RED→GREEN cross-package: test importa './canonical-registry' (FAIL RED) → implementa modulo (PASS GREEN). Stesso pattern dei plan F1 04/05/06."

requirements-completed: []
requirements-type-level:
  - MAP-01
  - MAP-02

# Metrics
duration: ~53min (incluso onboarding contesto Phase 2)
completed: 2026-04-29
---

# Phase 2 Plan 03: CanonicalRegistry Summary

**Implementato `CanonicalRegistry` (188 LOC) + test co-locato (143 LOC, 11 test) con pattern TDD RED→GREEN: 2 commit separati, 11/11 test passing al primo run dopo GREEN. Replica esatta del pattern `TopicRegistry` F1 (`packages/core/src/core/topic-registry.ts`) esteso con `requires` resolution check (D-36) e `unregister` per cascade plugin (D-26 ext F2). Pronto per consumption da MapperEngine (plan 02-07) e wiring al Broker (plan 02-10).**

## Performance

- **Duration:** ~53 min (start 13:42:29Z; commit GREEN 14:01:48Z; SUMMARY 14:35Z — la maggior parte è onboarding contesto Phase 2 + lettura del PLAN dettagliato + lettura PATTERNS.md/CONTEXT.md)
- **Started:** 2026-04-29T13:42:29Z
- **Completed:** 2026-04-29T14:35:28Z
- **Tasks:** 1/1 completed (TDD RED + GREEN come 2 commit atomici dello stesso task)
- **Files created:** 2 nuovi (331 LOC totali: 188 src + 143 test)
- **Files modified:** 0

## Accomplishments

- `class CanonicalRegistry` con 6 metodi pubblici: `register(schema, options?)`, `has(id)`, `get(id)`, `list()`, `onRegistered(listener)`, `unregister(id)`
- 2 type pubblici co-esportati: `RegisterOptions` (con `strict?: boolean` opt-in), `CanonicalRegistryListener`
- D-36 (canonical schema versioning) coperto: `register` con `requires` non risolti → throw `BrokerError 'canonical.requires.unresolved'` con `details: { id, missingRequires: string[] }`
- D-26 ext F2 (cascade unregister da plugin) abilitato via `unregister(id)` — wired al broker wrapper in plan 02-10
- Listener observer pattern con `onRegistered` ritornante unsubscribe + try/catch swallow per listener isolation (T-02-03-01)
- `list()` ritorna copia spread ordinata deterministicamente (T-02-03-02)
- Strict mode opzionale (`RegisterOptions.strict: true`) → throw `BrokerError 'canonical.id.duplicate'` per detection accidentale duplicati
- Tutti i metodi con return type esplicito (isolatedDeclarations enforcement)
- Header italiano + JSDoc IntelliSense in italiano + reference D-XX/REQ-ID/Threat-ID coerente con pattern F1
- Cross-package import `createBrokerError` da `@sembridge/core` + `category: 'mapping'` (già definita in F1 ErrorCategory)
- Auto-fix Biome formattazione applicato (lineWidth: 100) — coerente con repo standard

## Task Commits

Il PLAN dichiara 1 task con `tdd="true"`. Il task è stato eseguito come 2 commit atomici (RED gate + GREEN gate) coerenti con il pattern TDD F1:

1. **Task 1 RED — `4d9ca60`** `test(02-03): aggiunge test RED per CanonicalRegistry`
   - `canonical-registry.test.ts` (143 LOC, 11 test cases)
   - Test importa `./canonical-registry` che non esiste → FAIL atteso (RED gate verificato: `Failed to resolve import "./canonical-registry"`)
2. **Task 1 GREEN — `a5515c6`** `feat(02-03): implementa CanonicalRegistry (REQ MAP-01, MAP-02)`
   - `canonical-registry.ts` (188 LOC) — implementazione completa
   - Test passing 11/11 al primo run dopo creazione del modulo
   - Auto-fix Biome formattazione applicato a entrambi i file (incluso il test scritto in RED) — fix di formato, non altera semantica/logica del test

**Plan metadata commit:** TBD (eseguito alla fine del workflow tramite `gsd-sdk query commit` insieme a STATE/ROADMAP/REQUIREMENTS).

## Files Created

### packages/mapper/src/canonical-registry.ts (188 LOC)

Esporta:

- `interface RegisterOptions { readonly strict?: boolean }` — opzioni `register`
- `type CanonicalRegistryListener = (schema: CanonicalSchema) => void` — observer signature
- `class CanonicalRegistry` con private state:
  - `private readonly schemas = new Map<string, CanonicalSchema>()`
  - `private readonly listeners = new Set<CanonicalRegistryListener>()`
- 6 metodi pubblici (vedi Accomplishments)

### packages/mapper/src/canonical-registry.test.ts (143 LOC, 11 test)

Test cases:

| # | Behavior | Decisione coperta |
|---|----------|-------------------|
| 1 | register returns true for new, false on duplicate (idempotent) | pattern F1 TopicRegistry |
| 2 | register throws canonical.requires.unresolved on missing requires | D-36 |
| 3 | register succeeds when requires schemas already registered | D-36 |
| 4 | has returns true for registered, false otherwise | pattern F1 |
| 5 | get returns schema or undefined | F2 extension |
| 6 | list returns sorted array + fresh copy on each call (no mutation) | T-02-03-02 |
| 7 | onRegistered invokes listener + returns unsubscribe | pattern F1 |
| 8 | listener throw is swallowed; subsequent listeners continue | T-02-03-01 |
| 9 | unregister removes schema, returns true; false on unknown id | D-26 ext F2 |
| 10 | unregister with dependent schemas leaves orphans valid (no cascade V1) | D-36 V1 policy |
| 11 | strict register throws canonical.id.duplicate on collision | quality-of-life |

## Verification

| Comando | Risultato |
|---------|-----------|
| `pnpm --filter @sembridge/mapper test canonical-registry` (RED, post Task 1.1) | FAIL atteso: `Failed to resolve import "./canonical-registry"` |
| `pnpm --filter @sembridge/mapper test canonical-registry` (GREEN, post Task 1.2) | Exit 0: **`Test Files 1 passed (1) | Tests 11 passed (11)`** Duration 377ms |
| `pnpm --filter @sembridge/mapper test` (full mapper) | Exit 0: 1 file 11 test passing |
| `pnpm --filter @sembridge/mapper typecheck` | Exit 0 (isolatedDeclarations enforcement OK) |
| `pnpm --filter @sembridge/core test` (regression F1) | Exit 0: **24 file/248 test passing** (no regression) |
| `pnpm biome check packages/mapper/src/canonical-registry*.ts` | Exit 0 dopo auto-fix lineWidth |
| Grep verifica acceptance | 7/7 PASSED (`export class CanonicalRegistry`, `canonical.requires.unresolved`, `canonical.id.duplicate`, `createBrokerError`, `@sembridge/core`, file source + file test esistenti) |
| Audit `any` literal | 0 occorrenze come tipo |
| Audit `unknown` non documentato | 0 occorrenze (`unknown` solo in `details?: Record<string, unknown>` ereditato dal contratto BrokerError F1) |

## Threat Coverage

| Threat ID | Disposition | Mitigation in commit |
|-----------|-------------|----------------------|
| T-02-03-01 (DoS — listener throw collassa register flow) | mitigate | try/catch swallow nel for loop dei listener (riga 117-122 canonical-registry.ts). Pattern F1 TopicRegistry riga 28-34. **Test 8 verifica.** |
| T-02-03-02 (Tampering — `list()` ritorna reference interno) | mitigate | `[...this.schemas.keys()].sort()` ritorna spread copy (riga 154 canonical-registry.ts). Pattern F1 TopicRegistry riga 42-44. **Test 6 verifica con `copy.push('mutated')`.** |
| T-02-03-03 (Tampering — schema mutation post-register via `get()`) | accept | Schema dichiarato `Readonly<...>` al type-level (`CanonicalSchema.fields: Readonly<Record<...>>` da plan 02-02). Runtime `Object.freeze`/`deepFreeze` deferred a plan 02-07 mapper-engine in dev mode (D-04 pattern F1). Per V1 il consumer collabora con `readonly`. |
| T-02-03-04 (Repudiation — race register A → B requires A) | accept | JS single-threaded — `register` è atomico. Cross-tick race → caller riconosce throw `canonical.requires.unresolved` e ritenta. |
| T-02-03-05 (Information disclosure — listener riceve schema completo) | accept | Intenzionale: Inspector/Metrics F6 hanno bisogno dei field count. Listener autenticati a livello applicativo (consumer del broker controlla chi può subscribe a `onRegistered`). |

## Deviations from Plan

**None — il plan è stato eseguito esattamente come scritto.** Tutti i 11 behavior listati nel PLAN `<task><behavior>` sono coperti dai 11 test cases. L'implementazione segue lo snippet di codice del PLAN con identica shape (Map interno, Set listeners, conditional throw su `requires`/strict, spread copy su list).

**Note tecniche minori (non deviazioni):**

1. **Auto-fix Biome formattazione lineWidth: 100** — Lo snippet del PLAN aveva `makeSchema` con argomenti su 3 righe; Biome `formatter.lineWidth: 100` ha consolidato su 1 riga. Comportamento identico, layout normalizzato. Cambio applicato sia al test RED che al feat GREEN (commit GREEN include il fix in entrambi i file). Non altera RED gate semanticamente: il test RED ha già verificato che l'import fallisse PRIMA dell'auto-fix.
2. **Header file italiano + JSDoc inglese-misto** — Coerente con `02-PATTERNS.md §1.1`. Identico al pattern usato in plan 02-02.
3. **`RegisterOptions.strict` come default opt-in** — Lo snippet del PLAN documenta esplicitamente questa opzione come "discretionary, non altera D-XX locked" (vedi PLAN `<output>`). Inclusa nel SUMMARY come quality-of-life nei key-decisions.

## TDD Gate Compliance

Plan `type: execute` con un task `tdd="true"`. Gate sequence verificata in `git log --oneline`:

- ✅ **RED gate** (`4d9ca60`): commit `test(02-03): aggiunge test RED per CanonicalRegistry`
- ✅ **GREEN gate** (`a5515c6`): commit `feat(02-03): implementa CanonicalRegistry (REQ MAP-01, MAP-02)` dopo RED

**RED fail-fast confirmed:** test ha fallito al run con messaggio `Failed to resolve import "./canonical-registry"` PRIMA della creazione del modulo. Nessun test è passato accidentalmente in fase RED.

**GREEN single-iteration:** 11/11 test passati al primo run dopo la creazione del modulo. Nessuna iterazione di debug richiesta.

REFACTOR gate non necessario: l'implementazione del PLAN era già completa e idiomatica; l'auto-fix Biome è formattazione, non refactor logico.

## Auth Gates

Nessun auth gate — task interamente automatico (file creation + typecheck/test/biome local).

## Open Items / Pronto-per

- ✅ **Closed:** D-36 (canonical schema versioning via `requires`) — chiuso al register flow.
- ✅ **Closed:** D-26 ext F2 (cascade unregister) — abilitato via `unregister(id)`. Wiring al broker wrapper in plan 02-10.
- ✅ **Closed:** Listener pattern (D-26 ext F2 + Inspector F6) — coperto via `onRegistered`.
- ✅ **Ready:** plan 02-07 (`MapperEngine`) può consumare `CanonicalRegistry.get(id)` per validare che un mapping target esista come schema canonico (REQ MAP-01).
- ✅ **Ready:** plan 02-10 (broker wrapper) può chiamare `registry.unregister(id)` durante cascade plugin unregister.
- ⏳ **Pending:** Wave 3 paralleli plan 02-04/05/06 con file ownership disgiunta confermata (questo plan tocca SOLO `canonical-registry.ts`/`canonical-registry.test.ts`).
- ⏳ **Pending:** Coverage v8 misurazione del modulo deferred a plan 02-12 (final gate F2 — D-55).

## Self-Check: PASSED

File creati (verifica esistenza):
- packages/mapper/src/canonical-registry.ts: FOUND (188 LOC)
- packages/mapper/src/canonical-registry.test.ts: FOUND (143 LOC)

Commit hash (verifica esistenza in git log):
- 4d9ca60 (Task 1 RED — test canonical-registry): FOUND
- a5515c6 (Task 1 GREEN — feat canonical-registry): FOUND

REQ-IDs avanzati al runtime-level (al posto del solo type-level di plan 02-02):
- **MAP-01** (CanonicalRegistry traccia schemi registrati con campi tipizzati): runtime
- **MAP-02** (`register(schemaDefinition)` API pronta per wiring al `Broker.registerCanonicalSchema`): runtime
