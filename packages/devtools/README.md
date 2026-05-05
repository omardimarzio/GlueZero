# @sembridge/devtools

> Developer tooling per SemBridge — Phase 6 (Event Inspector + Route Inspector + MetricsCollector simil-OpenMetrics + PauseController + getDebugSnapshot deep-clone — closes PRD §39 #10 / TOOL-05 metrics format).

ESM-only TypeScript library. Browser evergreen target (ES2022). Composition wrapper di [`@sembridge/routing`](../routing/README.md) `RouterBroker` (D-121, D-83 strict carryover): un singolo entry point `createDevtoolsBroker(config)` orchestra route F3 + tap registry chain D-159 + Inspector ring buffer 500 (D-167) + MetricsCollector cumulative-only (D-164) + PauseController FIFO + critical bypass (D-170).

Quattro dipendenze runtime: [`@sembridge/core`](../core/README.md) (EventTap + PipelineSnapshot, F1), [`@sembridge/mapper`](../mapper/README.md) (canonical mapping, F2 — implicit via routing), [`@sembridge/routing`](../routing/README.md) (RouterBroker base composta, F3), [`valibot`](https://valibot.dev) (config validation al boundary).

## Indice

1. [Quick start](#1-quick-start)
2. [Tap registry chain D-159](#2-tap-registry-chain-d-159)
3. [EventInspector + RouteInspector](#3-eventinspector--routeinspector)
4. [enableDebug / disableDebug](#4-enabledebug--disabledebug)
5. [getDebugSnapshot deep-clone](#5-getdebugsnapshot-deep-clone)
6. [MetricsCollector — closes PRD §39 #10 (TOOL-05)](#6-metricscollector--closes-prd-39-10-tool-05)
7. [PauseController — pauseTopic / resumeTopic / flushQueue](#7-pausecontroller--pausetopic--resumetopic--flushqueue)
8. [Scenario meteo + Inspector dump](#8-scenario-meteo--inspector-dump)
9. [Anti-pattern cardinality explosion](#9-anti-pattern-cardinality-explosion)
10. [Performance caveat](#10-performance-caveat)
11. [Q&A](#11-qa)

---

## 1. Quick start

`@sembridge/devtools` espone `createDevtoolsBroker(config)` come factory pubblico (D-30 anti-singleton). Il broker compone trasparentemente il `RouterBroker` di Phase 3 (D-121, D-83 strict carryover) e installa un `MultiplexTap` aggregator come singleton `runtime.tap` — il tap chain riceve TUTTI gli step §28 della pipeline (steps 1-13 da F1+F2+F3+F4+F5 + step 14 attivato in F6).

```ts
import { createDevtoolsBroker } from '@sembridge/devtools'

const broker = createDevtoolsBroker({
  devtools: { enableByDefault: true, eventBufferSize: 500 },
})

broker.subscribe('weather.loaded', (event) => {
  console.log('Weather loaded:', event.payload)
})

await broker.publish('weather.requested', { city: 'Roma' })

// Snapshot debug deep-clone (D-162):
const snap = broker.getDebugSnapshot()
console.log('Recent events:', snap.recentEvents.length)
console.log('Recent routes:', snap.recentRoutes.length)
console.log('Counters:', snap.currentMetrics.counters)
```

`createDevtoolsBroker` è una **pure function** — ogni chiamata ritorna una nuova istanza isolata (D-30). La validazione `DevtoolsBrokerConfigSchema` Valibot avviene al boot: errori schema → `Error` nativo con prefix `Invalid DevtoolsBrokerConfig:`.

## 2. Tap registry chain D-159

**D-159 multiplex chain:** il devtools layer permette di registrare N `EventTap` user-side via `config.taps?: readonly EventTap[]` invece del singleton legacy F1 `runtime.tap`. Il broker installa internamente:

1. `EventInspector.tap` (capture step 1-14 in ring buffer 500)
2. `RouteInspector.tap` (capture step 9+10, aggrega per `(eventId, routeId)`)
3. `MetricsCollector.tap` (no-op default; il `DevtoolsBroker` 06-08b è responsabile dell'auto-increment lifecycle metrics)
4. ...user taps (`config.taps[]`)
5. `runtime.tap` legacy F1 single-tap auto-wrappato (`wrapLegacyTap` 06-04)

Tutti i tap sono chained via `MultiplexTap` con error isolation: un throw da un tap NON propaga agli altri (try/catch swallow per ciascuno — pattern carryover F1 D-20 `safeTapStep`).

```ts
import { createDevtoolsBroker } from '@sembridge/devtools'
import type { EventTap } from '@sembridge/core'

const auditTap: EventTap = {
  onPipelineStep(step, snapshot) {
    if (step === 'event.observed') {
      console.log(`[AUDIT] ${snapshot.eventId} ${snapshot.topic}`)
    }
  },
}

const consoleTap: EventTap = {
  onPipelineStep(step, snapshot) {
    if (snapshot.durationMs > 100) {
      console.warn(`Slow step: ${step} took ${snapshot.durationMs}ms`)
    }
  },
}

const broker = createDevtoolsBroker({
  taps: [auditTap, consoleTap], // D-159 chain — entrambi ricevono ogni step
})
```

**Auto-wrap legacy F1 (`wrapLegacyTap` 06-04):** il `runtime.tap` legacy F1 è auto-aggiunto al chain → il consumer migrato da F1 a F6 NON deve modificare config esistenti.

## 3. EventInspector + RouteInspector

**D-167 ring buffer 500 default** (override via `devtools.eventBufferSize` / `devtools.routeBufferSize`):

- **EventInspector**: cattura ogni `PipelineSnapshot` (step 1-14) in array circolare; FIFO drop-oldest via `Array.shift` quando length supera bufferSize.
- **RouteInspector**: cattura step 9 (`event.route.executed`) + step 10 (`event.outcome.collected`) F3, aggrega per `(eventId, routeId)` con campi: `outcome`, `retryCount`, `cacheHit`, `policiesApplied`, `errorCode`, `durationMs`.

```ts
const broker = createDevtoolsBroker({
  devtools: {
    enableByDefault: true,
    eventBufferSize: 1000, // raise da default 500
    routeBufferSize: 200,
  },
})

await broker.publish('weather.requested', { city: 'Roma' })

const snap = broker.getDebugSnapshot()
console.log(snap.recentEvents) // PipelineSnapshot[] deep-clone
console.log(snap.recentRoutes) // RouteInspectorEntry[] deep-clone
```

**Memory footprint predictable** (RESEARCH §6.3): default 500 entries × ~5KB payload medio = ~2.5MB per Inspector — acceptable per debug session.

## 4. enableDebug / disableDebug

**D-160 toggle live-mode + lazy-mode early-return**: il tap dei due Inspector è SEMPRE registrato (necessario per non perdere step se enable/disable cambiano runtime), ma applica un `if (!state.enabled) return` come prima istruzione hot-path — zero overhead in production.

**Default `initiallyEnabled` (D-160 inline NODE_ENV detection — WARNING-5 fix uniforme cross-component):**

```ts
function detectDefaultEnabled(): boolean {
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    if (proc != null && proc.env != null) {
      return proc.env['NODE_ENV'] !== 'production'
    }
  } catch {
    /* fallthrough — accesso process eccezione → fallback browser */
  }
  return true
}
```

- Production build → `false` (zero overhead)
- Browser/dev → `true` (DX dev-friendly out-of-the-box)

**API:**

```ts
broker.disableDebug() // → Inspector + RouteInspector disable + clear-buffer
// ... in production hot-path: zero overhead, zero memory growth ...
broker.enableDebug() // → re-enable, buffer ricomincia da capo
```

`disable()` clear-buffer (`state.buffer = []` + `pending.clear()`) per memory hygiene (T-06-05-03 mitigation, RESEARCH §6.3 Pitfall ring buffer leak).

## 5. getDebugSnapshot deep-clone

**D-162 deep-clone via `structuredClone`**: il debug snapshot è un'istantanea **immutable** — il consumer può navigare/serializzare/inspect senza corrompere lo state interno (T-06-08b-02 mitigation).

```ts
interface DebugSnapshot {
  readonly recentEvents: readonly PipelineSnapshot[]
  readonly recentRoutes: readonly RouteInspectorEntry[]
  readonly currentMetrics: MetricsSnapshot
  readonly pausedTopics: readonly string[]
  readonly enabled: boolean
}

const snap = broker.getDebugSnapshot()
// Mutazione SAFE — non corrompe lo state interno:
const heavy = snap.recentEvents.filter((e) => e.durationMs > 100)
console.log(JSON.stringify(snap, null, 2))
```

**Performance caveat (RESEARCH §15.3):** `structuredClone` su 500 entries con payload medio ~5KB ≈ <50ms (misurato Chromium/Firefox/Safari). Per snapshot frequenti in production (es. polling per dashboard), usare `disableDebug()` + tap custom dedicato che fa export append-only senza deep-clone.

## 6. MetricsCollector — closes PRD §39 #10 (TOOL-05)

> ✅ **Open issue PRD §39 punto 10 (TOOL-05 metrics format) — CHIUSO in Phase 6.**

### Schema simil-OpenMetrics

`MetricsSnapshot` ha shape rigida lockata coerente con OpenMetrics / Prometheus exposition format:

```ts
type MetricsSnapshot = {
  readonly counters: Readonly<Record<string, number>>
  readonly gauges: Readonly<Record<string, number>>
  readonly histograms: Readonly<Record<string, HistogramSummary>>
}

type HistogramSummary = {
  readonly count: number
  readonly sum: number
  readonly p50: number
  readonly p90: number
  readonly p99: number
}
```

### Naming convention `sembridge.<package>.<metric>{<labels>}` (D-163)

| Type      | Suffix esempio | Naming convention                                          |
| --------- | -------------- | ---------------------------------------------------------- |
| Counter   | `_total`       | `sembridge.cache.hits_total{routeId="weather"}`            |
| Gauge     | `_count`       | `sembridge.cache.entries_count{tenant="acme"}`             |
| Histogram | `_ms`          | `sembridge.routing.dispatch_duration_ms{routeId="weather"}` |

Labels Prometheus-style flatten alphabetical sort (idempotente cross-version):

```ts
flatLabels({ routeId: 'weather', tenant: 'acme' }) // → '{routeId="weather",tenant="acme"}'
flatLabels({ tenant: 'acme', routeId: 'weather' }) // → '{routeId="weather",tenant="acme"}' (stesso ordine)
```

### Cumulative-only counters (D-164) + helper `getMetricsDelta`

```ts
const t1 = broker.getMetrics()
// ... 5 secondi di traffico ...
const t2 = broker.getMetrics()

// Helper per delta (consumer monitoring scrape interval pattern):
const delta = (broker.getDebugSnapshot().currentMetrics === t2 ? null : t2) // type narrowing example
const deltaCalc = (broker as { getMetricsDelta?: typeof t1 }).getMetricsDelta?.(t1)
// → { counters: { 'sembridge.cache.hits_total': +42 }, gauges: t2.gauges, histograms: t2.histograms }
```

### Reservoir Algorithm R Vitter 1985 (D-165)

`HistogramSummary.{p50,p90,p99}` calcolati via reservoir sampling (Algorithm R Vitter 1985 ~30 LOC inline zero-deps, default 1024 samples per metric key). Trade-off accettato: ~5% errore p50/p90/p99 vs t-digest ~1%, in cambio di zero-dep + bundle stretto.

### Cardinality cap (D-166) + audit overflow

Default cap 100 distinct combinations per base name. Overflow → drop new combo + emit `system.metrics.cardinalityoverflow` audit:

```ts
broker.subscribe('system.metrics.cardinalityoverflow', (event) => {
  console.warn('Cardinality overflow:', event.payload)
  // → { baseName: 'sembridge.cache.hits_total', droppedLabels: '{userId="..."}' }
})
```

### Q&A obbligatorie — closure PRD §39 #10

| Domanda                                                                                  | Risposta lockata Phase 6                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1: Perché dot.case `sembridge.<package>.<metric>` invece di snake_case?**             | dot.case è coerente con Prometheus convention storica + permette grouping naturale per package quando si esporta a Prometheus/OTel via mapping 1:1 (snake_case è l'output finale Prometheus textfile, ma dot.case è l'input library-friendly). Mapping `dot.case → snake_case` lascia all'exporter. |
| **Q2: Come si calcola un counter delta tra due `getMetrics()`?**                         | Usa `broker.getMetricsDelta(prevSnapshot)` — counters delta = current - prev, gauges = current snapshot, histograms = current. Pattern monitoring scrape interval (Prometheus `rate()` simulated client-side).                                                                                       |
| **Q3: Reservoir vs t-digest — perché reservoir Algorithm R?**                            | Reservoir Algorithm R Vitter 1985 ~30 LOC inline zero deps, ~5% errore p50/p90/p99 vs t-digest ~1%. Trade-off: zero-dep priority + budget bundle stretto. V1.x se profiling richiede p999 reali (es. SLA 99.9p latenze sub-ms).                                                                       |
| **Q4: Cosa succede se cardinality overflow?**                                            | Cap 100 distinct combinations per base name. Overflow → drop new combo (silently rejected) + emit `system.metrics.cardinalityoverflow` audit (consumer può sottoscrivere per alerting). La cardinalità non si "espande" oltre il cap — protezione memory leak da label esplosivo.                    |
| **Q5: Come integrare con Prometheus / OpenTelemetry?**                                   | V1 fornisce schema `{ counters, gauges, histograms }` simil-OpenMetrics. Mapping 1:1 esportabile via custom adapter (`getMetrics()` → Prometheus textfile / OTel SDK). Adapter ufficiale `@sembridge/metrics-prometheus` + `@sembridge/metrics-otel` V1.x roadmap.                                   |
| **Q6: Quali metriche standard sono disponibili out-of-the-box?**                         | Counters: `sembridge.cache.hits_total`, `sembridge.cache.misses_total`, `sembridge.cache.evictions_total`, `sembridge.routing.routes_dispatched_total`, `sembridge.gateway.fetches_total`, `sembridge.worker.tasks_total`. Gauges: `sembridge.cache.entries_count`, `sembridge.worker.pool_size`. Histograms: `sembridge.routing.dispatch_duration_ms`, `sembridge.gateway.fetch_duration_ms`. |
| **Q7: Come si registra un custom metric?**                                               | V1 NON espone API `registerCustomMetric()`. Pattern current: subscribe a un tap user-side via `config.taps[]` + chiamare `metricsCollector.increment / setGauge / observe` direttamente sul collector esposto via factory custom. API ergonomica `broker.registerCustomMetric()` V1.x roadmap.        |

## 7. PauseController — pauseTopic / resumeTopic / flushQueue

**D-168 pauseTopic**: blocca `publish` del topic. Eventi accodati FIFO in `Map<topic, BrokerEvent[]>`. Subscriber + route NON triggherano (consistency SC-4 wording).

**D-168 resumeTopic**: flush FIFO + delete topic dalla paused Map. Replay via `publishFn` injected. **T-06-07-04 mitigation**: `paused.delete(topic)` PRIMA del replay → replay events vedono `paused.has(topic) === false` → pass-through (anti infinite-loop).

**D-169 flushQueue**: drop silenzioso + emit `system.queue.flushed { topic, droppedCount, droppedEventIds }` SENZA re-publish (replay solo via resumeTopic). Retain paused state (queue empty ma topic ancora paused).

**D-170 critical bypass**: `event.priority === 'critical'` → return `'pass'` (consistency Pitfall 4.C cross-fase F3+F5+F6 — broadcast events bypass cap E queue).

**D-170 cap drop-oldest**: `maxQueueSize: 1000` default. Cap raggiunto → drop oldest via `queue.shift()` + emit `system.queue.overflow { topic, droppedEventId }`.

```ts
broker.pauseTopic('weather.requested')

await broker.publish('weather.requested', { city: 'Roma' }) // → queued (FIFO)
await broker.publish('weather.requested', { city: 'Milano' }) // → queued

broker.resumeTopic('weather.requested') // → replay FIFO, delete paused entry
// (Roma poi Milano arrivano ai subscriber + route nell'ordine di publish originale)

broker.pauseTopic('chat.message')
await broker.publish('chat.message', { text: 'hi' }) // queued
broker.flushQueue('chat.message') // → drop silenzioso + audit, queue empty ma topic paused
```

## 8. Scenario meteo + Inspector dump

Scenario integrato F1+F2+F3+F4+F5+F6 con devtools full active — utile per debug interactive in development tools UI custom.

```ts
import { createDevtoolsBroker } from '@sembridge/devtools'

const broker = createDevtoolsBroker({
  devtools: {
    enableByDefault: true,
    eventBufferSize: 1000,
    pauseQueueMaxSize: 500,
    histogramSamples: 2048,
    maxLabelCombinations: 200,
  },
})

await broker.publish('weather.requested', { city: 'Roma' })
await broker.publish('weather.requested', { city: 'Milano' })
await broker.publish('weather.requested', { city: 'Napoli' })

// Dump completo per debug UI:
const snap = broker.getDebugSnapshot()
console.table(
  snap.recentRoutes.map((r) => ({
    eventId: r.eventId.slice(0, 8),
    routeId: r.routeId,
    outcome: r.outcome,
    duration: `${r.durationMs}ms`,
    cacheHit: r.cacheHit ?? '—',
    retries: r.retryCount ?? 0,
  })),
)
console.log('Counters:', snap.currentMetrics.counters)
console.log('Histograms p99:', snap.currentMetrics.histograms)
```

## 9. Anti-pattern cardinality explosion

**Cardinality explosion (RESEARCH §15.1):** label di alta cardinalità (es. `userId`, `eventId`, `correlationId`) come parte della metric key esplode il numero di combinations distinct → memory leak monotonic crescente.

**Esempi BAD vs GOOD:**

```ts
// BAD — userId arbitrario, ~milioni di distinct combo:
metrics.increment('sembridge.cache.hits_total', { userId: ev.payload.userId })

// GOOD — tenantId bounded (~decine):
metrics.increment('sembridge.cache.hits_total', { tenantId: 'acme' })

// GOOD — routeId bounded (~unità per app):
metrics.increment('sembridge.cache.hits_total', { routeId: 'weather-route' })
```

**Mitigazione D-166 cap 100**: il MetricsCollector intercetta cardinality overflow e droppa nuove combinations (audit `system.metrics.cardinalityoverflow`). Se vedi audit frequenti → c'è un consumer che usa label di alta cardinalità — fix consumer-side.

## 10. Performance caveat

**Lazy-mode hot-path (D-160):** Inspector + RouteInspector implementano `if (!state.enabled) return` come PRIMA istruzione del tap → zero overhead in production se `disableDebug()` è invocato. Lazy NODE_ENV detection garantisce default safe.

**`structuredClone` perf (RESEARCH §15.3):** `getDebugSnapshot()` deep-clone ~30-50ms su 500 entries con payload ~5KB medio (Chromium/Firefox/Safari). Pattern raccomandato per dashboard polling: usa `disableDebug()` + tap custom con append-only fanout invece che snapshot ripetuti.

**Reservoir add (D-165):** `observe()` è O(1) amortized (Math.random + assignment); `getMetrics()` è O(n log n) sort per histogram key (lazy on-demand, NON ad ogni observe). `histogramSamples * maxLabelCombinations * 8 bytes` = 1024 × 100 × 8 = ~800KB per metric base name (acceptable budget).

**Cardinality check O(1):** ogni `increment / setGauge / observe` invoca `cardinalityTracker.check(name, sig)` con Map lookup + Set check — costo trascurabile (<1µs).

## 11. Q&A

| Domanda                                                                          | Risposta                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quando usare `enableDebug()` in production?**                                  | Mai per default. Toggle su trigger UI debug (es. URL query `?sembridge_debug=1` + `broker.enableDebug()`). Costo lazy-mode quando off ≈ 0. Costo lazy-mode quando on ≈ ~5-10% overhead publish path (acceptable per session di debug interattivo).                                                  |
| **getDebugSnapshot polling intervallato — cost?**                                | ~30-50ms per call su 500 entries × ~5KB payload medio. Per dashboard real-time, preferire un tap custom append-only invece di snapshot ripetuti. Pattern: `tap.onPipelineStep` → push a observable/store esterno con backpressure RxJS-like.                                                          |
| **Differenza EventInspector vs RouteInspector?**                                 | EventInspector cattura ogni `PipelineSnapshot` (tutti i 14 step §28). RouteInspector cattura solo step 9+10 e aggrega per `(eventId, routeId)` con outcome/retryCount/cacheHit/policiesApplied — più focused per route-level debug.                                                                  |
| **Come integrare con DevTools browser custom?**                                  | Pattern: tap custom user-side che fa `postMessage` a content script → DevTools panel via Chrome Extensions API. Esempio in `examples/devtools-extension/` (V1.x roadmap).                                                                                                                            |
| **pauseTopic blocca anche `subscribe`?**                                         | NO — pauseTopic blocca solo la `publish` per quel topic. Le subscribe esistenti restano attive ma non ricevono eventi (perché nessun publish dispatcha). Al `resumeTopic` ricevono replay FIFO degli accodati.                                                                                       |
| **flushQueue vs resumeTopic — quando usare quale?**                              | `resumeTopic` quando vuoi replay degli eventi accodati (drain backlog). `flushQueue` quando vuoi scartare il backlog (es. dopo logout user — eventi accodati sono stale). `flushQueue` retain paused state — devi `resumeTopic` separatamente per riabilitare publish.                              |
| **Critical bypass — quali eventi sono `priority: 'critical'`?**                  | Convention: `system.*` eventi, broadcast events, eventi safety-critical (es. `auth.tokenexpired`). Il consumer marca esplicitamente `priority: 'critical'` in `publish` options. Consistency Pitfall 4.C cross-fase F3 D-75 + F5 D-130 + F6 D-170.                                                  |

---

## Riferimenti

- `prd.md` (root) §16 (debug + introspection), §25 (developer tooling), §28 (pipeline §28 14 step), §39 #10 (open issue TOOL-05 — **CHIUSO in F6**)
- `.planning/phases/06-cache-tooling-avanzato/06-CONTEXT.md` (D-159..D-170 — 12 decisioni lockate F6 devtools layer)
- `.planning/phases/06-cache-tooling-avanzato/06-RESEARCH.md` §6 (Inspector ring buffer impl), §7 (MetricsCollector deep dive), §10 (PauseController), §15 (Pitfall list)
- [`@sembridge/core`](../core/README.md) (EventTap + PipelineSnapshot + safeTapStep, F1)
- [`@sembridge/mapper`](../mapper/README.md) (canonical mapping, F2)
- [`@sembridge/routing`](../routing/README.md) (RouterBroker + step 9+10 pipeline, F3)
- [`@sembridge/cache`](../cache/README.md) (cache layer F6 — emette `event.cache.{lookup,hit,miss,evicted}` consumati da Inspector)

## Licenza

MIT.

*Phase 6 closure date: 2026-05-05. Milestone v1.0 chiusa. PRD §39 #10 (TOOL-05) → CLOSED. Ready for `gsd-verifier 6` finale.*
