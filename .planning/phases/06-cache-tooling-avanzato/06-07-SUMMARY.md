---
phase: 06-cache-tooling-avanzato
plan: 07
subsystem: devtools
tags:
  - pause-controller
  - flow-control
  - critical-bypass
  - drop-oldest
  - tdd
  - phase-6-w3
requires:
  - "@sembridge/devtools (06-01 bootstrap + types/pause-state.ts)"
  - "@sembridge/core (BrokerEvent interface)"
provides:
  - "createPauseController — pauseTopic/resumeTopic/flushQueue/intercept/isPaused/getSnapshot"
  - "PausePublishFn / PauseControllerOptions / PauseController types"
affects:
  - "D-168 pauseTopic block + queue FIFO chiuso runtime"
  - "D-169 flushQueue audit emit (system.queue.flushed) + retain paused state chiuso runtime"
  - "D-170 cap drop-oldest + critical bypass + audit (system.queue.overflow) chiuso runtime"
  - "TOOL-04 runtime building block (controlli pauseTopic/resumeTopic/flushQueue)"
  - "Pattern uniforme cross-fase critical bypass F3+F5+F6 verificato"
  - "Threat T-06-07-01 (DoS queue unbounded) mitigated via cap+drop-oldest"
  - "Threat T-06-07-03 (Logic flaw critical race) mitigated via priority='critical' pass"
  - "Threat T-06-07-04 (resumeTopic infinite loop) mitigated via delete-before-replay"
tech-stack:
  added: []
  patterns:
    - "Pattern algoritmico carryover F3 backpressure-strategy.ts:127-160 (cap + drop-oldest + critical bypass)"
    - "Critical bypass uniforme cross-fase (F3 D-75 + F5 D-130 + F6 D-170)"
    - "Map<topic, BrokerEvent[]> queue FIFO insertion order (idiomatic JS Map)"
    - "Delete-before-replay anti infinite-loop (T-06-07-04)"
    - "Audit emit via injected publishFn (DI carryover)"
key-files:
  created:
    - packages/devtools/src/pause-controller.ts
    - packages/devtools/src/pause-controller.test.ts
  modified: []
decisions:
  - "D-168 carryover — pauseTopic block + queue FIFO + resumeTopic replay"
  - "D-169 carryover — flushQueue audit (system.queue.flushed) NIENTE re-publish + retain paused state"
  - "D-170 carryover — maxQueueSize=1000 default + drop-oldest FIFO + critical bypass + audit (system.queue.overflow)"
  - "Pattern carryover F3 D-75 backpressure-strategy.ts:127-160 (algoritmico identico, semantica diversa)"
  - "BLOCKER-1 fix carryover — barrel index.ts NON modificato (cumulativo in 06-08b Wave 4b)"
  - "T-06-07-04 mitigation — paused.delete(topic) PRIMA di replay (anti infinite loop)"
metrics:
  duration: ~10min
  completed_date: 2026-05-05
  tasks_completed: 1
  files_changed: 2
  test_count: 16
  coverage:
    statements: 97.67
    branches: 83.33
    functions: 100
    lines: 100
---

# Phase 6 Plan 7: PauseController Wave 3 Summary

**One-liner:** PauseController runtime con pauseTopic/resumeTopic/flushQueue + critical bypass + cap drop-oldest (D-168/D-169/D-170 chiusi).

## Cosa è stato fatto

Wave 3 chiusura — tre building block parallelizzati con file ownership disgiunta (06-05 inspector + 06-06 metrics + **06-07 pause-controller**) hanno completato la superficie runtime devtools pre-Wave 4 composition.

**Output 06-07:**
1. `packages/devtools/src/pause-controller.ts` (191 LOC, ~115 LOC effettive) — factory `createPauseController({ maxQueueSize?, publishFn })` ritorna API `{ pauseTopic, resumeTopic, flushQueue, isPaused, intercept, getSnapshot }`.
2. `packages/devtools/src/pause-controller.test.ts` (284 LOC) — 16 test deterministici Tier-1 jsdom.

**Pattern primario carryover:**
F3 `gateway/src/http/strategies/backpressure-strategy.ts:127-160` (D-75 queue-bounded + drop-oldest + critical bypass) replicato algoritmicamente inline. La semantica diverge (F6 = explicit user pause vs F3 = automatic load shedding) ma le invarianti sono le stesse.

**Comportamenti chiave verificati:**
- D-168 — `pauseTopic` blocca publish + accoda FIFO; `resumeTopic` replay FIFO via `publishFn` iniettato + flag flip a non-paused.
- D-169 — `flushQueue(topic?)` drop silenzioso + emit audit `system.queue.flushed { topic, droppedCount, droppedEventIds }` SENZA re-publish + retain paused state (queue empty ma `isPaused === true`). `flushQueue()` senza argomento svuota TUTTE le queue paused.
- D-170 — cap `maxQueueSize: 1000` default + drop-oldest via `queue.shift()` + emit audit `system.queue.overflow { topic, droppedEventId }` + critical bypass uniforme (`event.priority === 'critical'` → return `'pass'`).

## Test plan & coverage

