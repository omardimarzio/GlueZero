---
phase: 05-worker-runtime
plan: 05-05
subsystem: worker-runtime
tags: [worker, pool, registry, backpressure, cascade, lifecycle, tdd]
dependency_graph:
  requires:
    - 05-01 (bootstrap @gluezero/worker + types + augment)
    - "@gluezero/gateway/http (BackpressureStrategy F3 D-75 carryover)"
    - "@gluezero/core (createBrokerError + WorkerDescriptor types)"
  provides:
    - "WorkerRegistry — Map<id, WorkerEntry> registry + cascade D-126"
    - "WorkerPool — bounded slots + queue + lazy spawn + respawn + cascade"
    - "MAX_POOL_SIZE_HARD constant (8) — esportato per consumer consistency"
    - "WorkerBridgeLike interface — disaccoppiamento da 05-04 worker-bridge"
  affects:
    - "Wave 4 plan 05-06 (worker-handler + worker-broker) consumerà WorkerRegistry + WorkerPool"
tech_stack:
  added: []
  patterns:
    - "Map<id, Entry> + cascade unregisterByOwner (analog F3 D-86 / F4 D-112)"
    - "Lazy spawn on-demand pattern (D-129)"
    - "F3 BackpressureStrategy riusato 1:1 via workspace dep import (D-130)"
    - "WorkerBridgeLike DI interface — file ownership disgiunta da 05-04 (parallel)"
    - "Critical priority bypass (D-130 / Pitfall 4.C carryover)"
    - "Cap hard 8 + warn 1x per worker (D-128 / Pitfall 7.D protection)"
key_files:
  created:
    - packages/worker/src/worker-registry.ts
    - packages/worker/src/worker-registry.test.ts
    - packages/worker/src/worker-pool.ts
    - packages/worker/src/worker-pool.test.ts
  modified:
    - packages/worker/src/index.ts
decisions:
  - "D-126: cascade unregisterByOwner LIFE-02 ext F5 — strict filter ownerId"
  - "D-127: defaultPoolSize() = min(navigator.hardwareConcurrency, 4) con fallback 4"
  - "D-128: cap hard 8 + allowUnboundedPool: true opt-in con console.warn 1x"
  - "D-129: lazy first dispatch — spawn on-demand fino a targetSize"
  - "D-130: F3 BackpressureStrategy riusato 1:1 — import @gluezero/gateway/http"
  - "D-131: cancellation hybrid — terminateByOwner cascade idempotente"
metrics:
  duration: "~30 min"
  completed: 2026-05-04
  tasks_total: 2
  tasks_completed: 2
  tests_total: 22
  tests_passing: 22
  files_created: 4
  files_modified: 1
  loc_added: 1737
  coverage_pool_v8: 93/80/100/95.74 stmt/br/fn/lines
  coverage_registry_v8: 94.44/92.3/100/94.28 stmt/br/fn/lines
---

# Phase 5 Plan 05-05: WorkerRegistry + WorkerPool Summary

**Wave 3-B (parallel con 05-04 worker-bridge — file ownership disgiunta).** Implementati `WorkerRegistry` (Map<id, WorkerEntry> + cascade D-126) e `WorkerPool` (bounded slots + queue + lazy spawn + respawn + cancellation hybrid + cascade) production-ready in TDD RED→GREEN co-located. F3 BackpressureStrategy riusato 1:1 via import workspace dep da `@gluezero/gateway/http` — zero ridichiarazione, zero copia.

---

## Files Created

| File | LOC | Purpose |
|------|-----|---------|
| `packages/worker/src/worker-registry.ts` | 261 | Map<id, WorkerEntry> registry + cascade D-126 + validation D-124/128 |
| `packages/worker/src/worker-registry.test.ts` | 174 | 10 test deterministici Tier-1 jsdom |
| `packages/worker/src/worker-pool.ts` | 479 | Bounded slots + queue + lazy + respawn + cascade + critical bypass |
| `packages/worker/src/worker-pool.test.ts` | 349 | 12 test deterministici Tier-1 jsdom (MockBridge locale) |

