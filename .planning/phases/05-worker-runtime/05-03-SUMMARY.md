---
phase: 05-worker-runtime
plan: 03
subsystem: worker
tags: [tdd, state-machine, pitfall-2c, atomic-cas, correlation-id]
requires:
  - 05-01 (types/task-state.ts → TaskState union + WorkerTaskOutcome)
  - F3 circuit-breaker pattern (analog state machine factory closure)
provides:
  - createTaskTracker() factory closure
  - TaskTracker interface (register/markDone/markTimeout/markCancelled/markError/getOutcome/getDebugSnapshot)
  - TaskTrackerSnapshot type (audit telemetry shape)
affects:
  - packages/worker/src/index.ts (barrel append-only)
tech-stack:
  added: []
  patterns:
    - factory closure + Map<key, state> (analog circuit-breaker.ts F3)
    - check-and-set atomico (CAS-like) via JS event loop single-thread
    - last-write-wins su register duplicato (idempotent semantics)
    - outcome build incrementale per TS exactOptionalPropertyTypes strict
key-files:
  created:
    - path: packages/worker/src/task-tracker.ts
      loc: 285
      role: state machine atomico Pitfall 2C closure (D-133)
    - path: packages/worker/src/task-tracker.test.ts
      loc: 184
      role: 12 test deterministici TDD (5 transitions + 4 atomic guards + 3 misc)
  modified:
    - path: packages/worker/src/index.ts
      change: append-only re-export createTaskTracker + TaskTracker + TaskTrackerSnapshot
decisions:
  - D-133 (state machine atomico Pitfall 2C closure)
  - D-134 (correlationId end-to-end)
  - D-149 (TDD RED→GREEN co-located)
  - D-151 #3 (timeout strict scenario verificato Test 6)
metrics:
  duration: ~12 min
  completed: 2026-05-04
  tests: 12/12
  loc-source: 285
  loc-test: 184
  coverage:
    statements: 97.05
    branches: 88.88
    functions: 100
    lines: 100
---

# Phase 5 Plan 03: Task Tracker — State Machine Atomico Pitfall 2C Closure

State machine `task-tracker.ts` con `Map<TaskId, TrackerState>` e tryTransition CAS-like atomico per chiusura deterministica della race condition timeout vs success (Pitfall 2C). Counter `lateResponses` per audit retroattivo. CorrelationId end-to-end (D-134) propagato dal `BrokerEvent` originale fino al `WorkerTaskOutcome`.

## Files Creati / Modificati

| Path | LOC | Ruolo |
|------|-----|-------|
| `packages/worker/src/task-tracker.ts` | 285 | Factory closure `createTaskTracker()` + `tryTransition` CAS atomico (D-133) |
| `packages/worker/src/task-tracker.test.ts` | 184 | 12 test deterministici TDD (RED→GREEN co-located D-149) |
| `packages/worker/src/index.ts` | +4 / -2 | Barrel append-only — re-export createTaskTracker + types |

## Test Results

**12/12 task-tracker.test.ts passing** (Tier-1 jsdom):

| # | Test | Type | Verifica |
|---|------|------|----------|
| 1 | register memorizza pending + correlationId | smoke | tasksActive=1, state='pending', correlationId='corr-1' |
| 2 | markDone su pending → true + state='done' | transition | tasksActive=0, tasksCompleted=1 |
| 3 | markTimeout su pending → true + state='timeout' | transition | id. |
| 4 | markCancelled su pending → true + state='cancelled' | transition | id. |
| 5 | markError su pending → true + state='error' | transition | + errorCode/errorMessage |
| 6 | **ATOMIC GUARD CRITICAL** — markDone DOPO markTimeout: false + lateResponses++ | **Pitfall 2C** | state resta 'timeout', tasksCompleted non re-incrementato |
| 7 | ATOMIC GUARD inverse — markTimeout DOPO markDone: false + lateResponses++ | guard | state resta 'done' |
| 8 | ATOMIC GUARD double-done — secondo markDone: false + lateResponses++ | guard | result=primo (lockato) |
| 9 | markDone su taskId mai registrato → false + lateResponses++ | guard | tasks=[] |
| 10 | getDebugSnapshot shape ({ tasksActive, tasksCompleted, lateResponses, tasks[] }) | snapshot | 2 task misti (1 done + 1 pending) |
| 11 | register stesso taskId 2 volte → silent override last-write-wins | idempotent | tasksActive=1, correlationId='corr-2' |
| 12 | correlationId end-to-end via getOutcome (D-134) + elapsedMs > 0 | E2E | outcome.correlationId='corr-1', elapsedMs > 0 |

