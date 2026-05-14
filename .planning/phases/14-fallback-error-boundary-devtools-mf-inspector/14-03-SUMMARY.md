---
phase: 14-fallback-error-boundary-devtools-mf-inspector
plan: "14-03"
title: "W2 P03 — RetryEngine (3-mode backoff + ±20% jitter + Map counter) + CircuitBreaker (3-state FSM + threshold + lazy + topic emit)"
subsystem: "@gluezero/fallbacks"
tags: ["retry", "circuit-breaker", "backoff", "jitter", "fsm", "topic-emit", "f14-w2"]
wave: 2
depends_on: ["14-01"]
requirements_closed:
  - "MF-FALLBACK-02 — RetryPolicy 3-mode backoff (none/linear/exponential) + jitter ±20% + per-MF+per-phase counter + reset semantics + shouldRetry predicate (PRD §29.3 verbatim)"
  - "MF-FALLBACK-03 — CircuitBreakerPolicy 3-state FSM (closed/open/half-open) + threshold + lazy transition + 2 topics emit (microfrontend.circuit.opened + microfrontend.circuit.closed) + per-MF isolation + dispose cleanup"
requires:
  - "@gluezero/core (Broker type + BrokerModule interface — type import)"
  - "@gluezero/fallbacks W1 14-01 (RetryPolicy + CircuitBreakerPolicy + MicroFrontendErrorLifecyclePhase types + MF_FALLBACK_TOPICS literal)"
provides:
  - "createRetryEngine() factory anti-singleton D-30 + RetryEngine interface (computeDelay/incrementAttempt/getAttempts/resetCounter/shouldRetry 5-method API stable)"
  - "createCircuitBreaker(broker) factory anti-singleton D-30 + CircuitBreaker interface (canExecute/recordFailure/recordSuccess/getState/dispose 5-method API stable)"
  - "Counter Map<RetryKey, number> private — key template `${mfId}::${phase}` per-MF+per-phase isolation"
  - "State Map<string, CircuitState> private — per-MF isolation + dispose(mfId) cleanup hook P-02"
  - "Topic emit microfrontend.circuit.opened + microfrontend.circuit.closed con source descriptor F1 D-23 obbligatorio + deliveryMode:sync"
  - "Lazy transition open → half-open (Date.now() - openedAt >= resetAfterMs) — F3 pattern carryover senza setTimeout overhead per-MF idle"
  - "Debounce double-emit (ulteriori failure in open NON re-emettono opened)"
  - "Default enabled:false pass-through (canExecute=true sempre, no state change, no emit)"
affects: []
tech-stack:
  added: []
  patterns:
    - "Rule 2 stretto carryover F3 — pattern retry-strategy.ts + circuit-breaker.ts da packages/gateway/src/http/strategies/"
    - "Diff F3 → F14 key axis: mfId+phase composto vs routeId / 3-mode backoff vs exponential locked / ±20% jitter vs ±50% AWS / topic emit aggiuntivo F14"
    - "Anti-singleton D-30 ogni factory (createRetryEngine / createCircuitBreaker) — istanze indipendenti"
    - "D-V2-F14-09 ±20% jitter conservativo (factor=0.8+Math.random()*0.4) — mitigation P-01 retry storm thundering herd"
    - "D-V2-F14-10 retry trigger via mfService.<op>(mfId) 5 ops API pubblica (OQ-1 verified: load/bootstrap/mount/unmount/destroy)"
    - "D-V2-F14-11 3-state FSM per-MF + threshold + lazy transition pattern"
    - "D-V2-F14-12 circuit → retry order (caller skip retry quando canExecute=false)"
    - "F1 D-23 source descriptor convention {type:plugin, id:fallbacks, name:@gluezero/fallbacks} obbligatorio per ogni broker.publish"
    - "D-83 strict septuple esteso v2.0: 7 protected packages src/ zero diff"
key-files:
  created:
    - "packages/fallbacks/src/retry-engine.ts (239 LoC)"
    - "packages/fallbacks/src/retry-engine.test.ts (276 LoC, 29 it() blocks)"
    - "packages/fallbacks/src/circuit-breaker.ts (314 LoC)"
    - "packages/fallbacks/src/circuit-breaker.test.ts (295 LoC, 22 it() blocks)"
  modified: []