**Modified:** `packages/worker/src/index.ts` (+17/-4) — append-only export di `WorkerRegistry`, `WorkerPool`, types.

**Total LOC added (05-05 own):** ~1283 LOC (worker-registry/worker-pool source + test).

---

## Test Results

| Suite | Total | Passing | Failed |
|-------|-------|---------|--------|
| `worker-registry.test.ts` | 10 | 10 | 0 |
| `worker-pool.test.ts` | 12 | 12 | 0 |
| **Total 05-05** | **22** | **22** | **0** |

Esecuzione `pnpm exec vitest run worker-registry.test.ts worker-pool.test.ts`:

```
Test Files  2 passed (2)
     Tests  22 passed (22)
  Duration  445ms
```

---

## Coverage v8 (file 05-05)

| File | Statements | Branches | Functions | Lines | Target ≥90/80/90/90 |
|------|-----------|----------|-----------|-------|---------------------|
| `worker-pool.ts` | **93%** | **80%** | **100%** | **95.74%** | ✓ |
| `worker-registry.ts` | **94.44%** | **92.3%** | **100%** | **94.28%** | ✓ |

Uncovered lines:
- `worker-pool.ts:275` — defensive cap branch (registry valida prima)
- `worker-pool.ts:347-348` — respawn su entry unregistered durante lifecycle race
- `worker-pool.ts:451` — defensive setTimeout fallback (waitForFreeSlot polling tick)
- `worker-registry.ts:220, 227` — defensive type-guard branches

Tutte mitigation defensive non raggiungibili da test deterministici (ramo registry-validato a monte).

---

## Decisioni Implementate

| ID | Descrizione | File / Verifica |
|----|-------------|-----------------|
| **D-124** | Fail-fast `worker.descriptor.invalid` se tasks vuote / id empty / factory non-function | `worker-registry.ts:validateDescriptor` (Test 3) |
| **D-126** | Cascade `unregisterByOwner(ownerId)` ritorna readonly string[] degli id rimossi (LIFE-02 ext F5) | `worker-registry.ts:unregisterByOwner` (Test 8) + `worker-pool.ts:terminateByOwner` (Test 6) |
| **D-127** | `defaultPoolSize() = min(navigator.hardwareConcurrency, 4)` con fallback 4 (jsdom/SSR) | `worker-pool.ts:defaultPoolSize` (Test 1) |
| **D-128** | Cap hard 8 (`MAX_POOL_SIZE_HARD`) + `allowUnboundedPool: true` bypass + `console.warn` 1x per worker | `worker-registry.ts:validateDescriptor` (Test 10) + `worker-pool.ts:resolveSize` (Test 12) |
| **D-129** | Lazy first dispatch — `acquireSlot` spawna on-demand fino a targetSize | `worker-pool.ts:acquireSlot` (Test 2, Test 9) |
| **D-130** | F3 BackpressureStrategy riusato 1:1 — `import { createBackpressureStrategy } from '@gluezero/gateway/http'` + critical bypass | `worker-pool.ts:schedule` (Test 8, Test 10) |
| **D-131** | Cancellation hybrid: `terminateByOwner` cascade idempotente; bridge.terminate fault recovery via `respawn` | `worker-pool.ts:terminateByOwner/respawn` (Test 5, Test 6, Test 7) |

---

## D-83 Strict Verification

**Acceptance criterion:** `git diff main...HEAD packages/{core,mapper,routing}/src/ packages/gateway/src/{http,sse-ws}/` exit 0.

```bash
$ git diff 4c3c3e5...HEAD --name-only -- packages/core/src/ packages/mapper/src/ packages/routing/src/ packages/gateway/src/http/ packages/gateway/src/sse-ws/
(empty)
```

