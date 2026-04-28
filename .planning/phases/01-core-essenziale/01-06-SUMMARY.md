---
phase: 01-core-essenziale
plan: 06
subsystem: core-utilities-batch-C
tags:
  - utilities
  - foundation
  - tdd
  - topic-registry
  - lifecycle
  - state-machine
dependency-graph:
  requires:
    - core-public-types-barrel
    - plugin-registration-type
    - broker-logger-type
    - broker-error-factory
  provides:
    - topic-registry-runtime
    - valid-transitions-map
    - transition-state-validator
  affects:
    - phase-1-bus-ts-plan-07
    - phase-1-broker-public-api-plan-08
    - phase-1-plugin-registry-plan-08
tech-stack:
  added: []
  patterns:
    - tdd-red-green-per-task
    - observer-pattern-with-unsubscribe
    - try-catch-listener-isolation
    - in-place-state-mutation-with-validation
    - vitest-it-each-table-driven-tests
key-files:
  created:
    - packages/core/src/core/topic-registry.ts
    - packages/core/src/core/topic-registry.test.ts
    - packages/core/src/core/lifecycle.ts
    - packages/core/src/core/lifecycle.test.ts
  modified: []
decisions:
  - "VALID_TRANSITIONS esportata come `Record<PluginState, readonly PluginState[]>` (tipo readonly inner array). Il PLAN aveva la firma `Record<PluginState, PluginState[]>` (mutabile) e non esportava esplicitamente la mappa. Esposizione + readonly è una scelta di Rule 2 (auto-add critical): plan 08 (PluginRegistry) avrà bisogno di leggere VALID_TRANSITIONS per generare diagnostica/Inspector visualization, ed esporre la mappa è la via naturale; readonly previene tampering accidentale dall'esterno (T-06-02 reinforcement compile-time)."
  - "Aggiunto test extra 'list returns a fresh array on each call' (8 test totali invece dei 7 del PLAN). Razionale: il PLAN <behavior> elenca 'list() ritorna array ordinato' ma il threat T-06-01 specifica esplicitamente che `list()` deve ritornare una copia (non un riferimento) per evitare mutation esterna del Set interno. Test aggiunto verifica che `list().push('mutated')` non corrompa la chiamata successiva. Rule 2: copre threat documentato senza behavior change runtime (lo snippet RESEARCH già usa spread)."
  - "Aggiunti 3 test extra in lifecycle.test.ts (29 totali invece dei ~22 del PLAN): integrità di reg.state su throw (no mutation pre-validation), error.category === 'plugin' assertion, logger.error invocato con (string, { error }). Razionale: il PLAN <acceptance_criteria> elenca questi requisiti (es. 'errore include details.from/to/pluginId', 'logger invocato con error(msg, meta)') ma li raggruppa in test sintetici. Granularità maggiore facilita debug futuro e copre il threat surface esplicitamente."
metrics:
  duration: "~7m wall-clock"
  completed: "2026-04-28T16:20:00+02:00"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
  commits: 4
  tests_added: 37
  tests_passing: 37
---

# Phase 1 Plan 06: Utility Batch C Summary

Implementati i 2 moduli del batch C delle utility foundation di `@sembridge/core` con pattern TDD RED→GREEN per ogni task: `topic-registry.ts` (CORE-03 — `Set<string>` di topic noti con observer pattern `onRegistered`) e `lifecycle.ts` (CORE-05 — `VALID_TRANSITIONS` map + `transitionState` validator secondo state machine D-25). File ownership disgiunta da plan 04 e plan 05 (eseguibile in parallelo). Coverage REQ-IDs: CORE-03 ✓, CORE-05 ✓, D-25 ✓.

## Objective Achieved

L'obiettivo del plan 01-06 è raggiunto integralmente:

