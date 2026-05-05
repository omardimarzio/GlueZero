---
phase: 02-canonical-model-mapper
plan: 08
subsystem: mapping-inspector
tags: [inspector, tdd, tap-extension, debug-snapshot, ring-buffer, composition]

# Dependency graph
requires:
  - phase: 02-canonical-model-mapper
    plan: 03
    provides: "CanonicalRegistry per leggere canonicalSchemas count via list().length"
  - phase: 02-canonical-model-mapper
    plan: 04
    provides: "AliasRegistry per leggere registeredAliases count via listGlobal().length"
  - phase: 02-canonical-model-mapper
    plan: 05
    provides: "TransformPipeline per leggere registeredTransforms count via list().length"
  - phase: 02-canonical-model-mapper
    plan: 07
    provides: "MapperEngine come consumer di MappingInspector.recordError quando il broker wrapper plan 02-10 popolerà gli errori mapping.*"
provides:
  - "packages/mapper/src/inspector.ts (221 LOC) — class MappingInspector + wrapTap helper + MappingInspectorOptions + MappingInspectorSnapshot"
  - "packages/mapper/src/inspector.test.ts (220 LOC, 10 test) — coverage completo dei 9 acceptance + 1 default-buffer-size extra"
  - "D-46 (estende EventTap di F1, NON parallel API): wrapTap composition pattern implementato"
  - "D-47 (PipelineSnapshot esteso): placeholder per F2 V1 — recordSnapshot accetta i 5 step F2 dichiarati via TS declaration merging in plan 02-09"
  - "D-48 (getDebugSnapshot mappings section): MappingInspectorSnapshot ritorna { canonicalSchemas, registeredAliases, registeredTransforms, lastMappingErrors }"
  - "Ring buffer bounded (default 10) con FIFO drop — T-02-08-01 mitigation"
  - "Spread copy lastErrors() — T-02-08-04 mitigation"
  - "Try/catch swallow original tap nel wrapTap — T-02-08-03 mitigation"