**Result:** ✓ Zero modifiche fuori `packages/worker/src/`. F5 vive isolato — F3 BackpressureStrategy importato come workspace dep `@gluezero/gateway/http` senza modificare la sua source.

---

## File Ownership Disgiunta da 05-04 (parallel Wave 3)

**Strategia DI per disaccoppiamento:** `WorkerPool` NON importa direttamente `WorkerBridge` da `./worker-bridge` (owned da 05-04). Definisce invece interface minimal `WorkerBridgeLike` (solo `dispatch + terminate`) + `bridgeFactory: (desc) => WorkerBridgeLike` injectable via `WorkerPoolDeps`.

**Files toccati da 05-05 (esclusivi):**
- `worker-pool.ts` ✓
- `worker-pool.test.ts` ✓
- `worker-registry.ts` ✓
- `worker-registry.test.ts` ✓
- `index.ts` (append-only — sezione propria) ✓

**Files NON toccati da 05-05 (owned da 05-04 parallel):**
- `worker-bridge.ts` — owned 05-04
- `worker-bridge.test.ts` — owned 05-04 (15 test, parallel run separato)
- `test-utils/mock-worker.ts` — owned 05-04

**Wave 4 (05-06) consumer connection point:**
```ts
const pool = new WorkerPool({
  registry,
  bridgeFactory: (desc) => new WorkerBridge(desc, deps),  // 05-04 connect-back
})
```

---

## CI Gates

| Gate | Status | Note |
|------|--------|------|
| `pnpm exec vitest run worker-registry.test.ts worker-pool.test.ts` | ✓ 22/22 | RED→GREEN cycle compliant |
| `pnpm exec tsc --noEmit` (worker package) | ✓ 0 errors | exactOptionalPropertyTypes strict |
| `pnpm exec tsup` (build) | ✓ ESM-only | dist/index.js 22.44 KB, dist/augment.js 226 B, DTS 34.19 KB |
| Coverage v8 sui file 05-05 | ✓ ≥90% target | pool 93/80/100/95.74; registry 94.44/92.3/100/94.28 |
| D-83 strict gate | ✓ Empty diff | Zero modifiche packages/{core,mapper,routing}/src/ + gateway/{http,sse-ws}/ |

---

## REQ Progress

| REQ-ID | Status | File / Note |
|--------|--------|-------------|
| **WK-01** | partial (registry done) | `WorkerRegistry` provides `register/get/listByOwner/unregister/unregisterByOwner` — top-level + PluginDescriptor.workers cascade pronto per 05-06 |
| **WK-02** | partial (pool done) | `WorkerPool` bounded slots + lazy + queue + cascade — pronto per dispatch handler 05-06 |
| **WK-04** | partial (cancellation hybrid base) | `terminateByOwner` cascade + `respawn` D-131 fault recovery — bridge cooperative cancellation owned 05-04 |
| **WK-06** | partial (slot management ready) | timeout enforcement è scope 05-06 worker-handler (combina TaskTracker da 05-03) |
| **LIFE-02** | ext F5 progress | `unregisterByOwner` cascade pattern carryover da F3 D-86 / F4 D-112; consumer-side wiring in 05-06 |
| **TEST-01/03** | unit subset done | 22 unit test deterministici Tier-1 jsdom (assertion-based, zero placeholder) |

---

## Threat Model Coverage

Tutti i 10 thread del threat register `<threat_model>` del PLAN sono mitigati o accepted documentati:

