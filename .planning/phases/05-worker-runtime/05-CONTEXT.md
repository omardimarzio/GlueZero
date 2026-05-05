# Phase 5: Worker Runtime - Context

**Gathered:** 2026-05-04
**Status:** Ready for research and planning

<domain>
## Phase Boundary

Esiste un `WorkerRegistry` che gestisce worker dedicati o pool con riuso bounded; la route `worker` delega un task a un worker correlato via `correlationId`; il worker riceve payload **canonico** (mapper applicato pre-dispatch, PRD §19.4 step 3), ritorna `success` / `progress` / `error` come `BrokerEvent` canonici (`<topic>.completed` / `<topic>.progress` / `<topic>.failed`); state machine atomico `pending → done | timeout | error` (Pitfall 2C); cancellazione + timeout first-class; cascade cleanup completo su `unregisterPlugin`; serializzazione documentata (structuredClone default + transferable opt-in via JSONPath, chiusura PRD §39 #11 / WK-07).

**In scope:**
- `@gluezero/worker` package: `WorkerRegistry`, `WorkerPool`, `WorkerBridge` (Comlink wrapper interno), `TaskTracker` (state machine atomico), `assertSerializable` validator
- `WorkerBroker` composition wrapper di `RouterBroker` (D-83 strict carryover) — F5 ortogonale a F4 (utente sceglie uno o compone esplicitamente)
- API top-level: `broker.registerWorker(descriptor)` / `unregisterWorker(id)` con `ownerId='system'`
- `PluginDescriptor.workers?: WorkerDescriptor[]` extension via declaration merging in `@gluezero/worker/augment.ts` (pattern F2 D-57, F3 D-94, F4 D-103) per cascade cleanup
- Route handler `type: 'worker'` integrato in F3 RouteExecutor (pattern Strategy)
- Mapper canonical pre-dispatch (riuso `MapperEngine.mapToCanonical` di F2 — D-114 carryover)
- BackpressureStrategy riusata (D-75/D-115)
- AbortSignal-first proxy via Comlink per cooperative cancellation
- Progress events via Comlink callback proxy `task(args, signal, onProgress)` con throttling adapter-level
- Eventi standard ERR-02 ext F5: `<topic>.completed/.progress/.failed` + `worker.error` (BrokerError `category: 'worker'`)
- Pipeline §28 step 9 dispatch worker (lasciato spazio in F3 D-77)
- Test TDD RED→GREEN co-located (D-88/D-117) + coverage v8 ≥90% (D-92) + 3-tier (jsdom unit + msw integration + Playwright browser per Worker reali, D-118)

**Out of scope (deferred):**
- Worker pool autoscaling con strategia configurabile (REQUIREMENTS.md WK2-01, V2)
- IndexedDB-backed worker queue persistence (V2)
- Service Worker / Push notification bridge (RT2-01, V2)
- Cross-tab worker sharing (`SharedWorker`) — deferred V1.x
- Custom RPC alternative to Comlink — astrazione `WorkerBridge` interna prepara lo swap, ma V1 = solo Comlink
- `superjson` adapter — pluggable opt-in deferred V1.x quando emerga il caso d'uso fuori SCA
- Auto-detect transferable heuristic — V1 = JSONPath dichiarato esplicito
- Worker module HMR per dev mode — bundler-specific, non vincolo GlueZero

</domain>

<decisions>
## Implementation Decisions

### A. Topology & composition wrapper

- **D-121:** **Composition wrapper pattern (estensione D-83 strict / D-101)** — F5 introduce `WorkerBroker` che compone `RouterBroker` di F3 (NON modifica runtime a F1/F2/F3/F4). F5 vive SOLO in `packages/worker/src/` + `packages/worker/src/augment.ts` (declaration merging tipi). F4 e F5 sono **ortogonali**: l'utente sceglie un solo entry point (`createRealtimeBroker` o `createWorkerBroker`) oppure compone esplicitamente `createWorkerBroker(createRealtimeBroker(config))` — l'ordine compositivo non rompe contratti perché entrambi delegano `publish/subscribe` a `inner` (RouterBroker base condivisa).

- **D-122:** **`createWorkerBroker(config)` factory pubblico** — `@gluezero/worker` espone `createWorkerBroker(config: WorkerBrokerConfig)` con Valibot `safeParse` (pattern F4 D-30 + 04-08 createRealtimeBroker). `WorkerBrokerConfig extends RouterBrokerConfig` con `workers?: WorkerConfig` aggiunto via declaration merging.

### B. Worker source contract

- **D-123:** **Factory `() => Worker` come canale unico** — `WorkerDescriptor.factory: () => Worker` (lazy invocation al primo dispatch). NIENTE supporto a `Worker` instance pre-costruita (lazy-init perso) né URL string (gestito dal consumer dentro la factory). Anti-singleton coerente con D-30. Pattern documentato: `factory: () => new Worker(new URL('./report.worker.ts', import.meta.url), { type: 'module' })`.

- **D-124:** **Tasks dichiarate esplicite (fail-fast pattern)** — `WorkerDescriptor.tasks: readonly string[]` obbligatorio. Validazione al `registerRoute({ type:'worker', task:'X' })`: se `'X'` non è in `tasks` → throw `BrokerError({ code:'worker.task.unknown', category:'config' })` al register, NON a runtime. DX migliore (typo tracciati al register, pattern coerente con cycle-detection F2 D-3 e validation F3 D-78).

- **D-125:** **Hybrid Comlink expose + dispatcher fallback utility** — Worker primary signature: `Comlink.expose({ taskName: async (input, signal, onProgress) => result })` (idiomatico Comlink 4.4.x, STACK.md). Helper opzionale `createTaskDispatcher({ tasks })` per consumer che preferiscono pattern uniforme `dispatch(taskName, args)`. Documentazione DOC-05 mostra entrambi gli approcci con scenario meteo F5 (es. parsing CSV pesante).

- **D-126:** **Top-level + PluginDescriptor.workers via declaration merging** — `broker.registerWorker(descriptor)` con `ownerId='system'` (use case "global utility worker") + `PluginDescriptor.workers?: WorkerDescriptor[]` auto-registrato al `registerPlugin` con `ownerId=pluginId` per cascade D-26 ext F5. Coerente con `routes` F3 D-94 e `realtimeChannels` F4 D-103.

### C. Pool strategy

- **D-127:** **Pool bounded di default `min(navigator.hardwareConcurrency, 4)`** — Default V1: `mode: 'pool'` con `size = min(hardwareConcurrency, 4)`. Throughput migliore out-of-the-box, allineato STACK.md. Override `mode: 'dedicated'` per worker stateful (es. mantengono cache interna) o `mode: 'pool', size: N` per dimensione custom.

- **D-128:** **Cap hard 8 + opt-in `allowUnboundedPool`** — Anche se `hardwareConcurrency=16`, default cap a 8. Oltre 8 richiede `mode: 'pool', size: N, allowUnboundedPool: true` con `console.warn` in dev mode (Pitfall 7.D protection contro storm). `unlimited` deprecato — sempre richiede valore numerico esplicito.

- **D-129:** **Lazy first dispatch lifecycle** — i worker del pool sono spawnati on-demand al primo task di quella `queue`: 1° task → spawn 1 worker; 2° task concorrente → spawn 2° worker; ... fino a `size`. Footprint zero se la route non viene mai attivata. NIENTE eager spawn al `registerWorker`. Coerente con D-30 anti-singleton.

- **D-130:** **F3 BackpressureStrategy riusata 1:1** — `WorkerRouteDescriptor.backpressure?: BackpressureStrategy` riusa il union F3 D-75 (`'queue-bounded' | 'drop' | 'throttle' | 'debounce' | 'latest-only' | 'merge'`). Default `queue-bounded` con `maxSize: 1000` (analogo D-115 F4). Eventi `priority: 'critical'` bypassano il limite (Pitfall 4.C / 7.D consistency). Coerente con pattern cross-fase.

### D. Cancellation semantics

- **D-131:** **Hybrid per mode: dedicated → terminate, pool → cooperative** — Su timeout/abort:
  - `mode: 'dedicated'` → `worker.terminate()` immediato (worker isolato, no impatto su altri task)
  - `mode: 'pool'` → invia `__cancel__` message via reserved topic; il worker honora cooperando (riceve `AbortSignal` proxied via Comlink dentro la task signature). Se non risponde entro `cancelGraceMs` (default 2000ms) → `terminate()` last resort + respawn nuovo worker per la slot.

- **D-132:** **AbortSignal proxied via Comlink** — la task signature lato worker è `async (input: TInput, signal: AbortSignal, onProgress?: ProgressCallback): Promise<TOutput>`. GlueZero wrappa: il bridge crea un `AbortController` lato main → invia `controller.signal` come proxy Comlink (Comlink 4.4.x supporta function/object proxy; `signal.aborted` letto via async getter, `addEventListener('abort')` proxied). Il dev del worker fa `signal.throwIfAborted()` nei punti di check naturali.

- **D-133:** **State machine atomico per `taskId` (Pitfall 2C closure)** — `Map<TaskId, TaskState>` con `TaskState = 'pending' | 'done' | 'timeout' | 'cancelled' | 'error'`. Transizioni esclusive: una volta `state ≠ 'pending'`, ogni successivo message dal worker viene **scartato silenziosamente** (logged in debug snapshot). Niente doppia pubblicazione `failed (timeout)` + `completed (late)`. State garantito da check-and-set atomico (single-threaded JS event loop = atomicità implicita).

- **D-134:** **`correlationId` end-to-end (Pitfall 2A consistency)** — Tutti gli eventi worker (`completed`, `progress`, `failed`, `worker.error`) propagano `BrokerEvent.correlationId` dal `<topic>.requested` originale. Subscriber può filtrare 'scarto risposte con correlationId che non è il mio ultimo'. Coerente con F1 CORE-05 + F3 contract.

### E. Progress events

- **D-135:** **Comlink callback proxy `onProgress(payload)`** — la task signature riceve un terzo argomento opzionale `onProgress: (payload: ProgressPayload) => void` proxied via Comlink. Il main thread riceve la chiamata e pubblica `<topic>.progress` come `BrokerEvent` canonico con `correlationId` propagato. Il worker non sa dell'envelope; pattern Comlink idiomatico; tipato.

- **D-136:** **Schema progress canonical `{ value, message?, partialResult? }`** — Schema canonico V1: `{ value: number /* 0..1 */, message?: string, partialResult?: unknown }`. Validato via Valibot a runtime; UI può mostrare progress bar + label + partial preview. Schema registrato come canonical nel `CanonicalRegistry` F2 (analogo `RealtimeFrameEnvelope` F4 D-106).

- **D-137:** **Throttling adapter-level con `progressThrottleMs` config** — `WorkerRouteDescriptor.progressThrottleMs?: number` (default 100ms). Il bridge raggruppa progress events nel main thread e pubblica solo l'ultimo entro la finestra (latest-only su `__progress__`). Worker può chiamare `onProgress` quanto vuole; il broker non viene floodato. NIENTE impatto su `.completed/.failed` che passano sempre.

- **D-138:** **Progress events passano per mapper canonical (D-114 carryover)** — Coerente con D-113/D-114 di F4 e PRD §28: ogni evento attraversa la pipeline. Il payload progress viene poi mappato verso il consumer (`canonical → local`) come ogni altro evento via `inputMap`. Niente bypass, niente eccezioni.

### F. Serialization & validation

- **D-139:** **`assertSerializable` dev-mode auto + opt-out (WK-07 closure)** — Default: `process.env.NODE_ENV !== 'production'` → attivo. Builds production → disattivato (zero overhead). Override via `BrokerConfig.workers.assertSerializable: 'always' | 'dev' | 'off'`. Coerente con principio PRD §34.1 ("debug mode disattivabile in produzione"). DX killer per il debug mantiene zero cost in prod.

- **D-140:** **Throw `BrokerError` PRE-postMessage su violation** — `assertSerializable(payload)` deep-walk ricorsivo: su `function`, DOM node, classi con prototype custom non-SCA → throw sincrono `BrokerError({ code: 'worker.serialization.failed', category: 'worker', details: { taskId, fieldPath: 'payload.options.transform', fieldType: 'function' } })` con path al campo colpevole. Il task NON viene dispatched (zero waste). Il route executor cattura, publica `<topic>.failed` + `worker.error`. Coerente con F1 ERR-01 + F3 OutcomeCollector.

- **D-141:** **Transferable opt-in via JSONPath-like array (WK-07 closure)** — `WorkerRouteDescriptor.transferable?: readonly string[]` con path stile `'payload.audioBuffer'` o `'payload.images[*].buffer'` (wildcard `[*]`). Il bridge estrae i transferable, chiama `port.postMessage(msg, transferList)`. Documenta esplicitamente in DOC-05: "i campi transferred non sono più accessibili dal main thread" (Pitfall 7.E warning).

- **D-142:** **Contratto serializzazione documentato (WK-07 closure PRD §39 #11)** — DOC-04 + DOC-05 esplicitano: structuredClone default supporta `Object | Array | Date | Map | Set | ArrayBuffer | TypedArray | RegExp | Blob | ImageData | ImageBitmap`. NON supportati: `function | DOM node | class with custom prototype`. Pattern raccomandato per funzioni: registrare via `registerTransform(name, fn)` in F2 (workspace-side), passare `transformId: string` al worker.

### G. Route worker policy inheritance

- **D-143:** **Subset rilevante delle RoutePolicies F3** — Route `worker` eredita: `timeout` (WK-06 obbligatorio), `concurrency: 'latest-only' | 'serial' | 'parallel'` (Pitfall 2.A), `backpressure: BackpressureStrategy` (D-75 carryover → D-130), `dedupe: { key }` (ROUTE-11 carryover via `dedupeKey` esplicito). NIENTE `retry` (worker error spesso deterministico, retry inutile salvo idempotency esplicita — deferred V1.x come opt-in `worker.retry: { mode: 'idempotent', maxAttempts: N }`), NIENTE `auth` (no scope per worker locale), NIENTE `circuitBreaker` (overhead non giustificato V1).

- **D-144:** **Default `concurrency: 'latest-only'`** — Allineato a F3 default per HTTP UI-driven (Pitfall 2.A). Nuova `<topic>.requested` aborta task pending precedente (signal proxied → task cooperative cancel). Override esplicito a `'serial'` per task batch (es. report generation queue) o `'parallel'` per task indipendenti idempotent.

- **D-145:** **Default `timeout: 30_000ms`** — Allineato al cap reconnection F4 (D-109 30s) e al pattern "non infinite by default" di F3 D-69. Override per route via `timeout: N`. `timeout: Infinity` opt-in per long-running task batch (con `console.warn` in dev mode).

- **D-146:** **Topic naming hybrid auto-derive + override esplicito** — Default: da `on:'report.generation.requested'` deriva auto `publishes.success='report.generation.completed'`, `publishes.error='report.generation.failed'`, `publishes.progress='report.generation.progress'` (PRD §12.2 naming convention). Override opzionale: il consumer può sovrascrivere singoli campi (`publishes: { error: 'report.custom.error' }`). Coerente con F3 route `http` (D-79).

### H. Worker module loading

- **D-147:** **ESM `{ type: 'module' }` default + classic opt-in** — Default V1: `WorkerDescriptor.workerType: 'module' | 'classic'` con default `'module'` (PRD §31.3 evergreen + STACK.md ESM-only). Classic opt-in via `workerType: 'classic'` per consumer con bundler vintage che non supportano module workers (rare ma esistenti — es. legacy webpack 4 senza plugin). Documenta esplicitamente in DOC-05 il trade-off (classic = no ESM imports nel worker).

- **D-148:** **Pattern bundler-friendly `new URL(..., import.meta.url)`** — DOC-05 documenta il pattern Vite/esbuild/tsup standard: `factory: () => new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })`. Il bundler riconosce e bundla il worker come asset separato. NIENTE helper GlueZero `workerFromUrl` — pattern minimale, ecosystem-aligned, zero magia.

### I. Test strategy F5

- **D-149:** **Pattern TDD RED→GREEN co-located** (analogo D-88 F3 / D-117 F4) — ogni modulo (`worker-registry.ts`, `worker-pool.ts`, `worker-bridge.ts`, `task-tracker.ts`, `assert-serializable.ts`, `worker-broker.ts`, `worker-handler.ts`) ha unit test co-locato. Plan paralleli con file ownership disgiunta (analogo F3/F4 wave-based). Coverage v8 ≥ 90% sui file `@gluezero/worker/src/` (riuso D-92 F3 setup, D-117 F4 setup).

- **D-150:** **Tre livelli di test (riuso D-118 F4)** — coerente con STACK.md:
  - **Node + Vitest jsdom**: unit logic (state machine, assertSerializable deep-walk, JSONPath transferable extractor, throttle calc)
  - **MSW non applicabile**: i worker sono in-process, no HTTP. Mock `Worker` via `MockWorker` test util (analogo `MockEventSource` F4 D-105).
  - **`@vitest/browser` + Playwright**: browser reale per `Worker` reali con `structuredClone`, `MessageChannel`, transferable round-trip (TEST-02 plugin → broker → worker → broker → plugin; TEST-03 worker timeout reale; SC-1 scenario).

- **D-151:** **Test scenari obbligatori (TEST-01/02/03 subset F5):**
  - Worker dedicated: `<topic>.requested` → mapper canonical → dispatch → success → `<topic>.completed` con `correlationId` propagato
  - Worker pool: 4 task concorrenti su `pool size=2` → 2 spawn + 2 in queue → tutti completano FIFO
  - Timeout: task lento > 30s → `<topic>.failed (timeout)` + state=`timeout` → response post-timeout scartata silenziosamente (Pitfall 2C)
  - Cancellation cooperative pool: `<topic>.requested` 2x con `latest-only` → primo task riceve `signal.aborted=true`, abortisce cooperativamente, ritorna `cancelled` → solo 2° pubblica `completed`
  - Cancellation hard dedicated: `<topic>.requested` con `mode: 'dedicated'` + cancel → `worker.terminate()` invocato + `<topic>.failed (cancelled)`
  - Serialization fail dev mode: `payload.transform: () => x*2` → throw `worker.serialization.failed` con `fieldPath` + NO postMessage chiamato
  - Transferable: `payload.audioBuffer: ArrayBuffer` con `transferable: ['payload.audioBuffer']` → post-transfer `payload.audioBuffer.byteLength === 0` (Pitfall 7.E verificato)
  - Cascade cleanup: 5 plugin con `workers: [...]` → `unregisterPlugin(pluginId)` → solo i suoi workers terminate + queue dei task pending svuotata (LIFE-02 ext F5)
  - Backpressure storm: 10K task/sec → `queue-bounded` drop policy applicata → `priority: 'critical'` passa sempre (consistency D-130)
  - Progress: worker con `onProgress({ value: 0.5 })` chiamato 100x in 100ms con `progressThrottleMs: 100` → `<topic>.progress` pubblicato 1-2 volte (latest-only window)

### J. Pipeline §28 integration

- **D-152:** **Step 9 dispatch worker (placeholder F3 D-77)** — `RouteExecutor.dispatchWorker(routeId, eventCanonical, options)` extends F3 dispatch table. Il `WorkerRouteHandler` riceve evento canonico (step 5-6 already done dal mapper F2), invoca `bridge.dispatch(workerId, taskName, payloadCanonical, signal, onProgress)`, attende `WorkerResult`, costruisce `OutcomeCollector` step 10 outcome (analogo F3 D-78/D-80). Niente bypass, niente short-circuit. Coerente con D-113 di F4.

- **D-153:** **Mapping canonical → output strict** — Il `WorkerResult.payload` (canonico) viene poi mappato verso ogni consumer via `inputMap` (step 11 §28). Coerente con D-114 di F4. Validation post-mapping (step 12) applicata identica (D-116 carryover). Niente schema speciale per worker output: il canonical schema del topic `<entity>.<action>.completed` lo definisce (PRD §11).

### K. Final gate F5

- **D-154:** **Final gate F5 simile a 01-11 / 02-12 / 03-14 / 04-09** — un plan dedicato chiude la fase con: lint biome, typecheck tsc --noEmit, build tsup ESM-only, test 3-tier, coverage ≥90% v8, REQ matrix verifica WK-01..WK-07 → Complete, smoke-test cross-package (`createWorkerBroker` + `createRouterBroker` + `createMapperBroker` compongono), DOC-05 esteso con sezione Worker + scenario CSV parsing pesante + serialization contract + transferable patterns + scenario meteo F5 cross-feature.

### Claude's Discretion

- Naming interno dei file (`worker-pool.ts` vs `pool.ts`, `task-tracker.ts` vs `state-machine.ts`) lasciato al planner — convenzione coerente con F3 (`http-gateway.ts`, `retry-strategy.ts`, ecc.) e F4 (`sse-adapter.ts`, `realtime-channel-manager.ts`).
- Default thresholds (`pool.size: min(hwc,4)`, `pool.cap: 8`, `cancelGraceMs: 2000`, `progressThrottleMs: 100`, `timeout: 30000`, `dedupeWindow: implicit`): lockati come default ragionevoli; tutti override-abili via `WorkerDescriptor`/`WorkerRouteDescriptor` config. Researcher può proporre tweak basati su benchmark in F5 RESEARCH.md.
- Internal topics `__cancel__` / `__progress__` filtrati: se collisione con topic utente reale, il planner può proporre namespace alternativo (es. `$$worker.cancel`/`$$worker.progress`) — attualmente inscaped tramite `__` prefix coerente con F4 D-111 `__ping__`/`__pong__`.
- Errori serializzazione: scelta `BrokerError code 'worker.serialization.failed'` lockata; sub-codes per categoria (`'.function'`, `'.dom-node'`, `'.custom-class'`) lasciati al planner se utile per DX dei messaggi error.
- Error categorization: `category: 'worker'` per tutti gli errori dell'adapter (timeout, serialization, cancel, dispatch). Eccezione: `category: 'config'` per errori al register (`worker.task.unknown`, `worker.id.duplicate`). Coerente con F3 mapping (`category: 'network'` per HTTP, `'config'` per registration).
- Comlink version exact: `4.4.x` come da STACK.md. Researcher verifica `npm view comlink version` e propone tweak se 4.5+ ha breaking minor.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PRD (fonte autoritativa)
- `prd.md` §10 — sotto-sistema "Worker Runtime" PRD §10.5
- `prd.md` §11.1 — `correlationId` first-class del BrokerEvent (D-134)
- `prd.md` §12.2 — naming convention `<entity>.<action>.<status>` (D-146 auto-derive)
- `prd.md` §15.5 — Lifecycle hooks plugin (D-126 PluginDescriptor.workers cascade)
- `prd.md` §16.2 — API pubblica `registerWorker`/`unregisterWorker` (D-126)
- `prd.md` §17.2, §17.5 — Route `worker` policy (D-143, D-144, D-145)
- `prd.md` §19.1-19.6 — **Worker runtime requisiti minimi** (PRD §19 main authority — registry, pool, task correlation, error propagation, timeout, cancellation, limitations)
- `prd.md` §22.3 — Eventi standard `worker.error` (D-140)
- `prd.md` §22.4 — `BrokerError` con `category: 'worker'` (D-140)
- `prd.md` §23.5 — Cancellazione semantica (D-131, D-132)
- `prd.md` §28 — **Pipeline 14 step** (D-152 step 9 worker dispatch)
- `prd.md` §31.3 — Vincolo browser evergreen (D-147 ESM module workers default)
- `prd.md` §34.1 — Debug mode disattivabile in produzione (D-139 assertSerializable opt-out)
- `prd.md` §35.1-35.3 — Test obbligatori unit/integration/robustness (D-150, D-151)
- `prd.md` §39 #11 — **Open issue WK-07 closure** (serializzazione messaggi worker, structuredClone + transferable + assertSerializable, D-139..D-142)
- `prd.md` §42 — Checklist finale (success criteria fase)

### Roadmap & requirements
- `.planning/ROADMAP.md` — Phase 5 success criteria 1-5 (definitive lock per goal)
- `.planning/REQUIREMENTS.md` — **WK-01..WK-07** (sezione Worker Runtime Fase 5) + ERR-02 ext (`worker.error`) + TEST-01/02/03 subset F5
- `.planning/REQUIREMENTS.md` — WK2-01 (V2 deferred, autoscaling)

### Decisioni fasi precedenti (riusate)
- `.planning/phases/04-realtime-inbound-sse-prioritario-ws-opzionale/04-CONTEXT.md`:
  - **D-101** — Composition wrapper pattern (esteso a F5 → D-121)
  - **D-112** — Cascade cleanup `unregisterPlugin` (esteso a workers → ext F5 in D-126)
  - **D-114** — Mapper server→canonical riusato (esteso a worker pre-dispatch → D-153)
  - **D-115** — BackpressureStrategy riusata (esteso a worker pool → D-130)
  - **D-116** — Validation post-mapping invariata (riusato → D-153)
  - **D-117/D-118** — TDD RED→GREEN + 3-tier test pattern (riusato → D-149, D-150)
- `.planning/phases/03-routing-server-gateway-http/03-CONTEXT.md`:
  - **D-83** — Composition wrapper STRICT (carryover hard, F5 vive solo in `packages/worker/src/` — D-121)
  - **D-69** — Default 30s timeout pattern (riusato → D-145)
  - **D-75** — `BackpressureStrategy` (riusata → D-130)
  - **D-77** — `RouteExecutor.dispatchByType` placeholder worker (concretizzato → D-152)
  - **D-78/D-80** — OutcomeCollector + `<topic>.failed` shape (riusato → D-152)
  - **D-86** — Cascade cleanup `unregisterByOwner` (esteso a workers → D-126)
  - **D-88** — TDD RED→GREEN pattern (riusato → D-149)
  - **D-92** — Coverage v8 ≥ 90% (riusato → D-149)
  - **D-94** — Declaration merging pattern `augment.ts` (riusato → D-126)
- `.planning/phases/02-canonical-model-mapper/02-CONTEXT.md`:
  - **D-44** — `onFailure: 'block' | 'skip' | 'fallback'` (riusato per validation fail → D-153)
  - **D-49** — Composition wrapper Mapper (precedente di D-83/D-101/D-121)
  - **D-57** — PluginDescriptor extension via declaration merging (precedente di D-94/D-103/D-126)
- `.planning/phases/01-core-essenziale/01-CONTEXT.md`:
  - **D-25** — Lifecycle plugin auto-mount (cascade trigger D-126)
  - **D-26** — Cascade cleanup base (esteso → D-126 ext F5)
  - **D-30** — No singleton (D-122, D-129)

### Stack & research già consolidati
- `.planning/research/STACK.md` §6 — **Comlink 4.4.x + WorkerBridge abstraction** (D-122, D-125, D-132, D-135)
- `.planning/research/STACK.md` §8 — **structuredClone nativo + transferable opt-in** (D-141, D-142)
- `.planning/research/SUMMARY.md` — V1 stack confirm Phase 5 + tabella open issues §39 #11
- `.planning/research/PITFALLS.md` #2 — Race condition timeout vs success (D-133 state machine)
- `.planning/research/PITFALLS.md` #4 — Backpressure priority bypass (D-130 critical pass)
- `.planning/research/PITFALLS.md` #7 — **Worker pitfalls (serialization + ownership + pool size + transferable)** (D-127 pool bounded, D-128 cap, D-131 cancellation, D-139-D-142 serialization)
- `.planning/research/ARCHITECTURE.md` §6 — Worker Runtime placement nei sotto-sistemi
- `.planning/research/ARCHITECTURE.md` §13 — Phase ordering rationale F5 ortogonale F4

### Plan precedenti (codebase scaffolding già in place)
- `packages/worker/package.json` — placeholder F1 da popolare in F5 (deps: comlink, @gluezero/core, @gluezero/mapper, @gluezero/routing, @gluezero/gateway opzionale)
- `packages/worker/src/` — vuota (da popolare in F5)
- `packages/core/src/types/plugin.ts` — placeholder per `// F5 will add: workers` (analogo a placeholder F4 realtimeChannels già rimosso)
- `packages/core/src/types/broker-event.ts` — `BrokerEvent.source.type` accetta già `'worker'` (PRD §11.1 union)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`AbortController` cascade pattern** (`packages/core/src/types/plugin.ts` PluginContext.signal): F5 propaga `signal` ai worker handler per cascade cleanup (D-26 ext F5)
- **`BrokerError` con `category: 'worker'`** (`packages/core/src/types/error.ts`): F5 riusa per errori timeout/serialization/cancel (D-140); `category: 'config'` per errori register (D-124)
- **`BackpressureStrategy` union type** (definita in F3, `packages/gateway/src/http/strategies/backpressure-strategy.ts`): F5 riusa identico per `WorkerRouteDescriptor.backpressure` (D-130)
- **`MapperEngine.mapToCanonical(raw, schemaId)`** (`packages/mapper/src/mapper-engine.ts`): F5 chiama pre-dispatch (PRD §19.4 step 3 + D-114 carryover → D-153)
- **`createRouterBroker(config)`** (`packages/routing/src/router-broker.ts`): F5 base per `createWorkerBroker(config)` composition wrapper (D-83 → D-121, D-122)
- **`CanonicalRegistry` bind via getter** (F3 D-100): F5 riusa identico per topic→schemaId resolution se needed per validation
- **`RouteExecutor.dispatchByType` dispatch table** (F3 routing): F5 aggiunge handler `worker` (D-152)
- **`OutcomeCollector` + `<topic>.failed` shape** (F3 03-07): F5 riusa pattern publish (D-78/D-80 carryover)
- **`unsubscribeByOwner` cascade pattern** (F1 LIFE-02 → F3 D-86 → F4 D-112): F5 estende a workers + queue dei task pending (D-126)

### Established Patterns
- **Declaration merging via `augment.ts`** (`packages/routing/src/augment.ts`, `packages/gateway/src/augment.ts`, `packages/gateway/src/sse-ws/augment.ts`): F5 crea `packages/worker/src/augment.ts` per estendere `BrokerConfig.workers`, `PluginDescriptor.workers`, `RouteDefinition` (placeholder F1 → concretizzato F5)
- **Composition wrapper factory chain** (`createMapperBroker → createRouterBroker → createRealtimeBroker / createWorkerBroker`): F5 segue catena ortogonale a F4
- **TDD RED→GREEN co-located test** (`*.test.ts` accanto a `*.ts`): F5 mantiene
- **Wave-based plan parallelization con file ownership disgiunta** (F3 14 wave, F4 9 wave): F5 simile (5-7 plan stimati)
- **3-tier test (Tier-1 jsdom + Tier-2 mock util + Tier-3 Playwright)** (F4 D-118): F5 riusa con `MockWorker` test util al posto di `MockEventSource`/`MockWebSocket`
- **State machine atomico per task lookup** (analog F3 dedupe-strategy KeyBased Promise singleton D-74): F5 estende a `Map<TaskId, TaskState>` (D-133)
- **Reserved internal topics `__X__` filtrati** (F4 D-111 `__ping__`/`__pong__`): F5 riusa per `__cancel__` / `__progress__` (D-131, D-135, D-137)
- **JSONPath-like extraction** (F2 `$derive` pattern): F5 estende per `transferable` array (D-141)

### Integration Points
- **`Broker.publish(event)` API**: punto di ingresso per eventi worker `<topic>.completed/.progress/.failed` (D-152), unchanged dal contratto F1
- **`PluginRegistration.workers` field**: nuovo membro nella struttura interna del plugin registry (extension D-126)
- **`createWorkerBroker(config)`**: nuovo factory pubblico in `@gluezero/worker` che compone `createRouterBroker` (D-122)
- **`WorkerRegistry` lifecycle**: registra workers al `registerWorker` (lazy spawn al first dispatch D-129), deregistra al `unregisterWorker`/`unregisterPlugin` cascade D-126
- **`BrokerEvent.source` con `type: 'worker'`**: già supportato da F1 type, popolato da F5 worker handler con `source: { type: 'worker', id: 'workerId', name: 'taskName' }`
- **Pipeline §28 step 9**: `RouteExecutor.dispatchWorker` aggiunto al dispatch table di F3 (D-152)
- **`gateway/src/http/circuit-breaker.ts` pattern**: NON riusato (D-143 niente circuitBreaker per worker V1) — ma utility `createPerRouteCircuitBreaker` resta disponibile se V1.x lo richiederà

</code_context>

<specifics>
## Specific Ideas

- **Hybrid Comlink + dispatcher utility** (D-125): l'utente vuole offrire DUE pattern paralleli — il primario Comlink expose (idiomatico STACK) + un helper `createTaskDispatcher({ tasks })` per consumer che preferiscono uniformità. DOC-05 mostrerà entrambi nello scenario meteo F5 (CSV parsing pesante o report generation).
- **Worker classic opt-in** (D-147): l'utente ha esplicitamente scelto di supportare anche `workerType: 'classic'` come opt-in (non in default). Researcher dovrà documentare in DOC-05 il caso d'uso (legacy webpack 4 senza module-worker plugin) + le limitazioni (no `import` ESM nel worker classic).
- **State machine atomico Pitfall 2C strict** (D-133): l'utente vuole "ignora response post-timeout" come default (NO `system.warn` audit, NO doppia pubblicazione con metadata). Researcher può comunque aggiungere logging in debug snapshot (`broker.getDebugSnapshot().workerLateResponses` counter) per audit retroattivo senza impatto sui subscriber.
- **Tasks dichiarate esplicite fail-fast** (D-124): tipico anti-typo gate, coerente con cycle-detection F2 e config validation F3. Researcher può proporre helper TS type `WorkerTasks<T>` che ricava le keys da `Comlink.expose<T>` automaticamente (TS inference + AssertEqual pattern).

</specifics>

<deferred>
## Deferred Ideas

- **Worker pool autoscaling con strategia configurabile** (REQUIREMENTS.md WK2-01): V2. Default V1 = bounded `min(hwc, 4)` cap 8 (D-127, D-128). Re-evaluation in V1.x se profiling mostra utilizzo CPU sub-ottimale.
- **Custom RPC alternative to Comlink**: V1.x se Comlink mostra friction in transferable complessi o cancellazione. `WorkerBridge` astrazione interna (D-122) prepara lo swap a costo zero per i consumer.
- **`superjson` adapter pluggable** (STACK.md alternativa): V1.x quando emerga il caso d'uso fuori SCA (Date/Map/Set/BigInt). API: `WorkerConfig.serializer?: SerializerAdapter` con default structuredClone implicit.
- **`SharedWorker` cross-tab support**: V2. Use case raro, complica lifecycle e cleanup.
- **Worker retry policy idempotent**: V1.x come opt-in `worker.retry: { mode: 'idempotent', maxAttempts: N }`. Default V1 = no retry (D-143). Aggiungere retry richiede contratto idempotency esplicito (rischia Pitfall 2A se mal usato).
- **Auto-detect transferable heuristic**: V1.x. Default V1 = JSONPath dichiarato esplicito (D-141). Auto-detect potrebbe causare sorprese (Pitfall 7.E ownership unexpected).
- **Worker module HMR per dev mode**: bundler-specific (Vite/webpack), non vincolo GlueZero. Documentazione in DOC-05 punta al bundler docs.
- **Service Worker / Push notification bridge** (RT2-01): V2 per use case oltre la vita della pagina (PRD §18.7).
- **Worker telemetry hooks per F6**: F6 introdurrà `WorkerInspector` analogo a `EventInspector`/`MappingInspector`/`RouteInspector`. F5 pre-instrumenta le hook tap (`tap.onPipelineStep('worker.dispatched', snapshot)`, `'worker.completed'`, `'worker.failed'`) coerente con CORE-13 / EventTap pre-instrumentation pattern.

</deferred>

---

*Phase: 05-worker-runtime*
*Context gathered: 2026-05-04*
