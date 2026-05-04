---
phase: 05-worker-runtime
plan: 04
subsystem: worker-runtime
tags: [tdd, worker, comlink, abortsignal, progress, transferable, serialization, lifecycle]
wave: 3-A
parallel_with: 05-05
status: complete
completed: 2026-05-04
duration_minutes: ~30
dependency_graph:
  requires:
    - 05-01 (bootstrap @sembridge/worker types + augment)
    - 05-02 (assertSerializable + extractTransferables building blocks)
    - 05-03 (TaskTracker state machine atomico — non consumato direttamente da bridge)
  provides:
    - WorkerBridge class — Comlink 4.4.x wrapper produzione-ready
    - MockWorker test util — Tier-1 jsdom Worker mock
    - ComlinkAdapter DI interface per test injection
  affects:
    - "@sembridge/worker entry point — barrel index.ts esporta WorkerBridge surface"
tech_stack:
  added: []
  patterns:
    - "DI external constructor (analog F4 SseAdapter EventSourceCtor → ComlinkAdapter)"
    - "Lazy first-dispatch lifecycle (D-129)"
    - "Listener tracking for cleanup (analog combine-signals.ts F1)"
    - "Latest-only window throttle (leading + trailing)"
    - "Test-utils Map indexing via query string (analog B-NEW-2 F4 byChannelName → byWorkerId)"
key_files:
  created:
    - packages/worker/src/worker-bridge.ts (629 LOC)
    - packages/worker/src/worker-bridge.test.ts (465 LOC)
    - packages/worker/src/test-utils/mock-worker.ts (208 LOC)
  modified:
    - packages/worker/src/index.ts (append WorkerBridge exports)
decisions_applied:
  - D-123 (factory `() => Worker` lazy invocata)
  - D-124 (tasks dichiarate esplicite — fail-fast `worker.task.unknown`)
  - D-125 (Comlink expose primary signature)
  - D-129 (lazy first dispatch)
  - D-131 (cancellation hybrid — `Comlink.releaseProxy` + `worker.terminate`)
  - D-132 (AbortSignal proxied via Comlink)
  - D-135 (Comlink callback proxy `onProgress`)
  - D-137 (progressThrottleMs=100 default latest-only — `makeThrottledOnProgress`)
  - D-139, D-140 (assertSerializable invocato PRE-postMessage)
  - D-141 (extractTransferables + Comlink.transfer)
  - D-150 (3-tier test — Tier-1 jsdom unit qui)
metrics:
  tasks_completed: 2
  files_created: 3
  files_modified: 1
  loc_added: ~1302
  test_count: 15
  test_passing: 15
  commits: 4
requirements_progress:
  - WK-01 (worker registry/pool API surface — bridge layer ready)
  - WK-03 (timeout/cancellation — bridge supporta AbortSignal proxy + terminate)
  - WK-04 (progress events — bridge throttle + proxy onProgress)
  - WK-05 (error propagation — error/messageerror listener + lastError)
  - WK-06 (timeout default — gestito a layer pool/handler 05-05/06)
  - WK-07 (serialization closure — assertSerializable + transferable integrate)
  - ERR-02 ext (worker.error + worker.messageerror category 'worker')
  - TEST-01 ext (unit subset — 15 test deterministici)
---

# Phase 5 Plan 04: WorkerBridge Comlink Wrapper Summary

**One-liner:** Comlink 4.4.x wrapper produzione-ready con DI WorkerCtor + lazy first-dispatch + AbortSignal/onProgress proxy + assertSerializable/transferable integration + terminate idempotente, completo di MockWorker test util e 15 test deterministici Tier-1 jsdom.

## Cosa è stato fatto

Wave 3-A del Phase 5 (eseguita in parallel con 05-05 worker-pool/registry, file ownership disgiunta) introduce il building block low-level per dispatch RPC tipizzato verso un singolo Worker:

### `WorkerBridge` (packages/worker/src/worker-bridge.ts, 629 LOC)

**API pubblica:**
- `dispatch(taskName, payload, signal, onProgress?, options?) → Promise<unknown>` — RPC verso il task del worker.
- `terminate() → void` — hard cancel idempotente (`Comlink.releaseProxy` + `worker.terminate`).
- `getDebugSnapshot() → { workerId, spawned, messagesCount, terminated }` — Inspector pre-instrumentation.
- `getLastErrorForTesting() → BrokerError | null` — last error catturato da `'error'`/`'messageerror'` listener.