| Threat ID | Status | Verifica |
|-----------|--------|----------|
| T-05-05-01 (DoS pool storm) | mitigate | Test 10 throw `worker.pool.size.exceeded` per size=16; Test 12 console.warn 1x |
| T-05-05-02 (DoS task infinite) | accept | scope 05-06 worker-handler (TaskTracker timeout) |
| T-05-05-03 (Spoofing duplicate id) | mitigate | Test 2 throw `worker.id.duplicate` con `existingOwner` details |
| T-05-05-04 (Tampering cross-plugin cleanup) | mitigate | Test 8 strict filter; Test 6 cascade preserve cross-plugin |
| T-05-05-05 (Info disclosure byOwner) | accept | byOwner è dev-only; nessun secret |
| T-05-05-06 (Race acquireSlot double-claim) | mitigate | JS event loop single-thread atomic loop |
| T-05-05-07 (Backpressure bypass) | mitigate | `priority === 'critical'` esplicito gate (grep verificabile in worker-pool.ts) |
| T-05-05-08 (Repudiation terminateByOwner) | mitigate | `getDebugSnapshot` byWorkerId pre/post compare; Tap audit in 05-06 |
| T-05-05-09 (respawn currentTaskId leak) | mitigate | Object literal fresh `{ bridge, busy: false }` |
| T-05-05-10 (Tampering routing/) | mitigate | D-83 strict ✓ — git diff routing/ empty |

---

## Commit History (05-05)

```
2f1efd9 chore(05-05): expose WorkerRegistry + WorkerPool + types in barrel index.ts
4eb037a feat(05-05): GREEN WorkerPool bounded + lazy + queue + respawn + terminateByOwner (D-127/128/129/130/131 + LIFE-02 ext F5)
e72b4c7 test(05-05): RED worker-pool 12 test bounded + lazy + queue + cascade (D-127/128/129/130/131)
af10e3b feat(05-05): GREEN WorkerRegistry Map + cascade unregisterByOwner + duplicate guard (D-124/126/128 + LIFE-02 ext F5)
c436c68 test(05-05): RED worker-registry 10 test cascade + duplicate guard + pool size validation (D-126/128)
```

5 commit atomici TDD-compliant (RED→GREEN cycle per ogni file source).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Test 3 assertion ricalibrata su counter task locale**
- **Found during:** Task 2 GREEN execution
- **Issue:** Il test originale asseriva `MockBridge.dispatchCalls === 4` ma `dispatchOnSlotWithTask` (variante test) NON invoca `bridge.dispatch` — chiama un task arbitrario sullo slot. L'assert `dispatchCalls = 4` era impossibile by-design.
- **Fix:** Sostituito assert con `taskRunCount` counter local (incrementato dentro slowTask) — verifica che 4 task siano effettivamente eseguiti, distinguendo da spawn count (`MockBridge.instances.length === 2`, bound rispettato).
- **Files modified:** `packages/worker/src/worker-pool.test.ts:Test 3`
- **Commit:** `4eb037a` (incluso nel GREEN commit del pool)

**2. [Rule 1 — Bug] `slot.currentTaskId = undefined` viola exactOptionalPropertyTypes**
- **Found during:** Typecheck post Task 2 GREEN
- **Issue:** TypeScript strict `exactOptionalPropertyTypes: true` non permette assegnare `undefined` a campo opzionale (Test fail TS2412).
- **Fix:** Sostituito `slot.currentTaskId = undefined` con `delete slot.currentTaskId` (semantica equivalente, type-safe).
- **Files modified:** `packages/worker/src/worker-pool.ts:releaseSlot`
- **Commit:** `4eb037a` (incluso nel GREEN commit del pool)

### Deviation strategica: WorkerBridgeLike DI interface (file ownership disgiunta)

**Plan original:** `worker-pool.ts` importa direttamente `WorkerBridge` da `./worker-bridge`.

**Issue rilevato:** 05-04 worker-bridge è owned da plan parallel — al momento dell'esecuzione di 05-05 (Wave 3-B), 05-04 (Wave 3-A) è in stato di parallel-run senza coordinamento sincrono. Importare `WorkerBridge` direttamente avrebbe causato dipendenza temporale stretta (deadlock parallel se 05-04 non aveva ancora committato il source).