decisions:
  - "Jitter ±20% lockato a `factor = 0.8 + Math.random() * 0.4` (range [0.8, 1.2) perche Math.random ∈ [0, 1)) — D-V2-F14-09 verbatim implementation"
  - "Key composta `${mfId}::${phase}` con separator `::` doppio colon — `mfId` valido [a-z0-9-] e phase letterali 7 union NON contengono `::` (collision-free)"
  - "computeDelay puro (no side effect) — caller responsabilita gestione `await setTimeout(delay)` + chiamata incrementAttempt"
  - "shouldRetry predicate semantica: counter < policy.attempts (strict less-than) — attempts:1 + 1 increment = exhausted (default no-retry behavior)"
  - "Lazy transition open → half-open triggerata SOLO da recordFailure/recordSuccess (NOT da canExecute/getState) — perche canExecute non ha policy.resetAfterMs in scope. Caller chiama recordX prima di canExecute, garantendo state sync"
  - "Debounce double-emit: ulteriori failure in open NON re-emettono opened ma incrementano comunque counter (per metrics observability future W2 P05 Inspector)"
  - "recordSuccess in closed: reset counter MA NO emit circuit.closed (transition closed→closed non e governance-relevant)"
  - "recordSuccess in open senza cooldown elapsed: no-op (success non sblocca circuit prima del cooldown — semantics conservativa)"
metrics:
  duration_minutes: 8
  tasks_total: 2
  tasks_completed: 2
  files_created: 4
  files_modified: 0
  loc_added: 1124
  test_count: 51
  test_passed: 51
  commits: 4
  commit_hashes:
    - "387cc9b — test(14-03): RED retry-engine.test.ts ≥20 scenari"
    - "f80dc18 — feat(14-03): GREEN retry-engine.ts createRetryEngine + 3-mode backoff + ±20% jitter + Map counter API stabile"
    - "f33b201 — test(14-03): RED circuit-breaker.test.ts ≥20 scenari"
    - "b57fd2f — feat(14-03): GREEN circuit-breaker.ts createCircuitBreaker + 3-state FSM + threshold + lazy + topic emit"
  completed_date: "2026-05-14"
---

# Phase 14 Plan 14-03: W2 P03 RetryEngine + CircuitBreaker Summary

**One-liner:** Implementazione `createRetryEngine()` (3-mode backoff `none`/`linear`/`exponential` + jitter ±20% conservativo D-V2-F14-09 + Map counter `${mfId}::${phase}` per-MF+per-phase isolation) + `createCircuitBreaker(broker)` (3-state FSM `closed`/`open`/`half-open` + threshold + lazy transition + 2 topics emit `microfrontend.circuit.{opened,closed}` con source descriptor F1 D-23) — Rule 2 stretto carryover F3 `packages/gateway/src/http/strategies/{retry-strategy,circuit-breaker}.ts` con divergenze documentate D-83 septuple zero-diff.

## Tasks Completed

### Task 14-03-T01 — RetryEngine (TDD RED + GREEN)

**Files created:**
- `packages/fallbacks/src/retry-engine.ts` (239 LoC)
- `packages/fallbacks/src/retry-engine.test.ts` (276 LoC, **29 it() blocks**)

**API surface (5-method `RetryEngine` interface):**
```typescript
export interface RetryEngine {
  readonly computeDelay: (attempt: number, policy: RetryPolicy) => number
  readonly incrementAttempt: (mfId: string, phase: MicroFrontendErrorLifecyclePhase) => number
  readonly getAttempts: (mfId: string, phase: MicroFrontendErrorLifecyclePhase) => number
  readonly resetCounter: (mfId: string, phase: MicroFrontendErrorLifecyclePhase) => void
  readonly shouldRetry: (mfId: string, phase: MicroFrontendErrorLifecyclePhase, policy: RetryPolicy) => boolean
}
export function createRetryEngine(): RetryEngine
```

**Backoff formula (PRD §29.3 verbatim):**
- `'none'`: `delay = delayMs ?? 0` (costante)
- `'linear'`: `delay = base * (attempt + 1)` (lineare 1x → 2x → 3x)
- `'exponential'`: `delay = base * 2^attempt` (esponenziale 1x → 2x → 4x → 8x)

**Jitter ±20% (D-V2-F14-09):**
```typescript
const factor = 0.8 + Math.random() * 0.4  // ∈ [0.8, 1.2)
delay = delay * factor
```

**Diff F3 → F14:**