**Lifecycle:**
1. `new WorkerBridge(desc, deps)` → NO spawn (D-129 lazy).
2. Prima `dispatch()` → invoca `desc.factory()` + `Comlink.wrap` + attach error listeners.
3. Subsequent `dispatch()` → riusa worker + proxy.
4. `terminate()` → release proxy + terminate worker + reset state. Idempotente (Test 11).
5. Subsequent dispatch dopo terminate → re-spawn lazy (Test 10).

**Sequenza dispatch (deterministica):**
1. **D-124 fail-fast** — `desc.tasks.includes(taskName) === false` → throw `BrokerError('worker.task.unknown', 'config')` PRIMA di spawn.
2. **D-139/D-140 assertSerializable** PRE-postMessage (modes: `'always' | 'dev' | 'off'`) — throw `BrokerError('worker.serialization.failed.<sub>', 'worker')` con `fieldPath` PRIMA di spawn.
3. **D-129 ensureSpawned** lazy.
4. **D-141 extractTransferables** JSONPath consumption (consumer Wave 2 building block).
5. **D-132 Comlink.proxy(signal)** — AbortSignal proxied al worker.
6. **D-135 + D-137 onProgress** proxied + `makeThrottledOnProgress` latest-only window.
7. **D-141 Comlink.transfer(payload, transferList)** wrap se transferList non vuoto.
8. Invoke `proxy[taskName](wrappedPayload, signalProxy, onProgressProxy)`.

**ComlinkAdapter DI interface** (innovation):
Comlink ESM module ha proprietà non-redefinable in test environment (`TypeError: Cannot redefine property: wrap`). Soluzione: `WorkerBridgeDeps.comlinkAdapter?: ComlinkAdapter` opt-in, default `DEFAULT_COMLINK_ADAPTER` con binding diretto a `Comlink.{wrap,proxy,transfer,releaseProxy}`. Test inietta uno stub adapter che intercetta tramite `Proxy` senza dipendenza da MessageChannel reale. Pattern coerente con F4 `EventSourceCtor` DI (analog `SseAdapter`).

**makeThrottledOnProgress** (D-137 latest-only window):
- **Leading**: prima chiamata in window-aperta passa subito a `cb`. `lastFlushAt = now`.
- **In-window**: chiamate successive accumulano solo l'ultimo valore in `pending`. Schedule `setTimeout` se non già attivo.
- **Trailing flush**: timer expiration → `cb(pending)` con il valore più recente.

100 chiamate sincrone in <window → 1 leading + 1 trailing = max 2 emit (Test 9).

### `MockWorker` test util (packages/worker/src/test-utils/mock-worker.ts, 208 LOC)

Tier-1 jsdom replacement per `globalThis.Worker` (jsdom non implementa `Worker` nativo).

**API:**
- `implements Worker` (postMessage / terminate / addEventListener / removeEventListener / dispatchEvent + onmessage / onmessageerror / onerror).
- `static lastInstance / instances / byWorkerId Map` indexing via `?_worker=<id>` query string + `reset()`.
- `messages` array memorizza ogni `postMessage` (data + transferList + timestamp) per asserzioni Test 6 D-141.
- Test helpers `__reply / __error / __messageError` dispatch deterministico `message`/`error`/`messageerror`.

Pattern role-match con `gateway/sse-ws/test-utils/mock-event-source.ts` (carryover D-118 → D-150 F5).

### Test suite (packages/worker/src/worker-bridge.test.ts, 465 LOC)

15 test deterministici TDD RED→GREEN co-located (Tier-1 jsdom + DI MockWorker + `stubComlinkAdapter`):

| Test | Decisione | Cosa verifica |
|------|-----------|---------------|
| 1 | D-129 | construction NON spawna Worker (lazy) |
| 2 | D-129 | first dispatch invoca factory + Comlink.wrap; subsequent riusa stesso worker |
| 3 | D-124 | unknown task throw BrokerError code=worker.task.unknown category=config + NO spawn |
| 4 | D-139/D-140 | assertSerializable PRE-postMessage throw worker.serialization.failed.function (mode=always) + NO spawn |
| 5 | D-139 | mode='off' bypassa validazione (zero overhead) |
| 6 | D-141 | extractTransferables + Comlink.transfer applicato quando paths>0 |
| 7 | D-132 | AbortSignal proxied via Comlink.proxy passato come 2° arg al task |
| 8 | D-135 | onProgress proxied via Comlink.proxy quando fornita; undefined quando assente |
| 9 | D-137 | progress throttling latest-only — 100 calls in <window collassano in <=2 emit |
| 10 | D-131 | terminate releases proxy + worker.terminate + lazy re-spawn |
| 11 | — | terminate idempotente (2x non throw) |
| 12 | — | BrokerError da assertSerializable rethrown senza wrapping (preserva fieldPath) |
| 13 | — | worker 'error' event memorizzato come last error code=worker.error |
| 14 | — | worker 'messageerror' event memorizzato code=worker.messageerror |
| 15 | — | getDebugSnapshot { workerId, spawned, messagesCount, terminated } |

