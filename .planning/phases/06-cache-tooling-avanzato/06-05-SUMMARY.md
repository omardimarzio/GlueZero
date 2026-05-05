---
phase: 06-cache-tooling-avanzato
plan: 05
subsystem: devtools-inspector
tags: [devtools, inspector, ring-buffer, lazy-mode, structuredClone, F6, W3]
provides:
  - createEventInspector closure factory (tap + enable/disable + getBuffer + clear + getSnapshot)
  - createRouteInspector closure factory (capture step 9+10 + aggregate eventId+routeId)
  - EventInspector ring buffer 500 default (D-167)
  - RouteInspector ring buffer 500 default (D-167)
  - Lazy-mode early-return D-160 (zero overhead production)
  - Deep-clone via structuredClone D-162 (mutation safety)
  - Default NODE_ENV inline detection (uniformità cross-component WARNING-5 fix)
requires:
  - "@gluezero/core (EventTap, PipelineSnapshot, PipelineStep)"
  - "06-01 types (EventInspectorSnapshot, RouteInspectorEntry da inspector-entry.ts)"
  - "06-04 multiplex-tap + tap-registry (downstream consumer pattern)"
affects:
  - packages/devtools/src/event-inspector.ts (creato)
  - packages/devtools/src/event-inspector.test.ts (creato)
  - packages/devtools/src/route-inspector.ts (creato)
  - packages/devtools/src/route-inspector.test.ts (creato)
key-files:
  created:
    - packages/devtools/src/event-inspector.ts
    - packages/devtools/src/event-inspector.test.ts
    - packages/devtools/src/route-inspector.ts
    - packages/devtools/src/route-inspector.test.ts
  modified: []
decisions:
  - "D-160 default NODE_ENV inline replicato in entrambi i file (NON delegato a wrapper) — uniformità cross-component"
  - "exactOptionalPropertyTypes: true → costruzione condizionale dei campi optional (route-inspector retryCount/policiesApplied/cacheHit/errorCode)"
  - "process access via globalThis cast (pattern carryover F5 worker-bridge.ts:556) — devtools è browser-package senza @types/node"
metrics:
  duration_minutes: 6
  completed_date: 2026-05-05
  task_count: 2
  test_count: 29
  test_breakdown: "14 event-inspector + 15 route-inspector"
  coverage: "98.76/91.07/100/98.71 (statements/branches/functions/lines >90/80/90/90)"
  loc_source: "~250 LOC totali (85 event-inspector + 224 route-inspector)"
---

# Phase 6 Plan 05: Inspector (EventInspector + RouteInspector) Summary

**One-liner:** EventInspector ring buffer 500 D-167 + RouteInspector capture step 9+10 con aggregate per (eventId, routeId), entrambi con lazy-mode D-160 + deep-clone D-162.

## Cosa è stato consegnato

Wave 3 building block A della Fase 6 (parallel-eligible con 06-06 ∥ 06-07 — file ownership disgiunta verificata): due closure factory in `packages/devtools/src/` che implementano i due Inspector richiesti dal PRD §30 (TOOL-01 + TOOL-03 partial).

### `createEventInspector(opts)` (Task 1)

Cattura tutti i `PipelineSnapshot` in arrivo via `tap.onPipelineStep`, mantiene un ring buffer 500 entries (override via `opts.bufferSize`). Drop-oldest FIFO via `Array.shift` quando length supera bufferSize.

API: `{ tap, enable, disable, getBuffer, clear, getSnapshot }`.

- `tap.onPipelineStep(step, snapshot)`: hot-path early return su `state.enabled === false` (D-160 zero overhead production); altrimenti push + drop-oldest.
- `enable()` / `disable()`: toggle live mode. `disable()` SVUOTA il buffer (memory hygiene RESEARCH §6.3 — T-06-05-03 mitigation).
- `getBuffer()`: ritorna deep-clone via `structuredClone` (D-162) → caller mutation NON corrompe state interno (T-06-05-02 mitigation).
- `clear()`: svuota buffer ma preserva `state.enabled`.
- `getSnapshot()`: meta-info `{ enabled, bufferEntries, bufferSize }` senza clonare il buffer (DX-friendly per metrics gauge).

Default `initiallyEnabled` via `detectDefaultEnabled()` inline: se `globalThis.process.env.NODE_ENV === 'production'` → false; altrimenti → true (DX dev-friendly auto, browser fallback true).

### `createRouteInspector(opts)` (Task 2)

Cattura step 9 (`event.route.executed`) + step 10 (`event.outcome.collected`) della pipeline §28 F3, aggrega per `(eventId, routeId)` in `RouteInspectorEntry`. Ring buffer 500 entries (override via `opts.bufferSize`). Pattern Map pending → push-to-buffer al completamento step 10.

API identica a EventInspector. Step diversi da 9+10 → ignorati. Step con `metadata.routeId` mancante → ignorati (defensive). Step 9 senza step 10 successivo → entry resta in pending Map (cleanup via `disable()` / `clear()`).