## CI Gates

- [x] `pnpm -F @sembridge/worker test --run task-tracker` → **12/12 pass** ✓
- [x] `pnpm -F @sembridge/worker typecheck` → **clean** (0 errors) ✓
- [x] `pnpm -F @sembridge/worker build` → **dist/index.js + dist/index.d.ts** generati ✓
- [x] `grep -c "createTaskTracker" packages/worker/dist/index.js` → 2 hits ✓
- [x] `grep -c "createTaskTracker" packages/worker/dist/index.d.ts` → 3 hits ✓
- [x] `grep -c "export function createTaskTracker" packages/worker/src/task-tracker.ts` → 1 ✓ (≥1)
- [x] `grep -c "lateResponses" packages/worker/src/task-tracker.ts` → 10 ✓ (≥3)
- [x] `grep -c "tryTransition" packages/worker/src/task-tracker.ts` → 6 ✓ (≥6)
- [x] `grep -c "state !== 'pending'" packages/worker/src/task-tracker.ts` → 1 ✓ (≥1)

## Pitfall 2C Closure Verificato

**Scenario deterministico (Test 6):**

```ts
tracker.register('t1', 'corr-1')
tracker.markTimeout('t1')                 // → true (transition pending → timeout)
tracker.markDone('t1', { foo: 'bar' })    // → false (LATE RESPONSE silently dropped)
tracker.getDebugSnapshot().lateResponses  // → 1 (audit telemetry)
tracker.getDebugSnapshot().tasks[0].state // → 'timeout' (NON sovrascritto da late response)
tracker.getDebugSnapshot().tasksCompleted // → 1 (NON re-incrementato)
```

**Atomicità implicita** garantita dall'event loop JS single-threaded: `tasks.get(taskId)` + `s.state !== 'pending'` check + `s.state = target` set è una sequenza non-preemptable per lo standard JS (RESEARCH §10.7). Niente lock necessari.

**Test inverse (Test 7)** verifica simmetria: markDone-prima → markTimeout-late è droppato con stessa garanzia. **Test 8** (double-done) e **Test 9** (never-registered) coprono i due edge case residui di Pitfall 2C.

## D-83 Strict Verification

```bash
git diff main...HEAD -- packages/core/src/ packages/mapper/src/ packages/routing/src/ \
                        packages/gateway/src/http/ packages/gateway/src/sse-ws/
# → 0 lines (zero modifiche fuori da packages/worker/src/)
```

✓ **D-83 strict carryover preserved** — F5 vive solo in `packages/worker/src/` (D-121).

## Coverage v8 (file-scoped)

```
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
 task-tracker.ts   |   97.05 |    88.88 |     100 |     100 |
```

**Tutti i target del plan superati** (target ≥90/80/90/90 per statements/branches/functions/lines). 97% stmts / 88% branches: gli unici stmts non coperti sono branch optional su `getOutcome` di task ancora `pending` (consumer raramente lo invoca su pending — comportamento safe documentato JSDoc).

## REQ Progress

| REQ-ID | Coverage | Status |
|--------|----------|--------|
| WK-03 (correlationId) | TaskTracker propaga correlationId end-to-end via TrackerState + getOutcome | progress |
| WK-06 (timeout state machine) | TaskState 'timeout' implementato + atomic guard contro late response | progress |
| TEST-01 (unit broker) | unit subset task-tracker (12/12) | progress |
| TEST-03 (unit worker) | unit subset task-tracker (state machine + atomic guard) | progress |

(Plan parziale building block — gli REQ saranno completati a Wave 4 con worker-handler 05-06 e Wave 5 con final gate 05-07.)

## Threat Model Status

| Threat ID | Disposition | Status |
|-----------|-------------|--------|
| T-05-03-01 (Pitfall 2C race) | mitigate | **CLOSED** — Test 6/7/8/9 deterministic |
| T-05-03-02 (no audit trail) | mitigate | **CLOSED** — `lateResponses` counter in snapshot (10 hits in source) |
| T-05-03-03 (tasks Map unbounded) | accept | deferred to plan 05-06 (handler cleanup downstream) |
| T-05-03-04 (Info Disclosure outcome) | accept | boundary main thread — sanitization downstream 05-06 |
| T-05-03-05 (Tampering TrackerState) | mitigate | Map privata closure; getDebugSnapshot ritorna array literal (no Map iterator) |
| T-05-03-06 (register duplicate) | accept | last-write-wins documentato — Test 11 |

