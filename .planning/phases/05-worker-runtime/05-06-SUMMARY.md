---
phase: 05-worker-runtime
plan: 06
subsystem: worker-runtime
tags: [worker, broker, composition-wrapper, opzione-b, d-83-strict, opus, italiano]
type: execute
wave: 4
status: complete
completed_at: 2026-05-04T23:48:00Z
duration_minutes: 28

dependency_graph:
  requires:
    - 05-01 # bootstrap @sembridge/worker (types + augment + vitest 3-tier)
    - 05-02 # assert-serializable + transferable-extractor
    - 05-03 # task-tracker (state machine atomico Pitfall 2C closure D-133)
    - 05-04 # WorkerBridge Comlink wrapper (D-124/129/131/132/135/137/139/140/141)
    - 05-05 # WorkerRegistry + WorkerPool (D-126/127/128/129/130/131 LIFE-02 ext F5)
  provides:
    - WorkerHandler # Strategy F3 dispatch (D-152) — registry + pool + tracker → publishFn
    - WorkerBroker # composition wrapper RouterBroker (D-121, D-83 strict) — Opzione B publish intercept (RESEARCH §7.2)
    - createWorkerBroker # factory pubblico Valibot safeParse + D-30 anti-singleton
    - createWorkerHarness # fixture integration test (analog F4 realtime-harness)
    - MockBridge # deterministic bridge per integration test (cooperative signal)
    - 8 integration test Tier-1 (D-151 #1-#6 + #8 + #9)
    - 6 browser smoke Tier-3 Playwright Chromium (D-151 #7 transferable byteLength=0 + Pitfall 7.B/7.E)
  affects:
    - "@sembridge/worker public API surface (WorkerBroker, createWorkerBroker, createWorkerHandler, deriveTopic)"

tech-stack:
  added: []
  patterns:
    - Composition wrapper RouterBroker (D-121 / D-83 strict carryover F4)
    - "Opzione B research §7.2 — publish intercept pre-delegate (zero modify packages/routing/)"
    - "DI bridgeFactory per integration test deterministico (analog F4 realtime-harness MockBridge)"
    - "Strategy F3 dispatch (D-152) con publishFn DI legato a inner.publish"
    - Atomic CAS state machine via TaskTracker (D-133 Pitfall 2C closure)
    - "Valibot safeParse al confine pubblico (D-56 boundary validation pattern F1-F4)"
    - "Topic auto-derive D-146 con suffix-replace (analog F3 outcome-collector)"
    - "Sanitized error shape T-03-07-01 carryover (no originalError/stack/cause)"

key-files:
  created:
    - packages/worker/src/worker-handler.ts # 422 LOC — Strategy F3 dispatch + deriveTopic + publishFailure ERR-02 ext F5
    - packages/worker/src/worker-handler.test.ts # 8 unit test (happy path / worker.unknown / task.unknown / timeout / cancellation / Pitfall 2C / progress / deriveTopic)
    - packages/worker/src/worker-broker.ts # 530 LOC — composition wrapper Opzione B + cascade D-126 + duplicate guard
    - packages/worker/src/worker-broker.test.ts # 12 unit test (composition / intercept / cascade / W-5 closure / top-level / duplicate / D-124 / D-83 smoke)
    - packages/worker/src/public-factory.ts # 145 LOC — createWorkerBroker + Valibot WorkerBrokerConfigSchema
    - packages/worker/src/public-factory.test.ts # 6 unit test (D-30 anti-singleton + Valibot validation)
    - packages/worker/src/test-utils/worker-harness.ts # 286 LOC — createWorkerHarness + MockBridge + makeMockDescriptor
    - packages/worker/src/__integration__/dedicated.test.ts # D-151 #1
    - packages/worker/src/__integration__/pool-concurrent.test.ts # D-151 #2
    - packages/worker/src/__integration__/timeout-strict.test.ts # D-151 #3 Pitfall 2C closure
    - packages/worker/src/__integration__/cancel-cooperative.test.ts # D-151 #4
    - packages/worker/src/__integration__/cancel-hard.test.ts # D-151 #5 LIFE-02 ext F5
    - packages/worker/src/__integration__/serialization-fail.test.ts # D-151 #6 D-139/D-140
    - packages/worker/src/__integration__/cascade-cleanup.test.ts # D-151 #8 LIFE-02 ext F5 cascade
    - packages/worker/src/__integration__/backpressure-storm.test.ts # D-151 #9 critical bypass Pitfall 4.C
    - packages/worker/src/__browser__/test-worker.ts # 39 LOC — Worker artifact reale Comlink.expose
    - packages/worker/src/__browser__/playwright-worker-smoke.test.ts # 74 LOC — 6 browser smoke (D-151 #7 transferable + Pitfall 7.B/7.E + module worker)
  modified:
    - packages/worker/src/index.ts # barrel runtime exports F5 W4 (WorkerBroker, createWorkerBroker, createWorkerHandler, deriveTopic, WorkerPublishFn)

decisions:
  - id: D-121
    title: WorkerBroker composition wrapper di RouterBroker (D-83 strict carryover F4)
    rationale: |
      F5 vive solo in `packages/worker/src/`. Il `WorkerBroker` istanzia `inner: RouterBroker(config)` al constructor e delega tutta la surface F1-F3 invariata (publish per topic non-worker, subscribe, registerRoute, registerCanonicalSchema, registerPlugin/unregisterPlugin con cascade D-126). Pattern composition identico a `RealtimeBroker` di F4 (plan 04-08).
  - id: D-83-strict
    title: Opzione B research §7.2 — publish intercept pre-delegate
    rationale: |
      Il `WorkerBroker.publish` intercetta topic matching una worker route registrata PRIMA di delegare a `inner.publish` (RouterBroker F3). NESSUNA modifica a `packages/routing/route-resolver.ts` né `route-executor.ts` (Opzione A vietata). `git diff main...HEAD packages/{core,mapper,routing}/src/ packages/gateway/src/{http,sse-ws}/` exit 0 verified.
  - id: D-126-cascade
    title: registerPlugin auto-registra PluginDescriptor.workers + cascade unregister
    rationale: |
      `registerPlugin` cascade auto-registra `desc.workers` con `ownerId=descriptor.id`; `unregisterPlugin` 3-step cascade `inner.unregisterPlugin + pool.terminateByOwner + registry.unregisterByOwner` con try/catch isolato per idempotency. W-5 closure F4 (no silent catch): `system.warn` strutturato su register failure. LIFE-02 ext F5.
  - id: D-152-dispatch
    title: WorkerHandler Strategy F3 — pipeline §28 step 9
    rationale: |
      `createWorkerHandler({ registry, pool, tracker, publishFn })` orchestra registry → pool → bridge → tracker → publish outcome. Stati atomici: markDone/markTimeout/markCancelled/markError ritornano boolean; late responses scartate silenziosamente (Pitfall 2C closure verified deterministically in `timeout-strict.test.ts`). correlationId end-to-end propagato (D-134).
  - id: D-146-topic
    title: Topic naming auto-derive con suffix-replace + override esplicito
    rationale: |
      `deriveTopic(sourceTopic, suffix)` esportato — `weather.requested` → `weather.completed`/`.progress`/`.failed`. Override via `route.publishes.{success|progress|error}` quando definito.
  - id: D-150-tier-3
    title: 3-tier test strategy (Tier-1 jsdom + Tier-3 Playwright)
    rationale: |
      Tier-1 jsdom: 121 unit + integration test (8 D-151 obbligatori) con `MockBridge` deterministico iniettato via `bridgeFactory` DI. Tier-3 Playwright Chromium real-browser: 6 browser smoke per D-151 #7 transferable byteLength=0 + Pitfall 7.B Date/Map structuredClone preserved + module worker (PRD §31.3). Vitest 4.x browser provider Playwright factory installato (no migration F4 carryover).
  - id: D-151-coverage
    title: 10 scenari D-151 distribuiti — 9 in Tier-1 + 1 in Tier-3 + 1 ridondante in 05-04
    rationale: |
      D-151 #1 (dedicated), #2 (pool-concurrent), #3 (timeout-strict + Pitfall 2C), #4 (cancel-cooperative), #5 (cancel-hard via unregisterPlugin), #6 (serialization-fail), #8 (cascade-cleanup), #9 (backpressure-storm) → 8 integration test Tier-1. #7 (transferable byteLength=0) → Tier-3 Playwright. #10 (assertSerializable PRE-postMessage no spawn) coperto in 05-04 worker-bridge.test.ts Test 4.

metrics:
  duration_minutes: 28
  files_created: 16
  files_modified: 1
  loc_source: 1383 # worker-handler 422 + worker-broker 530 + public-factory 145 + harness 286
  loc_tests_unit: 776 # worker-handler.test 281 + worker-broker.test 246 + public-factory.test 65 + ... approximate
  loc_tests_integration: 616 # 8 file __integration__/
  loc_tests_browser: 113 # 2 file __browser__/
  loc_total: ~2112
  test_count_unit: 26 # 8 handler + 12 broker + 6 factory
  test_count_integration: 8
  test_count_browser: 6
  test_count_w4_total: 40
  test_count_worker_full: 121 # 26 + 8 + 87 (W1+W2+W3 precedenti)
  monorepo_test_count: 877 # 248 core + 183 mapper + 103 routing + 222 gateway (3 skip MSW V1.x F4) + 121 worker
  commits: 4
  d83_strict_verified: true # zero diff packages/{core,mapper,routing,gateway/http,sse-ws}/

requirements_progress:
  - WK-01 # complete subset W4: WorkerBroker + registerWorker + PluginDescriptor.workers cascade
  - WK-02 # complete subset: pool concurrent dispatch verified D-151 #2
  - WK-03 # complete subset: WorkerHandler dispatch via Comlink (delegato a WorkerBridge 05-04)
  - WK-04 # complete subset: AbortSignal cancellation cooperative + hard via unregisterPlugin
  - WK-05 # complete subset: progress callback proxied via Comlink (delegato a WorkerBridge 05-04)
  - WK-06 # complete subset: timeout strict 30s default + per-route override
  - WK-07 # complete subset: serialization PRE-postMessage + transferable JSONPath (DOC-05 finale 05-07)
  - ERR-02-ext # complete: worker.error topic ext per ogni failure (telemetria audit)
  - LIFE-02-ext # complete: cascade 3-step unregisterPlugin verified D-151 #5/#8
  - TEST-01 # complete subset W4: 26 unit + 8 integration + 6 browser
  - TEST-02 # complete subset W4: integration test Tier-1 + Tier-3
  - TEST-03 # complete subset W4: D-151 10 scenari obbligatori distribuiti

threat_register_disposition:
  - id: T-05-06-01
    severity: low
    disposition: mitigate
    notes: |
      Opzione B publish intercept evita modifica F3 routing — D-83 strict ✓ verified
      via `git diff` zero output. JSDoc di `worker-broker.ts` cita Opzione B + D-83 +
      RESEARCH §7.2 in 14 occurrenze (Opzione B/D-83) + 4 esplicite (RESEARCH §7.2).
  - id: T-05-06-02
    severity: low
    disposition: mitigate
    notes: |
      Source descriptor `{ type: 'worker', id: route.worker, name: route.task }` impostato
      writer-side dal handler (success + failure paths) — il consumer payload NON può
      sovrascriverlo. Verifica via grep `source: { type: 'worker'` ≥ 2 in worker-handler.ts.
  - id: T-05-06-04
    severity: low
    disposition: mitigate
    notes: |
      `publishFailure` sanitizza error a `{ code, category, message, routeId, topic, eventId,
      workerId, taskName }` — NIENTE `originalError`/`stack`/`cause`. Audit retroattivo via
      Test 2 worker-handler.test.ts asserts.
  - id: T-05-06-06
    severity: low
    disposition: mitigate
    notes: |
      tracker.markDone/markTimeout/markCancelled CAS atomico (D-133) — solo prima
      transition publica outcome. Verifica deterministic: `timeout-strict.test.ts` integration
      test asserts `<topic>.completed` NOT published, `tasksCompleted === 1`.
  - id: T-05-06-08
    severity: low
    disposition: mitigate
    notes: |
      `registry.validateTask` fail-fast (D-124) sia al `registerWorkerRoute` (boot) che al
      `handler.execute` (runtime). Throw `worker.task.unknown` category='config'. Test 3
      worker-handler.test.ts + Test 8 worker-broker.test.ts verifica.
  - id: T-05-06-09
    severity: low
    disposition: mitigate
    notes: |
      `unregisterPlugin` 3-step cascade (S2 carryover F4): `inner.unregisterPlugin +
      pool.terminateByOwner + registry.unregisterByOwner` con try/catch isolato per
      idempotency. `cascade-cleanup.test.ts` asserts `pool.activeBridges === 0` post.
  - id: T-05-06-10
    severity: low
    disposition: mitigate
    notes: |
      `registerWorkerRoute` throw `worker.route.duplicate` se topic già registrato (NO
      last-write-wins). Test 7 worker-broker.test.ts verifica.

phase_progress:
  - "Plan 5/7 → Plan 6/7 done (Wave 4 complete — composition wrapper + integration test)"
  - "Wave 4 ✅ COMPLETE — Wave 5 (05-07 final gate F5) ready"

ci_gates:
  typecheck_status: pass # tsc --noEmit zero errors su 5 package
  build_status: pass # tsup ESM + DTS dist/index.js 50.85 KB, augment 226 B, dts 60.72 KB
  test_status_tier1: pass # 121/121 worker (jsdom)
  test_status_tier3: pass # 6/6 browser smoke (Chromium headless real)
  cross_package_status: pass # core 248 + mapper 183 + routing 103 + gateway 222 (3 skip MSW V1.x F4) + worker 121 = 877/880

next_steps:
  - 05-07 final gate F5 (Wave 5)
  - DOC-05 README italiano (Worker section ~11 sub-paragrafi analog F4)
  - JSDoc TypeDoc-ready public API (analog F4 04-09 — @example/@see/@throws)
  - REQ matrix flip atomic WK-01..WK-07 → Complete
  - PRD §39 #11 (WK-07 serialization rationale) closure esplicito
  - Coverage v8 thresholds finali calibrazione post-implementation
---

# Phase 5 Plan 06: Worker Runtime Composition Wrapper Wave 4 Summary

Composizione finale F5 — `WorkerBroker` composition wrapper di `RouterBroker` con publish intercept Opzione B (D-83 strict preservation), `createWorkerBroker` factory pubblico Valibot, `WorkerHandler` Strategy F3 dispatch atomic, `createWorkerHarness` fixture + 8 integration test Tier-1 + 6 browser smoke Tier-3 Playwright.

## Files Created

| Path                                                                          | LOC      | Note                                                                                 |
| ----------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `packages/worker/src/worker-handler.ts`                                       | 422      | Strategy F3 dispatch + deriveTopic + publishFailure (ERR-02 ext F5)                  |
| `packages/worker/src/worker-handler.test.ts`                                  | ~280     | 8 unit test (D-152 / D-146 / D-133 Pitfall 2C / D-134)                               |
| `packages/worker/src/worker-broker.ts`                                        | 530      | Composition wrapper Opzione B + cascade D-126 + duplicate guard                      |
| `packages/worker/src/worker-broker.test.ts`                                   | ~250     | 12 unit test (composition / intercept / cascade / W-5 / D-83 smoke)                  |
| `packages/worker/src/public-factory.ts`                                       | 145      | createWorkerBroker + Valibot WorkerBrokerConfigSchema                                |
| `packages/worker/src/public-factory.test.ts`                                  | ~70      | 6 unit test (D-30 anti-singleton + Valibot validation)                               |
| `packages/worker/src/test-utils/worker-harness.ts`                            | 286      | createWorkerHarness + MockBridge deterministico + makeMockDescriptor                 |
| `packages/worker/src/__integration__/dedicated.test.ts`                       | 54       | D-151 #1 happy path                                                                  |
| `packages/worker/src/__integration__/pool-concurrent.test.ts`                 | 83       | D-151 #2 4 publish parallel cap rispettato                                           |
| `packages/worker/src/__integration__/timeout-strict.test.ts`                  | 77       | D-151 #3 Pitfall 2C closure (atomic state machine)                                   |
| `packages/worker/src/__integration__/cancel-cooperative.test.ts`              | 72       | D-151 #4 signal abort onorato dal bridge                                             |
| `packages/worker/src/__integration__/cancel-hard.test.ts`                     | 73       | D-151 #5 unregisterPlugin cascade hard kill                                          |
| `packages/worker/src/__integration__/serialization-fail.test.ts`              | 90       | D-151 #6 assertSerializable PRE-postMessage simulata                                 |
| `packages/worker/src/__integration__/cascade-cleanup.test.ts`                 | 78       | D-151 #8 cleanup completo + worker.unknown post                                      |
| `packages/worker/src/__integration__/backpressure-storm.test.ts`              | 89       | D-151 #9 critical bypass Pitfall 4.C                                                 |
| `packages/worker/src/__browser__/test-worker.ts`                              | 39       | Worker artifact reale Comlink.expose                                                 |
| `packages/worker/src/__browser__/playwright-worker-smoke.test.ts`             | 74       | 6 browser smoke Chromium reale (Pitfall 7.B/7.E + D-151 #7)                          |

**Source totale:** ~1383 LOC (worker-handler 422 + worker-broker 530 + public-factory 145 + harness 286).
**Test totale:** ~1505 LOC (~776 unit + 616 integration + 113 browser).

## Files Modified

| Path                              | Note                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/worker/src/index.ts`    | Barrel runtime exports F5 W4 (WorkerBroker, createWorkerBroker, createWorkerHandler, deriveTopic, WorkerPublishFn) |

## Test Results

| Suite                              | Pass | Fail | Skip | Tot |
| ---------------------------------- | ---- | ---- | ---- | --- |
| @sembridge/worker (Tier-1 jsdom)   | 121  | 0    | 0    | 121 |
| @sembridge/worker (Tier-3 Playwright) | 6 | 0    | 0    | 6   |
| @sembridge/core                    | 248  | 0    | 0    | 248 |
| @sembridge/mapper                  | 183  | 0    | 0    | 183 |
| @sembridge/routing                 | 103  | 0    | 0    | 103 |
| @sembridge/gateway                 | 222  | 0    | 3    | 225 |
| **Monorepo full**                  | **877** | **0** | **3** | **880** |

3 skip pre-esistenti (gateway MSW V1.x F4 deferred — non impattati da F5 W4).

## Decisions Made

- **Opzione B research §7.2** lockata e implementata: il `WorkerBroker.publish` intercetta topic matching una `RouteWorkerDefinition` registrata PRIMA di delegare a `inner.publish` (RouterBroker F3). Nessuna modifica al `route-resolver.ts` né al `route-executor.ts` di `packages/routing/`. JSDoc di `worker-broker.ts` cita Opzione B + D-83 + RESEARCH §7.2 in 14 occorrenze totali (Opzione B/D-83) + 4 citazioni esplicite di RESEARCH §7.2.
- **DI bridgeFactory**: aggiunta opzione `WorkerBrokerConfig.bridgeFactory` per integration test deterministico — sostituisce il default `WorkerBridge` (Comlink-based) con `MockBridge` cooperativo. Pattern simmetrico a `WorkerCtor` DI ma a livello di pool.
- **Harness MockBridge**: deterministico per scenario test (per-task `result/delayMs/error/progress`), onora `signal` cooperativo, tracking `instances/byWorkerId/dispatchCalls/cancelledCount` per assertion strutturate.
- **Sanitization writer-side**: `publishFailure` sanitizza error a `{ code, category, message, routeId, topic, eventId, workerId, taskName }` — NIENTE `originalError`/`stack`/`cause` (T-03-07-01 carryover F3 OutcomeCollector).
- **ERR-02 ext F5**: ogni failure emette sia `<topic>.failed` (o override `route.publishes.error`) che `worker.error` topic ext per consumer sistemici (telemetria, banner, audit). Carryover F3 D-81 `network.error` pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Type coercion `RoutePolicies.timeout`**
- **Found during:** Task 1 typecheck
- **Issue:** `RoutePolicies.timeout` di F3 accetta `number | TimeoutPolicyConfig` (`{ ms: number }`); il `setTimeout` chiama richiede `number`.
- **Fix:** Aggiunta funzione helper `resolveTimeoutMs(timeout)` che coerce coerentemente.
- **Files modified:** `packages/worker/src/worker-handler.ts`
- **Commit:** `4717a2e`

**2. [Rule 1 - Bug] Test 2 worker-broker timeout sui MockWorker non-rispondente**
- **Found during:** Task 2 test execution
- **Issue:** Il test originale registrava worker con MockWorker reale (Comlink wrap che fa postMessage e attende risposta che non arriva mai) → timeout test 5s.
- **Fix:** Riscritto Test 2 per usare la sequenza fail-fast `worker.unknown`: registra una worker route SENZA registrare il worker matching → handler.execute fa publishFailure immediato. Verifica intercept Opzione B funzionante senza dipendere dal Comlink RPC reale.
- **Files modified:** `packages/worker/src/worker-broker.test.ts`
- **Commit:** `e117332`

**3. [Rule 2 - Auto-add] DI bridgeFactory per integration test**
- **Found during:** Task 3 setup
- **Issue:** Il pattern integration test richiede un `WorkerBridge` deterministico — il `WorkerBridge` reale di 05-04 dipende da Comlink RPC + MessageChannel non disponibile in jsdom.
- **Fix:** Aggiunta opzione `WorkerBrokerConfig.bridgeFactory` (DI optional) — il `WorkerBroker.makeBridge()` invoca `customBridgeFactory(desc)` se fornito, altrimenti default `new WorkerBridge(desc, deps)`. Pattern coerente con `WorkerPool.bridgeFactory` (05-05 building block disaccoppiamento da 05-04).
- **Files modified:** `packages/worker/src/worker-broker.ts`, `packages/worker/src/public-factory.ts`, `packages/worker/src/test-utils/worker-harness.ts`
- **Commit:** `6141eba`

## Threat Model Recap

11 threat enumerate (T-05-06-01..T-05-06-11) coperti via:

| Threat       | Severity | Disposition | Mitigation                                                                                  |
| ------------ | -------- | ----------- | ------------------------------------------------------------------------------------------- |
| T-05-06-01   | low      | mitigate    | Opzione B publish intercept — D-83 strict ✓ verified `git diff` zero output                 |
| T-05-06-02   | low      | mitigate    | `source.type='worker'` writer-side, consumer payload NON sovrascrivibile                    |
| T-05-06-03   | low      | mitigate    | EventTap pre-instrumentation (CORE-13 carryover) — F6 Inspector implementerà reali          |
| T-05-06-04   | low      | mitigate    | publishFailure sanitization — no originalError/stack/cause                                  |
| T-05-06-05   | low      | mitigate    | registry valida pool size cap 8 (D-128) — plugin maliziosi rifiutati                        |
| T-05-06-06   | low      | mitigate    | tracker CAS atomico (D-133) — `timeout-strict.test.ts` deterministically                    |
| T-05-06-07   | low      | mitigate    | F5 NON usa JSON.stringify in worker-broker / worker-handler — bridge usa structuredClone    |
| T-05-06-08   | low      | mitigate    | registry.validateTask fail-fast (D-124) sia register che runtime                            |
| T-05-06-09   | low      | mitigate    | unregisterPlugin 3-step cascade try/catch isolato — cascade-cleanup.test deterministically  |
| T-05-06-10   | low      | mitigate    | registerWorkerRoute throw `worker.route.duplicate` (NO last-write-wins)                     |
| T-05-06-11   | low      | accept      | externalAbortControllers Map cleanup in finally (bounded da #publish concorrenti)           |

## D-83 Strict Verification

```bash
$ git diff main...HEAD -- packages/core/src/ packages/mapper/src/ packages/routing/src/ packages/gateway/src/http/ packages/gateway/src/sse-ws/
# (zero output — D-83 strict ✓)
```

**Opzione B verified:** F5 vive solo in `packages/worker/src/`. Il `WorkerBroker.publish`:

```typescript
async publish(topic, payload, options) {
  const workerRoute = this.workerRoutes.get(topic)
  if (workerRoute === undefined) {
    // Non-worker → delegate inner.publish (pipeline F3 invariata)
    this.inner.publish(topic, payload, options)
    return
  }
  // Worker → handler.execute (Opzione B intercept)
  await this.handler.execute(event, workerRoute, ctrl.signal)
}
```

## Performance Notes

- **Build size:** `dist/index.js` 50.85 KB (ESM-only, +18.50 KB vs 05-04 32.35 KB), `dist/index.d.ts` 60.72 KB. Augment 226 B + dts 89 B (declaration merging side-effect preserved).
- **Test runtime:** Tier-1 jsdom 121 test in 1.34s; Tier-3 Playwright 6 test in 0.80s (browser provider Chromium headless reale, network startup compreso).

## Opzione B JSDoc Citation Audit

```bash
$ grep -c "Opzione B\|D-83" packages/worker/src/worker-broker.ts
14
$ grep -c "RESEARCH §7.2\|research §7.2" packages/worker/src/worker-broker.ts
4
```

L'`Opzione B research §7.2` + il vincolo `D-83 strict carryover` sono documentati esplicitamente nel JSDoc del file `worker-broker.ts` (header del modulo + JSDoc della class + JSDoc del metodo `publish`). Pattern coerente con `RealtimeBroker` di F4 (analog citazione D-101 + D-83 in 04-08 SUMMARY).

## Self-Check: PASSED

**File audit:**

```bash
$ [ -f packages/worker/src/worker-handler.ts ] && echo FOUND
FOUND
$ [ -f packages/worker/src/worker-broker.ts ] && echo FOUND
FOUND
$ [ -f packages/worker/src/public-factory.ts ] && echo FOUND
FOUND
$ [ -f packages/worker/src/test-utils/worker-harness.ts ] && echo FOUND
FOUND
$ ls packages/worker/src/__integration__/*.test.ts | wc -l
8
$ ls packages/worker/src/__browser__/*.ts | wc -l
2
```

**Commit audit:**

```bash
$ git log --oneline -4
ff3d694 test(05-06): Tier-3 Playwright real Worker smoke + D-151 #7 transferable byteLength=0
6141eba test(05-06): 8 integration test Tier-1 jsdom (D-151 #1-#6 + #8 + #9)
e117332 feat(05-06): WorkerBroker composition wrapper Opzione B + createWorkerBroker factory + harness
4717a2e feat(05-06): WorkerHandler Strategy F3 dispatch + atomic state + sanitized errors
```

**Cross-package isolation (D-83 strict):**
```bash
$ git diff main...HEAD -- packages/{core,mapper,routing}/src/ packages/gateway/src/{http,sse-ws}/ | wc -l
0
```
Zero output ✓.

**Acceptance grep:**
```bash
$ grep -c "private readonly inner: RouterBroker" packages/worker/src/worker-broker.ts
1
$ grep -c "this.workerRoutes.get(topic)" packages/worker/src/worker-broker.ts
1
$ grep -c "registry.unregisterByOwner\|pool.terminateByOwner" packages/worker/src/worker-broker.ts
3
$ grep -c "Invalid WorkerBrokerConfig:" packages/worker/src/public-factory.ts
1
$ grep -c "Comlink.expose" packages/worker/src/__browser__/test-worker.ts
1
$ grep -c "Comlink.transfer" packages/worker/src/__browser__/playwright-worker-smoke.test.ts
1
```
Tutti i grep ≥ 1 verified ✓.

## Next Plan: 05-07 (Wave 5 — Final Gate F5)

Pronto per:
- CI gates finali (lint biome + typecheck + build size + coverage v8 thresholds calibration)
- DOC-05 README italiano (Worker section — ~11 sub-paragrafi analog F4 04-09 W-4)
- JSDoc TypeDoc-ready public API (`@example`/`@see`/`@throws`/`@param` analog F4 04-09 W-3)
- REQ matrix flip atomic WK-01..WK-07 → Complete
- PRD §39 #11 (WK-07 serialization rationale) closure esplicito
- ROADMAP/STATE/TRACKER finalization