## CI Gates

| Gate | Risultato |
|------|-----------|
| `pnpm -F @sembridge/worker test --run` | **15/15** worker-bridge passing — **87/87** full worker package suite (15 nuovi + 72 W1+W2+W3-B precedenti) |
| `pnpm -F @sembridge/worker typecheck` | clean (zero errori) |
| `pnpm -F @sembridge/worker build` | OK — `dist/index.js` 32.35 KB, `dist/index.d.ts` 44.97 KB, `WorkerBridge` 24x in dts |
| `pnpm -F @sembridge/core typecheck` | clean (no regression) |
| `pnpm -F @sembridge/mapper typecheck` | clean (no regression) |
| `pnpm -F @sembridge/routing typecheck` | clean (no regression) |
| `pnpm -F @sembridge/gateway typecheck` | clean (no regression) |
| `pnpm -F @sembridge/core test --run` | 248/248 passing (no regression) |
| `pnpm -F @sembridge/gateway test --run` | 222/225 passing (3 skip MSW V1.x F4) |

## Acceptance grep counts

| Pattern | Count | Atteso |
|---------|------:|-------:|
| `Comlink.wrap` (file source) | 9 | ≥1 ✓ |
| `Comlink.proxy / .proxy(` | 11 | ≥2 (signal + onProgress) ✓ |
| `Comlink.transfer / .transfer(` | 9 | ≥1 ✓ |
| `Comlink.releaseProxy / releaseProxy` | 12 | ≥1 ✓ |
| `assertSerializable` | 15 | ≥1 ✓ |
| `extractTransferables` | 6 | ≥1 ✓ |
| `worker.task.unknown` | 6 | ≥1 ✓ |
| `JSON\.stringify(` (invocazioni runtime) | **0** | =0 ✓ T-05-04-05 mitigation |
| `implements Worker` (mock) | 1 | ≥1 ✓ |
| `WorkerBridge` (barrel index.ts) | 2 | ≥1 ✓ |

## D-83 strict gate

```bash
git diff main packages/core/src/ packages/mapper/src/ packages/routing/src/ \
  packages/gateway/src/http/ packages/gateway/src/sse-ws/ → exit empty
```

Verificato: zero modifiche runtime a F1-F4 per tutta la wave 3-A. Composition wrapper carryover preservato.

## File ownership disgiunta da 05-05 (Wave 3 parallel)

| Plan | Files owned |
|------|-------------|
| **05-04** | `packages/worker/src/worker-bridge.ts`<br>`packages/worker/src/worker-bridge.test.ts`<br>`packages/worker/src/test-utils/mock-worker.ts` |
| **05-05** | `packages/worker/src/worker-pool.ts`<br>`packages/worker/src/worker-pool.test.ts`<br>`packages/worker/src/worker-registry.ts`<br>`packages/worker/src/worker-registry.test.ts` |

Coordinamento barrel: append-only sezioni separate (`WorkerBridge` class + types vs `WorkerRegistry`/`WorkerPool` + types). Zero overlap git index, zero conflict.

## Threat model coverage

10 threat enumerate (T-05-04-01..T-05-04-10), tutti `LOW` severity, tutti `mitigate`:

