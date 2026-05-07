# @gluezero/worker

> Worker Runtime per GlueZero — Phase 5 (Comlink-based RPC + bounded pool + state machine atomico Pitfall 2C closure + WK-07 serializzazione documentata).

ESM-only TypeScript library. Browser evergreen target (ES2022). Composition wrapper di [`@gluezero/routing`](../routing/README.md) `RouterBroker` (D-121, D-83 strict carryover): un singolo entry point `createWorkerBroker(config)` orchestra route HTTP, route worker, mapping canonico, plugin lifecycle, pipeline §28 estesa con step 9 dispatch worker (D-152).

Cinque dipendenze runtime: [`@gluezero/core`](../core/README.md) (BrokerError + BrokerEvent + tipi base, F1), [`@gluezero/mapper`](../mapper/README.md) (canonical mapping, F2), [`@gluezero/routing`](../routing/README.md) (RouterBroker base composta, F3), [`@gluezero/gateway`](../gateway/README.md) (BackpressureStrategy F3 riusata 1:1, F3), [`comlink`](https://github.com/GoogleChromeLabs/comlink) 4.4.2 (RPC postMessage), [`nanoid`](https://github.com/ai/nanoid) (correlationId end-to-end D-134), [`valibot`](https://valibot.dev) (config validation).

## Indice

1. [Quick start](#1-quick-start)
2. [Worker source contract](#2-worker-source-contract)
3. [Pool strategy](#3-pool-strategy)
4. [Cancellation](#4-cancellation)
5. [Progress events](#5-progress-events)
6. [Serialization contract WK-07 (PRD §39 #11)](#6-serialization-contract-wk-07-prd-39-11)
7. [Scenario meteo F5 / report generation pesante](#7-scenario-meteo-f5--report-generation-pesante)
8. [State machine timeout vs success (Pitfall 2C closure)](#8-state-machine-timeout-vs-success-pitfall-2c-closure)
9. [Worker module loading](#9-worker-module-loading)
10. [Limitazioni V1](#10-limitazioni-v1)
11. [Q&A closure (PRD §39 #11)](#11-qa-closure-prd-39-11)

---

## 1. Quick start

`@gluezero/worker` espone `createWorkerBroker(config)` come factory pubblico (D-122, anti-singleton D-30). Il broker compone trasparentemente il `RouterBroker` di Phase 3 (D-121, D-83 strict carryover): per topic con worker route registrata, intercetta la `publish` PRIMA del `RouterBroker.publish` (Opzione B research §7.2) e dispatch al pool worker; per topic non-worker delega trasparente al `RouterBroker` invariato (pipeline F3 HTTP/local/cache/composite preservata).

```ts
import { createWorkerBroker } from '@gluezero/worker'

const broker = createWorkerBroker({
  workers: { assertSerializable: 'dev' },
  workerRoutes: [
    {
      type: 'worker',
      id: 'report-route',
      topic: 'report.generation.requested',
      worker: 'report-worker',
      task: 'generateReport',
      policies: { timeout: 30_000, concurrency: 'latest-only' },
    },
  ],
})

broker.registerPlugin({
  id: 'reports-plugin',
  workers: [
    {
      id: 'report-worker',
      factory: () => new Worker(new URL('./report.worker.ts', import.meta.url), { type: 'module' }),
      tasks: ['generateReport'] as const,
      mode: 'pool',
      size: 2,
    },
  ],
})

broker.subscribe('report.generation.completed', (e) => console.log('Done:', e.payload))
broker.subscribe('report.generation.progress', (e) => updateProgressBar(e.payload))
broker.subscribe('report.generation.failed', (e) => console.error('Failed:', e.payload))

// Publish trigger:
await broker.publish('report.generation.requested', { period: '2026-Q1' })
```

`createWorkerBroker` è una **pure function** — ogni chiamata ritorna una nuova istanza isolata (D-30 anti-singleton). La validazione `WorkerBrokerConfigSchema` Valibot avviene al boot: errori schema → `Error` nativo con prefix `Invalid WorkerBrokerConfig:` e dettagli per fixing developer-time. La validazione runtime per-evento (canonical, dedupe, transform) è delegata a F2/F3 invariati.

## 2. Worker source contract

Ogni worker source deve esporre via `Comlink.expose` un oggetto API con le **task dichiarate esplicitamente** in `WorkerDescriptor.tasks` (D-124 fail-fast — `worker.task.unknown` BrokerError sollevato al register se la route fa riferimento a un task non in `tasks: readonly string[]`). La factory `() => Worker` (D-123) è **lazy**: il worker viene istanziato solo al primo dispatch (D-129 lazy first-dispatch), evitando overhead inutile per worker registrati ma mai usati.

Esempio di worker source ESM (D-147 default + D-148 pattern bundler-friendly):

```ts
// report.worker.ts
import * as Comlink from 'comlink'

const api = {
  generateReport: async (
    input: { period: string; format: 'pdf' | 'csv' },
    signal: Comlink.Remote<AbortSignal>,
    onProgress?: Comlink.Remote<(p: { value: number; message?: string }) => void>,
  ) => {
    onProgress?.({ value: 0.05, message: 'Loading data' })
    if (await signal.aborted) throw new DOMException('Aborted', 'AbortError')

    const rows = await loadRows(input.period)
    onProgress?.({ value: 0.4, message: `Loaded ${rows.length} rows` })

    if (await signal.aborted) throw new DOMException('Aborted', 'AbortError')

    const summary = aggregate(rows)
    onProgress?.({ value: 0.9, message: 'Finalizing' })

    return { period: input.period, rows: rows.length, summary, format: input.format }
  },
}

Comlink.expose(api)
```

**Hybrid Comlink expose + dispatcher utility (D-125)**: l'API supporta sia `Comlink.expose(api)` diretto sia il pattern `createTaskDispatcher({ tasks })` opzionale per mappare task name → function più esplicitamente. Il consumer sceglie in base a complessità del worker.

**Top-level `registerWorker` + `PluginDescriptor.workers` declaration merging (D-126)**: i worker possono essere registrati a livello broker (`broker.registerWorker(...)`) o dichiarati come parte di un plugin (`PluginDescriptor.workers: readonly WorkerDescriptor[]`). Quest'ultimo caso eredita automaticamente `ownerId = pluginId` e abilita la cascade cleanup F5 ext LIFE-02 al `unregisterPlugin`.

## 3. Pool strategy

| Mode          | Use case                                              | Default size              |
| ------------- | ----------------------------------------------------- | ------------------------- |
| `'dedicated'` | Worker stateful (cache interna, ML model loaded once) | 1 fisso                   |
| `'pool'`      | Throughput stateless (parsing CSV, image resize)      | `min(hwc, 4)` cap hard 8  |

**Default pool size (D-127)**: `min(navigator.hardwareConcurrency, 4)` con fallback `4` per ambienti SSR/jsdom dove `hardwareConcurrency` può essere indefinito o malformato. Una macchina developer 8-core macOS userà 4 worker; un Chromebook 2-core ne userà 2.

**Cap hard 8 (D-128)**: oltre 8 worker concorrenti per pool è una bandiera rossa empirica (context switch overhead, memory pressure RAM/heap). Setting `size > 8` → `WorkerRegistry` solleva `worker.pool.size.exceeded` a meno di `allowUnboundedPool: true` opt-in (con `console.warn` 1x — Pitfall 7.D protection — non silente).

**Lazy first-dispatch (D-129)**: il pool non spawna worker al register, solo al primo `schedule()`. Un'app con 5 plugin che dichiarano worker ma di cui solo 2 vengono effettivamente usati spawna 0 worker per i 3 inutilizzati.

**BackpressureStrategy F3 riusata 1:1 (D-130)**: la coda di scheduling worker condivide la stessa policy di backpressure F3 (`queue-bounded`, `drop-old`, `drop-new`, `throttle`, `debounce`, `latest-only`, `coalesce`) tramite import diretto `from '@gluezero/gateway/http'`. Zero ridichiarazione tipi, zero copia logica, zero modifica F3 source. Override per-route via `RouteWorkerDefinition.policies.backpressure`.

**Critical bypass esplicito (Pitfall 4.C consistency)**: `priority === 'critical'` bypassa la coda backpressure (event broadcast ad esempio). Bypass `grep -c "priority === 'critical'"` audit-able.

```ts
{
  type: 'worker',
  id: 'csv-route',
  topic: 'csv.parse.requested',
  worker: 'csv-worker',
  task: 'parseCsv',
  policies: {
    backpressure: { policy: 'queue-bounded', maxSize: 100 },
    concurrency: 'latest-only',  // D-144 default
  },
}
```

## 4. Cancellation

**Hybrid cancellation (D-131)**: la strategia dipende dal `mode`:

- **`mode: 'dedicated'`** → `worker.terminate()` immediato. Hard kill: l'event loop interno del worker viene distrutto. Indicato per worker stateful dove la pulizia non è critica (cache evict implicito).
- **`mode: 'pool'`** → cooperative cancellation: il consumer setta `signal.aborted` (proxiato via Comlink, D-132); il worker deve check periodicamente `if (await signal.aborted) throw ...`. Grace period default `cancelGraceMs: 2000` ms — se il worker non onora il signal entro grace → `worker.terminate()` fallback.

**AbortSignal proxy via Comlink (D-132)**: `Comlink.proxy(signal)` espone un `AbortSignal` riferimento remoto al worker. Il worker chiama `await signal.aborted` (booleano async via RPC) o `signal.addEventListener('abort', ...)` se vuole reagire pro-attivamente.

**Concurrency 'latest-only' default (D-144)**: per ogni `routeId`, una nuova `publish` mentre un task con stesso routeId è in-flight aborta automaticamente il precedente (analog F3). Override esplicito tramite `policies.concurrency`: `'serial'` (queue), `'parallel'` (no abort), `'latest-only'` (default).

```ts
// Lato consumer:
const ctrl = new AbortController()
broker.publish('report.generation.requested', { period: '2026-Q1' }, { signal: ctrl.signal })
// ... user clicca cancel:
ctrl.abort('user-cancelled')

// Lato worker (cooperative pattern):
const generateReport = async (
  input: { period: string },
  signal: Comlink.Remote<AbortSignal>,
  onProgress?: Comlink.Remote<(p: { value: number; message?: string }) => void>,
) => {
  for (let i = 0; i < 100; i++) {
    if (await signal.aborted) {
      throw new DOMException('Cancelled', 'AbortError')
    }
    await processChunk(i)
    onProgress?.({ value: (i + 1) / 100 })
  }
  return { rows: 100 * 1000 }
}
```

## 5. Progress events

**Comlink callback proxy (D-135)**: `WorkerBridge` proxia un `onProgress: (payload) => void` lato main → worker tramite `Comlink.proxy(callback)`. Il worker invoca `onProgress?.({ value: 0..1, message?, partialResult? })` localmente, l'invocazione viene serializzata via SCA + postMessage al main thread, dispatch a `<topic>.progress` BrokerEvent (D-138 progress passa per pipeline §28 mapper + validation come ogni altro evento).

**Schema canonical (D-136)**: `ProgressPayload` ha shape rigida lockata:

```ts
type ProgressPayload = {
  readonly value: number       // 0..1 (clamp lato bridge)
  readonly message?: string    // optional UI hint
  readonly partialResult?: unknown  // optional incremental result
}
```

**Throttle adapter-level (D-137)**: `progressThrottleMs: 100` default — il bridge applica una throttle latest-only window leading+trailing 100ms. Una progress storm dal worker (es. 1000 chiamate/secondo) viene compressa a ~10 events/secondo nel main thread, evitando re-render pressure UI. Override tramite `WorkerBrokerConfig.workers.progressThrottleMs` o per-route policy.

```ts
broker.subscribe('report.generation.progress', (event) => {
  const { value, message } = event.payload as ProgressPayload
  updateProgressBar(value, message)
})
```

## 6. Serialization contract WK-07 (PRD §39 #11)

> **Closure ufficiale Phase 5** — questa sezione chiude esplicitamente il punto 11 della checklist PRD §39 (serializzazione messaggi worker).

### Default: `structuredClone` (Structured Clone Algorithm)

`@gluezero/worker` usa `postMessage` standard come backbone Comlink. Il browser applica automaticamente lo Structured Clone Algorithm (SCA) — niente `JSON.stringify`, niente `superjson` di default (V1 — D-142 closure).

**Tipi supportati nativamente da SCA (round-trip preservato):**

| Tipo                                       | Round-trip preservato | Note                                  |
| ------------------------------------------ | --------------------- | ------------------------------------- |
| `Object` plain                             | ✅                     |                                       |
| `Array`                                    | ✅                     |                                       |
| `Date`                                     | ✅                     | `instanceof Date` preservato          |
| `Map`, `Set`                               | ✅                     | iterazione preservata                 |
| `ArrayBuffer`, `TypedArray`, `DataView`    | ✅                     |                                       |
| `RegExp`                                   | ✅                     | flags preservati                      |
| `Blob`, `File`, `ImageData`, `ImageBitmap` | ✅                     |                                       |
| `MessagePort`                              | ✅ (transferable)      |                                       |
| `BigInt`                                   | ✅                     |                                       |
| `Error`, `DOMException`                    | ✅                     | message + name preservati             |

**Tipi NON supportati (throw `DataCloneError` PRE-postMessage):**

| Tipo                                                   | Strategia raccomandata                                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `function`                                             | Registra via `registerTransform(name, fn)` (F2), passa `transformId: string` come stringa      |
| `Symbol`                                               | Usa string token come chiave (es. `'ROLE_ADMIN'`)                                              |
| `DOM Node` (HTMLElement, Text, ...)                    | Estrai dato strutturato lato main (`element.outerHTML`, `element.dataset`)                     |
| Class instance con prototype custom (es. `new Order()`) | Serializza a `{ ...obj, __type: 'Order' }` + reidrata lato worker                              |

> **MAI usare `JSON.stringify` lato consumer pre-publish:** F5 mantiene SCA passthrough invariato. `JSON.stringify` rompe `Date`/`Map`/`Set`/`BigInt` silenziosamente (es. `Date` → `string`, `Map` → `{}`). Questo è il bug più comune nel codice consumer.

### `assertSerializable` (D-139, D-140)

In **dev mode** (default `process.env.NODE_ENV !== 'production'` auto-detect), `WorkerBridge` invoca `assertSerializable(payload)` PRE-`postMessage`. Funzione deep-walk recursive con cycle detection (`WeakSet`) che fa fail-fast con shape `BrokerError`:

```ts
{
  code: 'worker.serialization.failed.{function|symbol|dom-node|custom-class}',
  category: 'worker',
  details: {
    fieldPath: 'payload.options.transform',  // JSONPath-style
    fieldType: 'function',
  },
}
```

Override esplicito modalità:

```ts
createWorkerBroker({
  workers: { assertSerializable: 'always' | 'dev' | 'off' }
})
```

- `'dev'` (default): auto-detect via `NODE_ENV`.
- `'always'`: ON anche in production (audit critico).
- `'off'`: OFF anche in dev (zero overhead, raro).

In production builds (auto-detect): disattivato → zero overhead.

### Transferable opt-in (D-141)

Per evitare il **costo della copia SCA** su payload pesanti (es. `ArrayBuffer` multi-MB, `ImageBitmap`), dichiara `transferable` come array JSONPath-like nella route:

```ts
{
  type: 'worker',
  id: 'audio-route',
  topic: 'audio.process.requested',
  worker: 'audio-worker',
  task: 'analyze',
  transferable: ['payload.audioBuffer', 'payload.samples[*].buffer'],
}
```

L'extractor `extractTransferables` walka il payload per ogni JSONPath e raccoglie i target in un array passato come secondo argomento a `postMessage(payload, transferList)`. Il browser sposta ownership invece di copiare.

> ⚠️ **WARNING (Pitfall 7.E):** un campo `transferable` perde l'ownership lato main thread immediatamente post-`postMessage`. `audioBuffer.byteLength === 0` IMMEDIATAMENTE dopo `publish` — non è un bug, è il behavior del transferable. Documenta nel tuo codice consumer che il payload originale viene "consumato" dalla `publish`. Se hai bisogno di mantenere una copia main-side, fai `audioBuffer.slice(0)` PRIMA di passare al broker.

Verifica end-to-end di Pitfall 7.E è coperta in `__browser__/playwright-worker-smoke.test.ts` (D-150 Tier-3 Playwright Chromium reale — jsdom non implementa Worker nativo).

## 7. Scenario meteo F5 / report generation pesante

Esempio end-to-end PRD §29 esteso a worker — plugin form + plugin widget + worker CSV/report. Mostra correlationId end-to-end (D-134) + progress events + outcome `<topic>.completed`/`.failed` (D-146 topic auto-derive) + cascade cleanup (LIFE-02 ext F5).

```ts
import { createWorkerBroker } from '@gluezero/worker'

const broker = createWorkerBroker({
  workers: { assertSerializable: 'dev' },
})

// Plugin: report-plugin.ts
const reportPlugin = {
  id: 'report-plugin',
  workers: [
    {
      id: 'report-worker',
      factory: () => new Worker(new URL('./report.worker.ts', import.meta.url), { type: 'module' }),
      tasks: ['generateReport'] as const,
      mode: 'pool' as const,
      size: 2,
    },
  ],
}

broker.registerPlugin(reportPlugin)

broker.registerWorkerRoute({
  type: 'worker',
  id: 'report-route',
  topic: 'report.generation.requested',
  worker: 'report-worker',
  task: 'generateReport',
  publishes: { /* default auto-derive D-146 — completed/progress/failed */ },
  policies: { timeout: 60_000, concurrency: 'serial' },  // batch processing serial
})

// Plugin widget consumer (separato — interoperabilità via topic):
broker.subscribe('report.generation.progress', (e) => updateProgressBar(e.payload))
broker.subscribe('report.generation.completed', (e) => showReport(e.payload))
broker.subscribe('report.generation.failed', (e) => showError(e.payload))

// Plugin widget consumer alternativo — usa topic auto-derived `worker.error` ext F5:
broker.subscribe('worker.error', (e) => logToTelemetry(e.payload))

// User clicca "Genera report":
await broker.publish('report.generation.requested', {
  period: '2026-Q1',
  format: 'pdf',
})

// ... successivamente, user logout → unregisterPlugin cascade:
broker.unregisterPlugin('report-plugin')
// → cascade: subscribe orphan removal + worker pool terminate + bridges teardown
//   (LIFE-02 ext F5 — D-126 + D-131 dedicated terminate / pool cooperative grace)
```

Il `correlationId` (`event.correlationId`) viaggia end-to-end sulle 3 outcome: il plugin widget può raggruppare progress + completed sotto lo stesso "report run" anche se altre route worker emettono progress nello stesso momento.

## 8. State machine timeout vs success (Pitfall 2C closure)

**State machine atomico (D-133)**: ogni task ha uno stato lockato in un `Map<TaskId, TaskState>` con CAS atomico (Compare-And-Swap). Stati possibili: `'pending' | 'running' | 'done' | 'timeout' | 'cancelled' | 'error'`.

**Pitfall 2C closure**: la race classica `worker.respond()` arriva subito DOPO `setTimeout` ha emesso `worker.timeout`. Senza CAS, l'app emette sia `<topic>.failed` (timeout) sia `<topic>.completed` (late response) — stato inconsistente. Con CAS atomico:

1. `setTimeout` callback vede `state === 'running'` → CAS → `'timeout'` → publish `<topic>.failed`.
2. Late `worker.respond()` arriva → CAS check `state === 'running'`? NO, `state === 'timeout'`. → ignored silently.
3. Counter `lateResponses++` per audit (debug-only).

Il test `__integration__/timeout-strict.test.ts` verifica deterministicamente con fake timer:

- 1 publish + worker non-rispondente (sleep > timeout)
- aspetta timeout fired
- aspetta worker eventually responds (late)
- assert: `events.filter(e => e.topic === 'long.work.failed').length === 1`
- assert: `events.filter(e => e.topic === 'long.work.completed').length === 0` (NESSUN .completed)
- assert: `tracker.tasksCompleted === 1`

**Correlation ID end-to-end (D-134)**: ogni task riceve un `correlationId` nanoid 16-char generato al register. Logging/audit lo traccia end-to-end:
`[corr=AbCd...] router.dispatch → [corr=AbCd...] pool.acquireSlot → [corr=AbCd...] bridge.dispatch → [corr=AbCd...] worker.respond → [corr=AbCd...] tracker.markDone → [corr=AbCd...] publishOutcome <topic>.completed`.

## 9. Worker module loading

**ESM module default (D-147)**: il pattern raccomandato è `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`. ESM permette `import` standard dentro il worker (non hack tipo `importScripts`), tree-shaking, source maps coerenti.

**Pattern `new URL(import.meta.url)` (D-148)**: bundler-friendly per Vite/esbuild/tsup/Webpack 5+. Il bundler riconosce il pattern e produce un asset separato per il worker, con URL hash content-addressable. Il consumer non deve configurare nulla — funziona out-of-the-box su tutti i bundler moderni.

```ts
// ESM (default raccomandato):
factory: () => new Worker(new URL('./report.worker.ts', import.meta.url), { type: 'module' })

// Classic opt-in (raro — D-147 estensione opt-in a PRD §31.3):
factory: () => new Worker(new URL('./legacy.worker.js', import.meta.url))
// (richiede WorkerDescriptor.workerType === 'classic')
```

Il `workerType: 'classic'` opt-in è documentato come estensione PRD §31.3 — usabile solo per worker source legacy che non supportano ESM (raro, principalmente codice generato da tool vintage).

## 10. Limitazioni V1

- Pool autoscaling con strategie configurabili (CPU-pressure, queue-length-based) → V2 (WK2-01).
- `superjson` adapter pluggable → V1.x quando emerge use case fuori SCA (`Date`/`Map`/`Set`/`BigInt` sono già coperti da SCA — il caso primario è classi user-defined).
- Custom RPC alternative to Comlink (es. RPC custom binary protocol) → V1.x se Comlink mostra friction; l'astrazione `WorkerBridge` interna prepara lo swap.
- `SharedWorker` cross-tab → V2 (separato architettonicamente — design-time decision).
- `worker.retry` policy idempotent → V1.x come opt-in (V1 = no retry default — D-143 — per evitare amplification di task non idempotenti).
- Auto-detect transferable heuristic (es. detection automatica di `ArrayBuffer` payload) → V1.x; V1 = JSONPath dichiarato esplicito (predicabilità + zero false positive).
- Worker telemetry hooks reali (`WorkerInspector` analogo a `EventInspector`/`MappingInspector`/`RouteInspector`) → F6.
- IndexedDB-backed worker queue persistence (resume task post tab close) → V2.
- `worker.spawn.preheat` (warm pool al boot vs lazy first-dispatch) → V1.x opt-in per workload critico start-up.

## 11. Q&A closure (PRD §39 #11)

> ✅ **Open issue PRD §39 punto 11 (WK-07 serializzazione messaggi worker) — CHIUSO in Phase 5.**

| Domanda                            | Risposta lockata Phase 5                                                                                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default serializer?                | `structuredClone` (SCA) tramite `postMessage` standard — D-142 (no `JSON.stringify`, no `superjson` di default V1)                                                    |
| Function ammesse?                  | NO. Registrare via `registerTransform(name, fn)` di F2, passare `transformId: string` come stringa                                                                    |
| Validatore pre-send?               | `assertSerializable` deep-walk recursive con cycle detection (WeakSet) — D-139, D-140 (file `assert-serializable.ts`)                                                 |
| Override mode?                     | `BrokerConfig.workers.assertSerializable: 'always' \| 'dev' \| 'off'` (default `'dev'` auto-detect via `NODE_ENV`)                                                    |
| Transferable?                      | Opt-in via `route.transferable: readonly string[]` JSONPath-like — D-141 (file `transferable-extractor.ts`)                                                           |
| Date/Map/Set preservati?           | ✅ via SCA — testato Tier-3 Playwright Chromium real-browser (`__browser__/playwright-worker-smoke.test.ts` D-150 + D-151 #7)                                          |
| Worker source spec?                | Factory `() => Worker` (D-123) + tasks dichiarate (D-124 fail-fast) + mode dedicated/pool (D-127)                                                                     |
| Module loading?                    | ESM default `new URL(..., import.meta.url) + { type: 'module' }` (D-147 + D-148); classic opt-in raro                                                                 |
| Cancellation?                      | AbortSignal proxied via Comlink (D-132) + dedicated `terminate()` immediato / pool cooperative grace 2000ms (D-131)                                                   |
| Progress events?                   | Comlink callback proxy schema canonical `{value, message?, partialResult?}` (D-135 + D-136), throttled 100ms latest-only (D-137), passa per pipeline §28 mapper (D-138) |
| Race timeout vs success?           | State machine atomico CAS — late responses scartate silenziosamente, counter `lateResponses` per audit (D-133, Pitfall 2C closure deterministica via fake timer)      |
| Topic naming?                      | Auto-derive D-146 (`<topic>.completed/.progress/.failed`) o override esplicito via `route.publishes.{success\|progress\|error}`                                       |
| Cascade cleanup plugin unregister? | LIFE-02 ext F5 (D-126): subscribe orphan removal + worker pool terminate + bridges teardown idempotenti                                                               |
| Pool default size?                 | `min(navigator.hardwareConcurrency, 4)` cap hard 8 (D-127, D-128); `allowUnboundedPool: true` opt-in con `console.warn` 1x                                            |
| Backpressure?                      | F3 `BackpressureStrategy` riusato 1:1 via `import from '@gluezero/gateway/http'` (D-130) — zero ridichiarazione                                                      |

---

## Riferimenti

- [`DECISIONS.md`](../../DECISIONS.md) — 170 decisioni architetturali con riferimenti a sezioni di design
- [`@gluezero/core`](../core/README.md) (BrokerError + BrokerEvent + EventTap, F1)
- [`@gluezero/mapper`](../mapper/README.md) (canonical mapping registries, F2)
- [`@gluezero/routing`](../routing/README.md) (RouterBroker + RouteResolver, F3)
- [`@gluezero/gateway`](../gateway/README.md) (BackpressureStrategy F3 + sub-modulo /sse-ws F4)
- [Comlink](https://github.com/GoogleChromeLabs/comlink) 4.4.2 (RPC postMessage)

## Licenza

MIT.

*Phase 5 closure date: 2026-05-05. Ready for `gsd-verifier 5`.*