**Soluzione:** Pattern DI con interface minimal `WorkerBridgeLike`:
- `worker-pool.ts` definisce interface `WorkerBridgeLike { dispatch(...); terminate(); }` — subset minimo consumed dal pool
- `WorkerPoolDeps.bridgeFactory: (desc) => WorkerBridgeLike` injectable
- Test usano `MockBridge implements WorkerBridgeLike` locale (nessuna dipendenza 05-04)
- Consumer Wave 4 plan 05-06 connette `bridgeFactory: (desc) => new WorkerBridge(desc, deps)` — mapping nominal compatibility

**Beneficio:** Plan 05-05 e 05-04 totalmente disaccoppiati. La file ownership disgiunta è preservata. Il pattern è documentato in JSDoc (`@see` references). Niente impatto runtime al consumer (TypeScript structural typing assicura compatibility tra `WorkerBridge` e `WorkerBridgeLike` se 05-04 implementa `dispatch + terminate` nelle stesse signatures).

**Action taken:** documentato nel SUMMARY (qui) + commit message + JSDoc inline. Plan futuro (05-06) eredita pattern senza conflitti.

---

## Building blocks pronti per Wave 4 (05-06)

Il plan 05-06 (worker-handler + worker-broker composition wrapper) ha ora a disposizione:

1. **`WorkerRegistry`** — `register/get/validateTask/listByOwner/unregister/unregisterByOwner/getDebugSnapshot` con duplicate guard + size cap.
2. **`WorkerPool`** — `schedule (with critical bypass) / dispatchOnSlot / acquireSlot / releaseSlot / respawn / terminateByOwner / getDebugSnapshot` con lazy spawn + bounded.
3. **`WorkerBridgeLike` DI** — connection point per `WorkerBridge` di 05-04 (atterrato in parallel — il route handler di 05-06 wrapperà via `bridgeFactory`).
4. **`MAX_POOL_SIZE_HARD = 8`** — esportato per consumer consistency.
5. **F3 BackpressureStrategy** — già wired di default; `WorkerPoolDeps.backpressure` opzionale per override (es. policy `latest-only` per route UI-driven).

**Wave 4 wiring esempio:**
```ts
import { WorkerRegistry, WorkerPool } from '@gluezero/worker'
import { WorkerBridge } from './worker-bridge'  // 05-04 produced

class WorkerBroker /* extends RouterBroker (composition wrapper D-83) */ {
  private readonly registry = new WorkerRegistry()
  private readonly pool: WorkerPool
  constructor(deps: WorkerBridgeDeps) {
    this.pool = new WorkerPool({
      registry: this.registry,
      bridgeFactory: (desc) => new WorkerBridge(desc, deps),
    })
  }
  async unregisterPlugin(id: string) {
    this.pool.terminateByOwner(id)        // cascade pool
    this.registry.unregisterByOwner(id)   // cascade registry
    await this.inner.unregisterPlugin(id) // cascade RouterBroker
  }
}
```

---

## Self-Check: PASSED

**Files created (verified):**
- `packages/worker/src/worker-registry.ts` ✓
- `packages/worker/src/worker-registry.test.ts` ✓
- `packages/worker/src/worker-pool.ts` ✓
- `packages/worker/src/worker-pool.test.ts` ✓

**Files modified (verified):**
- `packages/worker/src/index.ts` ✓ (append-only, +17/-4 lines)

**Commits verified in git log:**
- `c436c68` test RED registry ✓
- `af10e3b` feat GREEN registry ✓
- `e72b4c7` test RED pool ✓
- `4eb037a` feat GREEN pool ✓
- `2f1efd9` chore barrel update ✓

**Verification commands run:**
- `pnpm exec vitest run worker-registry.test.ts worker-pool.test.ts` → 22/22 passing ✓
- `pnpm exec tsc --noEmit` → 0 errors ✓
- `pnpm exec tsup` → build success ESM ✓

**D-83 strict gate:** `git diff` su `packages/{core,mapper,routing}/src/ + gateway/{http,sse-ws}/` → empty ✓

**File ownership disgiunta da 05-04:** verificata via `git diff --stat` su commit di 05-05 — solo file owned ✓
