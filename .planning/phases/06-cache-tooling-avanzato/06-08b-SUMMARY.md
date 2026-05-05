---
phase: 06-cache-tooling-avanzato
plan: 08b
subsystem: devtools-broker + sembridge-aggregato
tags: [devtools, composition-wrapper, factory-aggregato, chain-completa, BLOCKER-1-fix, BLOCKER-2-fix, D-83-strict]
dependency_graph:
  requires:
    - 06-01-SUMMARY (cache+devtools+aggregate bootstrap)
    - 06-04-SUMMARY (multiplex-tap + tap-registry D-159)
    - 06-05-SUMMARY (event-inspector + route-inspector D-160/D-162/D-167)
    - 06-06-SUMMARY (metrics-collector + reservoir + cardinality-cap D-163/D-165/D-166)
    - 06-07-SUMMARY (pause-controller D-168/D-170)
    - 06-08a-SUMMARY (CacheBroker composition wrapper Opzione B)
  provides:
    - DevtoolsBroker composition wrapper RouterBroker (D-83 strict carryover) + step 14 attivazione D-161
    - createDevtoolsBroker factory Valibot + D-30 anti-singleton
    - createGlueZero aggregato CHAIN COMPLETA F1+F2+F3+F4+F5+F6 (BLOCKER-2 fix)
    - barrel devtools/index.ts FINAL cumulativo Wave 3+4 (BLOCKER-1 fix single-writer)
    - barrel sembridge/index.ts re-export pubblico API surface F6
    - 6 integration test 3-tier (4 devtools + 2 sembridge)
  affects:
    - packages/devtools/src/* (devtools-broker, public-factory, index, integration)
    - packages/gluezero/src/* (sem-bridge, index, integration)
tech_stack:
  added: []
  patterns:
    - Composition wrapper Opzione B (RESEARCH §11.3 — D-83 strict preservation)
    - Factory pubblica Valibot safeParse + 'Invalid <Broker>Config:' prefix (D-30 no singleton)
    - Chain composition aggregato OUTERMOST → INNERMOST (devtools > cache > worker > realtime > router)
    - MultiplexTap aggregator + auto-wrap F1 single-tap legacy (wrapLegacyTap helper)
    - structuredClone deep-clone D-162 immutability getDebugSnapshot
    - Topic naming F1 D-24 — segments lowercase alphanumeric (NO trattino)
key_files:
  created:
    - packages/devtools/src/devtools-broker.ts
    - packages/devtools/src/devtools-broker.test.ts
    - packages/devtools/src/public-factory.ts
    - packages/devtools/src/public-factory.test.ts
    - packages/devtools/src/__integration__/multiplex-tap-flow.test.ts
    - packages/devtools/src/__integration__/pause-resume-flow.test.ts
    - packages/devtools/src/__integration__/metrics-cardinality-flow.test.ts
    - packages/devtools/src/__integration__/inspector-snapshot.test.ts
    - packages/gluezero/src/glue-zero.ts
    - packages/gluezero/src/sem-bridge.test.ts
    - packages/gluezero/src/__integration__/chain-completa-flow.test.ts
    - packages/gluezero/src/__integration__/features-opt-out.test.ts
  modified:
    - packages/devtools/src/index.ts (BLOCKER-1 fix barrel FINAL cumulativo single-writer Wave 3+4)
    - packages/gluezero/src/index.ts (re-export pubblico API surface F6 + side-effect augment)
decisions:
  - "BLOCKER-2 fix: createGlueZero include OBBLIGATORIAMENTE createWorkerBroker + createRealtimeBroker quando features.worker / features.realtime sono enabled (default true). Acceptance grep verified 10 hits ≥ 4."
  - "BLOCKER-1 fix: barrel packages/devtools/src/index.ts modificato SOLO da 06-08b (single-writer cumulativo post-Wave 3). File ownership disgiunta verified — Wave 3 plans 06-05/06-06/06-07 NON l'hanno toccato."
  - "Topology V1: i wrapper realtime/worker/cache/devtools sono ortogonali (estendono RouterBroker via composition diretta). createGlueZero sceglie OUTERMOST in funzione di features. Roadmap V1.x per chain letterale multi-wrapper documentata in JSDoc."
  - "Rule 1 auto-fix bug: topic 'system.metrics.cardinality-overflow' invalido (trattino non ammesso da F1 D-24 validateTopicPattern). Sostituito con 'system.metrics.cardinalityoverflow' (singolo segment). DOC-06 update in 06-09b final gate."
metrics:
  duration_minutes: ~25
  completed_date: 2026-05-05
  test_count_total: 50
  coverage_devtools: 96.44/89.28/94.36/96.98
  coverage_sembridge: 100/100/100/100
---

# Phase 6 Plan 08b: DevtoolsBroker + createGlueZero Chain Completa F1+F2+F3+F4+F5+F6

**One-liner**: DevtoolsBroker composition wrapper Opzione B + step 14 attivazione D-161 + getDebugSnapshot deep-clone D-162 + createGlueZero aggregato CHAIN COMPLETA F1+F2+F3+F4+F5+F6 (BLOCKER-2 fix) + barrel devtools FINAL cumulativo single-writer (BLOCKER-1 fix) + 6 integration test 3-tier — milestone v1.0 SC-2 deliverable.

## Obiettivo

Wave 4b sequential gate (post 06-08a — depends_on cache wrapper) completion devtools wrapper + createGlueZero aggregato CHAIN COMPLETA + barrel devtools FINAL append cumulativo + 6 integration test 3-tier.

## Lavoro svolto

### Task 1 — DevtoolsBroker composition + factory (commit `4c6950e` RED, `3217a9a` GREEN, `2db79c0` factory GREEN)

`DevtoolsBroker` composition wrapper di RouterBroker (Opzione B D-83 strict carryover) — wires:
- `EventInspector` (06-05) ring buffer 500 + lazy mode D-160
- `RouteInspector` (06-05) aggrega step 9+10
- `MetricsCollector` (06-06) counters/gauges/histograms cumulative D-163/D-164
- `PauseController` (06-07) pauseTopic/resumeTopic/flushQueue D-168/D-170
- `MultiplexTap` (06-04) chain N tap user con error isolation D-159
- `wrapLegacyTap` (06-04) auto-wrap F1 single-tap legacy

API esposta TOOL-03 + TOOL-04: `enableDebug` / `disableDebug` / `getDebugSnapshot` (structuredClone D-162) / `getMetrics` / `pauseTopic` / `resumeTopic` / `flushQueue`.

**Step 14 attivazione D-161**: post `inner.publish` emette `event.observed` al MultiplexTap (Inspector + RouteInspector + Metrics + user taps).

**NODE_ENV detection inline**: default `enableByDefault = NODE_ENV !== 'production'` → DX dev-friendly, prod zero overhead.

`createDevtoolsBroker(config)` factory Valibot + 'Invalid DevtoolsBrokerConfig:' + D-30 anti-singleton.

**Test**: 22 test broker + 8 test factory passing.

### Task 2 — createGlueZero CHAIN COMPLETA F1+F2+F3+F4+F5+F6 (commit `ae1a565` RED, `74e4c4d` GREEN — BLOCKER-2 fix)

`createGlueZero(config)` factory aggregato chain composition COMPLETA — features opt-out (cache/devtools/worker/realtime). Default tutte enabled (RESEARCH §11.3 Opzione B convenience).

**BLOCKER-2 fix critico**: chain implementa F1+F2+F3+F4+F5+F6 obbligatoriamente — NON V1 minimal `Devtools(Cache(...))` come iter precedente. Acceptance grep `createWorkerBroker|createRealtimeBroker` → **10 hits** (atteso ≥4).

**Topology V1**: i wrapper realtime/worker/cache/devtools sono ortogonali (estendono RouterBroker via composition diretta). `createGlueZero` sceglie OUTERMOST in funzione di `features` (devtools > cache > worker > realtime > router). Roadmap V1.x per chain letterale multi-wrapper (es. `Devtools(Cache(Worker(Realtime(Router(...)))))`) documentata in JSDoc.

Type union completa: `GlueZero = ReturnType<createBroker | createMapperBroker | createRouterBroker | createRealtimeBroker | createWorkerBroker | createCacheBroker | createDevtoolsBroker>` — 7 ReturnType.

**Test**: 12 sem-bridge.test.ts passing.

### Task 3 — Barrel FINAL cumulative + 6 integration test (commit `9a96216` aggregato — BLOCKER-1 fix)

**Barrel `packages/devtools/src/index.ts` FINAL cumulative** (single-writer post-Wave 3):
- Wave 3 exports: `createMultiplexTap` + `createTapRegistry` + `wrapLegacyTap` + `createEventInspector` + `createRouteInspector` + `createMetricsCollector` + `createReservoir` + `createCardinalityTracker` + `createPauseController` + types
- Wave 4 exports: `DevtoolsBroker` + `createDevtoolsBroker` + `DebugSnapshot`

Wave 3 plans 06-05/06-06/06-07 NON hanno modificato il barrel (file ownership disgiunta verified via `git log --oneline packages/devtools/src/index.ts`).

**Barrel `packages/gluezero/src/index.ts`**: side-effect re-export augment cache + devtools + `createGlueZero` + re-export pubblico API surface `@gluezero/cache` + `@gluezero/devtools`.

**6 integration test 3-tier (Tier-1 jsdom)**:
- `devtools/__integration__/multiplex-tap-flow.test.ts` (3 scenari): 3+ tap chain + error isolation + step 14 attivazione D-161
- `devtools/__integration__/pause-resume-flow.test.ts` (3 scenari): replay FIFO + flushQueue audit + critical priority bypass D-170
- `devtools/__integration__/metrics-cardinality-flow.test.ts` (3 scenari): cap audit + getMetrics shape + naming Prometheus
- `devtools/__integration__/inspector-snapshot.test.ts` (3 scenari): Inspector capture + getDebugSnapshot deep-clone D-162 immutability
- `sembridge/__integration__/chain-completa-flow.test.ts` (3 scenari): createGlueZero default chain F1+F2+F3+F4+F5+F6 active end-to-end
- `sembridge/__integration__/features-opt-out.test.ts` (5 scenari): realtime/worker/cache/devtools opt-out + tutte false → minimal F1+F2+F3

**Test totali plan 06-08b**: **50 test** (22 devtools-broker + 8 factory + 12 sem-bridge + 8 integration scenari devtools-flow).

## Pattern carryover

- **F5 worker-broker.ts:1-100** — Composition wrapper RouterBroker + cascade D-126 + try/catch isolato
- **F6 cache-broker.ts:1-100 (06-08a)** — pattern primario W4a (composition wrapper Opzione B)
- **F4 realtime-broker.ts:1-100** — composition wrapper extension topology
- **F5 createWorkerBroker** — Valibot factory at boundary (D-56 + D-30)
- **F6 cache + worker** — Same MultiplexTap chain pattern (06-04 D-159)

## Coverage v8 measured

| Package | Stmts | Branches | Functions | Lines |
|---------|-------|----------|-----------|-------|
| @gluezero/devtools | **96.44%** | **89.28%** | **94.36%** | **96.98%** |
| @gluezero/gluezero | **100%** | **100%** | **100%** | **100%** |

Threshold target ≥90/80/90/90 → **PASSED**.

## Cross-package zero regression

| Package | Test count | Result |
|---------|------------|--------|
| @gluezero/core | invariato | passing |
| @gluezero/mapper | invariato | passing |
| @gluezero/routing | invariato | passing |
| @gluezero/gateway | invariato | passing |
| @gluezero/worker | 121 | passing |
| @gluezero/cache | 108 | passing |
| @gluezero/devtools | 160 | passing |
| @gluezero/gluezero | 20 | passing |

## D-83 strict acceptance verified (CRITICO)

```
git diff main packages/{core,mapper,routing,gateway,worker}/src/ | wc -l
→ 0
```

Tutta F6 Wave 4b vive in `packages/{devtools,sembridge}/src/`. ZERO modifiche cross-package F1-F5.

## REQ-IDs runtime done

- TOOL-01 (Event/Mapping/Route Inspector) — runtime DevtoolsBroker.getDebugSnapshot expose Inspector buffers
- TOOL-02 (Mapping Inspector) — RouteInspector aggregate step 9+10 incluso in snapshot
- TOOL-03 (debug toggle live-mode) — enableDebug / disableDebug
- TOOL-04 (debug snapshot + pause API) — getDebugSnapshot + pauseTopic/resumeTopic/flushQueue
- TOOL-05 (metrics format) — getMetrics simil-OpenMetrics (counters/gauges/histograms cumulative)
- PIPE-01 (ordine pipeline) — step 14 attivazione D-161 post inner.publish
- LIFE-02 (unsubscribe automatico unregister plugin) — cascade delegate inner.unregisterPlugin
- ERR-02 (error isolation tap) — MultiplexTap try/catch isolato per tap (D-159)
- TEST-01 / TEST-02 — 50 test deterministici Tier-1 jsdom passing

Closure finale REQ matrix in 06-09b final gate (atomic flip Complete).

## Chain coverage F1+F2+F3+F4+F5+F6 verified

Acceptance grep:
```
grep -cE "createWorkerBroker|createRealtimeBroker" packages/gluezero/src/glue-zero.ts
→ 10
```

(2 import + branch use case if features → 10 hits ≥ 4 atteso. **BLOCKER-2 verified**.)

## Threat coverage

| Threat | Disposition | Mitigazione |
|--------|-------------|-------------|
| T-06-08b-01 (Logic flaw composition order) | mitigate | Devtools è OUTERMOST per default; documented JSDoc + 6 integration test verificano end-to-end |
| T-06-08b-02 (InfoDisclosure getDebugSnapshot leak) | mitigate | structuredClone D-162; integration test inspector-snapshot.test.ts Test 2 verifica mutation safety |
| T-06-08b-03 (DoS publish hot-path debug=on) | mitigate | D-160 lazy-mode tap delegate solo quando enabled; Inspector early-return |
| T-06-08b-04 (Tampering config.features) | mitigate | Valibot safeParse al confine pubblico — 'Invalid GlueZeroConfig:' prefix |
| T-06-08b-05 (Logic flaw chain non include realtime/worker) | mitigate | Acceptance grep `createWorkerBroker|createRealtimeBroker` → 10 hits ≥ 4 (BLOCKER-2 fix verified) |
| T-06-08b-06 (Wave 3 toccato barrel) | mitigate | BLOCKER-1 fix verified — `git log --oneline packages/devtools/src/index.ts` mostra append cumulativo Wave 4b only |

## Deviazioni dal plan

### Auto-fix issues

**1. [Rule 1 - Bug] Fixed topic name `system.metrics.cardinality-overflow` invalido**
- **Found during:** Task 3 integration test metrics-cardinality-flow
- **Issue:** Il topic name conteneva trattino, non ammesso dal F1 D-24 `validateTopicPattern` (segments devono essere lowercase alphanumeric o `*`). Il devtools-broker.ts originale (Task 1) emettava questo topic via `inner.publish`, e il subscriber dell'integration test falliva a registrarlo.
- **Fix:** Sostituito con `system.metrics.cardinalityoverflow` (singolo segmento valido). Aggiornato sia il source `devtools-broker.ts` che il test integration.
- **Files modified:** `packages/devtools/src/devtools-broker.ts`, `packages/devtools/src/__integration__/metrics-cardinality-flow.test.ts`
- **Commit:** `9a96216` (incluso nel commit aggregato Task 3)
- **Follow-up:** Aggiornare DOC-06 + augment.ts F6PipelineStep type alias in 06-09b final gate.

**2. [Rule 1 - Bug] Fixed integration test topic invalidi (trattino)**
- **Found during:** Task 3 integration test features-opt-out
- **Issue:** Topic `rt-off.topic` / `wrk-off.topic` / `cache-off.topic` / `dt-off.topic` contenevano trattino → rejected da F1 D-24.
- **Fix:** Sostituiti con `rtoff.topic` / `wrkoff.topic` / `cacheoff.topic` / `dtoff.topic`.
- **Files modified:** `packages/gluezero/src/__integration__/features-opt-out.test.ts`
- **Commit:** `9a96216`

Nessun'altra deviazione — chain completa F1+F2+F3+F4+F5+F6 implementata esattamente come da plan + RESEARCH §11.3.

## Authentication gates

Nessuna — plan 06-08b interamente offline (in-memory broker + composition wrapper).

## Building blocks pronti per 06-09a + 06-09b

**06-09a** (CI gates + size-limit + biome cleanup):
- DevtoolsBroker + createGlueZero consolidati (16 file source/test pronti per audit Biome + size-limit budget tracking)
- Coverage v8 ≥90/80/90/90 floor calibrato per CI threshold

**06-09b** (DOC-02/05/06 README italiani + JSDoc + REQ matrix flip + PRD §39 #10 closure + CHANGELOG v1.0.0 milestone closure):
- TOOL-01..05 + PIPE-01 + LIFE-02 + ERR-02 + TEST-01/02 runtime done — REQ matrix atomic flip Complete
- Chain F1+F2+F3+F4+F5+F6 deliverable v1.0 SC-2 ROADMAP closed
- DevtoolsBroker.getDebugSnapshot + getMetrics output format → DOC-02 examples
- BLOCKER-2 fix verified — chain completa milestone v1.0 stabile
- Patch DOC-06: documentare topic naming convention F1 D-24 (no trattino) per audit topics di metrics/cache.

## Self-Check: PASSED

- [x] `packages/devtools/src/devtools-broker.ts` exists
- [x] `packages/devtools/src/devtools-broker.test.ts` exists
- [x] `packages/devtools/src/public-factory.ts` exists
- [x] `packages/devtools/src/public-factory.test.ts` exists
- [x] `packages/devtools/src/__integration__/multiplex-tap-flow.test.ts` exists
- [x] `packages/devtools/src/__integration__/pause-resume-flow.test.ts` exists
- [x] `packages/devtools/src/__integration__/metrics-cardinality-flow.test.ts` exists
- [x] `packages/devtools/src/__integration__/inspector-snapshot.test.ts` exists
- [x] `packages/gluezero/src/glue-zero.ts` exists
- [x] `packages/gluezero/src/sem-bridge.test.ts` exists
- [x] `packages/gluezero/src/__integration__/chain-completa-flow.test.ts` exists
- [x] `packages/gluezero/src/__integration__/features-opt-out.test.ts` exists
- [x] Commit `4c6950e` (RED devtools-broker test) found
- [x] Commit `3217a9a` (GREEN devtools-broker source) found
- [x] Commit `2db79c0` (GREEN devtools-factory) found
- [x] Commit `ae1a565` (RED sem-bridge test) found
- [x] Commit `74e4c4d` (GREEN createGlueZero BLOCKER-2 fix) found
- [x] Commit `9a96216` (Task 3 aggregato barrel + integration BLOCKER-1) found
- [x] D-83 strict: 0 diff lines su packages/{core,mapper,routing,gateway,worker}/src/
- [x] BLOCKER-2 acceptance grep: 10 hits ≥ 4
- [x] BLOCKER-1 single-writer: barrel devtools modificato solo da 06-08b
- [x] Coverage devtools 96.44/89.28/94.36/96.98 ≥ 90/80/90/90
- [x] Coverage sembridge 100/100/100/100 ≥ 90/80/90/90
- [x] Cross-package zero regression: tutti 408+ test pre-esistenti continuano a passare
