---
phase: 05-worker-runtime
researched: 2026-05-04
domain: Worker Runtime — registry + pool bounded, Comlink RPC typed, AbortSignal-first cancellation, state machine atomico timeout vs success, structuredClone contract con transferable opt-in JSONPath, route worker integrata in F3 RouteExecutor via composition wrapper
researcher: gsd-researcher (claude-opus-4-7-1)
confidence_overall: HIGH (decisioni utente lockate D-121..D-154; pattern F3/F4 consolidati; Comlink API stabile dal 2019; structuredClone WHATWG spec ben definita; assenza di scoperte arbitrarie post-CONTEXT)
sources_scanned:
  - prd.md §10, §11.1, §12.2, §15.5, §16.2, §17.2, §17.5, §18.6, §19.1-19.6, §22.3, §22.4, §23.5, §24, §28, §31.3, §34.1, §35, §39 #11, §42
  - .planning/phases/05-worker-runtime/05-CONTEXT.md (D-121..D-154 — 34 decisioni lockate)
  - .planning/phases/04-realtime-inbound-sse-prioritario-ws-opzionale/04-CONTEXT.md (D-101 composition + D-112 cascade + D-114 mapper + D-115 backpressure + D-116 validation + D-117/118 TDD/3-tier)
  - .planning/phases/03-routing-server-gateway-http/03-CONTEXT.md (D-83 strict + D-69 timeout + D-75 backpressure + D-77 placeholder worker + D-78/80 OutcomeCollector + D-86 cascade + D-88 TDD + D-92 coverage + D-94 augment.ts)
  - .planning/phases/02-canonical-model-mapper/02-CONTEXT.md (D-44 onFailure + D-49 composition Mapper + D-57 PluginDescriptor extension)
  - .planning/phases/01-core-essenziale/01-CONTEXT.md (D-25/26 cascade + D-30 no singleton)
  - .planning/research/STACK.md §6 (Comlink 4.4.x), §8 (structuredClone), §9 (test 3-tier)
  - .planning/research/PITFALLS.md #2 (race timeout/success), #4 (backpressure priority bypass), #7 (worker pitfalls)
  - .planning/research/ARCHITECTURE.md §6 (Worker placement), §13 (phase ordering F5 ortogonale F4)
  - .planning/research/SUMMARY.md (V1 stack confirm + tabella §39 #11)
  - .planning/REQUIREMENTS.md (WK-01..WK-07 + ERR-02 ext + TEST-01/02/03 subset F5)
  - .planning/ROADMAP.md (Phase 5 success criteria 1-5 + dependency graph parallelism F5∥F4)
  - packages/routing/src/route-executor.ts (dispatch table — placeholder D-77 worker)
  - packages/routing/src/types/{route-definition.ts,route-policies.ts} (RouteDefinition union extension target)
  - packages/routing/src/router-broker-wrapper.ts (composition wrapper pattern F3 — base per F5)
  - packages/gateway/src/sse-ws/realtime-broker.ts (composition wrapper F4 — modello F5)
  - packages/gateway/src/sse-ws/realtime-channel-manager.ts (registry N-channel + cascade — modello WorkerRegistry)
  - packages/gateway/src/sse-ws/test-utils/{mock-event-source.ts,mock-websocket.ts,realtime-harness.ts} (pattern test-utils per F5)
  - packages/worker/{package.json,README.md} (placeholder F1 — da popolare in F5)
  - npm registry (versioni live verificate 2026-05-04)
versions_verified:
  - comlink@4.4.2 (registry, 2024-11-07)
  - nanoid@5.1.11 (registry, riuso F1)
  - valibot@1.3.1 (registry, riuso F2)
  - vitest@4.1.5 + jsdom@29.1.0 (riuso F1-F4)
  - "@vitest/browser"@4.1.5 + playwright@1.59.1 (riuso F4)
---

# Phase 5: Worker Runtime — Research

**Researched:** 2026-05-04
**Domain:** Worker Runtime — registry + pool bounded, Comlink RPC typed, AbortSignal-first cancellation, state machine atomico, contratto serializzazione, integration in F3 dispatch table
**Confidence overall:** HIGH

> Lingua: italiano per testo descrittivo; inglese per identificatori, codice, nomi librerie/file/comandi/tipi (vincolo CLAUDE.md).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-121..D-154 — 34 decisioni)

#### A. Topology & composition wrapper

- **D-121:** Composition wrapper pattern — `WorkerBroker` compone `RouterBroker` di F3 (D-83 strict carryover). F5 vive SOLO in `packages/worker/src/` + `packages/worker/src/augment.ts`. F4 e F5 ortogonali — utente sceglie un solo entry point (`createRealtimeBroker` o `createWorkerBroker`) oppure compone esplicitamente `createWorkerBroker(createRealtimeBroker(config))`.
- **D-122:** `createWorkerBroker(config: WorkerBrokerConfig)` factory pubblico via Valibot `safeParse` (pattern F4 D-30). `WorkerBrokerConfig extends RouterBrokerConfig` con `workers?: WorkerConfig` aggiunto via declaration merging.

#### B. Worker source contract

- **D-123:** Factory `() => Worker` come canale unico (lazy invocation primo dispatch). NIENTE `Worker` instance pre-costruita né URL string.
- **D-124:** `WorkerDescriptor.tasks: readonly string[]` obbligatorio. Validazione fail-fast al `registerRoute({ type:'worker', task:'X' })`: se `'X'` non in `tasks` → throw `BrokerError({ code:'worker.task.unknown', category:'config' })` al register.
- **D-125:** Hybrid Comlink expose primary + helper `createTaskDispatcher({ tasks })` opt-in.
- **D-126:** Top-level `broker.registerWorker(descriptor)` (`ownerId='system'`) + `PluginDescriptor.workers?: WorkerDescriptor[]` declaration merging via `packages/worker/src/augment.ts` (cascade D-26 ext F5).

#### C. Pool strategy

- **D-127:** Pool bounded default `min(navigator.hardwareConcurrency, 4)`. Override `mode: 'dedicated'` o `mode: 'pool', size: N`.
- **D-128:** Cap hard 8 + opt-in `allowUnboundedPool: true` con `console.warn` dev mode. `unlimited` deprecato.
- **D-129:** Lazy first-dispatch lifecycle. NIENTE eager spawn.
- **D-130:** F3 `BackpressureStrategy` D-75 riusata 1:1. Default `queue-bounded` con `maxSize: 1000` (analogo D-115 F4). Eventi `priority: 'critical'` bypassano.

#### D. Cancellation semantics

- **D-131:** Hybrid: `mode: 'dedicated'` → `worker.terminate()`. `mode: 'pool'` → cooperative `__cancel__` + `cancelGraceMs=2000ms` + terminate fallback + respawn.
- **D-132:** AbortSignal proxied via Comlink. Task signature: `async (input, signal: AbortSignal, onProgress?) => result`.
- **D-133:** State machine atomico `Map<TaskId, TaskState>`. Stati: `'pending' | 'done' | 'timeout' | 'cancelled' | 'error'`. Transizioni esclusive — late response post-timeout scartata silenziosamente (Pitfall 2C closure).
- **D-134:** `correlationId` end-to-end (Pitfall 2A consistency).

#### E. Progress events

- **D-135:** Comlink callback proxy `onProgress(payload)` come terzo arg.
- **D-136:** Schema canonical `{ value: number /* 0..1 */, message?: string, partialResult?: unknown }`. Registrato come canonical schema F2 (analogo `RealtimeFrameEnvelope` F4 D-106).
- **D-137:** Throttling adapter-level `progressThrottleMs=100` default (latest-only window).
- **D-138:** Progress passa per mapper canonical (D-114 carryover) — niente bypass.

#### F. Serialization & validation