Aggregazione campi:
- `outcome` da `metadata.outcome` (default 'success')
- `cacheHit` da `metadata.origin === 'cache'`
- `errorCode` da `metadata.errorCode` (per outcome='error')
- `retryCount` da `metadata.retryCount` (analog F3 03-09 retry)
- `policiesApplied` da `metadata.policies` (array readonly)

## Commit list (TDD atomic RED → GREEN)

| Hash | Type | Descrizione |
|------|------|-------------|
| `a1d858a` | test | RED test for event-inspector (12 test, 14 con sub-describe Test 12) |
| `84912a0` | feat | GREEN event-inspector ring buffer 500 + lazy + NODE_ENV + deep-clone |
| `cae80ca` | test | RED test for route-inspector (15 test) |
| `33948a6` | feat | GREEN route-inspector capture step 9+10 + aggregate |

## Test count + coverage

- **EventInspector**: 14/14 passing (12 main test, 1 con sub-describe a 3 sotto-test sub-process env)
- **RouteInspector**: 15/15 passing
- **Totale W3 Task 06-05**: 29/29 passing (15 + 14)
- **Devtools full suite (post-merge 06-04+06-05)**: 57/57 passing
- **Coverage v8 globale devtools**:
  - Statements: 98.76% (80/81)
  - Branches: 91.07% (51/56)
  - Functions: 100% (26/26)
  - Lines: 98.71% (77/78)
- Threshold targets 90/80/90/90 → **TUTTI superati**
- L'unica linea uncovered (`route-inspector.ts:91`) è il branch `catch { /* fallthrough */ }` di `detectDefaultEnabled()` non triggerable in jsdom (eccezione su accesso process.env). Pattern identico a event-inspector (replica intenzionale per zero coupling).

## REQ-IDs avanzati

- **TOOL-01** (Event Inspector): partial → ring buffer + lazy mode + deep-clone consegnati. Wiring a DevtoolsBroker pending per 06-08b.
- **TOOL-02** (Route Inspector): partial → capture step 9+10 + aggregate consegnato. Wiring pending 06-08b.
- **TOOL-03** (enable/disable API): partial → API esposta sui due Inspector. Coordinamento globale `enableDebug/disableDebug` in 06-08b.
- **PIPE-01** ext F6: partial → step 9+10 captured (RouteInspector) + step 14 ready (EventInspector cattura `event.observed` + tutti gli step F1-F6).

## Pattern carryover

- **F5 task-tracker.ts:46-220**: state closure factory + bounded counter (replicato 1:1 nei due Inspector).
- **F5 worker-bridge.ts:556**: pattern `globalThis.process` cast safe (devtools è browser-package senza `@types/node`).
- **F4 realtime-channel-manager.ts:90-120**: Map registry pattern (RouteInspector pending Map).
- **F3 outcome-collector**: step 10 capture pattern.
- **F1 D-20 safeTapStep**: error isolation tap implicit (consumer tap → multiplex-tap già committato in 06-04).

## Threat coverage

| Threat | Mitigazione | Test |
|--------|-------------|------|
| T-06-05-01 (DoS buffer illimitato) | D-167 cap 500 default + drop-oldest FIFO Array.shift | event-inspector Test 5 + route-inspector Test 5 |
| T-06-05-02 (Information disclosure mutation leak) | D-162 deep-clone via structuredClone in getBuffer | event-inspector Test 6/7 + route-inspector Test 6 |
| T-06-05-03 (Logic flaw disable non clear-buffer) | disable() svuota state.buffer + state.pending (memory hygiene) | event-inspector Test 4 + route-inspector Test 12 |
| T-06-05-04 (DoS structuredClone perf su buffer pieno) | accept (RESEARCH §15.3 ~5-10ms documentato DOC-06 rare-call) | n/a — Tier-3 perf benchmark in 06-09a |
| T-06-05-05 (Logic flaw production debug accidentale) | detectDefaultEnabled() inline → NODE_ENV=production false | event-inspector Test 12 (3 sub-test) |

## Vincoli verificati

- **D-83 strict**: `git diff main packages/{core,mapper,routing,gateway,worker}` = **0 diff lines** ✓
- **BLOCKER-1 fix**: `git diff packages/devtools/src/index.ts` = **0 diff lines** ✓ — il barrel append cumulativo (esportazione `createEventInspector` + `createRouteInspector` + tipi associati) è esplicitamente delegato a 06-08b Wave 4b sequential gate.
- **File ownership Wave 3 disgiunta**: 06-05 owns SOLO `event-inspector.{ts,test.ts}` + `route-inspector.{ts,test.ts}`. 06-06 owns metrics-collector + reservoir-sampling + cardinality-cap. 06-07 owns pause-controller. Verificato con git status pulito su file non-owned.
- **TypeScript strict + exactOptionalPropertyTypes**: tutti i field optional (`retryCount`, `policiesApplied`, `cacheHit`, `errorCode`) costruiti condizionalmente via spread guard.
- **Coverage v8 ≥90/80/90/90**: superato (98.76/91.07/100/98.71).