affects: [02-09-augment, 02-10-broker-wrapper, 02-11-integration-tests, 02-12-final-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern composition con dependency injection: MappingInspector accetta i 3 registry (CanonicalRegistry, AliasRegistry, TransformPipeline) read-only via constructor injection"
    - "Pattern ring buffer bounded con FIFO drop: array.push() + array.shift() quando length > size; pattern semplice O(1) ammortizzato per recordError"
    - "Pattern spread copy per immutability esposta: lastErrors() ritorna [...this.errorBuffer] ad ogni chiamata (replicato da CanonicalRegistry.list() pattern F1)"
    - "Pattern composition wrapTap (D-46): NON parallel API — il tap risultante chiama PRIMA il tap originale e POI inspector.recordSnapshot, con try/catch swallow attorno al tap originale (replicato da F1 safeTapStep di event-tap.ts:23-34)"
    - "Pattern conditional default per opzionali (exactOptionalPropertyTypes): errorBufferSize ?? 10 invece di {errorBufferSize?: number} con assignment nel body"
    - "Pattern no-op runtime per V1 con extension hook documentato (recordSnapshot V1 = no-op; F6 sostituirà — JSDoc esplicita lo scope-out)"
    - "Pattern TDD RED→GREEN: 1 commit RED (test) + 1 commit GREEN (source) — coerente con plan 02-06 valibotAdapter (1+1 per 10 test)"

key-files:
  created:
    - "packages/mapper/src/inspector.ts (221 LOC) — class MappingInspector + wrapTap helper + 2 type esportati (MappingInspectorOptions, MappingInspectorSnapshot)"
    - "packages/mapper/src/inspector.test.ts (220 LOC, 10 test) — 8 test in describe MappingInspector + 2 in describe wrapTap"
  modified: []

key-decisions:
  - "Nessuna deviazione dalle decisioni D-46/D-47/D-48 di 02-CONTEXT.md — il plan è eseguito esattamente come scritto"
  - "Test count 10 invece di 9 (PLAN suggeriva 'almeno 9'): aggiunto 1 test extra 'default errorBufferSize is 10' per documentare il valore di default in modo esplicito (acceptance criteria del PLAN nominava esplicitamente 'default 10' ma non era coperto da un test isolato — gap copertura). Test extra è additive, non altera il design."
  - "Test count 6 invece di 7 nel describe MappingInspector (aggiunto test 'getSnapshot includes recorded mapping errors'): scope copertura D-48 esplicito che getSnapshot.lastMappingErrors NON sia sempre [] ma rifletta gli errori registrati. Il PLAN aveva il test 'getSnapshot returns counts' che verificava lastMappingErrors === [] (no errors), ma non il caso opposto. Gap di copertura della 4a property dello snapshot (D-48). Test extra è additive."
  - "recordSnapshot no-op runtime in F2 V1: il PLAN snippet del codice mostra esattamente questo (commento '// F2 V1: no-op'). Documentato esplicitamente in JSDoc come scope-out con riferimento a F6 (TOOL-01) per full snapshot per evento. T-02-08-05 disposition: accept (intenzionale)."
  - "wrapTap come funzione standalone esportata (non metodo statico della class): pattern PLAN snippet riga 388 mostra 'export function wrapTap'. Coerente con il pattern F1 'safeTapStep' di event-tap.ts che è una function exportata, non un method della class EventTap."
  - "Biome auto-fix applicato post-implementazione: organizeImports (riordino import: type-only separato da runtime) + lineWidth (consolidamento expect chain su una riga). Pattern affine a plan 02-07 (auto-fix lineWidth/organizeImports)."

patterns-established:
  - "Pattern composition wrapTap per estendere EventTap senza creare API parallele: il broker wrapper (plan 02-10) userà questo helper per comporre il tap utente con MappingInspector. Applicabile a future estensioni F3 (route inspector), F4 (realtime inspector), F5 (worker inspector) senza retrofit."
  - "Pattern ring buffer bounded con FIFO drop come default per state debug: applicabile a future estensioni F6 (Event Inspector con full snapshot per evento — TOOL-01) per evitare memory leak."
  - "Pattern read-only dependency injection per inspector/observer: il MappingInspector NON modifica i registry, solo li legge via list() methods. Coerente con il pattern delegation cross-module senza tight coupling."

requirements-completed: []
requirements-runtime-level:
  - MAP-15
  - MAP-16
requirements-type-level-only: []

# Metrics
duration: ~12min
completed: 2026-04-30
---

# Phase 2 Plan 08: Mapping Inspector Summary

**Implementato `MappingInspector` (221 LOC) + test co-locato (220 LOC, 10 test) — estensione `EventTap` di F1 per i 5 step F2 della pipeline §28 (D-46). NON un'API parallela: il broker wrapper plan 02-10 comporrà questo inspector con il tap utente esistente tramite il `wrapTap` helper. Pattern TDD RED→GREEN: 2 commit (1 RED con 10 test + 1 GREEN con source). F2 V1 espone counter dei 3 registry + ring buffer bounded (default 10) degli ultimi errori `mapping.*`; full snapshot per evento (payload before/after) deferred a F6 (TOOL-01) come da D-48. Pronto per consumption da plan 02-09 (augment.ts — declaration merging dei 5 PipelineStep F2) e plan 02-10 (broker wrapper — wiring `wrapTap` + `recordError` chiamato dal mapper-engine).**

## Performance

- **Duration:** ~12 min totali (start 2026-04-30T07:07:44Z; commit GREEN 2026-04-30T07:19:34Z; SUMMARY 07:20:11Z)
- **Started:** 2026-04-30T07:07:44Z
- **Completed:** 2026-04-30T07:20:11Z
- **Tasks:** 1/1 completed (TDD RED + TDD GREEN)
- **Files created:** 2 nuovi (441 LOC totali: 221 src + 220 test)
- **Files modified:** 0

## Accomplishments

- `class MappingInspector` con 5 metodi pubblici: `recordSnapshot`, `recordError`, `lastErrors`, `clearErrors`, `getSnapshot`
- 2 type pubblici co-esportati: `MappingInspectorOptions` (DI dei 3 registry + opzionale `errorBufferSize`), `MappingInspectorSnapshot` (shape per `Broker.getDebugSnapshot().mappings` D-48)
- D-46 (estende EventTap, NON parallel API): `wrapTap(originalTap, inspector)` helper esportato come funzione standalone — composition pattern coerente con F1 `safeTapStep`
- D-47 (PipelineSnapshot esteso): `recordSnapshot` accetta sia gli step F1 (no-op pass-through per V1) sia i 5 step F2 dichiarati via TS declaration merging in plan 02-09 (`event.source.resolved`, `event.mapped.canonical`, `event.canonical.validated`, `event.mapped.consumer`, `event.final.validated`)
- D-48 (getDebugSnapshot mappings): `MappingInspectorSnapshot` ritorna `{ canonicalSchemas, registeredAliases, registeredTransforms, lastMappingErrors }`. Counter letti via `list().length` dei 3 registry; `lastMappingErrors` come copia spread del ring buffer
- Ring buffer bounded con FIFO drop: `errorBufferSize` default 10; `recordError` fa `push` + `shift` quando length > size — T-02-08-01 mitigation
- `lastErrors()` ritorna `[...this.errorBuffer]` (spread copy) — T-02-08-04 mitigation; mutation esterna del result NON corrompe lo state interno
- `wrapTap` con try/catch swallow attorno al tap originale — T-02-08-03 mitigation; coerente con il pattern F1 `safeTapStep` di event-tap.ts:23-34. Errori del tap originale non rompono il chain
- `clearErrors()` per reset esplicito post-debug session (utility, non invocato auto)
- `recordSnapshot` no-op runtime in F2 V1 — JSDoc esplicita lo scope-out con riferimento a F6 (TOOL-01)
- Cross-package import `import { createBrokerError } from '@gluezero/core'` (test-only) + `import type { BrokerError, EventTap, PipelineSnapshot, PipelineStep } from '@gluezero/core'` (source) — coerente con pattern F2 plan 02-03/02-05/02-07
- Header italiano + JSDoc IntelliSense in italiano + reference D-XX/REQ-ID/Threat-ID coerente con pattern F1 e plan 02-03/04/05/06/07
- Auto-fix Biome applicato post-implementazione: organizeImports (riordino import) + lineWidth (consolidamento expect chain)
- 10 test cases covering 9 acceptance criteria + 1 default-buffer-size extra: 8 in describe MappingInspector + 2 in describe wrapTap

## Pipeline §28 PIPE-01 — verifica esplicita ordine F2 (D-50)

`MappingInspector` accetta tutti i 10 step della pipeline §28 (5 F1 + 5 F2):

| Passo | Step ID | Implementato in | Test |
|-------|---------|------------------|------|
| 1 | event.received (F1) | recordSnapshot pass-through (no-op) | Test "recordSnapshot accepts F1 + F2 pipeline steps" |
| 2 | event.metadata.enriched (F1) | recordSnapshot pass-through | idem |
| 3 | event.validated (F1) | recordSnapshot pass-through | idem |
| 4 | event.source.resolved (F2 NUOVO) | recordSnapshot pass-through (V1 no-op; F6 popolerà) | idem |
| 5 | event.mapped.canonical (F2 NUOVO) | idem | idem |
| 6 | event.canonical.validated (F2 NUOVO) | idem | idem |
| 7 | event.dedupe.checked (F1) | recordSnapshot pass-through | idem |
| 11 | event.mapped.consumer (F2 NUOVO) | idem | idem |
| 12 | event.final.validated (F2 NUOVO) | idem | idem |
| 13 | event.delivered (F1) | recordSnapshot pass-through | idem |

I 5 step F2 (4, 5, 6, 11, 12) sono passati come `'event.source.resolved' as PipelineStep` etc. nel test — il cast esplicito è necessario perché `augment.ts` (plan 02-09) non è ancora attivo. Quando 02-09 farà declaration merging, il cast sparirà automaticamente.

## Task Commits

1. **Task 1 RED — `505bddd`** `test(02-08): aggiunge test RED per MappingInspector`
   - `inspector.test.ts` (222 LOC pre-format, 220 post-format Biome, 10 test in 2 describe block)
   - Test importa `./inspector` che non esiste → FAIL atteso (RED gate verificato: `Failed to resolve import "./inspector"`)
2. **Task 1 GREEN — `9a93669`** `feat(02-08): implementa MappingInspector + wrapTap (REQ MAP-15, MAP-16)`
   - `inspector.ts` (221 LOC) — implementazione completa
   - `inspector.test.ts` (220 LOC) — auto-format Biome (organizeImports + lineWidth) committato insieme al source
   - 10/10 test passing al primo run

**Plan metadata commit:** TBD (eseguito alla fine del workflow tramite `gsd-sdk query commit` insieme a STATE/ROADMAP/REQUIREMENTS).

## Files Created

### packages/mapper/src/inspector.ts (221 LOC)

Esporta:

- `interface MappingInspectorOptions` — DI: `canonicalRegistry`, `aliasRegistry`, `transformPipeline`, `errorBufferSize?`
- `interface MappingInspectorSnapshot` — `canonicalSchemas`, `registeredAliases`, `registeredTransforms`, `lastMappingErrors`
- `class MappingInspector`:
  - private state: `canonicalRegistry`, `aliasRegistry`, `transformPipeline`, `errorBuffer: BrokerError[]`, `errorBufferSize`
  - public: `recordSnapshot(step, snapshot)`, `recordError(error)`, `lastErrors()`, `clearErrors()`, `getSnapshot()`
- `function wrapTap(original: EventTap, inspector: MappingInspector): EventTap` — composition helper

### packages/mapper/src/inspector.test.ts (220 LOC, 10 test)

Test cases organizzati in 2 `describe` block:

| # | Describe | Test name | Behavior coperto | Decisione/REQ-ID |
|---|----------|-----------|------------------|-------------------|
| 1 | MappingInspector | constructor accepts dependencies | smoke test DI | Constructor signature |
| 2 | MappingInspector | recordSnapshot accepts F1 + F2 pipeline steps without throwing | accetta tutti i 10 step (5 F1 + 5 F2) | D-46, D-50 |
| 3 | MappingInspector | recordError appends + lastErrors copy | ring buffer push + spread copy | T-02-08-04 |
| 4 | MappingInspector | ring buffer bounded: keeps last N errors (FIFO drop) | bound size 3, push 5, keep last 3 | T-02-08-01 |
| 5 | MappingInspector | getSnapshot returns counts from registries (D-48) | 2 schemas + 1 alias + 3 transforms → counter corretti, lastMappingErrors === [] | D-48 |
| 6 | MappingInspector | getSnapshot includes recorded mapping errors | dopo recordError, snap.lastMappingErrors non vuoto | D-48 (extra coverage) |
| 7 | MappingInspector | clearErrors empties the buffer | record + clear → lastErrors === [] | utility coverage |
| 8 | MappingInspector | default errorBufferSize is 10 | constructor senza errorBufferSize → buffer capped a 10 | T-02-08-01 default (extra coverage) |
| 9 | wrapTap | wraps original tap + inspector recordSnapshot (composition) | both invoked with same args | D-46 |
| 10 | wrapTap | original tap throw is swallowed; recordSnapshot still invoked | wrapped non throw + recordSnapshot called | T-02-08-03 |

## Verification

| Comando | Risultato |
|---------|-----------|
| `pnpm --filter @gluezero/mapper test inspector` (RED, post commit 505bddd) | FAIL atteso: `Failed to resolve import "./inspector"` |
| `pnpm --filter @gluezero/mapper test inspector` (post-GREEN) | Exit 0: **`Test Files 1 passed (1) | Tests 10 passed (10)`** Duration 487ms |
| `pnpm --filter @gluezero/mapper test` (full mapper) | Exit 0: **`Test Files 6 passed (6) | Tests 87 passed (87)`** (11 canonical-registry + 16 alias-registry + 14 transform-pipeline + 10 valibot-adapter + 26 mapper-engine + 10 inspector) |
| `pnpm --filter @gluezero/mapper typecheck` | Exit 0 (isolatedDeclarations enforcement OK; ogni metodo pubblico ha return type esplicito) |
| `pnpm --filter @gluezero/core test` (regression F1) | Exit 0: **24 file/248 test passing** (no regression) |
| `pnpm exec biome check packages/mapper/src/inspector*.ts` | Exit 0 dopo auto-fix organizeImports + lineWidth |
| Grep verifica acceptance | 6/6 PASSED (`export class MappingInspector`, `export function wrapTap`, `lastErrors`, `errorBuffer`, file source + file test esistenti) |
| Audit `any` literal | 0 occorrenze come tipo |
| Audit `unknown` non documentato | 0 occorrenze (nessun unknown introdotto in questo modulo) |
| Pipeline §28 PIPE-01 — accetta tutti i 10 step | Verificato in Test 2 (F1 + F2 step F2 castati `as PipelineStep` per V1; cast sparirà post-augment.ts plan 02-09) |
| Post-commit deletion check | OK: no deletions tra HEAD~2 e HEAD (`git diff --diff-filter=D --name-only HEAD~2 HEAD` empty) |

## Threat Coverage

| Threat ID | Disposition | Mitigation in commit |
|-----------|-------------|----------------------|
| T-02-08-01 (DoS — error buffer cresce indefinitamente) | mitigate | `errorBufferSize` default 10 + FIFO drop in `recordError` (`array.shift()` quando length > size). Test 4 verifica con bound 3 e 5 push; Test 8 verifica default 10. |
| T-02-08-02 (Information disclosure — error messages contengono PII) | accept | F2 V1 best-effort. Redaction obbligatoria documentata in DOC-03 (plan 02-12) per produzione; F6 fornirà hook di redaction esplicito. |
| T-02-08-03 (DoS — original tap throw rompe wrapTap chain) | mitigate | try/catch swallow nel wrapTap (pattern F1 `safeTapStep` di event-tap.ts:23-34). Test 10 verifica: tap originale throw → wrapped NON throw + recordSnapshot comunque invocato. |
| T-02-08-04 (Tampering — `lastErrors()` ritorna reference interno → mutation esterna corrompe state) | mitigate | spread copy `[...this.errorBuffer]` ad ogni chiamata. Test 3 verifica: `errors.length = 0` su result NON altera `inspector.lastErrors().length` interno. |
| T-02-08-05 (Repudiation — `recordSnapshot` no-op per F1 step → debug confuso) | accept | Intenzionale per F2 V1 — full per-event snapshot è scope F6 (D-48). JSDoc del metodo esplicita lo scope-out con reference a TOOL-01. |

## Deviations from Plan

**Nessuna deviazione architetturale o di scope dal PLAN.** Solo addizioni di test extra (additive, non modificano il design):

**1. [Style — Test extra "getSnapshot includes recorded mapping errors"]**

- **Found during:** Task 1 RED test design
- **Issue:** Il PLAN snippet del Test "getSnapshot returns counts (D-48)" verifica `expect(snap.lastMappingErrors).toEqual([])` — caso "no errors". Manca il caso opposto (snapshot include errori effettivamente registrati). Gap di copertura della 4a property dello snapshot (D-48).
- **Fix:** Aggiunto test 6 "getSnapshot includes recorded mapping errors" che verifica esplicitamente che `recordError` popola `getSnapshot().lastMappingErrors`.
- **Files modified:** `packages/mapper/src/inspector.test.ts` (1 test extra)
- **Verification:** 10 test totali passing; snippet test del PLAN preservato (test 5).
- **Commit:** `505bddd` (RED)

**2. [Style — Test extra "default errorBufferSize is 10"]**

- **Found during:** Task 1 RED test design
- **Issue:** Acceptance criteria del PLAN nominava esplicitamente "Ring buffer bounded a `errorBufferSize` (default 10) con FIFO drop" ma il test snippet di Test 5 ("ring buffer bounded") usa `errorBufferSize: 3` esplicito — il valore di default 10 NON era coperto da un test isolato.
- **Fix:** Aggiunto test 8 "default errorBufferSize is 10" che istanzia `MappingInspector` SENZA `errorBufferSize` opzionale e verifica che il buffer è capped a 10 (15 push → keep last 10).
- **Files modified:** `packages/mapper/src/inspector.test.ts` (1 test extra)
- **Verification:** 10 test totali passing; snippet test del PLAN preservato (test 4 con bound 3).
- **Commit:** `505bddd` (RED)

**Note tecniche minori (non deviazioni):**

1. **Auto-fix Biome `organizeImports`** — Riordino degli import nel file di test: `import type` separato da `import` runtime, alfabetico cross-package. Cosmetico, semantica identica. Coerente con pattern plan 02-07.
2. **Auto-fix Biome `lineWidth`** — Consolidamento `expect(() => wrapped.onPipelineStep(...))).not.toThrow()` da multi-riga a single-line. Cosmetico.
3. **Header file italiano + JSDoc IntelliSense italiano-misto** — Coerente con `02-PATTERNS.md §1.1`. Identico al pattern usato in plan 02-03/04/05/06/07.
4. **Cast `as PipelineStep` per i 5 step F2** — Necessario in V1 perché `augment.ts` (plan 02-09) non è ancora attivo. Quando 02-09 farà TS declaration merging, il cast sparirà automaticamente. Documentato nel test stesso e in CONTEXT D-46.
5. **`createBrokerError` importato come runtime nel test, type-only nel source** — Pattern coerente: il source non istanzia errori (li riceve via `recordError`); il test li crea per verificare il ring buffer.

## TDD Gate Compliance

Plan `type: execute` con 1 task `tdd="true"`. Gate sequence verificata in `git log --oneline`:

- ✅ **RED gate** (`505bddd`): commit `test(02-08): aggiunge test RED per MappingInspector` con 10 test in 2 describe block
- ✅ **GREEN gate** (`9a93669`): commit `feat(02-08): implementa MappingInspector + wrapTap` dopo RED

**RED fail-fast confirmed:** test ha fallito al run con messaggio `Failed to resolve import "./inspector"` PRIMA della creazione del modulo. Nessun test è passato accidentalmente in fase RED.

**GREEN single-iteration:** primo run dopo source creation: 10/10 passing. Nessun fix algoritmico necessario. Auto-fix Biome cosmetici (formattazione/import ordering) committati insieme al source GREEN.

REFACTOR gate non necessario: l'implementazione è already idiomatic dopo il fix Biome; nessun refactor logico applicato.

## Auth Gates

Nessun auth gate — task interamente automatico (file creation + typecheck/test/biome local).

## Open Items / Pronto-per

- ✅ **Closed:** D-46 (estende EventTap di F1, NON parallel API) — `wrapTap` composition pattern implementato.
- ✅ **Closed:** D-47 (PipelineSnapshot esteso) — placeholder per F2 V1: `recordSnapshot` accetta i 5 step F2 (cast esplicito `as PipelineStep` per V1; sparirà post-augment.ts).
- ✅ **Closed:** D-48 (getDebugSnapshot mappings section) — `MappingInspectorSnapshot` con 4 property: counter dei 3 registry + ring buffer errori.
- ✅ **Ready:** plan 02-09 (`augment.ts`) può fare TS declaration merging del `PipelineStep` di `@gluezero/core` per aggiungere i 5 nuovi step F2 (`event.source.resolved`, `event.mapped.canonical`, `event.canonical.validated`, `event.mapped.consumer`, `event.final.validated`); il cast `as PipelineStep` nel test sparirà automaticamente.
- ✅ **Ready:** plan 02-10 (broker wrapper) può istanziare il `MappingInspector` come dipendenza, comporlo col tap utente via `wrapTap(config.runtime?.tap ?? noopEventTap, inspector)`, esporre `Broker.getDebugSnapshot().mappings = inspector.getSnapshot()`, e wirare `inspector.recordError(err)` quando il MapperEngine lancia errori `mapping.*`.
- ⏳ **Pending:** `MAP-15` Mapping Inspector richiesto dal PRD §14.8 di mostrare "payload originale, canonico, finale, trasformazioni applicate, warning di ambiguità" — F2 V1 espone solo counter + lastErrors. Full snapshot per evento (payload before/after, transformsApplied per evento, ambiguityWarnings per evento) è scope F6 (TOOL-01). Documentato in D-48.
- ⏳ **Pending:** Coverage v8 misurazione del modulo deferred a plan 02-12 (final gate F2 — D-55). Inspector non ha branch logic complessa (recordSnapshot no-op, recordError ha 1 if, lastErrors/clearErrors/getSnapshot lineari) → coverage atteso 100%.
- ⏳ **Pending:** Wave 5 plan 02-08 (questo) → plan 02-09 e 02-10 in sequenziale (depends_on=[02-08, 02-07]); file ownership confermata (questo plan tocca SOLO `inspector.ts`/`inspector.test.ts`, nessun overlap con `augment.ts` o `broker-mapper-wrapper.ts`).

## Self-Check: PASSED

File creati (verifica esistenza):
- packages/mapper/src/inspector.ts: FOUND (221 LOC)
- packages/mapper/src/inspector.test.ts: FOUND (220 LOC)

Commit hash (verifica esistenza in git log):
- 505bddd (Task RED — test inspector): FOUND
- 9a93669 (Task GREEN — feat inspector): FOUND

REQ-IDs avanzati a runtime-level (parziale per F2 V1):
- **MAP-15** Mapping Inspector — runtime parziale (counter + lastErrors V1; full snapshot per evento deferred F6 D-48)
- **MAP-16** Warning runtime alias ambiguo — runtime via `recordError` (il mapper-engine plan 02-10 chiamerà `inspector.recordError(err)` quando AliasRegistry.resolve ritorna `ambiguous: true` E il consumer plugin non ha mapping esplicito)

Decisioni F2 chiusura:
- **D-46** estende EventTap, NON parallel API — closed (wrapTap composition implementato) ✅
- **D-47** PipelineSnapshot esteso — V1 placeholder (recordSnapshot accetta gli step F2; metadata.transformsApplied/ambiguityWarnings popolati nel broker wrapper plan 02-10) ✅
- **D-48** getDebugSnapshot mappings section — closed (MappingInspectorSnapshot con 4 property) ✅