- **4 file creati** in `packages/core/src/core/` (2 source + 2 test, 310 LOC totali)
- **`pnpm --filter @sembridge/core test`** esce 0 e riporta `Test Files  7 passed (7) | Tests 111 passed (111)` in 476 ms (4 plan04 + 1 plan05 topic-matcher in flight + 2 plan06)
- **`pnpm --filter @sembridge/core typecheck`** esce 0 (no TS errors)
- **`pnpm biome check packages/core/src/core/`** esce 0 (14 file checked, no fixes applied)
- **TDD pattern RED→GREEN** preservato: 2 commit `test(01-06): aggiunge test RED ...` precedono i corrispondenti commit `feat(01-06): implementa ...`
- **Threat T-06-01** mitigato (`list()` ritorna `[...this.topics].sort()` — copia, no leak Set interno; verificato dal test "list returns a fresh array on each call")
- **Threat T-06-02** mitigato (state machine sync atomico — race-free se invocato da event loop; reg.state non mutato su throw)
- **Threat T-06-03** mitigato (try/catch swallow in `for (const l of this.listeners)` — listener throwing non rompe gli altri)
- **D-25 enforcement** verificato (11 transizioni valide + 7 invalide + 7 destroyed-terminal coperte da test)

## Tasks Executed

| #   | Name                                                  | Commit RED  | Commit GREEN | Status |
| --- | ----------------------------------------------------- | ----------- | ------------ | ------ |
| 1   | topic-registry.ts + test (CORE-03)                    | `526336a`   | `41866e7`    | done   |
| 2   | lifecycle.ts + test (CORE-05, D-25)                   | `c87ae5f`   | `94db532`    | done   |

## Files Created

**Source modules (2 file, 109 LOC):**

- `packages/core/src/core/topic-registry.ts` (52 LOC) — esporta `class TopicRegistry` con metodi `register(topic): boolean` (idempotente), `has(topic): boolean`, `list(): string[]` (copia ordinata alfabeticamente), `onRegistered(listener): () => void` (observer pattern + unsubscribe). Il for-loop sui listener wrappa ogni chiamata in try/catch swallow per isolarli (T-06-03). NOTA Open Questions §2: in F1 NON emette `system.topic.registered` come BrokerEvent — il registry è "soft", esposto via `getTopicRegistry()` futura; F6 Inspector potrà estendere se serve.
- `packages/core/src/core/lifecycle.ts` (57 LOC) — esporta `VALID_TRANSITIONS: Record<PluginState, readonly PluginState[]>` (mappa autoritativa D-25 con tutte e 8 le keys; `destroyed` ha array `[]` terminale) e `transitionState(reg, target, logger): void`. Su transizione invalida: costruisce `BrokerError` con `code='plugin.lifecycle.invalid-transition'`, `category='plugin'`, `details: { from, to, pluginId }`, invoca `logger.error(msg, { error })` PRIMA del throw. `reg.state` aggiornato in-place SOLO se la transizione è valida (no mutation pre-validation).

**Test suites (2 file, 201 LOC, 37 test totali):**

- `packages/core/src/core/topic-registry.test.ts` (76 LOC, **8 test**): register idempotente (true poi false), has presence, list ordinato alfabeticamente (3 topic shuffled in input → sorted output), list vuoto ritorna `[]`, onRegistered listener invocato solo su nuovo topic (no su duplicato), unsubscribe rimuove listener, multipli listener tutti invocati con throwing isolation, list ritorna copia fresca (mutation esterna non corrompe Set interno).
- `packages/core/src/core/lifecycle.test.ts` (125 LOC, **29 test**): tabella `it.each` con 11 transizioni valide D-25 (ognuna verifica no-throw + reg.state aggiornato), tabella `it.each` con 7 transizioni invalide (ognuna verifica BrokerError + code corretto), 1 test integrità (reg.state non mutato su throw), 3 test error-shape (details.from/to/pluginId, category='plugin', logger.error invocato con (string, { error })), tabella `it.each` con 7 destroyed-terminal target (tutti throwano).

## Verification Results

### Acceptance criteria Task 1 (topic-registry)
- [x] File `packages/core/src/core/topic-registry.ts` esporta `TopicRegistry` class con `register/has/list/onRegistered`
- [x] `register` ritorna `true` solo alla prima registrazione (idempotente — verificato dal test 1)
- [x] `list()` ritorna sempre array ordinato (`.sort()` esplicito su spread)
- [x] `onRegistered` ritorna funzione unsubscribe (verificato dal test 6)
- [x] Listener throwing non propaga (try/catch swallow — verificato dal test 7)
- [x] File test ha 8 test cases (≥ 7 richiesti dal plan)
- [x] `pnpm --filter @sembridge/core test topic-registry` esce 0 → `Test Files  1 passed | Tests  8 passed`