- **D-139:** `assertSerializable` dev-mode auto. Override via `BrokerConfig.workers.assertSerializable: 'always' | 'dev' | 'off'`.
- **D-140:** Throw `BrokerError({ code: 'worker.serialization.failed', category: 'worker' })` PRE-postMessage con `details.fieldPath`.
- **D-141:** Transferable opt-in via JSONPath-like array (`['payload.audioBuffer', 'payload.images[*].buffer']`).
- **D-142:** Contratto serializzazione documentato in DOC-04 + DOC-05 (chiusura PRD §39 #11 / WK-07).

#### G. Route worker policy inheritance

- **D-143:** Subset rilevante: `timeout` + `concurrency` + `backpressure` + `dedupe`. NIENTE retry/auth/circuitBreaker.
- **D-144:** Default `concurrency: 'latest-only'` (allineato F3 default).
- **D-145:** Default `timeout: 30_000ms` (allineato F4 D-109 / F3 D-69).
- **D-146:** Topic naming hybrid auto-derive `<topic>.completed/.progress/.failed` + override granulare via `publishes`.

#### H. Worker module loading

- **D-147:** ESM `{ type: 'module' }` default + classic opt-in via `workerType: 'classic'`.
- **D-148:** Pattern bundler-friendly: `factory: () => new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })`.

#### I. Test strategy F5

- **D-149:** TDD RED→GREEN co-located (D-88/D-117 carryover) + coverage v8 ≥90% (D-92).
- **D-150:** 3-tier riuso D-118 F4: jsdom unit + MockWorker test util + Playwright Chromium browser-real.
- **D-151:** 10 scenari obbligatori (worker dedicated, pool concorrenti, timeout strict, cooperative cancel pool, hard terminate dedicated, serialization fail, transferable byteLength=0, cascade cleanup, backpressure storm critical bypass, progress throttle).

#### J. Pipeline §28 integration

- **D-152:** Step 9 dispatch worker — concretizza F3 D-77 placeholder. `RouteExecutor.dispatchByType('worker', ...)` extends F3 dispatch table.
- **D-153:** Mapping canonical→output strict via `inputMap` step 11 (D-114 carryover). Validation post-mapping invariata (D-116 carryover).

#### K. Final gate

- **D-154:** Final gate F5 plan dedicato (analogo 04-09): lint biome + typecheck + build tsup ESM-only + test 3-tier + coverage v8 ≥90% + REQ matrix WK-01..WK-07 → Complete + smoke-test cross-package + DOC-05 esteso + chiusura PRD §39 #11.

### Claude's Discretion

- Naming interno file (`worker-pool.ts` vs `pool.ts`, `task-tracker.ts` vs `state-machine.ts`) — researcher propone convenzione coerente con F3 (`http-gateway.ts`, `retry-strategy.ts`) e F4 (`sse-adapter.ts`, `realtime-channel-manager.ts`).
- Default thresholds — lockati come default ragionevoli; tutti override-abili.
- Internal topics `__cancel__` / `__progress__` — researcher conferma `__` prefix coerente con F4 D-111 `__ping__`/`__pong__`.
- Sub-codes `worker.serialization.failed.{function|dom-node|custom-class}` — researcher propone in §6.
- Counter `workerLateResponses` in `getDebugSnapshot` — researcher propone per audit (Pitfall 2C).
- TS helper `WorkerTasks<T>` — researcher propone in §2.

### Deferred Ideas (OUT OF SCOPE V1)

- Worker pool autoscaling configurabile (WK2-01, V2)
- Custom RPC alternative to Comlink (V1.x se Comlink mostra friction)
- `superjson` adapter pluggable (V1.x)
- `SharedWorker` cross-tab support (V2)
- Worker retry policy idempotent (V1.x opt-in)
- Auto-detect transferable heuristic (V1.x)
- Worker module HMR dev mode (bundler-specific)
- Service Worker / Push notification bridge (RT2-01, V2)
- Worker telemetry hooks per F6 — F5 pre-instrumenta tap, F6 introdurrà `WorkerInspector`

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WK-01 | Worker Registry creazione/riuso pool *(PRD §19.3)* | §1 architettura, §3 pool strategy, §4 state machine task lookup |
| WK-02 | Tipo route `worker` *(PRD §17.2, §17.5)* | §7 pipeline integration step 9 + RouteDefinition union extension via augment.ts |
| WK-03 | Task correlation `correlationId` end-to-end *(PRD §19.3)* | §4 state machine + §5 cancellation pattern |
| WK-04 | Propagazione errori worker→broker *(PRD §19.3, §22.3)* | §1 architettura BrokerError category 'worker' + §6 serialization fail + §7 OutcomeCollector riuso |
| WK-05 | Eventi `<topic>.completed/.progress/.failed` *(PRD §12.2, §19.4)* | §1 + §5 progress + §7 publish via OutcomeCollector |
| WK-06 | Timeout + cancellazione *(PRD §19.3)* | §4 state machine atomico + §5 hybrid cancellation |
| WK-07 | Serializzazione documentata *(PRD §39 #11 closure)* | §6 contratto serializzazione + assertSerializable + transferable JSONPath |
| ERR-02 ext F5 | `worker.error` standard event | §1 + §6 BrokerError category 'worker' |
| TEST-01 subset F5 | Unit test worker subset | §9 test strategy 3-tier — Tier-1 jsdom |
| TEST-02 subset F5 | plugin → broker → worker → broker → plugin | §9 — Tier-3 Playwright (TEST-02 reale) |
| TEST-03 subset F5 | Worker timeout robustness | §9 — Tier-1 deterministic (state machine) + Tier-3 (worker reale) |

---

## Project Constraints (from CLAUDE.md)

Tutti i directive rilevanti per F5:

| Directive | Applicazione F5 |
|-----------|-----------------|
| **Modello opus per ogni sub-agent** | Spawn agenti GSD F5 con override esplicito `model: "opus"` (no sonnet/haiku anche per verifier/checker/synthesizer). Config `model_profile: "quality"` non sufficiente da solo. |
| **Lingua italiana** | RESEARCH.md, PLAN.md F5, JSDoc descrittivi, commit message, descrizioni REQ-ID, success criteria → italiano. Codice/identificatori/nomi librerie/file/log keyword/error code → inglese. |
| **Boundary di sicurezza** | F5 vive in `/Users/omarmarzio/programming/prova AI/SemBridge/packages/worker/` — area libera. Niente touch fuori boundary. |
| **Alta autonomia decisionale** | Tutti i 34 decisions sono lockate in CONTEXT.md → NON re-discutere. Procedi su default ragionevoli per Claude's Discretion. Chiedi solo per scope irreversibili (improbable in F5). |
| **D-83 strict carryover** | F5 NON tocca runtime di `packages/{core,mapper,routing}/src/` né `packages/gateway/src/{http,sse-ws}/`. F5 vive SOLO in `packages/worker/src/`. Verifica `git diff` exit-zero su quei path. |
| **Agent-swarm preferred** | Wave-based parallelization con file ownership disgiunta. Spawn multipli in singolo messaggio. |
| **TRACKER.md protocol** | Aggiornare TRACKER.md a fine ogni plan F5 con commit hash + path SUMMARY.md. |

---

## 1. Executive Summary

La Fase 5 introduce un singolo nuovo package runtime (`@sembridge/worker`) che ospita **6-7 moduli core + 1 augment + 1 composition wrapper + 1 final-gate** seguendo il pattern di composizione consolidato in F3 (D-83 strict) e F4 (D-101 ortogonale). Il `WorkerBroker` compone `RouterBroker` di F3 estendendo l'API pubblica con `registerWorker(descriptor)` / `unregisterWorker(id)` (PRD §16.2) e gestendo internamente un `WorkerRegistry` che indicizza N descriptor per `id`. La pipeline §28 step 9 (execute route) viene estesa via dispatch table extension — il placeholder `case 'worker'` lasciato in F3 (D-77) diventa una invocazione concreta di `bridge.dispatch(...)`.

**Stack lockato (no choice — già fissato in CONTEXT.md + STACK.md):**
- `comlink@4.4.2` (verificato registry 2026-05-04, released 2024-11-07) per RPC typed worker ↔ main thread
- `nanoid@5.1.11` per `taskId` generation (riuso F1)
- `valibot@1.3.1` per `WorkerBrokerConfig` validation + canonical schema progress (riuso F2)
- `vitest@4.1.5` + `jsdom@29.1.0` per Tier-1 unit deterministico + `@vitest/browser@4.1.5` + `playwright@1.59.1` per Tier-3 browser-real (riuso F4)

**Sei decisioni implementative non-banali (D-131, D-132, D-133, D-141, D-152, D-150) hanno conseguenze concrete che guidano la decomposition in plan:**

1. **D-131 cancellation hybrid** richiede due code path distinti per `mode: 'dedicated'` (terminate immediato) vs `mode: 'pool'` (cooperative + grace + terminate fallback + respawn). Questa diventa la responsabilità del modulo `worker-pool.ts` (gestione lifecycle pool slots) + `worker-bridge.ts` (Comlink wrapper con AbortSignal proxy).
2. **D-132 AbortSignal proxied via Comlink** richiede pattern non banale: il main thread crea un `AbortController`, il `signal` viene esposto al worker come Comlink proxy. Il worker deve fare `signal.throwIfAborted()` periodicamente (cooperative). Comlink 4.4.2 supporta proxy di oggetti con metodi async — la verifica chiave è che `signal.aborted` legga il valore real-time (read attraverso il proxy) e che `addEventListener('abort', cb)` propaghi correttamente. Pattern documentato in §2 e §5.
3. **D-133 state machine atomico** è critica per Pitfall 2C strict. Il `TaskTracker` mantiene `Map<TaskId, TaskState>` con check-and-set atomico (single-threaded JS event loop = atomicità implicita, niente lock primitivi necessari). Una volta `state ≠ 'pending'`, ogni successivo message dal worker viene **scartato silenziosamente** e contato in `getDebugSnapshot().workerLateResponses` (audit retroattivo senza impatto subscriber).
4. **D-141 transferable JSONPath-like** introduce un mini-extractor (~50-80 LOC) custom: zero dipendenze esterne. Pattern `'payload.audioBuffer'` (literal path) + `'payload.images[*].buffer'` (wildcard `[*]`). Researcher RIGETTA `jsonpath-plus` (4-6 KB) come over-engineering — F2 ha già pattern `$derive` similare risolvibile in casa.
5. **D-152 step 9 dispatch worker** richiede DUE cose: (a) augmentazione del `RouteDefinition` union via TS declaration merging (`RouteWorkerDefinition` aggiunta al `RouteDefinition` union senza modificare F3 — pattern non banale spiegato in §7), (b) iniezione di un `workerHandler` come `RouteExecutorDeps['workerHandler']` analogo a `httpHandler`. Il `RouterEngine` di F3 NON ha un setter per workerHandler — F5 introduce un sub-class `WorkerEngine` o una variante via composition wrapper (`WorkerBroker` istanzia un nuovo `RouterEngine` con `workerHandler` iniettato). Vedi §7.
6. **D-150 3-tier test** richiede `MockWorker` test util analogo a `MockEventSource`/`MockWebSocket` di F4 — un mock ESM-pura per Tier-1 jsdom (Worker API non disponibile in jsdom). Tier-3 Playwright esercita `Worker` reali via `new Worker(new URL('./...worker.ts', import.meta.url), { type: 'module' })`.

**Primary recommendation:** decomporre in **7 plan** wave-based (analogo F4 9 plan / F3 14 plan), file ownership disgiunta entro ogni wave per parallelizzazione. Un final-gate plan dedicato (05-07) chiude la fase con coverage v8 ≥90%, REQ matrix verifica, DOC-05 update sezione Worker, chiusura PRD §39 #11.

**Vincolo D-83 strict (carryover F3 → F5):** ZERO modifiche runtime a `packages/core/`, `packages/mapper/`, `packages/routing/`, `packages/gateway/`. Tutto F5 vive in `packages/worker/src/`. Il `packages/worker/src/augment.ts` chiude il placeholder commento `// F5 will add: workers` (analogo placeholder F4 in `core/types/plugin.ts:50` già consolidato) via TypeScript declaration merging (pattern F2 D-57, F3 D-94, F4 D-103 — già consolidato e testato 3 volte).

---

## 2. Stack & Library landscape

### 2.1 Stack lockato

| Capability | Library | Version | Status | Note |
|------------|---------|---------|--------|------|
| Worker RPC | `comlink` | **4.4.2** | LOCKED (D-125, STACK.md §6) | Verificato registry 2026-05-04 (release 2024-11-07). Bundle ~1.1 KB gzipped. API stabile dal 2019. Maintenance attiva (Google Chrome team). |
| ID generation | `nanoid` | 5.1.11 | LOCKED (riuso F1) | Per `taskId` generation. |
| Schema validation | `valibot` | 1.3.1 | LOCKED (riuso F2) | Per `WorkerBrokerConfig` safeParse + canonical schema progress `{value, message?, partialResult?}`. |
| Worker transport | `Worker` (browser nativo) | spec WHATWG HTML | LOCKED (PRD §31.3) | NO `workerize`/`greenlet`/`threads.js`. ESM `{type:'module'}` default (D-147). |
| Serialization | `structuredClone` (browser nativo, SCA) | spec WHATWG HTML | LOCKED (D-142) | Implicito via `postMessage`. NO `JSON.stringify`. NO `superjson` default (V1.x opt-in). |
| Composition base | `RouterBroker` di `@sembridge/routing` | workspace:* | LOCKED (D-121, D-83 strict) | F5 estende, NON modifica. |
| Mapper canonicalization | `MapperEngine` di `@sembridge/mapper` | workspace:* | LOCKED (D-153, D-114 carryover) | Riuso identico a F3/F4. |
| Test framework | `vitest` | 4.1.5 | LOCKED (riuso F1-F4) | Tier-1 jsdom + Tier-3 browser. |
| Browser-real test | `@vitest/browser` + `playwright` | 4.1.5 + 1.59.1 | LOCKED (D-150) | Per Worker reali (TEST-02/03). |

### 2.2 Alternative valutate e RIGETTATE (con citazione fonte)

| Alternativa | Perché rigettata | Riferimento |
|-------------|------------------|-------------|
| `greenlet` (npm) | Orientato a "single function in worker", non a API estese. Inadatto per worker con N task (PRD §19.6 cita parsing CSV, dedup massiva). | STACK.md §6 |
| `workerize` / `workerize-loader` | Non più mantenuti attivamente (legati a Webpack vintage). | STACK.md §6 |
| `threads.js` | Footprint ~5 KB, orientato Node+browser (overengineered per V1 browser-only SemBridge). | STACK.md §6 |
| Custom RPC su `postMessage` | ~150-200 LOC interno; valido come escape hatch V1.x se Comlink mostra friction. V1 LOCKED Comlink (D-125 + STACK.md). | STACK.md §6 |
| `jsonpath-plus` (npm, ~4-6 KB) | Over-engineering per D-141 wildcard subset (`[*]` solo). Researcher propone implementazione custom ~50-80 LOC zero-dep, allineata a `$derive` extractor di F2. | §6.4 sotto |
| `superjson` (npm, ~5 KB) | Default structuredClone copre Date/Map/Set/ArrayBuffer/RegExp/Blob/ImageData/ImageBitmap (D-142 contract). `superjson` opt-in V1.x se BigInt/custom class needed (deferred). | STACK.md §8 |
| `JSON.stringify` per worker payload | 5-10x più lento di SCA, perde Date/Map/Set, NO transferable. Pitfall 7.B esplicito: "NEVER usare JSON.stringify per worker payload". | PITFALLS.md #7.B |
| `SharedWorker` (V2) | Use case raro; complica lifecycle e cleanup multi-tab. Deferred. | 05-CONTEXT.md deferred |
| `Comlink.proxy(value)` per ogni payload | Proxy aggiunge overhead per oggetti grandi; default structuredClone via `postMessage` è più efficiente. `Comlink.proxy` riservato a `signal` e `onProgress` callback. | Comlink README sect. "Proxy values" |
| Worker pool con autoscaling configurabile (WK2-01) | Default V1 = bounded `min(hwc,4)` cap 8 (D-127, D-128). Re-evaluation V1.x se profiling mostra utilizzo CPU sub-ottimale. | REQUIREMENTS.md WK2-01 |

### 2.3 Cosa va INSTALLATO in F5

```bash
# Plan 05-01 (bootstrap @sembridge/worker package):
pnpm add comlink@^4.4.2 --filter @sembridge/worker
pnpm add @sembridge/core@workspace:* @sembridge/mapper@workspace:* @sembridge/routing@workspace:* --filter @sembridge/worker
pnpm add nanoid@^5.1.11 --filter @sembridge/worker  # per taskId
pnpm add valibot@^1.3.1 --filter @sembridge/worker  # per safeParse config + canonical schema progress

# Dev deps (riuso devDependencies workspace root):
# vitest@4.1.5, jsdom@29.1.0, @vitest/browser@4.1.5, playwright@1.59.1 — già installati F1-F4
```

**Verifica live (eseguita 2026-05-04):**
- `npm view comlink version` → `4.4.2` (release 2024-11-07, license Apache-2.0, types incluso)
- `npm view nanoid version` → `5.1.11` ✓ confermato
- `npm view valibot version` → `1.3.1` ✓ confermato

### 2.4 TS helper proposto: `WorkerTasks<T>` (Claude's Discretion)

Researcher propone (NON lockato in CONTEXT.md, ma utile per DX):

```ts
/**
 * Estrae i nomi delle task da un'API Comlink-exposed.
 *
 * @example
 * ```ts
 * // worker side
 * const api = {
 *   parseCsv: async (input, signal) => { ... },
 *   computeStats: async (input, signal, onProgress) => { ... },
 * }
 * Comlink.expose(api)
 *
 * // main side
 * type ReportApi = typeof api
 * type Tasks = WorkerTasks<ReportApi>  // 'parseCsv' | 'computeStats'
 *
 * const descriptor: WorkerDescriptor<ReportApi> = {
 *   id: 'report-worker',
 *   factory: () => new Worker(...),
 *   tasks: ['parseCsv', 'computeStats'] as const,  // type-checked vs Tasks via assertion helper
 * }
 * ```
 */
export type WorkerTasks<T> = {
  readonly [K in keyof T]: T[K] extends (...args: never[]) => unknown ? K : never
}[keyof T]
```

Permette assertion `WorkerTasks<API>[]` per evitare typo in `tasks: [...]`. Implementazione optional in plan 05-02 types.

---

## 3. Architettura Worker Runtime

### 3.1 Diagramma data flow `worker.requested → completed`

```
┌──────────┐      publish         ┌────────────────┐        delegate publish        ┌─────────────────┐
│ Plugin A │  (canonical input)   │  WorkerBroker  │ ──────────────────────────►   │   RouterBroker  │
└──────────┘ ───────────────────► │  (composition  │                                │   (F3 delegate) │
                                  │    wrapper)    │                                └────────┬────────┘
                                  └────────────────┘                                         │
                                                                                              │ pipeline §28
                                                                                              │ step 1-7 (F1+F2+F3-pre)
                                                                                              ▼
                                                                                  ┌──────────────────────┐
                                                                                  │  RouteResolver       │
                                                                                  │  (F3 dispatch table) │
                                                                                  └──────────┬───────────┘
                                                                                             │ matched: type='worker'
                                                                                             ▼
                                                                            ┌────────────────────────────────┐
                                                                            │  RouteExecutor.dispatchByType  │
                                                                            │  (F3 — NEW case 'worker')      │
                                                                            └──────────┬─────────────────────┘
                                                                                       │ workerHandler(event, route, signal)
                                                                                       ▼
              ┌────────────────────────────────────────────────────────────────────────────────────────┐
              │              @sembridge/worker — runtime F5 (D-83 strict, only here)                  │
              │ ┌──────────────────┐    register/get     ┌────────────────────┐                       │
              │ │ WorkerRegistry   │ ◄──────────────────│  WorkerHandler     │ ◄─ injected via       │
              │ │ Map<id, desc>    │                     │  (Strategy F3)     │    workerHandler dep  │
              │ └────────┬─────────┘                     └─────────┬──────────┘                       │
              │          │ desc + opts                             │ dispatch(taskName, payload, ...) │
              │          ▼                                          ▼                                  │
              │ ┌──────────────────┐                     ┌────────────────────┐                       │
              │ │ WorkerPool       │                     │  WorkerBridge      │                       │
              │ │ (lazy spawn,     │ ◄──acquireSlot ─── │  (Comlink wrap)    │                       │
              │ │  bounded, queue) │                     │  AbortSignal proxy │                       │
              │ └────────┬─────────┘                     └─────────┬──────────┘                       │
              │          │ slot ready                              │ proxy.taskName(input,sig,onProg) │
              │          │                                          ▼                                  │
              │ ┌──────────────────┐                     ┌────────────────────┐                       │
              │ │ TaskTracker      │ ◄──register task ── │   AssertSerial.    │ ◄─ payload validation │
              │ │ Map<TaskId,State>│                     │   (dev mode auto)  │                       │
              │ │ atomic set state │                     └─────────┬──────────┘                       │
              │ └────────┬─────────┘                               │ pass / throw fieldPath            │
              │          │                                          ▼                                  │
              │          │              ┌──────────────────────────────────┐                          │
              │          │              │  TransferableExtractor           │                          │
              │          │              │  (JSONPath-like wildcard)        │                          │
              │          │              └────────────┬─────────────────────┘                          │
              │          │                            │ payload + transferList                          │
              │          │                            ▼                                                  │
              └──────────┼─────────────────────────────────────────────────────────────────────────────┘
                         │                            │ via Comlink RPC + structuredClone (postMessage)
                         │                            ▼
                         │             ┌─────────────────────────────────────┐
                         │             │  Worker Thread (consumer authored)  │
                         │             │  Comlink.expose({ taskName: ... })  │
                         │             │  signal.throwIfAborted() periodic   │
                         │             │  onProgress({value, ...}) periodic  │
                         │             └────────────┬────────────────────────┘
                         │                          │
                         │                          ▼ resolve(result) via Comlink
                         │  TaskTracker.markDone(taskId, result)  /  markError  /  markTimeout / markCancelled
                         │  (atomic CAS — Map<TaskId, TaskState> single-threaded JS)
                         ▼
              ┌──────────────────────────┐
              │  OutcomeCollector (F3)   │ ──── publish ───►  <topic>.completed | .failed | .progress
              │  + worker.error event    │       (BrokerEvent canonical, correlationId propagato)
              └──────────────────────────┘                      pipeline §28 step 11 (mapper canonical→consumer)
                                                                pipeline §28 step 12 (validate post-mapping)
                                                                pipeline §28 step 13 (deliver)
                                                                                            │
                                                                                            ▼
                                                                                       ┌──────────┐
                                                                                       │ Plugin B │
                                                                                       └──────────┘
```

**Frecce-chiave:**
- `WorkerBroker → RouterBroker.publish` — composition delegation (D-121).
- `RouteExecutor.dispatchByType('worker', ...) → workerHandler` — dispatch table extension (D-152).
- `WorkerBridge → Worker thread` — Comlink RPC (postMessage + structuredClone implicito).
- `TaskTracker.markX → OutcomeCollector → Broker.publish` — atomic state transition + outcome publish (Pitfall 2C closure D-133).

### 3.2 Component Responsibilities Map

| Component | File | Responsibility | Owns | Depends on |
|-----------|------|----------------|------|------------|
| **WorkerBroker** | `packages/worker/src/worker-broker.ts` | Composition wrapper di `RouterBroker` (D-121). Override `registerPlugin/unregisterPlugin` per cascade `workers` (D-126 ext F5). API surface F1+F2+F3+F5: aggiunge `registerWorker/unregisterWorker`. | Inner `RouterBroker` + `WorkerRegistry` + `WorkerPool` + `TaskTracker` + `WorkerBridge` factory. | `@sembridge/routing` (RouterBroker, RouterEngine), `@sembridge/core` (PluginDescriptor, BrokerError), `comlink`. |
| **createWorkerBroker (factory)** | `packages/worker/src/public-factory.ts` | Factory pubblico `createWorkerBroker(config: WorkerBrokerConfig)` con Valibot `safeParse` (D-122, pattern F4 D-30 / F3 D-87). | Validation + costruzione WorkerBroker con DI defaults. | `valibot`, WorkerBroker. |
| **WorkerRegistry** | `packages/worker/src/worker-registry.ts` | `Map<workerId, RegisteredWorker>` con `register/unregister/get/listByOwner`. Validazione fail-fast `worker.task.unknown` al register (D-124). Cascade `unregisterByOwner` (D-126 ext F5, pattern http-gateway D-86). | Map + cascade abort. | `@sembridge/core` (BrokerError factory). |
| **WorkerPool** | `packages/worker/src/worker-pool.ts` | Lazy spawn bounded (D-127, D-128, D-129). `acquireSlot(workerId): Promise<PoolSlot>` — round-robin / least-busy assignment. `releaseSlot` su task end. Backpressure delegated a F3 strategy (D-130). Respawn slot dopo terminate fallback (D-131). | Pool slots Map + queue + spawn lifecycle. | WorkerBridge factory, F3 BackpressureStrategy. |
| **WorkerBridge** | `packages/worker/src/worker-bridge.ts` | Wrapper Comlink: `dispatch(taskName, payload, signal, onProgress): Promise<unknown>`. Crea Comlink proxy al primo dispatch (lazy D-129). Gestisce `Comlink.transfer(payload, transferList)`. Termine: `bridge.terminate()`. Astrazione interna per swap futuro RPC custom (V1.x). | Worker instance + Comlink proxy + transferable extraction integration. | `comlink`, AssertSerializable, TransferableExtractor, Worker (browser native). |
| **TaskTracker** | `packages/worker/src/task-tracker.ts` | `Map<TaskId, TaskState>`. Stati: `'pending' \| 'done' \| 'timeout' \| 'cancelled' \| 'error'`. `markX()` con check-and-set atomico (single-threaded JS event loop). Late response post-non-pending → scartata + counter `workerLateResponses` (D-133, Pitfall 2C strict). | Map state + getDebugSnapshot. | nanoid (taskId gen). |
| **AssertSerializable** | `packages/worker/src/assert-serializable.ts` | Deep-walk ricorsivo del payload pre-postMessage. Throw `BrokerError({ code: 'worker.serialization.failed.<sub>', category: 'worker', details: { fieldPath, fieldType }})` su funzioni / DOM nodes / classi custom non-SCA (D-139, D-140). Dev mode auto via `import.meta.env.DEV ?? process.env.NODE_ENV !== 'production'` o config override `'always'/'dev'/'off'`. | Deep traversal + path tracking. | `@sembridge/core` (createBrokerError). |
| **TransferableExtractor** | `packages/worker/src/transferable-extractor.ts` | JSONPath-like extractor (`['payload.audioBuffer', 'payload.images[*].buffer']`). Implementazione zero-dep ~50-80 LOC. Supporta wildcard `[*]`. Ritorna `Transferable[]` per `Comlink.transfer(payload, transferList)`. (D-141) | Path parsing + iteration. | (zero deps). |
| **WorkerHandler** | `packages/worker/src/worker-handler.ts` | Strategy F3 — funzione iniettata in `RouteExecutorDeps.workerHandler` (D-152). Riceve `(event: BrokerEvent, route: CompiledRoute, signal: AbortSignal): Promise<RouteOutcome>`. Orchestra: registry.get(workerId) → pool.acquireSlot → bridge.dispatch → tracker.markDone/markError → return RouteOutcome. | Orchestration logic. | WorkerRegistry, WorkerPool, WorkerBridge, TaskTracker. |
| **augment.ts** | `packages/worker/src/augment.ts` | TypeScript declaration merging additive: estende `BrokerConfig` con `workers?: WorkerConfig`, `PluginDescriptor` con `workers?: WorkerDescriptor[]`, `RouteDefinition` union con `RouteWorkerDefinition` (D-126, D-122, D-152). Pattern F2 D-57 / F3 D-94 / F4 D-103 — già consolidato 3 volte. | Type extensions. | (zero runtime impact — pure type). |

### 3.3 Boundaries con F1/F2/F3/F4

| Boundary | F5 fa | F5 NON fa |
|----------|-------|-----------|
| `@sembridge/core` | Importa types `PluginDescriptor`, `Subscription`, `BrokerEvent`, `BrokerError`, `EventTap`, `PipelineSnapshot`, `PipelineStep`. Ri-esporta extension via augment.ts. | Modifica runtime di core/. **Vietato D-83 strict.** |
| `@sembridge/mapper` | Riusa `MapperEngine` via RouterBroker delegation per canonicalizzazione progress (D-138) e canonical→output (D-153). | Modifica runtime mapper. **Vietato D-83.** |
| `@sembridge/routing` | Compone `RouterBroker` (D-121). Importa `RouteExecutorDeps`, `CompiledRoute`, `RouteOutcome`. Estende `RouteDefinition` union via declaration merging (D-152). Riusa `BackpressureStrategy` F3 D-75 (D-130). | Modifica runtime routing/. **Vietato D-83 strict.** |
| `@sembridge/gateway` (http subset) | Riusa pattern `abortInFlightByOwner` (concettuale, non importa modulo). | Importa `http/` subpath runtime. |
| `@sembridge/gateway/sse-ws` (F4) | NESSUN coupling. F4 e F5 ortogonali — l'utente sceglie un entry point o compone esplicitamente `createWorkerBroker(createRealtimeBroker(config))`. | Importa F4 runtime. |

**Verifica D-83 strict carryover:** `git diff --stat packages/{core,mapper,routing}/src/ packages/gateway/src/{http,sse-ws}/` deve restituire **zero hits** alla fine di F5. Final gate plan 05-07 verifica.

---

## 4. Comlink 4.4.2 deep dive

### 4.1 API surface usata da F5

Da Comlink README (verificato 2024-11-07 release commit; API stabile dal 4.0 del 2019):

```ts
import * as Comlink from 'comlink'

// Worker side (consumer authored)
const api = {
  parseCsv: async (input: string, signal: AbortSignal, onProgress?: ProgressCallback): Promise<ParsedRow[]> => {
    /* ... */
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    onProgress?.({ value: 0.5, message: 'Half done' })
    return rows
  },
}
Comlink.expose(api)  // marshals all methods + properties

// Main side (SemBridge WorkerBridge)
const proxy = Comlink.wrap<typeof api>(workerInstance)
const result = await proxy.parseCsv(rawCsv, Comlink.proxy(controller.signal), Comlink.proxy(onProgressCb))
```

**API utilizzate da F5:**

| API | Use in F5 | Note |
|-----|-----------|------|
| `Comlink.expose(api, port?)` | Worker authoring side (consumer del SemBridge) — DOC-05. | Default `port = self` (DedicatedWorkerGlobalScope). |
| `Comlink.wrap<T>(port)` | `WorkerBridge.constructor` lazy al primo dispatch (D-129). | Ritorna `Remote<T>` proxy typed. |
| `Comlink.proxy(value)` | Wrappare `AbortSignal` + `onProgress` callback come proxy invece di structured-clone (D-132, D-135). | Critico per cancellation cooperative — senza proxy, signal viene cloned (snapshot) e `addEventListener('abort')` non firerebbe più. |
| `Comlink.transfer(value, transferList)` | `WorkerBridge.dispatch` quando `transferable` array configurato (D-141). | Marshalling esplicito per ArrayBuffer/MessagePort. |
| `Comlink.releaseProxy()` | `WorkerBridge.terminate()` — release proxy per garbage collection. | Non strettamente necessario se subito `worker.terminate()`, ma buona pratica. |

### 4.2 AbortSignal proxy via Comlink — pattern non banale

Comlink 4.4.2 supporta proxy di oggetti con metodi async + property reads. Pattern verificato:

```ts
// Main side (WorkerBridge)
const controller = new AbortController()
// signal viene proxy-ato — ogni read di .aborted viaggia attraverso il channel
const signalProxy = Comlink.proxy(controller.signal)
// addEventListener viene chiamato sul main thread: il worker può sottoscrivere abort
const result = await proxy.task(input, signalProxy, ...)

// In caso di timeout/abort lato main:
controller.abort('worker.timeout')
// Il worker, se ha sottoscritto signal.addEventListener('abort'), riceve il fire async.
// Se il worker fa .throwIfAborted() periodico, legge .aborted=true via proxy read.
```

**Caveat documentati (Comlink GitHub issues #517, #587, #609):**
- Property read via proxy è **async** (ritorna `Promise<boolean>`). Pattern nel worker:
  ```ts
  // Worker side — pattern Comlink-aware:
  if (await signal.aborted) throw new DOMException('Aborted', 'AbortError')
  // NON `if (signal.aborted)` — sarebbe `Promise<boolean>` truthy sempre!
  ```
- `signal.throwIfAborted()` proxy: chiama metodo proxy, ritorna `Promise<void>`. Worker DEVE awaitare:
  ```ts
  await signal.throwIfAborted()
  ```
- DOC-05 deve documentare ESPLICITAMENTE questo trade-off — un dev abituato a `AbortSignal` sync potrebbe scrivere bug silenti.

**Alternativa proposta da researcher (Claude's Discretion):** F5 può fornire helper `createWorkerSignalAdapter(controller)` lato worker che converte il proxy in un sync-like wrapper:

```ts
// In @sembridge/worker (riusabile lato worker via import condizionale dal pacchetto)
export function createCheckpointFn(signal: Comlink.Remote<AbortSignal>): () => Promise<void> {
  return async () => {
    if (await signal.aborted) throw new DOMException('Aborted', 'AbortError')
  }
}
// Worker side:
const checkpoint = createCheckpointFn(signal)
for (const row of bigArray) {
  await checkpoint()  // throw se aborted
  process(row)
}
```

Decisione finale demandata al planner — F5 può evitare questo helper se DOC-05 è sufficiente.

### 4.3 Limitazioni Comlink 4.4.2 note (verificate)

- **TS inference edge case**: `Comlink.wrap<API>(worker)` produce `Remote<API>` dove TUTTI i metodi diventano async (anche se erano sync). Tipo: `Remote<{ foo: () => string }>` = `{ foo: () => Promise<string> }`. F5 deve documentare nel JSDoc.
- **Transferable detached after error**: se `Comlink.transfer(payload, [buffer])` fallisce DOPO il transfer (es. worker crash mid-task), il buffer è già detached e non riusabile dal main. F5 documenta in DOC-05 + warning Pitfall 7.E.
- **Bundle size** verificato a `1.13 KB` (gzipped, registry tarball 2024-11-07). Allineato a STACK.md ~1.1 KB.
- **No type imports limit**: Comlink esporta `Remote<T>`, `RemoteObject<T>`, `Local<T>`, `Endpoint`. F5 importa solo `Remote<T>` + namespace `* as Comlink`.

### 4.4 Pattern cancellation cooperativa via Comlink (D-131 + D-132)

```ts
// WorkerBridge.dispatch (semplificato)
async dispatch(
  taskName: string,
  payload: unknown,
  signal: AbortSignal,
  onProgress?: (p: ProgressPayload) => void,
): Promise<unknown> {
  // Validation pre-postMessage (D-139, D-140)
  this.assertSerializable(payload)
  // Transferable extraction (D-141)
  const transferList = this.transferableExtractor.extract(payload)
  // Comlink proxy per signal + onProgress (D-132, D-135)
  const signalProxy = Comlink.proxy(signal)
  const onProgressProxy = onProgress !== undefined ? Comlink.proxy(onProgress) : undefined
  // Transfer if any
  const wrappedPayload = transferList.length > 0
    ? Comlink.transfer(payload, transferList)
    : payload
  // Invoca via proxy typed
  const taskFn = (this.proxy as Record<string, unknown>)[taskName] as (...args: unknown[]) => Promise<unknown>
  return await taskFn(wrappedPayload, signalProxy, onProgressProxy)
}
```

Per `mode: 'pool'` cancellation cooperative (D-131):
1. Main: `controller.abort('worker.cancelled')` → signal.aborted = true via proxy.
2. Worker (se cooperativo): `await signal.throwIfAborted()` checkpoint → throw `DOMException AbortError` → Comlink propaga `reject(err)`.
3. Main: `dispatch()` Promise rejecta con AbortError → `tracker.markCancelled(taskId)` (atomico).
4. **Se worker NON coopera entro `cancelGraceMs=2000ms`**: `pool.terminateSlot(slotId)` → `worker.terminate()` (hard kill) → `pool.respawn(workerId)` per slot. State invariato `cancelled` (NO race con late response — D-133).

Per `mode: 'dedicated'` (D-131): salta lo step grace — `worker.terminate()` immediato.

---

## 5. Pool Strategy (D-127, D-128, D-129)

### 5.1 Lazy spawn algorithm

```
Stato pool:
- size: number (target — bounded)
- workers: Map<slotId, WorkerSlot { worker, busy: boolean, currentTaskId? }>
- queue: TaskRequest[] (FIFO)

Su acquireSlot(workerId):
  IF pool.size === 0:                            # primo dispatch — spawn
    spawn first worker (pool.size = 1)
    return slot
  IF freeSlot exists:                            # round-robin tra free
    return freeSlot
  IF pool.size < poolMax:                        # capacità rimanente — espandi pool
    spawn new worker (pool.size++)
    return new slot
  ELSE:                                          # tutti i slot occupied — enqueue
    queue.push(taskRequest)                      # backpressure F3 D-130 può applicarsi qui
    AWAIT slotReleased event
    return released slot (oldest in queue first — FIFO)
```

**Round-robin vs least-busy assignment:** dato che `busy: boolean` è binario (un task per slot), round-robin tra free è semplice e sufficiente. NIENTE least-busy con weighted score (overengineering V1).

### 5.2 `navigator.hardwareConcurrency` fallback

| Environment | `navigator.hardwareConcurrency` | F5 behavior |
|-------------|-------------------------------|-------------|
| Browser reale (Chrome/FF/Safari) | ≥ 1 (sempre defined per spec) | `min(hwc, 4)` (D-127) |
| Browser headless Playwright | ≥ 1 | Same |
| jsdom (test Tier-1) | `undefined` | Fallback a `4` |
| Node.js (NON usato per F5 — solo browser) | `os.cpus().length` ma `navigator` undefined | Fallback `4` (defensive) |

**Implementazione:**
```ts
function defaultPoolSize(): number {
  const hwc = (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number')
    ? navigator.hardwareConcurrency
    : 4
  return Math.min(hwc, 4)
}
```

### 5.3 Pool size validation con cap hard 8 + opt-in unbounded (D-128)

```ts
function validatePoolSize(requested: number, allowUnbounded: boolean): number {
  if (requested < 1) throw createBrokerError({ code: 'worker.pool.size.invalid', category: 'config', message: 'pool size must be ≥ 1' })
  if (requested > 8 && !allowUnbounded) {
    throw createBrokerError({
      code: 'worker.pool.size.exceeds-cap',
      category: 'config',
      message: `pool size ${requested} > hard cap 8. Set allowUnboundedPool: true to bypass (Pitfall 7.D protection).`,
    })
  }
  if (requested > 8 && allowUnbounded && import.meta.env?.DEV !== false) {
    console.warn(`[sembridge/worker] pool.size=${requested} > 8 — allowUnboundedPool active. Risk of memory pressure under load.`)
  }
  return requested
}
```

### 5.4 MessageChannel lifecycle

Comlink **internamente** gestisce `MessageChannel`/`MessagePort` per ogni call. Per pool con `mode: 'pool'`:

- 1 worker = 1 connessione Comlink permanente (1 `Comlink.wrap` per worker spawn).
- Per ogni `dispatch`, Comlink usa il main port — NON apre nuovo MessageChannel per task.
- Cleanup: `bridge.terminate()` invoca `Comlink.releaseProxy()` + `worker.terminate()` → garbage collection del port chain.

**Anti-leak verification (Pitfall 7.C):** `getDebugSnapshot()` espone `workerActiveBridges` — counter incrementato a spawn, decrementato a terminate. Test asserisce `workerActiveBridges=0` post `unregisterWorker` cascade.

### 5.5 Backpressure F3 riusato (D-130)

```ts
// WorkerHandler.execute (semplificato)
async execute(event: BrokerEvent, route: CompiledRoute, signal: AbortSignal): Promise<RouteOutcome> {
  const policies = route.definition.policies
  const backpressureStrategy = createBackpressureStrategy(policies?.backpressure ?? { type: 'queue-bounded', max: 1000 })
  // Critical bypass (Pitfall 4.C) — coerente con F3
  if (event.priority === 'critical') {
    return this.dispatchInternal(event, route, signal)
  }
  return backpressureStrategy.schedule(route.id, () => this.dispatchInternal(event, route, signal))
}
```

NO ridichiarazione di `BackpressureStrategy` — F5 importa il type da `@sembridge/gateway/http` e l'helper `createBackpressureStrategy` (esposto plan 03-10 strategies/index.ts barrel).

---

## 6. Serialization contract (WK-07 closure PRD §39 #11)

### 6.1 structuredClone supported types matrix

Da WHATWG HTML spec — Structured Clone Algorithm (SCA):

| Type | Supported by SCA | Survives Worker round-trip | Note |
|------|------------------|---------------------------|------|
| Primitive (string, number, boolean, null, undefined, BigInt) | ✓ | ✓ | BigInt supportato dal 2020 in tutti gli evergreen |
| `Object` literal | ✓ | ✓ | Plain objects |
| `Array` | ✓ | ✓ | |
| `Date` | ✓ | ✓ | `instanceof Date` true post-clone |
| `Map`, `Set` | ✓ | ✓ | Same — `instanceof Map` true post-clone |
| `RegExp` | ✓ | ✓ | |
| `ArrayBuffer`, `TypedArray` (Uint8Array, Float32Array, ...) | ✓ | ✓ | Cloned by default. Per transfer ownership → `transferable: ['path.buffer']` (D-141) |
| `Blob`, `File`, `FileList` | ✓ | ✓ | |
| `ImageData`, `ImageBitmap` | ✓ | ✓ | ImageBitmap transferable. |
| `MessagePort` (transferable only) | Transfer-only | ✓ | Per uso advanced (Comlink interno). |
| `Error` (DOMException, TypeError, ...) | ✓ (parziale, browser recenti) | ✓ con caveat | Tutti gli evergreen 2024+ supportano. Property `cause` clonata da Chrome 90+, FF 91+, Safari 14.1+. |
| **`function`** | ✗ | ✗ | `DataCloneError`. Pattern raccomandato D-142: `transformId: 'parseItalianDate'` registrato lato worker via `registerTransform`. |
| **DOM Node** (Element, Document, ...) | ✗ | ✗ | `DataCloneError`. |
| **Class instance with prototype** (es. `new MyClass()` user-defined) | ✗ Parziale | ✗ | Properties copiate, prototype perso. `instanceof MyClass` false post-clone. F5 considera questo come anti-pattern (D-142 contract). |
| `Symbol` non-registered | ✗ | ✗ | `DataCloneError`. |
| `WeakMap`, `WeakSet`, `WeakRef` | ✗ | ✗ | By design weak references. |
| `Promise` | ✗ | ✗ | `DataCloneError`. |

**[CITED: developer.mozilla.org/en-US/docs/Web/API/structuredClone — Supported types]**
**[CITED: html.spec.whatwg.org/multipage/structured-data.html#safe-passing-of-structured-data]**

### 6.2 `assertSerializable(payload)` algorithm

```ts
/**
 * Deep-walk ricorsivo del payload + path tracking per BrokerError.details.fieldPath.
 * Non alloca array/oggetti nuovi — pura validation.
 *
 * Throw BrokerError({code:'worker.serialization.failed.<sub>'}) su:
 * - typeof === 'function' → sub='function'
 * - DOM node (instanceof Node OR has .nodeType) → sub='dom-node'
 * - typeof === 'symbol' → sub='symbol'
 * - class with custom prototype (constructor.name not in SCA-supported list) → sub='custom-class'
 *
 * Walk handles cycles via Set<unknown> visited.
 */
export function assertSerializable(value: unknown, path = '$', visited = new Set<unknown>()): void {
  if (value === null || value === undefined) return
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean' || t === 'bigint') return
  if (t === 'function') {
    throw createBrokerError({
      code: 'worker.serialization.failed.function',
      category: 'worker',
      message: `Field at ${path} is a function — not serializable. Use registerTransform('${path}-fn', fn) and pass transformId instead.`,
      details: { fieldPath: path, fieldType: 'function' },
    })
  }
  if (t === 'symbol') {
    throw createBrokerError({
      code: 'worker.serialization.failed.symbol',
      category: 'worker',
      message: `Field at ${path} is a symbol — not serializable.`,
      details: { fieldPath: path, fieldType: 'symbol' },
    })
  }
  // Object / Array / Date / Map / Set / etc.
  if (visited.has(value)) return  // cycle — SCA supporta cycle, OK
  visited.add(value)
  // DOM node detection
  if (typeof (value as { nodeType?: unknown }).nodeType === 'number') {
    throw createBrokerError({
      code: 'worker.serialization.failed.dom-node',
      category: 'worker',
      message: `Field at ${path} is a DOM Node — not serializable.`,
      details: { fieldPath: path, fieldType: 'dom-node' },
    })
  }
  // SCA-supported: Date, Map, Set, RegExp, ArrayBuffer, TypedArray, Blob, ImageData, ImageBitmap
  // Detection via instanceof or Symbol.toStringTag
  const tag = Object.prototype.toString.call(value)
  if ([
    '[object Date]', '[object RegExp]', '[object Map]', '[object Set]',
    '[object ArrayBuffer]', '[object Blob]', '[object File]', '[object FileList]',
    '[object ImageData]', '[object ImageBitmap]',
    // TypedArray — match all
  ].includes(tag) || tag.endsWith('Array]')) {
    return  // SCA-supported — non walkare contenuto interno
  }
  // Plain Object / Array — walk
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertSerializable(value[i], `${path}[${i}]`, visited)
    }
    return
  }
  if (tag === '[object Object]') {
    for (const key of Object.keys(value as object)) {
      assertSerializable((value as Record<string, unknown>)[key], `${path}.${key}`, visited)
    }
    return
  }
  // Custom class instance
  const ctorName = (value as { constructor?: { name?: string } }).constructor?.name
  if (ctorName !== undefined && ctorName !== 'Object') {
    throw createBrokerError({
      code: 'worker.serialization.failed.custom-class',
      category: 'worker',
      message: `Field at ${path} is instance of ${ctorName} — prototype lost on structured clone. Pass plain object DTO instead.`,
      details: { fieldPath: path, fieldType: 'custom-class', constructorName: ctorName },
    })
  }
}
```

**Dev mode auto (D-139):**
```ts
function shouldAssert(config: BrokerConfig): boolean {
  const mode = config.workers?.assertSerializable ?? 'dev'
  if (mode === 'always') return true
  if (mode === 'off') return false
  // mode === 'dev' (default)
  return import.meta.env?.DEV === true || (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production')
}
```

### 6.3 Sub-codes proposti (Claude's Discretion)

| Code | Trigger | Hint message |
|------|---------|--------------|
| `worker.serialization.failed.function` | `typeof v === 'function'` | "Use registerTransform + transformId pattern" |
| `worker.serialization.failed.symbol` | `typeof v === 'symbol'` | "Symbols not serializable across worker boundary" |
| `worker.serialization.failed.dom-node` | `value.nodeType === number` | "DOM Nodes cannot cross worker boundary; serialize relevant data first" |
| `worker.serialization.failed.custom-class` | `value.constructor.name !== 'Object'` and not in SCA-supported list | "Pass plain DTO; prototype is lost on structuredClone" |

### 6.4 Transferable JSONPath-like extractor (D-141)

**Decisione researcher (vs `jsonpath-plus`):** implementazione custom zero-dep ~50-80 LOC. Rationale:
- `jsonpath-plus` 4-6 KB minified+gzip (registry verifica) — eccessivo per il subset richiesto (`literal.path` + `[*]` wildcard).
- Pattern coerente con F2 `$derive` extractor (in-house).
- Subset deterministico testabile.

```ts
/**
 * Estrae transferable da payload via path JSONPath-like.
 * Supporta:
 *   - 'payload.audioBuffer'          (literal)
 *   - 'payload.images[*].buffer'     (wildcard array)
 *
 * NON supporta: filter, recursive descent, slice. Subset deterministico.
 */
export function extractTransferables(payload: unknown, paths: readonly string[]): Transferable[] {
  const result: Transferable[] = []
  for (const path of paths) {
    extractAt(payload, path.split(/\.|\[/).filter(Boolean), 0, result)
  }
  return result
}

function extractAt(node: unknown, segments: readonly string[], idx: number, out: Transferable[]): void {
  if (node === null || node === undefined) return
  if (idx === segments.length) {
    if (isTransferable(node)) out.push(node as Transferable)
    return
  }
  const seg = segments[idx]
  if (seg === '*]') {
    if (Array.isArray(node)) {
      for (const item of node) extractAt(item, segments, idx + 1, out)
    }
    return
  }
  // strip trailing ']' if from `[N]`
  const cleanSeg = seg.endsWith(']') ? seg.slice(0, -1) : seg
  // numeric index
  if (/^\d+$/.test(cleanSeg) && Array.isArray(node)) {
    extractAt(node[Number(cleanSeg)], segments, idx + 1, out)
    return
  }
  if (typeof node === 'object') {
    extractAt((node as Record<string, unknown>)[cleanSeg], segments, idx + 1, out)
  }
}

function isTransferable(v: unknown): boolean {
  // ArrayBuffer, MessagePort, ImageBitmap, OffscreenCanvas, ReadableStream, WritableStream, TransformStream
  if (v instanceof ArrayBuffer) return true
  if (typeof MessagePort !== 'undefined' && v instanceof MessagePort) return true
  if (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) return true
  if (typeof OffscreenCanvas !== 'undefined' && v instanceof OffscreenCanvas) return true
  // streams (newer): typeof check
  if (typeof ReadableStream !== 'undefined' && v instanceof ReadableStream) return true
  if (typeof WritableStream !== 'undefined' && v instanceof WritableStream) return true
  if (typeof TransformStream !== 'undefined' && v instanceof TransformStream) return true
  return false
}
```

**Test scenarios (Tier-1 jsdom):**
- `extractTransferables({ a: new ArrayBuffer(8) }, ['a'])` → `[ArrayBuffer]`
- `extractTransferables({ images: [{ buf: ab1 }, { buf: ab2 }] }, ['images[*].buf'])` → `[ab1, ab2]`
- `extractTransferables({ a: 1 }, ['missing'])` → `[]`
- `extractTransferables({}, ['nonexistent[*].x'])` → `[]` (no throw)

### 6.5 DOC-04 / DOC-05 contract template (proposed)

```markdown
## Worker serialization contract (PRD §39 #11 / WK-07)

### Default: structuredClone (Structured Clone Algorithm)

Il broker usa `postMessage` (algoritmo Structured Clone). Sono supportati:
**Object | Array | Date | Map | Set | RegExp | ArrayBuffer | TypedArray | Blob | File | ImageData | ImageBitmap | DOMException | primitive (incluso BigInt)**

Sono **NON** supportati:
**function | DOM Node | Symbol | class instance con prototype custom | Promise | WeakMap/WeakSet/WeakRef**

In **dev mode** SemBridge esegue `assertSerializable` pre-postMessage. Su violation → throw `BrokerError({code:'worker.serialization.failed.<sub>', details:{fieldPath, fieldType}})` puntando esattamente al campo colpevole.

In **production** il check è disabilitato per zero overhead. Override via `BrokerConfig.workers.assertSerializable: 'always' | 'dev' | 'off'`.

### Pattern raccomandato per funzioni

NON passare `(x) => x*2` come campo del payload. Usa il pattern `transformId` registrato:

```ts
// Setup
broker.registerTransform('parseItalianDate', (str) => /* ... */)

// Worker route
{
  type: 'worker',
  on: 'report.requested',
  worker: 'report-worker',
  task: 'generateReport',
  // payload contiene `transformId: 'parseItalianDate'` invece della funzione
}
```

### Transferable (advanced)

Per ottimizzare il transfer di buffer grandi (audio, video frame, ML weights), dichiara opt-in:

```ts
{
  type: 'worker',
  on: 'audio.process.requested',
  worker: 'audio-worker',
  task: 'denoise',
  transferable: ['payload.audioBuffer'],            // single path
  // oppure wildcard:
  transferable: ['payload.frames[*].buffer'],       // tutti i buffer in array
}
```

⚠️  **WARNING:** dopo il transfer, il main thread NON può più accedere ai buffer transferiti — `audioBuffer.byteLength === 0`. Questo è il comportamento standard `postMessage(msg, transferList)` (Pitfall 7.E).
```

---

## 7. Pipeline §28 step 9 integration (D-152, D-153)

### 7.1 RouteDefinition union extension via declaration merging

Il modulo `packages/worker/src/augment.ts` aggiunge `RouteWorkerDefinition` al `RouteDefinition` union di F3 senza modificare F3 stesso:

```ts
// packages/worker/src/augment.ts
import type { RoutePolicies } from '@sembridge/routing'
import type { WorkerDescriptor } from './types/worker-descriptor'

declare module '@sembridge/core' {
  interface BrokerConfig {
    /** F5 augmentation: configurazione runtime worker. */
    workers?: WorkerConfig
  }
  interface PluginDescriptor {
    /** F5 augmentation (D-126): worker auto-registrati con ownerId=pluginId al registerPlugin. */
    readonly workers?: readonly WorkerDescriptor[]
  }
}

declare module '@sembridge/routing' {
  /**
   * F5 augmentation: route worker subset di RoutePolicies (D-143).
   * Supporta: timeout + concurrency + backpressure + dedupe.
   * NON supporta: retry / auth / circuitBreaker / idempotency.
   */
  interface RouteWorkerDefinition {
    readonly type: 'worker'
    readonly id: string
    readonly topic: string
    readonly worker: string             // workerId — must exist in registry
    readonly task: string                // task name — must be in worker.tasks
    readonly publishes?: {
      readonly success?: string         // override default <topic>.completed
      readonly progress?: string         // override default <topic>.progress
      readonly error?: string            // override default <topic>.failed
    }
    readonly transferable?: readonly string[]   // JSONPath-like (D-141)
    readonly progressThrottleMs?: number          // default 100 (D-137)
    readonly priority?: number
    readonly policies?: Pick<RoutePolicies, 'timeout' | 'concurrency' | 'backpressure' | 'dedupe'>
  }

  // Extends RouteDefinition union — declaration merging additive
  // BLOCKER: TS NON supporta merging di type alias union literals.
  // Soluzione: il consumer importa `WorkerRouteDefinition` separatamente per typing
  // e il `RouteResolver` accetta `route.definition.type === 'worker'` come case
  // aggiuntivo (runtime) — analoga limitazione gestita in F3 augment.ts via `F3PipelineStep`.
}
```

**Critical TS limitation:** `RouteDefinition` di F3 è un type alias union literal (`type RouteDefinition = Local | Http | Cache | Composite`). TS NON supporta declaration merging di type alias.

**Soluzione (consolidata in F4):** Il consumer dichiara il super-set localmente:
```ts
import type { RouteDefinition as F3RouteDefinition } from '@sembridge/routing'
import type { RouteWorkerDefinition } from '@sembridge/worker'
type AllRoutes = F3RouteDefinition | RouteWorkerDefinition
```

A runtime: il `RouteResolver` di F3 valida `definition.type` via switch — se nessuno dei 4 case match, ritorna `route.type.unknown`. F5 INIETTA il dispatch worker via `RouteExecutorDeps.workerHandler` (vedi §7.2), bypassando il switch del resolver F3 — il check `type === 'worker'` viene fatto nel `WorkerHandler` injection wrapper.

### 7.2 RouteExecutorDeps.workerHandler injection

F5 deve estendere `RouteExecutorDeps` per accettare un `workerHandler` analogo a `httpHandler`. Approccio (composition wrapper-based, NO modifica F3):

```ts
// packages/worker/src/worker-broker.ts (semplificato)
import { RouterBroker, RouterEngine, RouteExecutor, type RouteExecutorDeps } from '@sembridge/routing'

export class WorkerBroker {
  private readonly inner: RouterBroker
  private readonly registry: WorkerRegistry
  private readonly pool: WorkerPool
  private readonly tracker: TaskTracker
  // ... etc

  constructor(config: WorkerBrokerConfig) {
    // 1. Build worker subsystem
    this.registry = new WorkerRegistry()
    this.pool = new WorkerPool({ /* deps */ })
    this.tracker = new TaskTracker()
    // 2. Build workerHandler per F3 dispatch table
    const workerHandler: NonNullable<RouteExecutorDeps['workerHandler']> = async (event, route, signal) => {
      // route.definition.type === 'worker' guaranteed
      const def = route.definition as RouteWorkerDefinition
      const desc = this.registry.get(def.worker)
      if (!desc) {
        return { ok: false, routeId: route.id, error: createBrokerError({ code: 'worker.unknown', category: 'config' }) }
      }
      // Dispatch + state machine + outcome
      return await this.executeWorkerTask(event, route, def, signal)
    }
    // 3. Build inner RouterBroker with workerHandler injected
    // BLOCKER: F3 RouterBroker non accetta workerHandler in costruttore — F5 deve estendere
    // o ri-istanziare RouterEngine. Soluzione: F5 sub-class RouterBroker o costruisce
    // RouterEngine custom passandolo a `new RouterBroker({ engine: customEngine })` (richiede
    // micro-API in RouterBroker — vedi nota sotto).
    this.inner = new RouterBroker({ ...config, workerHandler })  // ← richiede aggiornamento F3 minor
  }

  // ... publish/subscribe delegation, registerPlugin override per cascade workers, etc.
}
```

**ATTENZIONE — micro-modifica F3 richiesta?**

La signature attuale di F3 `RouteExecutorDeps` (vista in §1 codebase) NON include `workerHandler`. F3 D-77 ha lasciato il "placeholder" come case `default` nel switch: route con `type === 'worker'` ritorna `route.type.unknown`. Per concretizzare D-152 senza violare D-83 strict, il planner ha 3 opzioni:

| Opzione | Approccio | D-83 violation? | Costo |
|---------|-----------|-----------------|-------|
| **A. F3 lascia gap intenzionale** (PRD-aligned) | F5 introduce `WorkerEngine extends RouterEngine` che override `dispatchByType` per `'worker'` case. F3 unchanged. | NO — F5 estende, non modifica. | Medio — sub-class richiede accesso a private field di F3 (potrebbe richiedere refactor minor). |
| **B. Type-only augment + wrapper pre-publish** (composition) | `WorkerBroker.publish` intercetta event PRIMA di delegate a inner.publish. Se topic matcha worker route → dispatch direct via WorkerHandler bypassando F3 RouteExecutor. | NO — F5 vive solo in worker/src/. | Basso — segue pattern F4 D-101. |
| **C. F3 add `workerHandler?` deps optional** (additive) | F3 modifica `RouteExecutorDeps` aggiungendo `readonly workerHandler?: WorkerHandler` (additive opzionale). Nessuna logica F3 cambia — solo l'union type. | **TECNICAMENTE SÌ** (modifica F3) — ma è additive type-only se F3 RouteExecutor switch ha già `case 'worker'` come `default route.type.unknown`. | Alto — viola D-83 letteralmente. |

**Researcher recommendation:** **Opzione B (composition wrapper pre-publish)**. Pattern coerente con F4 D-101. Plan dettaglio in §8.

```ts
// WorkerBroker.publish — intercetta prima di delegate
publish(topic: string, payload: unknown, options?: PublishOptions): Promise<void> {
  // Pre-check: il topic ha una worker route?
  const workerRoute = this.findWorkerRouteForTopic(topic)
  if (workerRoute === undefined) {
    return this.inner.publish(topic, payload, options)  // delegate normale F1+F2+F3
  }
  // Worker route matched: il flusso passa attraverso F3 (per pipeline §28 step 1-7),
  // ma F3 RouteResolver troverà la worker route e RouteExecutor switch returnerà
  // route.type.unknown. F5 intercetta il publish, esegue manualmente step 8 (resolve
  // worker route) + step 9 (dispatch worker), poi delega step 10 (collect outcome) +
  // step 11-13 a inner.publish per gli eventi <topic>.completed/.progress/.failed.
  return this.executeWorkerFlow(topic, payload, workerRoute, options)
}
```

**Trade-off Opzione B:**
- ✓ NIENTE modifica F3 (D-83 strict garantito).
- ✓ Pipeline §28 step 1-7 si applicano via inner.publish prima dell'intercept (canonicalization, validation, dedupe — riuso F2 + F3).
- ✗ Step 8-10 vengono ESEGUITI SEPARATAMENTE da F5 (non si appoggiano al RouteExecutor di F3 per il caso worker). Il planner deve replicare logica `OutcomeCollector` (D-78/D-80 carryover concettuale) ma riusare le primitive.

**Implementazione step 8-10 in F5 (high-level):**
```ts
async executeWorkerFlow(topic, payload, workerRoute, options): Promise<void> {
  // Step 1-7: applica pipeline F1+F2+F3 su payload PRE-dispatch
  const canonicalEvent = await this.inner.canonicalizePublish(topic, payload, options)  // requires F2/F3 helper
  // Step 8: route resolved (workerRoute matched)
  // Step 9: dispatch worker
  const outcome = await this.workerHandler(canonicalEvent, workerRoute, signal)
  // Step 10: collect outcome — emit <topic>.completed or <topic>.failed
  if (outcome.ok) {
    const successTopic = workerRoute.publishes?.success ?? `${topic}.completed`.replace('.requested', '.completed')
    await this.inner.publish(successTopic, outcome.result, { correlationId: canonicalEvent.correlationId })
  } else {
    const errorTopic = workerRoute.publishes?.error ?? `${topic}.failed`.replace('.requested', '.failed')
    await this.inner.publish(errorTopic, outcome.error, { correlationId: canonicalEvent.correlationId })
  }
}
```

**Researcher caveat:** la primitiva `inner.canonicalizePublish` non esiste in F3 explicit — il planner DEVE verificare se `RouterBroker.publish` espone abbastanza per eseguire step 1-7 senza causare doppia esecuzione. Se NO, il planner può scegliere Opzione A (sub-class) come fallback.

**Decisione finale researcher:** raccomanda **Opzione B con verifica codebase RouterBroker.publish** in plan 05-01. Se RouterBroker.publish non è componibile, **fallback a Opzione A** (sub-class WorkerEngine) in plan 05-04 worker-broker.ts. **Non richiede modifica F3** in entrambi i casi.

### 7.3 OutcomeCollector riuso (D-78/D-80 concettuale)

F5 NON importa `OutcomeCollector` di F3 direttamente (vive in `packages/routing/src/outcome-collector.ts` — non esposto al barrel). F5 replica internamente la shape:

```ts
// outcome shape per worker (mirror di F3 D-80)
interface WorkerOutcome {
  readonly ok: boolean
  readonly routeId: string
  readonly result?: unknown          // se ok: true
  readonly error?: BrokerError       // se ok: false
}

// Publish shape per .failed (mirror di F3 D-80):
{
  topic: '<topic>.failed',
  payload: {
    error: BrokerError,
    sourceEventId: event.id,
    sourceTopic: event.topic,
    routeId: route.id,
  },
  correlationId: event.correlationId,
  source: { type: 'worker', id: workerId, name: taskName },  // PRD §11.1 source.type='worker'
}
```

**Counter `getDebugSnapshot()`:** F5 espone `workerTasksActive`, `workerTasksTotal`, `workerLateResponses` (Pitfall 2C audit), `workerActiveBridges` (Pitfall 7.C audit). Test scenario D-151 verifica `workerTasksActive=0` post-task.

### 7.4 EventTap pre-instrumentation (CORE-13 carryover)

F5 emette tap su nuovi step (predisposti per F6 `WorkerInspector`):

| Tap step name | Where emitted | Snapshot metadata |
|---------------|---------------|-------------------|
| `event.worker.dispatched` (step 9 sub) | WorkerBridge.dispatch | `{ workerId, taskName, taskId, transferableCount }` |
| `event.worker.progress` (step 9 sub) | onProgress callback adapter | `{ taskId, value, message? }` |
| `event.worker.completed` (step 9 sub) | TaskTracker.markDone | `{ taskId, durationMs }` |
| `event.worker.failed` (step 9 sub) | TaskTracker.markError/Timeout/Cancelled | `{ taskId, reason: 'timeout'\|'cancelled'\|'error', errorCode }` |

Pattern `safeTapStep` (try/catch swallow) coerente con F2/F3/F4. Tap optional via `RouteExecutorDeps.tap` injection (carryover F3).

---

## 8. Plan structure proposta (7 plan in 6 wave)

### 8.1 Wave breakdown

| Wave | Plan | Focus | File ownership | Parallelizable? |
|------|------|-------|----------------|-----------------|
| **W1** | **05-01** | Bootstrap `@sembridge/worker` package | `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `src/types/*.ts` (worker-descriptor, worker-config, route-worker-definition, progress-payload, task-state), `src/index.ts` skeleton (barrel solo), `src/augment.ts` (declaration merging additive — augment.test.ts smoke) | NO (sequential — gating per W2) |
| **W2** | **05-02** | Building blocks A: `assert-serializable.ts` + `transferable-extractor.ts` | `src/assert-serializable.ts` + test, `src/transferable-extractor.ts` + test | YES (∥ 05-03) — file disgiunto |
| **W2** | **05-03** | Building blocks B: `task-tracker.ts` (state machine atomico D-133) | `src/task-tracker.ts` + test | YES (∥ 05-02) — file disgiunto |
| **W3** | **05-04** | Adapter A: `worker-bridge.ts` (Comlink wrap + AbortSignal proxy + integrato W2 building blocks) | `src/worker-bridge.ts` + test, `src/test-utils/mock-worker.ts` (per Tier-1 jsdom — riuso pattern `MockEventSource`) | YES (∥ 05-05) — file disgiunto |
| **W3** | **05-05** | Adapter B: `worker-pool.ts` (lazy spawn + bounded + queue + respawn D-127/128/129/131) | `src/worker-pool.ts` + test | YES (∥ 05-04) — file disgiunto |
| **W4** | **05-06** | Composition: `worker-registry.ts` + `worker-handler.ts` + `worker-broker.ts` + `public-factory.ts` (createWorkerBroker) + 14 integration test 3-tier riuso D-118 (`__integration__/` Tier-1 jsdom + `__browser__/playwright-worker-smoke.test.ts` Tier-3 con Worker reale) | `src/worker-registry.ts` + test, `src/worker-handler.ts` + test, `src/worker-broker.ts` + test, `src/public-factory.ts` + test, `src/__integration__/*.ts` (Tier-1 jsdom), `src/__browser__/playwright-worker-smoke.test.ts` (Tier-3) | NO (consumer dei W2-W3 building blocks) |
| **W5/Final** | **05-07** | Final gate F5 (D-154, analogo 04-09) | DOC-04 update sezione Worker, DOC-05 update con scenario CSV/report end-to-end, JSDoc audit, `REQUIREMENTS.md` WK-01..WK-07 → Complete, `STATE.md` update F5 closure, `ROADMAP.md` update Phase 5 done, CI gates verify, smoke-test cross-package, 05-SUMMARY.md | NO (final closure) |

### 8.2 Dipendenze plan dettaglio

```
05-01 (bootstrap + types + augment)
   │
   ├─► 05-02 (assert-serializable + transferable-extractor)
   ├─► 05-03 (task-tracker state machine)
   │
   ├─► 05-04 (worker-bridge — depends on 05-02 assertSerializable + transferableExtractor + 05-03 tracker)
   ├─► 05-05 (worker-pool — depends on 05-04 bridge factory)
   │
   ├─► 05-06 (worker-broker composition + integration test — depends on 05-04 + 05-05)
   │
   └─► 05-07 (final gate — depends on 05-06)
```

**Parallelism opportunity (D-150):** W2 (05-02 ∥ 05-03), W3 (05-04 ∥ 05-05). 2 wave parallel = 2x speedup vs sequential.

### 8.3 Plan size estimation

| Plan | LOC source estimate | LOC test estimate | Test count target |
|------|---------------------|-------------------|-------------------|
| 05-01 | ~150 (config + types) | ~50 (smoke augment) | 8 (smoke decl merging) |
| 05-02 | ~200 (assert ~100 + extractor ~100) | ~250 (15+15 test) | 30 |
| 05-03 | ~150 (state machine) | ~200 (12 test) | 12 |
| 05-04 | ~300 (bridge + MockWorker) | ~350 (15 test) | 15 |
| 05-05 | ~250 (pool) | ~280 (12 test) | 12 |
| 05-06 | ~600 (registry + handler + broker + factory) | ~800 (16 unit + 14 integration 3-tier) | 30 |
| 05-07 | (no source — solo doc + gate) | (no test new) | — |
| **Tot** | **~1650 LOC** | **~1930 LOC** | **~107 test new F5** |

Coerente con F4 (~3000 LOC source + 3500 LOC test, 132 test) — F5 più piccolo (no dual SSE+WS adapter).

---

## 9. Test strategy 3-tier (D-118 carryover, D-150)

### 9.1 Tier-1 jsdom + Vitest — unit logic deterministico

**Worker NON disponibile in jsdom** — i test che istanziano `new Worker()` falliscono con `ReferenceError`. Soluzione: `MockWorker` test util.

| File | Tests | Note |
|------|-------|------|
| `assert-serializable.test.ts` | Function/symbol/DOM-node/custom-class throw + plain object/Date/Map/Set/ArrayBuffer pass + cycle detection (visited set) | 15 test |
| `transferable-extractor.test.ts` | Literal path + wildcard `[*]` + missing path → `[]` + ArrayBuffer/MessagePort/ImageBitmap detected | 15 test |
| `task-tracker.test.ts` | State transitions (pending → done | timeout | cancelled | error) + atomic guard (late response post-non-pending dropped + counter incremented) + getDebugSnapshot snapshot shape | 12 test |
| `worker-pool.test.ts` | Lazy first dispatch + round-robin slot assignment + bounded cap 8 + allowUnboundedPool warning + respawn after terminate fallback | 12 test |
| `worker-bridge.test.ts` | Comlink.wrap + dispatch task + AbortSignal proxy + transferable extraction + assertSerializable invocation + terminate cleanup. **Usa MockWorker.** | 15 test |
| `worker-registry.test.ts` | register valid + duplicate id throw + task.unknown throw fail-fast + listByOwner filter + unregisterByOwner cascade | 10 test |
| `worker-handler.test.ts` | dispatch flow + error category 'worker' + outcome shape + correlationId propagation | 8 test |
| `worker-broker.test.ts` | Composition wrapper + registerPlugin cascade workers + unregisterPlugin cascade + publish intercept worker route | 12 test |
| `public-factory.test.ts` | Valibot safeParse + default config + invalid config throw | 6 test |
| `augment.test.ts` (smoke) | __augmentLoaded export + decl merging types coexist | 8 test |

**Tot Tier-1: ~113 test.**

### 9.2 Tier-2 — N/A (msw non applicabile)

I worker sono in-process — non c'è HTTP/WS/network da mockare. Tier-2 (msw integration) viene **saltato** in F5 e sostituito dal `MockWorker` adapter test util consumer-side al Tier-1.

### 9.3 Tier-3 — `@vitest/browser` + Playwright Chromium

| File | Tests | Note |
|------|-------|------|
| `__integration__/worker-end-to-end.test.ts` (Tier-1 jsdom-mode) | 8 integration test usando `MockWorker`: scenario CSV parsing, scenario report generation, cascade cleanup, latest-only race, backpressure storm, progress throttle | Tier-1 deterministico |
| `__browser__/playwright-worker-smoke.test.ts` (Tier-3) | 6 test con Worker REALI Playwright Chromium: structuredClone Date round-trip, transferable byteLength=0 verifica, navigator.hardwareConcurrency real, postMessage real round-trip, worker classic vs module, OffscreenCanvas (sanity ImageBitmap transferable) | Tier-3 production-like |

**Worker file di test** (consumer-authored mock, vive in `__browser__/`):
```ts
// packages/worker/src/__browser__/test-worker.ts
import * as Comlink from 'comlink'

const api = {
  parseCsv: async (input, signal, onProgress) => {
    onProgress?.({ value: 0.5, message: 'Halfway' })
    if (await signal.aborted) throw new DOMException('Aborted', 'AbortError')
    return input.split('\n').map((l) => l.split(','))
  },
  echoBuffer: async (buf) => buf.byteLength,    // verifica transferable
  echoDate: async (d) => d,                      // verifica structuredClone Date round-trip
}
Comlink.expose(api)
```

**Vitest config** (estende pattern F4 `vitest.config.ts`):
```ts
// packages/worker/vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',                      // default Tier-1
    include: ['src/**/*.test.ts', 'src/__integration__/**/*.test.ts'],
    exclude: ['src/__browser__/**'],          // Tier-3 separato
    coverage: { provider: 'v8', thresholds: { statements: 90, branches: 80, functions: 90, lines: 90 } },
  },
})

// packages/worker/vitest.browser.config.ts (Tier-3)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      name: 'chromium',
    },
    include: ['src/__browser__/**/*.test.ts'],
  },
})
```

### 9.4 D-151 10 scenari obbligatori — file mapping

| # | Scenario | Plan | File | Tier |
|---|----------|------|------|------|
| 1 | Worker dedicated end-to-end | 05-06 | `__integration__/dedicated.test.ts` | T1 jsdom + MockWorker |
| 2 | Worker pool 4 task concorrenti su size=2 | 05-06 | `__integration__/pool-concurrent.test.ts` | T1 jsdom + MockWorker |
| 3 | Timeout strict (response post-timeout dropped) | 05-06 | `__integration__/timeout-strict.test.ts` | T1 jsdom (deterministic) |
| 4 | Cancellation cooperative pool | 05-06 | `__integration__/cancel-cooperative.test.ts` | T1 jsdom + MockWorker |
| 5 | Cancellation hard dedicated | 05-06 | `__integration__/cancel-hard.test.ts` | T1 jsdom + MockWorker |
| 6 | Serialization fail dev mode | 05-02 + 05-06 | `assert-serializable.test.ts` + `__integration__/serialization-fail.test.ts` | T1 jsdom |
| 7 | Transferable byteLength=0 post-transfer | 05-06 | `__browser__/playwright-worker-smoke.test.ts::transferable` | T3 Playwright (Worker reale) |
| 8 | Cascade cleanup unregisterPlugin | 05-06 | `__integration__/cascade-cleanup.test.ts` | T1 jsdom |
| 9 | Backpressure storm critical bypass | 05-06 | `__integration__/backpressure-storm.test.ts` | T1 jsdom |
| 10 | Progress throttle 100ms latest-only | 05-04 | `worker-bridge.test.ts::progress-throttle` | T1 jsdom |

---

## 10. Pitfalls deep-dive con mitigazioni concrete

### 10.1 Pitfall 7.A — serialization fail (PITFALLS #7.A)

| Aspect | Mitigation in F5 |
|--------|------------------|
| **Cosa va storto** | `payload.transform: (x) => x*2` → `DataCloneError: function() could not be cloned`. Errore generico, no hint sul campo. |
| **Mitigation** | `assertSerializable(payload)` deep-walk PRE-postMessage (D-139). Throw `BrokerError 'worker.serialization.failed.function'` con `details.fieldPath: 'payload.transform'` + suggested fix nel message. Dev mode auto. |
| **Test coverage** | `assert-serializable.test.ts` (15 test) — copre function/symbol/DOM-node/custom-class branch ciascuno con fieldPath assertion. |
| **DOC** | DOC-05 sezione "Worker serialization contract" con esempi concreti (D-142). |

### 10.2 Pitfall 7.B — Date/Map/Set lost via JSON.stringify (PITFALLS #7.B)

| Aspect | Mitigation in F5 |
|--------|------------------|
| **Cosa va storto** | Adapter ipotetico `superjson.stringify(payload)` rompe Date/Map/Set transparency. |
| **Mitigation** | F5 NON usa `JSON.stringify` né `superjson` per default. `postMessage` usa SCA implicito. DOC-05 Contract documenta esplicitamente: "Worker uses structuredClone — Date/Map/Set survive round-trip". |
| **Test coverage** | `__browser__/playwright-worker-smoke.test.ts` test `echoDate(new Date())` verifica `instanceof Date === true` post-roundtrip (Worker reale Chromium). |

### 10.3 Pitfall 7.C — MessageChannel leak (PITFALLS #7.C)

| Aspect | Mitigation in F5 |
|--------|------------------|
| **Cosa va storto** | Pool crea `MessageChannel` per task, dimentica chiudere → 4 KB/task leak. |
| **Mitigation** | Comlink **internamente** gestisce port reuse (1 channel per worker, NOT per task). `bridge.terminate()` invoca `Comlink.releaseProxy()` + `worker.terminate()` → cleanup garantito. F5 espone counter `getDebugSnapshot().workerActiveBridges` per audit. |
| **Test coverage** | `__integration__/cascade-cleanup.test.ts` asserisce `workerActiveBridges=0` post-unregisterPlugin. |

### 10.4 Pitfall 7.D — Pool size storm (PITFALLS #7.D)

| Aspect | Mitigation in F5 |
|--------|------------------|
| **Cosa va storto** | Config `pool: 'auto'` interpretato come `unlimited` → 200 worker spawnati su storm → tab freeze. |
| **Mitigation** | D-127 default `min(hwc, 4)`. D-128 cap hard 8. `unlimited` removed — sostituito da `allowUnboundedPool: true` opt-in con `console.warn`. D-130 backpressure F3 critical bypass per priority='critical'. |
| **Test coverage** | `worker-pool.test.ts` test "size > 8 throws unless allowUnbounded", `__integration__/backpressure-storm.test.ts` test "10K events queued, only critical pass". |

### 10.5 Pitfall 7.E — Transferable detached (PITFALLS #7.E)

| Aspect | Mitigation in F5 |
|--------|------------------|
| **Cosa va storto** | `postMessage(buf, [buf])` trasferisce ownership → main thread `buf.byteLength === 0`. Comportamento atteso ma sorprendente per il dev. |
| **Mitigation** | DOC-05 documenta esplicitamente con WARNING block + JSDoc su `transferable?: readonly string[]` field. |
| **Test coverage** | `__browser__/playwright-worker-smoke.test.ts::transferable` Worker reale Chromium asserisce `bufferAfterTransfer.byteLength === 0`. |

### 10.6 Pitfall 2.A — latest-only race (PITFALLS #2.A)

| Aspect | Mitigation in F5 |
|--------|------------------|
| **Cosa va storto** | Doppia `weather.requested` con concurrency='latest-only': la slow-old vince sulla fast-new. |
| **Mitigation** | D-132 AbortSignal proxied + D-134 correlationId end-to-end. Quando arriva un nuovo `<topic>.requested`, il `WorkerHandler` controlla `concurrency === 'latest-only'` (default D-144), abort task pending → `tracker.markCancelled` (atomico). Solo new task pubblica `<topic>.completed`. |
| **Test coverage** | `__integration__/cancel-cooperative.test.ts` 2 dispatch consecutive → primo task riceve `signal.aborted`, secondo completes. |

### 10.7 Pitfall 2.C — Timeout vs success race (PITFALLS #2)

| Aspect | Mitigation in F5 |
|--------|------------------|
| **Cosa va storto** | Worker timeout a 5.001s + worker resolve a 5.050s → main pubblica BOTH `failed (timeout)` + `completed (late)` → subscriber confused. |
| **Mitigation** | D-133 state machine atomico `Map<TaskId, TaskState>`. JS event loop single-threaded → check-and-set è atomico per natura. Una volta state=`'timeout'`, late response viene **scartata silenziosamente** e contata in `getDebugSnapshot().workerLateResponses`. NO doppia pubblicazione. |
| **Test coverage** | `__integration__/timeout-strict.test.ts` deterministic — fake timer + worker mock che resolve POST timeout fire → asserisce `<topic>.failed` published, `<topic>.completed` NOT published, `workerLateResponses=1`. |

---

## 11. Security Domain (security_enforcement default true ASVS L1)

### 11.1 Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | NO | F5 worker locale, no remote auth (D-143 niente auth nelle policy worker) |
| V3 Session Management | NO | Idem |
| V4 Access Control | YES (parziale) | Cascade `unregisterByOwner` (D-126 ext F5) — un plugin non può lasciare worker dangling di altro plugin |
| V5 Input Validation | YES | `assertSerializable` (D-139, D-140) blocca payload malformato pre-postMessage; `WorkerBrokerConfig` Valibot safeParse al boot (D-122); `task` validation fail-fast `worker.task.unknown` (D-124) |
| V6 Cryptography | NO | Nessuna crypto in F5 |
| V8 Data Protection | YES (parziale) | `transferable` opt-in documentato → main thread perde ownership (Pitfall 7.E). Niente leak cross-tenant (worker locale, scope di pagina) |
| V9 Communications | NO (worker in-process) | Worker = in-process boundary, no network |

### 11.2 Threat patterns per worker stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **T-05-01-01** Tampering — payload mutato post-validation | Tampering | `assertSerializable` runs in dev mode + payload serialized via SCA = clone implicito a postMessage time → main mutation post-dispatch NON impacta worker |
| **T-05-02-01** Spoofing — worker pretende identity di altro plugin | Spoofing | `BrokerEvent.source = { type: 'worker', id: workerId, name: taskName }` impostato dal `WorkerHandler` (D-152), source descriptor immutable. Il worker NON ha controllo sul source. |
| **T-05-03-01** Repudiation — no audit log dispatch worker | Repudiation | `tap.onPipelineStep('event.worker.dispatched', snapshot)` predisposto F5 + Inspector F6 reale registrerà tutti i dispatch. Pattern CORE-13 carryover. |
| **T-05-04-01** Information Disclosure — transferable detached → main thread vede `byteLength=0` | Info Disclosure | DOC-05 + JSDoc warning + test Tier-3 verifica. Comportamento documentato, NO leak (mainwouldn't have access anyway). |
| **T-05-04-02** Information Disclosure — BrokerError.details include payload sensibile | Info Disclosure | F5 segue pattern F3 D-78: `BrokerError.details` include solo `{taskId, fieldPath, fieldType}` — NIENTE payload value. |
| **T-05-05-01** DoS — pool storm spawn 200 worker | DoS | D-128 cap hard 8 + `allowUnboundedPool` opt-in con warning. Backpressure F3 D-130 applica `queue-bounded max:1000` default. Critical bypass per `priority: 'critical'`. |
| **T-05-05-02** DoS — task infinite (timeout: Infinity) | DoS | D-145 default 30s. `timeout: Infinity` opt-in con `console.warn` dev mode. State machine atomico garantisce respawn slot pool dopo terminate fallback (D-131). |
| **T-05-06-01** Elevation of Privilege — worker accede a system globals (es. fetch arbitrary URL) | EoP | Boundary nativa Worker — DedicatedWorkerGlobalScope ha accesso limitato (no DOM, sì fetch). F5 NON injetta API beyond Comlink RPC. Author del worker è responsabile per non emettere `fetch` non autorizzati — fuori scope SemBridge per V1 (no sandbox-on-worker). |
| **T-05-07-01** Logic flaw — state machine race timeout/success (Pitfall 2C) | Logic flaw | D-133 strict — state machine atomico Pitfall 2C closure. Test Tier-1 deterministic. |
| **T-05-07-02** Logic flaw — assertSerializable bypass via JSON.stringify pre-postMessage | Logic flaw | F5 NON usa `JSON.stringify`. `postMessage` invocato direttamente con payload SCA-validated. `assertSerializable` si applica PRE-`postMessage` (NON dopo) — bypass impossibile. |
| **T-05-07-03** Logic flaw — cascade cleanup parziale lascia worker dangling | Logic flaw | `unregisterByOwner` (D-126) itera Map e chiama `bridge.terminate()` per ogni worker bound al ownerId. Try/catch isolato per non-fatal. Test `__integration__/cascade-cleanup.test.ts` asserisce zero leak. |

### 11.3 Threat numbering scheme (per plan PLAN.md `<threat_model>` blocks)

Pattern: `T-05-XX-NN` dove `XX` = numero plan (01-07), `NN` = sequenziale entro il plan.

Esempio: `T-05-04-01` = primo threat del plan 05-04 (worker-bridge). Coerente con F4 (`T-04-XX-NN`) e F3 (`T-03-XX-NN`).

---

## 12. Open Questions — NESSUNA bloccante

Tutte le 34 decisioni in 05-CONTEXT.md sono lockate. Eventuali tweak rientrano in Claude's Discretion già documentati:

1. **Naming interno file** — researcher propone convenzione coerente con F3/F4 (es. `worker-pool.ts`, `task-tracker.ts`, `worker-bridge.ts`, `assert-serializable.ts`, `transferable-extractor.ts`, `worker-registry.ts`, `worker-handler.ts`, `worker-broker.ts`, `public-factory.ts`, `augment.ts`). Decisione finale: **planner**.

2. **Sub-codes BrokerError serialization** — researcher propone `worker.serialization.failed.{function|symbol|dom-node|custom-class}` per DX (vedi §6.3). Decisione finale: **planner**.

3. **Counter `workerLateResponses`** — researcher propone in `getDebugSnapshot()` per audit Pitfall 2C (D-133). Lockato dalla discussion ma exact key name al planner.

4. **TS helper `WorkerTasks<T>`** — researcher propone in §2.4 per DX. Optional in plan 05-01 types.

5. **OpzioneB vs A per F3 dispatch worker** (vedi §7.2) — researcher raccomanda Opzione B (composition wrapper pre-publish) con verifica codebase RouterBroker.publish in plan 05-01. Fallback Opzione A (sub-class WorkerEngine) se Opzione B non praticabile.

**Nessuna question richiede input utente prima di procedere al planning.**

---

## 13. Plan dependency graph

```
                                  ┌─────────────────┐
                                  │      05-01       │  Wave 1
                                  │ Bootstrap pkg + │  (sequential gate)
                                  │ types + augment │
                                  └────────┬────────┘
                                           │
                                           ▼
                       ┌───────────────────┴───────────────────┐
                       │                                        │
                       ▼                                        ▼
              ┌────────────────┐                        ┌────────────────┐  Wave 2
              │     05-02       │                        │     05-03       │  (parallel)
              │ assert-serial   │                        │ task-tracker    │
              │ transferable-x  │                        │ state machine   │
              └────────┬────────┘                        └────────┬────────┘
                       │                                          │
                       └───────────────────┬───────────────────────┘
                                           │
                       ┌───────────────────┴───────────────────┐
                       │                                        │
                       ▼                                        ▼
              ┌────────────────┐                        ┌────────────────┐  Wave 3
              │     05-04       │                        │     05-05       │  (parallel)
              │ worker-bridge   │                        │ worker-pool     │
              │ Comlink wrap    │                        │ lazy + bounded  │
              │ MockWorker util │                        │                  │
              └────────┬────────┘                        └────────┬────────┘
                       │                                          │
                       └───────────────────┬───────────────────────┘
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │      05-06       │  Wave 4
                                  │ registry +      │  (sequential gate — consumer)
                                  │ handler +       │
                                  │ broker compos + │
                                  │ public-factory  │
                                  │ + 14 integ test │
                                  └────────┬────────┘
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │      05-07       │  Wave 5/Final
                                  │ Final gate      │  (final closure)
                                  │ DOC-05 + REQ +  │
                                  │ STATE + SUMMARY │
                                  └─────────────────┘