| Aspect | F3 Gateway | F14 Fallbacks |
|--------|-----------|---------------|
| Key | `routeId` | `mfId::phase` composto |
| Backoff | exponential locked | 3-mode PRD §29.3 |
| Jitter | ±50% AWS full | ±20% conservativo |
| Trigger | `fetch(req)` | `mfService.<op>(mfId)` 5 ops (OQ-1) |

**Test count breakdown:**
- 4 scenari `backoff:"none"` (costante + default + delayMs omitted)
- 3 scenari `backoff:"linear"` (attempt=0/1/2)
- 4 scenari `backoff:"exponential"` (attempt=0/1/2/3)
- 6 scenari jitter ±20% (Math.random=0.5/0/0.999/jitter:false/jitter omitted/+exponential combinato)
- 1 scenario Math.floor integer output
- 7 scenari counter Map (increment ritorno + default 0 + per-phase + per-MF isolation + reset + reset no-op + anti-singleton)
- 4 scenari shouldRetry predicate (counter=0/2/3 vs attempts=3 + attempts:1 default)

### Task 14-03-T02 — CircuitBreaker (TDD RED + GREEN)

**Files created:**
- `packages/fallbacks/src/circuit-breaker.ts` (314 LoC)
- `packages/fallbacks/src/circuit-breaker.test.ts` (295 LoC, **22 it() blocks**)

**API surface (5-method `CircuitBreaker` interface):**
```typescript
export interface CircuitBreaker {
  readonly canExecute: (mfId: string) => boolean
  readonly recordFailure: (mfId: string, policy: CircuitBreakerPolicy) => void
  readonly recordSuccess: (mfId: string, policy: CircuitBreakerPolicy) => void
  readonly getState: (mfId: string) => 'closed' | 'open' | 'half-open'
  readonly dispose: (mfId: string) => void  // P-02 cleanup
}
export function createCircuitBreaker(broker: Broker): CircuitBreaker
```

**State machine D-V2-F14-11:**

```
 closed ──(failures >= threshold)──▶ open
   ▲                                  │
   │ recordSuccess                    │ Date.now() - openedAt >= resetAfterMs
   │                                  ▼
 closed ◀──(success)── half-open ◀────┘
                         │
                         └──(failure)──▶ open (re-emit opened, timer reset)
```

**Topics emit (D-V2-F14-03):**
- `microfrontend.circuit.opened`: payload `{microFrontendId, consecutiveFailures, openedAt, timestamp}`
- `microfrontend.circuit.closed`: payload `{microFrontendId, closedAt, timestamp}`
- Publish options: `{source: {type:'plugin', id:'fallbacks', name:'@gluezero/fallbacks'}, deliveryMode: 'sync'}` — F1 D-23 obbligatorio.

**Diff F3 → F14:**

| Aspect | F3 Gateway | F14 Fallbacks |
|--------|-----------|---------------|
| Key | `routeId` | `mfId` |
| Topic emit | NO (internal) | 2 topics governance |
| Source descriptor | n/a | F1 D-23 obbligatorio |
| Dispose | n/a | `dispose(mfId)` P-02 cleanup |

**Test count breakdown:**
- 3 scenari disabled `enabled:false` (canExecute true mai visto + recordFailure no-op + recordSuccess no-op)
- 6 scenari closed → open (1/2 fail no emit + 3 fail emit + payload include openedAt/timestamp + debounce double-emit + canExecute false + source descriptor F1 D-23)
- 3 scenari lazy transition (open → half-open → closed con `vi.useFakeTimers` + `vi.advanceTimersByTime(1100)` + half-open → open re-emit + payload closedAt)
- 2 scenari closed recordSuccess (reset counter + no emit)
- 2 scenari per-MF isolation (mf-A vs mf-B + default closed)
- 2 scenari dispose cleanup (remove state + no throw mai visto)
- 2 scenari custom threshold (2 + 1 aggressive)
- 1 scenario anti-singleton D-30 (2 cb indipendenti)

## Verification Output

### Test suite combinata (Tier-1 jsdom)

```
$ pnpm --filter @gluezero/fallbacks test -- --run src/retry-engine.test.ts src/circuit-breaker.test.ts

 RUN  v4.1.5 packages/fallbacks

 Test Files  2 passed (2)
      Tests  51 passed (51)
   Start at  10:25:14
   Duration  462ms (transform 85ms, setup 0ms, import 111ms, tests 10ms, environment 604ms)
```

**Risultato:** 51/51 PASS (29 retry-engine + 22 circuit-breaker) — target ≥40 superato.

### Typecheck

```
$ pnpm --filter @gluezero/fallbacks typecheck
(no output — exit 0)
```