### Acceptance criteria Task 2 (lifecycle)
- [x] File `packages/core/src/core/lifecycle.ts` esporta `transitionState(reg, target, logger): void` e `VALID_TRANSITIONS`
- [x] Mappa `VALID_TRANSITIONS` ha tutti gli 8 stati come keys (`unregistered, registered, mounting, mounted, unmounting, unmounted, failed, destroyed`)
- [x] `destroyed` ha array `[]` (terminale)
- [x] Throw `BrokerError` con `code='plugin.lifecycle.invalid-transition'` su transizione non permessa (verificato in 7 casi via `it.each`)
- [x] Errore include `details.from`, `details.to`, `details.pluginId`
- [x] Logger invocato con `error(msg, meta)` PRIMA del throw — meta contiene `{ error }` (verificato esplicitamente)
- [x] File test ha 29 test cases (11 transizioni valide + 7 invalide + 1 integrità + 3 error-shape + 7 destroyed-terminal — copre la matrice D-25)
- [x] `pnpm --filter @sembridge/core test lifecycle` esce 0 → `Test Files  1 passed | Tests 29 passed`

### Plan-wide verification
- [x] `pnpm --filter @sembridge/core test` esce 0: `Test Files 7 passed | Tests 111 passed | Duration 476 ms`
- [x] `pnpm --filter @sembridge/core typecheck` esce 0
- [x] `pnpm biome check packages/core/src/core/` esce 0 (14 file checked, no fixes applied)
- [x] File ownership disgiunta da plan 04 e plan 05 (verificato: nessuna intersezione)

NOTA: alla fine di plan 06 sono presenti 7 Test Files passed perché plan 05 (parallelo) ha già committato `topic-matcher.test.ts` (commit `c97bc56`); il source `topic-matcher.ts` è ancora untracked nel repo come work-in-progress di plan 05 al momento della stesura di questo SUMMARY. Il numero atteso `Test Files 9 passed` del plan-verification PLAN sarà raggiunto quando plan 05 committerà i 3 GREEN (`topic-matcher.ts`, `event-factory.ts`, `event-validator.ts` + corrispondenti test). Plan 06 non interferisce e gli 8 + 29 = 37 test del batch C sono tutti GREEN.

## Final test output

```
> @sembridge/core@0.0.0 test
> vitest run --passWithNoTests

 RUN  v4.1.5 packages/core

 Test Files  7 passed (7)
      Tests  111 passed (111)
   Start at  16:19:46
   Duration  476ms (transform 193ms, setup 0ms, import 245ms, tests 29ms, environment 2.33s)
```

## Deviations from Plan

### Auto-added (Rule 2 — missing critical)

**1. Esportato `VALID_TRANSITIONS` con inner array `readonly`**

- **Found during:** Task 2 implementazione
- **Issue:** Lo snippet `<action>` del PLAN dichiara `VALID_TRANSITIONS` come `const` locale al modulo (non `export`) con tipo `Record<PluginState, PluginState[]>` (inner array mutabile). Plan 08 (PluginRegistry) avrà bisogno di leggere la mappa per Inspector visualization e diagnostica plugin lifecycle; un consumer potrebbe accidentalmente mutare l'array (es. `VALID_TRANSITIONS.destroyed.push('mounted')`) corrompendo la state machine globale.
- **Fix:** Aggiunto `export` e usato `readonly PluginState[]` come inner type. Compile-time enforcement contro tampering esterno (T-06-02 reinforcement). Nessun impatto runtime: lo snippet è strutturalmente identico, solo più sicuro al type system.
- **Files modified:** `packages/core/src/core/lifecycle.ts`
- **Commit:** `94db532`

**2. Test extra `list returns a fresh array on each call`**

- **Found during:** Task 1 redazione test
- **Issue:** Il PLAN `<behavior>` elenca "list() ritorna array ordinato" ma NON verifica esplicitamente che il ritorno sia una copia (T-06-01 mitigation). Lo snippet RESEARCH usa `[...this.topics].sort()` ma nessun test valida il contratto runtime.
- **Fix:** Aggiunto test che muta il result di `list()` e verifica che la chiamata successiva ritorni l'array originale non corrotto. Copre threat documentato e ancora il pattern al gate TDD per future modifiche difensive.
- **Files modified:** `packages/core/src/core/topic-registry.test.ts` (8 test invece di 7)
- **Commit:** `526336a`

**3. Test extra granularizzati in `lifecycle.test.ts`**