- **T-05-04-01** (Tampering payload mutato post-validation pre-postMessage) — assertSerializable + Comlink.transfer atomic in dispatch (event loop single-thread). Test 4.
- **T-05-04-02** (Transferable detached info disclosure) — documentato JSDoc `WorkerBridgeDispatchOptions.transferable` + DOC-05 in 05-07.
- **T-05-04-03** (Pool storm) — accept (scope di 05-05 pool cap 8 + allowUnboundedPool warn).
- **T-05-04-04** (Race timeout vs success Pitfall 2C) — delegato a TaskTracker (05-03) + WorkerHandler (05-06). Bridge è puramente dispatch/await.
- **T-05-04-05** (assertSerializable bypass via JSON.stringify) — zero invocazioni runtime di JSON.stringify nel bridge.
- **T-05-04-06** (Comlink proxy escape elevation) — `desc.tasks.includes` fail-fast prima di proxy[taskName]. Test 3.
- **T-05-04-07** (No audit trail dispatch) — `getDebugSnapshot` espone messagesCount + spawned + terminated.
- **T-05-04-08** (onProgress flood broker) — `makeThrottledOnProgress` latest-only window 100ms default. Test 9.
- **T-05-04-09** (BrokerError.details include payload value) — details solo metadata (`workerId`/`taskName`/`fieldPath`/`fieldType`/`filename`/`lineno`).
- **T-05-04-10** (Comlink.releaseProxy mancato → memory leak) — terminate idempotente con `proxy[releaseProxy]?.()` + `worker.terminate()`. Test 11.

## Decisioni autonome (Claude's Discretion)

1. **`ComlinkAdapter` DI interface aggiunto** — Comlink ESM properties non-redefinable in test runtime (`Cannot redefine property: wrap`). Soluzione DI elegante coerente con pattern F4 `EventSourceCtor`. `WorkerBridgeDeps.comlinkAdapter?` opt-in con default binding diretto a Comlink runtime. Aggiunge testabilità senza cambiare il contratto pubblico.
2. **`detectDevMode` via `globalThis` cast** — evita dipendenza da `@types/node`. Pattern compatibile con Web Worker globalScope (no polyfill). Bundler replace `process.env.NODE_ENV` literal in production → tree-shake elimina branch.
3. **`getLastErrorForTesting`** — espone last error catturato da error listener. Marcato `@internal` (non parte di API pubblica consumer); usato dal WorkerHandler 05-06 per outcome publishing + dai test 13/14.
4. **Listener cleanup esplicito al terminate** — best-effort `removeEventListener` PRIMA di `worker.terminate()` per coerenza con pattern F4 `combine-signals.ts`. Worker.terminate() implicit cleanup ridondante ma sicuro.
5. **JSDoc rich** — `@example` runtime in WorkerBridge class header + `@see` cross-references a `assertSerializable`, `extractTransferables`, `WorkerDescriptor`. TypeDoc-ready (analog F4 04-09 final gate).

## Deviazioni dal plan

Nessuna deviazione architettonica. Aggiunte minor coerenti con il design intent:
- **DI ComlinkAdapter** non era nel plan iniziale (originale: stub Comlink.wrap globale). Scoperto in fase di test-run: necessario per testabilità jsdom. Pattern aderente a D-150 e a F4 carryover. Marcato `@internal` (non superficie pubblica consumer).
- **`getLastErrorForTesting`** marcato `@internal` ma esposto come API minor — necessario per Test 13/14 + usato come hook da WorkerHandler 05-06.

## Authentication gates

Nessun auth gate. Plan completamente autonomo (jsdom Tier-1, no live worker).

## Pronto per Wave 4 (05-06)

Building blocks per `WorkerHandler` (05-06):
- `WorkerBridge` con dispatch/terminate/getLastErrorForTesting → orchestrabile da handler
- `MockWorker` test util → riuso per integration test 8x 3-tier
- `WorkerPool` (05-05 in parallel) `bridgeFactoryFn` può creare WorkerBridge per slot

Plan 05-06 comporrà: `WorkerHandler` Strategy F3 dispatch table → `WorkerRegistry.get(workerId)` → `WorkerPool.acquireSlot` → `slot.bridge.dispatch(taskName, payloadCanonical, signal, onProgress)` → `WorkerTaskOutcome` → `OutcomeCollector` publish.

## Self-Check: PASSED

File creati verificati:
- FOUND: packages/worker/src/worker-bridge.ts (629 LOC)
- FOUND: packages/worker/src/worker-bridge.test.ts (465 LOC)
- FOUND: packages/worker/src/test-utils/mock-worker.ts (208 LOC)

Commit verificati:
- FOUND: b3cb23b test(05-04): MockWorker test util Tier-1 jsdom
- FOUND: efc72c1 test(05-04): RED worker-bridge 15 test
- FOUND: 7461718 feat(05-04): GREEN WorkerBridge Comlink wrap + lifecycle
- FOUND: 9a52637 chore(05-04): expose WorkerBridge in barrel + cleanup

Test passing: 15/15 worker-bridge.test.ts (87/87 full worker package suite).