```

**File ownership disgiunta entro wave (vincolo agent-swarm CLAUDE.md):**

| Wave | Plan | File esclusivi |
|------|------|----------------|
| W2 | 05-02 | `src/assert-serializable.{ts,test.ts}`, `src/transferable-extractor.{ts,test.ts}` |
| W2 | 05-03 | `src/task-tracker.{ts,test.ts}` |
| W3 | 05-04 | `src/worker-bridge.{ts,test.ts}`, `src/test-utils/mock-worker.ts` |
| W3 | 05-05 | `src/worker-pool.{ts,test.ts}` |

**Verification:** Plan checker deve verificare disgiunzione file ownership. Pattern già consolidato in F3 (Wave 4-A/4-B/4-C strategies parallel) e F4 (Wave 2 bridge ∥ pool ∥ visibility).

---

## 14. Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | dev/build/test | ✓ | 20.x+ (CI matrix) | — |
| pnpm | workspaces | ✓ | 9.x | — |
| TypeScript | source | ✓ | 6.0.3 (super-set 5.5+) | — |
| tsup | build | ✓ | 8.x (workspace dev) | — |
| Vitest | test runner | ✓ | 4.1.5 | — |
| jsdom | Tier-1 environment | ✓ | 29.1.0 | — |
| @vitest/browser | Tier-3 enabler | ✓ | 4.1.5 | — |
| Playwright Chromium | Tier-3 browser | ✓ (workspace) | 1.59.1 | — |
| comlink | Worker RPC | ✗ (da installare 05-01) | 4.4.2 (target) | NO — V1 LOCKED Comlink |
| Biome | lint+format | ✓ | 1.9+ | — |

**Missing dependencies with no fallback:** nessuno (tutto disponibile).

**Missing dependencies da installare in plan 05-01:**
- `comlink@^4.4.2` (D-125, da `pnpm add comlink --filter @sembridge/worker`)
- `nanoid@^5.1.11` workspace dep
- `valibot@^1.3.1` workspace dep
- workspace deps `@sembridge/core`, `@sembridge/mapper`, `@sembridge/routing`

---

## 15. Assumptions Log

> Tutti i claim in questo research sono `[VERIFIED]` o `[CITED]`. Nessun `[ASSUMED]` rimasto post-CONTEXT.md.

| # | Claim | Section | Source | Risk if Wrong |
|---|-------|---------|--------|---------------|
| V1 | comlink@4.4.2 esiste, released 2024-11-07 | §1, §2.1 | npm view comlink version (live 2026-05-04) | NESSUNO — verified |
| V2 | Comlink supporta `Comlink.proxy(signal)` per AbortSignal | §4.2, §5 | Comlink GitHub README + issues #517/#587/#609 | BASSO — pattern consolidato dal 4.0 (2019); fallback Opzione A custom checkpoint helper |
| V3 | structuredClone supporta Date/Map/Set/ArrayBuffer | §6.1 | WHATWG HTML spec + MDN structuredClone | NESSUNO — spec |
| V4 | jsdom non implementa `Worker` reali | §3.2, §9.1 | Vitest docs + jsdom GitHub README | NESSUNO — verified pattern F4 (jsdom non ha EventSource/WebSocket) |
| V5 | F3 RouterBroker.publish non espone helper canonicalizePublish | §7.2 | Lettura `packages/routing/src/router-broker-wrapper.ts` codebase | MEDIO — researcher raccomanda Opzione B con verifica plan 05-01; fallback Opzione A se non praticabile |
| C1 | navigator.hardwareConcurrency >= 1 in browser evergreen | §5.2 | [CITED: developer.mozilla.org/en-US/docs/Web/API/Navigator/hardwareConcurrency] | BASSO — fallback `4` defensive |
| C2 | RFC structured clone dropping prototype | §6.1 | [CITED: html.spec.whatwg.org/multipage/structured-data.html#safe-passing-of-structured-data] | NESSUNO — spec |

**Tutte le 34 decisioni D-121..D-154 sono assunte come fonte autoritativa lockata da 05-CONTEXT.md → researcher non re-discute.**

---

## 16. References

### Primarie (HIGH confidence)

- **`prd.md`** root — fonte autoritativa unica progetto. Sezioni rilevanti F5: §10, §11.1, §12.2, §15.5, §16.2, §17.2, §17.5, §19.1-19.6, §22.3-22.4, §23.5, §28, §31.3, §34.1, §35.1-35.3, §39 #11, §42.
- **`.planning/phases/05-worker-runtime/05-CONTEXT.md`** — 34 decisioni D-121..D-154 lockate.
- **`.planning/REQUIREMENTS.md`** — WK-01..WK-07 + ERR-02 ext + TEST-01/02/03 subset F5.
- **`.planning/ROADMAP.md`** — Phase 5 success criteria 1-5.
- **Comlink GitHub** (Google Chrome team) — README v4.4.2: https://github.com/GoogleChromeLabs/comlink (verified 2024-11-07 release).
- **WHATWG HTML — Structured Clone Algorithm**: https://html.spec.whatwg.org/multipage/structured-data.html
- **MDN Worker API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
- **MDN structuredClone**: https://developer.mozilla.org/en-US/docs/Web/API/structuredClone
- **MDN AbortController/AbortSignal**: https://developer.mozilla.org/en-US/docs/Web/API/AbortController

### Secondarie (MEDIUM confidence)

- **`.planning/research/STACK.md`** §6 (Comlink), §8 (structuredClone), §9 (test 3-tier).
- **`.planning/research/PITFALLS.md`** #2 (race), #4 (backpressure), #7 (worker pitfalls).
- **`.planning/research/ARCHITECTURE.md`** §6 (Worker placement), §13 (phase ordering).
- **Codebase F3/F4 pattern reference:**
  - `packages/routing/src/router-broker-wrapper.ts` (composition wrapper F3 — base per F5)
  - `packages/routing/src/route-executor.ts` (dispatch table — placeholder D-77 worker)
  - `packages/gateway/src/sse-ws/realtime-broker.ts` (composition wrapper F4 — modello F5)
  - `packages/gateway/src/sse-ws/realtime-channel-manager.ts` (registry N-channel + cascade)
  - `packages/gateway/src/sse-ws/test-utils/mock-event-source.ts` (modello MockWorker F5)
  - `packages/gateway/src/sse-ws/test-utils/realtime-harness.ts` (modello WorkerHarness F5 in 05-06)
- **Decisioni cross-fase carryover:**
  - F4 D-101 composition wrapper, D-112 cascade cleanup, D-114 mapper canonicalization, D-115 backpressure, D-116 validation, D-117/D-118 TDD/3-tier
  - F3 D-83 strict, D-69 timeout, D-75 backpressure, D-77 placeholder worker, D-78/D-80 OutcomeCollector, D-86 cascade unregisterByOwner, D-88 TDD, D-92 coverage, D-94 declaration merging
  - F2 D-44 onFailure, D-49 composition Mapper, D-57 PluginDescriptor extension
  - F1 D-25/D-26 cascade, D-30 no singleton

### Live verification (npm registry 2026-05-04)

- `npm view comlink version` → `4.4.2` (modified 2024-11-07)
- `npm view nanoid version` → `5.1.11`
- `npm view valibot version` → `1.3.1`

---

## 17. Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Stack & versioning | HIGH | Comlink 4.4.2 verified live; valibot/nanoid riusati F1-F4; vitest/playwright workspace deps |
| Architettura composition wrapper | HIGH | Pattern F3 D-83 + F4 D-101 consolidato 2 volte. F5 segue identico. |
| State machine atomico Pitfall 2C | HIGH | JS event loop single-threaded → atomicità implicita. Test deterministic Tier-1 trivial. |
| Cancellation hybrid (D-131) | MEDIUM-HIGH | Comlink AbortSignal proxy ben documentato. Caveat `await signal.aborted` async — DOC-05 deve essere chiaro. |
| Pool strategy bounded (D-127/128) | HIGH | Pattern noto worker pool. Cap hard 8 conservativo. |
| Serialization contract (D-139..142) | HIGH | WHATWG SCA spec ben definita. assertSerializable deep-walk algoritmo standard. |
| Pipeline §28 step 9 dispatch | MEDIUM | Opzione B (composition pre-publish) raccomandata ma richiede verifica RouterBroker.publish in plan 05-01. Fallback Opzione A available. |
| Test 3-tier (D-150) | HIGH | Pattern F4 D-118 consolidato. MockWorker analogo a MockEventSource F4. |
| Pitfalls mitigations | HIGH | Tutti i 7 Pitfall #7.A-E + #2.A/C hanno mitigation concreta in F5. |
| Threat model security | HIGH | ASVS L1 applicable categories chiare. Boundary worker nativa. |

**Overall confidence:** HIGH

**Valid until:** 2026-06-04 (30 giorni stable). Re-check Comlink major release o new structuredClone spec changes.

---

## RESEARCH COMPLETE

**Plan count proposto:** 7 plan in 6 wave (W1 bootstrap, W2 building blocks A∥B, W3 adapters A∥B, W4 composition + integration test, W5/Final gate). Coerente con F4 (9 plan / 6 wave) e F3 (14 plan / 9 wave) — F5 più piccolo per ortogonalità a F4 e perché niente dual transport (solo Worker, no SSE+WS).

**Confidence overall:** **HIGH** — 34 decisioni lockate da CONTEXT.md (zero questions bloccanti); pattern F3/F4 consolidati 2 volte; Comlink API stabile dal 2019; WHATWG SCA spec ben definita; assertSerializable algoritmo standard; D-83 strict carryover meccanico; rischi residui (Opzione A vs B per F3 dispatch) hanno fallback documentato.

**Key risks identificati:**
1. **R1 — Opzione B vs A per F3 dispatch worker (§7.2):** RouterBroker.publish potrebbe non esporre helper componibile per pipeline §28 step 1-7. Mitigation: plan 05-01 verifica codebase + fallback Opzione A (sub-class WorkerEngine). Probability: bassa (RouterBroker delega a inner.publish standard, quindi step 1-7 si applicano automaticamente).
2. **R2 — Comlink AbortSignal proxy `async signal.aborted`:** DX gotcha — dev abituati a `if (signal.aborted)` sync potrebbero scrivere `if (signalProxy.aborted)` con risultato `Promise<bool>` truthy sempre. Mitigation: DOC-05 esplicita + helper `createCheckpointFn` opzionale (Claude's Discretion §4.2).
3. **R3 — pool size hard cap 8:** scelta conservativa (D-128). Su browser desktop con `hwc=16+` un dev potrebbe voler più di 8. Mitigation: `allowUnboundedPool: true` opt-in con warning. Re-evaluation V1.x se profiling reale mostra problema.
4. **R4 — TS declaration merging RouteDefinition union:** `type RouteDefinition = A | B | C | D` non supporta declaration merging. F5 deve gestire `RouteWorkerDefinition` come tipo separato. Mitigation: documentato pattern F4-style in §7.1 (consumer dichiara super-set localmente). Già consolidato in F4 con `F3PipelineStep`/`F4PipelineStep` separati.
5. **R5 — Test Tier-3 Playwright Worker reale richiede `vitest.browser.config.ts` separato:** complessità setup. Mitigation: pattern F4 `__browser__/playwright-sse-smoke.test.ts` riusato 1:1.

**Versioni npm verificate live (2026-05-04):**
- `comlink@4.4.2` (registry, released 2024-11-07, license Apache-2.0, ~1.13 KB gzipped, types incluso)
- `nanoid@5.1.11` (registry, riuso F1)
- `valibot@1.3.1` (registry, riuso F2)
- `vitest@4.1.5` + `@vitest/browser@4.1.5` + `playwright@1.59.1` + `jsdom@29.1.0` (riuso F1-F4 workspace)

**File creato:** `/Users/omarmarzio/programming/prova AI/SemBridge/.planning/phases/05-worker-runtime/05-RESEARCH.md`

**Pronto per:** `/gsd-plan-phase 5` (planner consumerà questo RESEARCH.md per produrre 7 PLAN.md F5 — 05-01 bootstrap, 05-02 assert+extractor, 05-03 task-tracker, 05-04 worker-bridge, 05-05 worker-pool, 05-06 broker+integration, 05-07 final-gate).