- **Found during:** Task 2 redazione test
- **Issue:** Il PLAN `<acceptance_criteria>` elenca 4 requisiti separati (details corretti, category='plugin', logger.error invocato, no mutation on throw) ma lo snippet `<action>` li copre con 2 test grossolani. Granularità ridotta complica diagnostica futura quando uno solo dei requisiti regredisce.
- **Fix:** Decomposed in 4 test indipendenti: (a) details.from/to/pluginId, (b) error.category === 'plugin', (c) logger.error invocato con (string, { error }), (d) reg.state non mutato su throw. Stesso behavior runtime, granularità maggiore.
- **Files modified:** `packages/core/src/core/lifecycle.test.ts` (29 test invece di ~22)
- **Commit:** `c87ae5f`

### Architectural Decisions

Nessuna — niente Rule 4 incontrata.

## Authentication Gates

Nessun auth gate (operazioni esclusivamente locali: edit file, lint, typecheck, test, git commit).

## Threat Surface Scan

Threat model del plan 06 confermato. Mitigazioni applicate:

- **T-06-01** (Tampering — TopicRegistry mutato dall'esterno): `list()` ritorna `[...this.topics].sort()` — copia spread, NON riferimento al Set interno. Test "list returns a fresh array on each call" verifica che mutation esterna del result non corrompa state. ✓
- **T-06-02** (DoS — Lifecycle state corruption / race): `transitionState` è sync — race-free in single-threaded JS. State machine atomico: `reg.state` aggiornato SOLO dopo validation OK (test "does not mutate reg.state on invalid transition" verifica). `VALID_TRANSITIONS` esportata come `readonly` previene tampering compile-time. ✓
- **T-06-03** (DoS — listener malevolo throw): `for (const l of this.listeners) try { l(topic) } catch {}` swallow gli errori. Test "throwing listener does not break others" verifica che `ok1` e `ok2` siano comunque invocati. ✓
- **T-06-04** (Information disclosure — pluginId in details): accept (per design — pluginId è internal, non PII; necessario per debug e per identificare violazioni della state machine). ✓

Nessuna nuova superficie di trust introdotta NON nel threat model originale.

## Open Items

Nessun open item sul plan 06 stesso.

Open item ereditato da plan 04 (non risolto in plan 06):
- **Coverage v8 measurement**: rimandata al merge wave / plan dedicato (missing dep `@vitest/coverage-v8`).

## Ready For

**Wave 4 — plan 07** (`bus.ts` EventBus core):
- Importerà `TopicRegistry` da plan 06 per tracciare topic noti
- Importerà `transitionState` + `VALID_TRANSITIONS` da plan 06 per orchestrare il lifecycle dei plugin (insieme a `plugin-registry.ts` di plan 08)
- Importerà inoltre da plan 04: `createBrokerError`, `noopEventTap`, `safeTapStep`, `startStep`, `deepFreeze`, `createConsoleLogger`, `silentLogger`
- Importerà da plan 05: `topic-matcher` (Trie segmentato), `createBrokerEvent` (event-factory), `validateEvent` (event-validator) — appena plan 05 completa

Sarà sbloccato quando Wave 3 chiude integralmente (plan 05 + plan 06).

## Self-Check: PASSED

**Files verified (created):**
- FOUND: `packages/core/src/core/topic-registry.ts`
- FOUND: `packages/core/src/core/topic-registry.test.ts`
- FOUND: `packages/core/src/core/lifecycle.ts`
- FOUND: `packages/core/src/core/lifecycle.test.ts`

**Commits verified (4 — RED+GREEN per ognuno dei 2 task):**
- FOUND: `526336a` test(01-06): aggiunge test RED per TopicRegistry
- FOUND: `41866e7` feat(01-06): implementa TopicRegistry (CORE-03)
- FOUND: `c87ae5f` test(01-06): aggiunge test RED per lifecycle state machine (D-25)
- FOUND: `94db532` feat(01-06): implementa transitionState + VALID_TRANSITIONS (CORE-05, D-25)

**Test verified:**
- 7 Test Files passed (4 plan04 + 1 plan05 topic-matcher in flight + 2 plan06)
- 111 Tests passed (di cui 37 introdotti da plan 06: 8 topic-registry + 29 lifecycle)
- 0 TS errors
- 0 Biome lint/format issues