**16 test deterministici Tier-1 jsdom (>15 target):**
1. API shape factory
2. pauseTopic + isPaused + queue empty init
3. intercept topic non-paused → 'pass'
4. pauseTopic + intercept → 'queued' + queue.length=1
5. resumeTopic replay FIFO N event in ordine cronologico
6. resumeTopic NO infinite loop (T-06-07-04 — anti-loop guard via delete-before-replay)
7. flushQueue audit `system.queue.flushed` + droppedEventIds shape (D-169)
8. flushQueue retain paused state (queue empty + isPaused=true)
9. flushQueue() no-arg → flush ALL paused topics + N audit emit
10. flushQueue su topic non-paused → no-op silente (T-06-07-05)
11. cap drop-oldest D-170 — cap=3, intercept di 4 eventi → 1° dropped + audit overflow + replay coerente [evt-2, evt-3, evt-4]
12. cap drop multiple — 10 eventi cap=3 → 7 overflow audit + ultimi 3 in queue [evt-8, evt-9, evt-10]
13. critical bypass D-170 — pauseTopic + priority='critical' → 'pass' (NO queue, NO drop)
14. critical bypass + cap saturato → critical passes through (NO drop, NO mutation queue)
15. getSnapshot() shape `{ pausedTopics, queueSizes, maxQueueSize }`
16. Default maxQueueSize=1000 quando non specificato

**Coverage v8 sul file `pause-controller.ts`:** 97.67% statements / 83.33% branches / 100% funcs / 100% lines — supera threshold richiesta ≥90/80/90/90 ✓.

**Test totali package `@sembridge/devtools`:** 118/118 passing (9 file test).

## Acceptance gates verificati

| Gate | Risultato |
|------|-----------|
| `grep "priority === 'critical'"` ≥1 | ✓ (2 hit) |
| `grep "queue.shift()"` ≥1 | ✓ (2 hit) |
| `grep "paused.delete(topic)"` ≥1 anti-loop guard | ✓ (2 hit) |
| `grep "system.queue.flushed\|system.queue.overflow"` ≥2 | ✓ (4 hit) |
| Coverage v8 ≥90/80/90/90 | ✓ (97.67/83.33/100/100) |
| D-83 strict (zero modifiche fuori `packages/devtools/src/`) | ✓ |
| Barrel `index.ts` INVARIATO (BLOCKER-1 fix) | ✓ (diff vuoto) |
| File ownership disgiunta da 06-05 + 06-06 (parallel W3) | ✓ |
| Pattern carryover F3 D-75 + F5 D-130 critical bypass documentato | ✓ (header + JSDoc + commit) |

## Commit list

| # | Hash | Type | Messaggio |
|---|------|------|-----------|
| 1 | `1a43290` | test | RED test pause-controller (16 test D-168/D-169/D-170 + critical bypass) |
| 2 | `d79009b` | feat | GREEN pause-controller pauseTopic/resumeTopic/flushQueue (D-168/D-169/D-170) |

## Threat coverage

| Threat ID | Disposition | Mitigation status |
|-----------|-------------|-------------------|
| T-06-07-01 | mitigate | ✓ cap default 1000 + drop-oldest FIFO. Test 11 + 12 verificano cap rispettato. |
| T-06-07-02 | accept | ✓ eventIds nanoid random non-PII. Documentato in DOC-06 (deferred F6 doc consolidation). |
| T-06-07-03 | mitigate | ✓ critical priority pass + atomic single-thread JS event loop (D-133 carryover). Test 13 + 14 verificano bypass anche con cap saturato. |
| T-06-07-04 | mitigate | ✓ `paused.delete(topic)` PRIMA di replay → replay events vedono `isPaused === false` → 'pass' (no infinite loop). Test 6 verifica. |
| T-06-07-05 | accept | ✓ flushQueue di topic mai paused = no-op silente by design. Test 10 verifica zero audit emit. |

## Requirements coverage

- **TOOL-04** (runtime controls pauseTopic/resumeTopic/flushQueue) — ✓ runtime building block delivered. Wiring composition in 06-08 Wave 4.

## Pattern carryover cross-fase

| Pattern | Source | Target | Verifica |
|---------|--------|--------|----------|
| Cap + drop-oldest FIFO | F3 D-75 `backpressure-strategy.ts:138-156` | F6 `pause-controller.ts:159-167` | Algoritmo identico (queue.shift + audit + push new) |
| Critical bypass priority | F3 D-75 `backpressure-strategy.ts:131-133` + F5 D-130 worker-pool | F6 D-170 `pause-controller.ts:155-156` | Pattern uniforme `priority === 'critical' → return 'pass'` |
| Audit emit via DI publishFn | F3+F5 carryover | F6 `pause-controller.ts:140+162` | publishFn iniettato per testabilità + decoupling |

## Deviazioni dal plan

Nessuna deviazione dal PLAN.md. Implementazione 1:1 con `<action>` block del Task 1.

**Nota minor:** test count 16 anziché 15+ (aggiunto Test 16 di sanity sul default maxQueueSize=1000) — coperto dal target plan "≥15 test" ✓.

## Blocks pronti per 06-08

`createPauseController` è pronto per essere wired da `createDevtoolsBroker` (Wave 4):
- Composition wrapper (D-83 strict) intercetta `broker.publish(event)` chiamando `ctrl.intercept(event)` → su `'queued'`/`'dropped'` short-circuit della pipeline §28.
- `broker.pauseTopic`, `broker.resumeTopic`, `broker.flushQueue` esposti come metodi di façade Wave 4.
- `getSnapshot()` integrato in `getDebugSnapshot().pauseControllerState`.
- `publishFn` iniettato sarà `broker.publish.bind(broker)` adattato a signature `(topic, payload) => void`.

## Self-Check: PASSED

- File `packages/devtools/src/pause-controller.ts` — FOUND
- File `packages/devtools/src/pause-controller.test.ts` — FOUND
- Commit `1a43290` (RED test) — FOUND
- Commit `d79009b` (GREEN feat) — FOUND
- 118/118 test passing (incluso 16 test pause-controller)
- Coverage v8 sul file ≥ 90/80/90/90 ✓
- D-83 strict ✓ (zero modifiche fuori `packages/devtools/src/`)
- Barrel `index.ts` invariato ✓ (BLOCKER-1 fix rispettato)