## Deviazioni dal plan

### Auto-fix applicate

**1. [Rule 1 - Bug] Fix TS2591 `process` non in scope (devtools browser-package)**
- **Trovato durante:** typecheck event-inspector.ts (Task 1 GREEN post-implementazione)
- **Issue:** `typeof process !== 'undefined' && process.env != null` non type-checka in `@gluezero/devtools` (no `@types/node` come browser-package).
- **Fix:** pattern carryover F5 `worker-bridge.ts:556` — accesso safe via `(globalThis as { process?: { env?: Record<string, string | undefined> } }).process` + access `proc.env['NODE_ENV']` (TS4111 index-signature).
- **Files modificati:** `event-inspector.ts:91-99`, `route-inspector.ts:79-87` (pattern replicato per coerenza cross-Inspector + zero coupling).
- **Commit:** incluso in `84912a0` (event-inspector) + `33948a6` (route-inspector).

**2. [Rule 1 - Bug] Fix TS2375 `exactOptionalPropertyTypes: true` su RouteInspectorEntry**
- **Trovato durante:** typecheck route-inspector.ts (Task 2 GREEN post-implementazione)
- **Issue:** assegnazione diretta di `undefined` ai field optional `retryCount`, `policiesApplied`, `cacheHit`, `errorCode` di `RouteInspectorEntry` violava `exactOptionalPropertyTypes: true` (TS strict mode).
- **Fix:** costruzione condizionale via spread guard `...(field !== undefined ? { field } : {})` per ogni field optional in entrambi i branch (step 9 + step 10).
- **Files modificati:** `route-inspector.ts:142-185` (logica aggregate).
- **Commit:** incluso in `33948a6`.

**3. [Decisione minore CONTEXT.md "Claude's discretion"] Aggiunto `getSnapshot()` API**
- **Trovato durante:** Task 1 implementazione (PLAN.md GREEN code lo prevedeva già).
- **Razionale:** espone meta-info `{ enabled, bufferEntries, bufferSize }` senza dover deep-cloning l'intero buffer — DX-friendly per metrics gauge in 06-08b. Pattern coerente con F5 task-tracker.ts:71-81.
- **Replicato in:** entrambi i file Inspector per consistency.

Nessuna deviazione di tipo Rule 4 (architetturali). Tutti i fix sono Rule 1 (bug typecheck) o decisioni minori già autorizzate dal CONTEXT.md "Claude's Discretion".

## Block pronti per 06-08b

L'append cumulativo del barrel `packages/devtools/src/index.ts` in 06-08b dovrà includere (oltre a multiplex-tap+tap-registry già esportati):

```typescript
// ---------- W3 plan 06-05 — event-inspector + route-inspector (D-167) ----------
export { createEventInspector } from './event-inspector'
export type { EventInspector, EventInspectorOptions } from './event-inspector'
export { createRouteInspector } from './route-inspector'
export type { RouteInspector, RouteInspectorOptions } from './route-inspector'
```

Inoltre il `createDevtoolsBroker` composition wrapper (06-08b) potrà:
1. Istanziare i due Inspector con config da `BrokerConfig.devtools.eventBufferSize` / `routeBufferSize` (declaration merging già attivo).
2. Registrare i due tap nel `TapRegistry` (06-04).
3. Esporre `enableDebug()` / `disableDebug()` API che invocano `inspector.enable() / disable()` su entrambi (+ MetricsCollector + PauseController quando 06-06 e 06-07 saranno completi).
4. Esporre `getDebugSnapshot()` con `recentEvents: inspector.getBuffer()` + `recentRoutes: routeInspector.getBuffer()` (D-162 deep-clone già fatto).

## Self-Check: PASSED

- [x] `packages/devtools/src/event-inspector.ts` esiste
- [x] `packages/devtools/src/event-inspector.test.ts` esiste
- [x] `packages/devtools/src/route-inspector.ts` esiste
- [x] `packages/devtools/src/route-inspector.test.ts` esiste
- [x] Commit `a1d858a` presente in git log
- [x] Commit `84912a0` presente in git log
- [x] Commit `cae80ca` presente in git log
- [x] Commit `33948a6` presente in git log
- [x] `git diff packages/devtools/src/index.ts` = 0 (BLOCKER-1 fix verificato)
- [x] `git diff packages/{core,mapper,routing,gateway,worker}` = 0 (D-83 strict ✓)
- [x] `pnpm -F @gluezero/devtools test` = 57/57 passing
- [x] `pnpm -F @gluezero/devtools typecheck` = 0 errori
- [x] Coverage v8 = 98.76/91.07/100/98.71 ≥ threshold 90/80/90/90