## Building Block Pronto per Wave 3+

Il `TaskTracker` è la primitive di orchestrazione consumata da:
- **Wave 3 (05-04 worker-bridge)**: `bridge.dispatch(taskId, ...)` invoca `tracker.register(taskId, correlationId)` pre-postMessage e `tracker.markDone/markError` su listener `comlink-resolve`.
- **Wave 4 (05-06 worker-handler)**: `handler.handleRouted(event)` orchestrates `tracker.register → bridge.dispatch → setTimeout(timeoutMs) → tracker.markTimeout` con `<topic>.completed/failed` publish gated by transition return value.

L'API è stabile per i consumer downstream.

## Decisioni Cite in Commit

- **D-133** (state machine atomico Pitfall 2C closure)
- **D-134** (correlationId end-to-end)
- **D-149** (TDD RED→GREEN co-located)
- **D-151 #3** (timeout strict scenario)

## Commits

| Hash | Type | Message |
|------|------|---------|
| `f0c768f` | test | RED task-tracker 12 test state machine atomico Pitfall 2C (D-133/D-134) |
| `bbbc989` | feat | GREEN task-tracker state machine atomico Pitfall 2C (D-133 closure WK-03/WK-06) |
| `2c3a454` | chore | expose createTaskTracker + types in barrel |

## Coordinamento con Plan 05-02 Parallel

File ownership disgiunta verificata:
- **05-03** (questo plan): `task-tracker.{ts,test.ts}` + sezione barrel W2 plan 05-03
- **05-02** (parallel): `assert-serializable.{ts,test.ts}` + `transferable-extractor.{ts,test.ts}` + sezione barrel W2 plan 05-02

Append-only sul barrel `index.ts`: nessun overlap di righe (la mia sezione è isolata sotto un commento header dedicato `// W2 plan 05-03 — task-tracker`). Pattern già provato in F4.

## Deviazioni dal Plan

**1. [Rule 1 — Bug] Fix TS strict `exactOptionalPropertyTypes` su `getOutcome`**

- **Trovato durante:** Task 1 (typecheck post-GREEN)
- **Issue:** `WorkerTaskOutcome` ha `errorCode?: string` (no `| undefined`); il primo draft passava `s.errorCode` direttamente (potenzialmente `undefined` quando state è `'done'`), violando `exactOptionalPropertyTypes: true` del progetto.
- **Fix:** Costruzione incrementale dell'outcome via spread con omit dei campi `undefined`:
  ```ts
  const base = { taskId, correlationId, state, elapsedMs } as const
  const withResult = s.result !== undefined ? { ...base, result: s.result } : base
  const withErrorCode = s.errorCode !== undefined ? { ...withResult, errorCode: s.errorCode } : withResult
  const outcome: WorkerTaskOutcome = s.errorMessage !== undefined
    ? { ...withErrorCode, errorMessage: s.errorMessage } : withErrorCode
  ```
- **File modificato:** `packages/worker/src/task-tracker.ts:233-247`
- **Commit:** Incluso in `bbbc989` (feat GREEN — fix applicato in-task pre-commit)

Nessun deferred item, nessun BLOCKER, nessun checkpoint richiesto.

## Self-Check: PASSED

**Files exist:**
- ✓ `/Users/omarmarzio/programming/prova AI/SemBridge/packages/worker/src/task-tracker.ts`
- ✓ `/Users/omarmarzio/programming/prova AI/SemBridge/packages/worker/src/task-tracker.test.ts`
- ✓ `/Users/omarmarzio/programming/prova AI/SemBridge/packages/worker/src/index.ts` (modified)

**Commits exist (verified via `git log`):**
- ✓ `f0c768f` test(05-03) RED
- ✓ `bbbc989` feat(05-03) GREEN
- ✓ `2c3a454` chore(05-03) barrel

**Test gates:**
- ✓ 12/12 task-tracker.test.ts passing
- ✓ typecheck clean
- ✓ build success
- ✓ D-83 strict gate (0 lines diff fuori da packages/worker/src/)