**Risultato:** Clean, nessun errore TS.

### D-83 strict septuple zero-diff verification

```
$ git diff ebbe0a2 HEAD -- \
    packages/core/src/ \
    packages/microfrontends/src/ \
    packages/mapper/src/ \
    packages/context/src/ \
    packages/permissions/src/ \
    packages/compat/src/ \
    packages/isolation/src/ \
  | wc -l
0
```

**Risultato:** Zero diff su tutti i 7 protected packages — D-83 strict septuple rispettato vs W1 baseline (`ebbe0a2`).

## REQ-ID Coverage

| REQ-ID | Status | Verification |
|--------|--------|--------------|
| **MF-FALLBACK-02** | ✅ CLOSED | RetryPolicy 3-mode backoff (none/linear/exponential PRD §29.3 verbatim) + jitter ±20% (D-V2-F14-09 factor=0.8+Math.random()*0.4) + counter Map per-MF+per-phase isolation + resetCounter on success + shouldRetry predicate boundary — 29 test PASS |
| **MF-FALLBACK-03** | ✅ CLOSED | CircuitBreakerPolicy 3-state FSM (closed/open/half-open D-V2-F14-11) + threshold counter + lazy transition (Date.now() - openedAt >= resetAfterMs F3 pattern carryover) + 2 topics emit (microfrontend.circuit.opened + microfrontend.circuit.closed con source descriptor F1 D-23) + per-MF isolation + dispose(mfId) P-02 cleanup — 22 test PASS |

## Deviations from Plan

**Nessuna deviation** — plan eseguito esattamente come scritto. Test count target (≥40) superato (51 totali). API signature identica al spec. D-83 strict septuple verificato zero-diff vs W1 baseline.

## TDD Gate Compliance

Sequenza RED → GREEN rispettata per entrambi i task:

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 14-03-T01 RetryEngine | `387cc9b` test(14-03): RED retry-engine.test.ts | `f80dc18` feat(14-03): GREEN retry-engine.ts |
| 14-03-T02 CircuitBreaker | `f33b201` test(14-03): RED circuit-breaker.test.ts | `b57fd2f` feat(14-03): GREEN circuit-breaker.ts |

REFACTOR phase non necessaria — codice GREEN pulito senza duplicazione (factory pattern + 5-method API + Map private).

## Threat Surface Scan

Nessun nuovo threat surface introdotto rispetto a `<threat_model>` del plan. STRIDE register T-14-03-01 (retry storm DoS — mitigated da `attempts:1` default + jitter ±20% + circuit→retry order D-V2-F14-12) e T-14-03-02 (memory leak counter/state Map — mitigated da `dispose(mfId)` API + W2 P04 subscribe `microfrontend.unregistered`) confermati.

## Next Steps — W2 P04 dependency

W2 P04 (FallbackRenderer + module install) può ora importare:
```typescript
import { createRetryEngine } from './retry-engine.js'
import { createCircuitBreaker } from './circuit-breaker.js'
```

per orchestrator chain in `fallbacksModule.install`:
1. `const retryEngine = createRetryEngine()`
2. `const circuit = createCircuitBreaker(broker)`
3. Error subscriber callback: `if (!circuit.canExecute(mfId)) { await dispatchFallback(...); return }`
4. `if (retryEngine.shouldRetry(mfId, phase, policy)) { ...await mfService[phase](mfId); circuit.recordSuccess(mfId, policy) }`
5. Topic subscribe `microfrontend.unregistered` → `retryEngine.resetCounter(mfId, phase)` + `circuit.dispose(mfId)` (P-02 cleanup cascade)

## Self-Check: PASSED

- [x] `packages/fallbacks/src/retry-engine.ts` exists (239 LoC)
- [x] `packages/fallbacks/src/retry-engine.test.ts` exists (276 LoC, 29 it())
- [x] `packages/fallbacks/src/circuit-breaker.ts` exists (314 LoC)
- [x] `packages/fallbacks/src/circuit-breaker.test.ts` exists (295 LoC, 22 it())
- [x] Commit `387cc9b` (RED retry) in git log
- [x] Commit `f80dc18` (GREEN retry) in git log
- [x] Commit `f33b201` (RED circuit) in git log
- [x] Commit `b57fd2f` (GREEN circuit) in git log
- [x] 51/51 tests PASS (target ≥40)
- [x] Typecheck exit 0
- [x] D-83 septuple zero-diff (0 lines)
