# @gluezero/devtools

> Developer tooling per GlueZero — Phase 6 (Event Inspector + Route Inspector + MetricsCollector simil-OpenMetrics + PauseController + getDebugSnapshot deep-clone — closes PRD §39 #10 / TOOL-05 metrics format).

ESM-only TypeScript library. Browser evergreen target (ES2022). Composition wrapper di [`@gluezero/routing`](../routing/README.md) `RouterBroker` (D-121, D-83 strict carryover): un singolo entry point `createDevtoolsBroker(config)` orchestra route F3 + tap registry chain D-159 + Inspector ring buffer 500 (D-167) + MetricsCollector cumulative-only (D-164) + PauseController FIFO + critical bypass (D-170).

Quattro dipendenze runtime: [`@gluezero/core`](../core/README.md) (EventTap + PipelineSnapshot, F1), [`@gluezero/mapper`](../mapper/README.md) (canonical mapping, F2 — implicit via routing), [`@gluezero/routing`](../routing/README.md) (RouterBroker base composta, F3), [`valibot`](https://valibot.dev) (config validation al boundary).

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

`@gluezero/devtools` espone `createDevtoolsBroker(config)` come factory pubblico (D-30 anti-singleton). Il broker compone trasparentemente il `RouterBroker` di Phase 3 (D-121, D-83 strict carryover) e installa un `MultiplexTap` aggregator come singleton `runtime.tap` — il tap chain riceve TUTTI gli step §28 della pipeline (steps 1-13 da F1+F2+F3+F4+F5 + step 14 attivato in F6).

```ts
import { createDevtoolsBroker } from '@gluezero/devtools'

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
import { createDevtoolsBroker } from '@gluezero/devtools'
import type { EventTap } from '@gluezero/core'

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

### Naming convention `gluezero.<package>.<metric>{<labels>}` (D-163)

| Type      | Suffix esempio | Naming convention                                          |
| --------- | -------------- | ---------------------------------------------------------- |
| Counter   | `_total`       | `gluezero.cache.hits_total{routeId="weather"}`            |
| Gauge     | `_count`       | `gluezero.cache.entries_count{tenant="acme"}`             |
| Histogram | `_ms`          | `gluezero.routing.dispatch_duration_ms{routeId="weather"}` |

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
// → { counters: { 'gluezero.cache.hits_total': +42 }, gauges: t2.gauges, histograms: t2.histograms }
```

### Reservoir Algorithm R Vitter 1985 (D-165)

`HistogramSummary.{p50,p90,p99}` calcolati via reservoir sampling (Algorithm R Vitter 1985 ~30 LOC inline zero-deps, default 1024 samples per metric key). Trade-off accettato: ~5% errore p50/p90/p99 vs t-digest ~1%, in cambio di zero-dep + bundle stretto.

### Cardinality cap (D-166) + audit overflow

Default cap 100 distinct combinations per base name. Overflow → drop new combo + emit `system.metrics.cardinalityoverflow` audit:

```ts
broker.subscribe('system.metrics.cardinalityoverflow', (event) => {
  console.warn('Cardinality overflow:', event.payload)
  // → { baseName: 'gluezero.cache.hits_total', droppedLabels: '{userId="..."}' }
})
```

### Q&A obbligatorie — closure PRD §39 #10

| Domanda                                                                                  | Risposta lockata Phase 6                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1: Perché dot.case `gluezero.<package>.<metric>` invece di snake_case?**             | dot.case è coerente con Prometheus convention storica + permette grouping naturale per package quando si esporta a Prometheus/OTel via mapping 1:1 (snake_case è l'output finale Prometheus textfile, ma dot.case è l'input library-friendly). Mapping `dot.case → snake_case` lascia all'exporter. |
| **Q2: Come si calcola un counter delta tra due `getMetrics()`?**                         | Usa `broker.getMetricsDelta(prevSnapshot)` — counters delta = current - prev, gauges = current snapshot, histograms = current. Pattern monitoring scrape interval (Prometheus `rate()` simulated client-side).                                                                                       |
| **Q3: Reservoir vs t-digest — perché reservoir Algorithm R?**                            | Reservoir Algorithm R Vitter 1985 ~30 LOC inline zero deps, ~5% errore p50/p90/p99 vs t-digest ~1%. Trade-off: zero-dep priority + budget bundle stretto. V1.x se profiling richiede p999 reali (es. SLA 99.9p latenze sub-ms).                                                                       |
| **Q4: Cosa succede se cardinality overflow?**                                            | Cap 100 distinct combinations per base name. Overflow → drop new combo (silently rejected) + emit `system.metrics.cardinalityoverflow` audit (consumer può sottoscrivere per alerting). La cardinalità non si "espande" oltre il cap — protezione memory leak da label esplosivo.                    |
| **Q5: Come integrare con Prometheus / OpenTelemetry?**                                   | V1 fornisce schema `{ counters, gauges, histograms }` simil-OpenMetrics. Mapping 1:1 esportabile via custom adapter (`getMetrics()` → Prometheus textfile / OTel SDK). Adapter ufficiale `@gluezero/metrics-prometheus` + `@gluezero/metrics-otel` V1.x roadmap.                                   |
| **Q6: Quali metriche standard sono disponibili out-of-the-box?**                         | Counters: `gluezero.cache.hits_total`, `gluezero.cache.misses_total`, `gluezero.cache.evictions_total`, `gluezero.routing.routes_dispatched_total`, `gluezero.gateway.fetches_total`, `gluezero.worker.tasks_total`. Gauges: `gluezero.cache.entries_count`, `gluezero.worker.pool_size`. Histograms: `gluezero.routing.dispatch_duration_ms`, `gluezero.gateway.fetch_duration_ms`. |
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
import { createDevtoolsBroker } from '@gluezero/devtools'

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
metrics.increment('gluezero.cache.hits_total', { userId: ev.payload.userId })

// GOOD — tenantId bounded (~decine):
metrics.increment('gluezero.cache.hits_total', { tenantId: 'acme' })

// GOOD — routeId bounded (~unità per app):
metrics.increment('gluezero.cache.hits_total', { routeId: 'weather-route' })
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
| **Quando usare `enableDebug()` in production?**                                  | Mai per default. Toggle su trigger UI debug (es. URL query `?gluezero_debug=1` + `broker.enableDebug()`). Costo lazy-mode quando off ≈ 0. Costo lazy-mode quando on ≈ ~5-10% overhead publish path (acceptable per session di debug interattivo).                                                  |
| **getDebugSnapshot polling intervallato — cost?**                                | ~30-50ms per call su 500 entries × ~5KB payload medio. Per dashboard real-time, preferire un tap custom append-only invece di snapshot ripetuti. Pattern: `tap.onPipelineStep` → push a observable/store esterno con backpressure RxJS-like.                                                          |
| **Differenza EventInspector vs RouteInspector?**                                 | EventInspector cattura ogni `PipelineSnapshot` (tutti i 14 step §28). RouteInspector cattura solo step 9+10 e aggrega per `(eventId, routeId)` con outcome/retryCount/cacheHit/policiesApplied — più focused per route-level debug.                                                                  |
| **Come integrare con DevTools browser custom?**                                  | Pattern: tap custom user-side che fa `postMessage` a content script → DevTools panel via Chrome Extensions API. Esempio in `examples/devtools-extension/` (V1.x roadmap).                                                                                                                            |
| **pauseTopic blocca anche `subscribe`?**                                         | NO — pauseTopic blocca solo la `publish` per quel topic. Le subscribe esistenti restano attive ma non ricevono eventi (perché nessun publish dispatcha). Al `resumeTopic` ricevono replay FIFO degli accodati.                                                                                       |
| **flushQueue vs resumeTopic — quando usare quale?**                              | `resumeTopic` quando vuoi replay degli eventi accodati (drain backlog). `flushQueue` quando vuoi scartare il backlog (es. dopo logout user — eventi accodati sono stale). `flushQueue` retain paused state — devi `resumeTopic` separatamente per riabilitare publish.                              |
| **Critical bypass — quali eventi sono `priority: 'critical'`?**                  | Convention: `system.*` eventi, broadcast events, eventi safety-critical (es. `auth.tokenexpired`). Il consumer marca esplicitamente `priority: 'critical'` in `publish` options. Consistency Pitfall 4.C cross-fase F3 D-75 + F5 D-130 + F6 D-170.                                                  |

---

## Riferimenti

- [`DECISIONS.md`](../../DECISIONS.md) — 170 decisioni architetturali con riferimenti a sezioni di design
- [`@gluezero/core`](../core/README.md) (EventTap + PipelineSnapshot + safeTapStep, F1)
- [`@gluezero/mapper`](../mapper/README.md) (canonical mapping, F2)
- [`@gluezero/routing`](../routing/README.md) (RouterBroker + step 9+10 pipeline, F3)
- [`@gluezero/cache`](../cache/README.md) (cache layer F6 — emette `event.cache.{lookup,hit,miss,evicted}` consumati da Inspector)

## Subpath theme-inspector (v1.1.0 — Phase 7 W5a)

Da v1.1.0, `@gluezero/devtools` espone un **subpath additivo** `@gluezero/devtools/theme-inspector` per l'observability del theme layer (`@gluezero/theme`). Pattern role-match con F6 `createEventInspector` applicato al namespace canonico `ui.*` (UI-EVENT-01..05).

**Vincolo D-F7-04 D-83 strict carryover esteso:** il subpath è additivo. `packages/devtools/src/index.ts` e i moduli pre-esistenti restano invariati. La source vive in `packages/devtools/src/theme-inspector/` (NUOVA sub-folder con 4 moduli). L'unica modifica al `package.json` è l'aggiunta di `"./theme-inspector"` alla `exports` map + `peerDependenciesMeta.@gluezero/theme.optional: true`.

### Peer dependency optional

`@gluezero/theme` è dichiarato come `peerDependencies` con `peerDependenciesMeta.optional: true`. Consumer che NON usano il subpath `theme-inspector` non vedono install warning. Consumer che lo usano devono installare `@gluezero/theme` accanto.

### Quick start

```ts
import { createBroker } from '@gluezero/core'
import { createTheme } from '@gluezero/theme/factory'
import {
  createThemeInspector,
  createRoleCoverageReport,
  createLiveTokenEditor,
  snapshotTokens,
  diffSnapshots,
} from '@gluezero/devtools/theme-inspector'

const broker = createBroker()
const theme = createTheme({ broker })

// Subscriber passivo `ui.*` ring buffer 500 (D-167)
const inspector = createThemeInspector(broker, { initiallyEnabled: true })

theme.manager.setMode('dark')
theme.manager.setDensity('compact')

console.log(inspector.getBuffer())
// [
//   { topic: 'ui.theme.changed',   payload: { ... }, timestamp: ... },
//   { topic: 'ui.density.changed', payload: { ... }, timestamp: ... },
// ]

inspector.disable() // memory hygiene: drop buffer
inspector.destroy() // unsubscribe + cleanup
```

### API surface

| Factory | REQ-ID | Behavior |
|---|---|---|
| `createThemeInspector(broker, opts?)` | UI-DEVTOOLS-01 | Subscriber passivo `ui.*` con ring buffer 500 (D-167) + lazy-mode hot-path (D-160) + deep-clone via `structuredClone` (D-162). |
| `createRoleCoverageReport({ adapter, roles, scope? })` | UI-DEVTOOLS-02 | Scan DOM `[data-gz-role]` + diff vs `adapter.roleMap`/`cssRules`. Output 5 categorie: registeredAndUsed / registeredAndOrphan / unregisteredAndUsedWarn / inlineStyleWarn / nonSemanticWarn. |
| `createLiveTokenEditor(theme, opts?)` | UI-DEVTOOLS-03 | Form HTML minimal con un `<input>` per ogni token; on `change` invoca `theme.applyTokens({ [name]: value })`. **Production no-op (NODE_ENV gate D-160 — T-F7-02 mitigation).** |
| `snapshotTokens(scope?)` | UI-DEVTOOLS-04 | Read CSS Custom Properties con prefix `--gz-*` da `getComputedStyle(scope ?? document.documentElement)` filtrate. |
| `diffSnapshots(a, b)` | UI-DEVTOOLS-05 | Re-export pure da `@gluezero/theme/snapshot.ts` (W2 plan 07-02). Diff JSON readonly+frozen `{ added, removed, changed }`. |

### Role coverage scenario

```ts
const report = createRoleCoverageReport({
  adapter: theme.manager.adapters.get('tailwind') ?? null,
  roles: theme.manager.roles.list().map((r) => r.name),
})

const result = report.scan()
console.log('OK:', result.registeredAndUsed.map((e) => `${e.role} (${e.count})`))
console.log('WARN orphan DOM:', result.unregisteredAndUsedWarn.map((e) => e.role))
console.log('WARN inline:', result.inlineStyleWarn.map((w) => w.cssText))
console.log('WARN a11y:', result.nonSemanticWarn.map((w) => `${w.role} on ${w.got}`))
```

### Live token editor (dev-only)

```ts
const editor = createLiveTokenEditor(theme, {
  tokens: ['color-primary', 'spacing-md', 'radius-md'],
})
const panel = document.getElementById('devtools-panel')!
editor.render(panel)
// In production NODE_ENV → render+destroy diventano no-op (T-F7-02 mitigation)
```

### Snapshot + diff

```ts
const before = snapshotTokens()
theme.applyTokens({ 'color-primary': '#FF6B35' })
const after = snapshotTokens()
const delta = diffSnapshots(before, after)
console.log(delta.changed) // { 'color-primary': { from: '...', to: '#FF6B35' } }
```

### Threat model (W5a)

| Threat | Categoria | Mitigation |
|---|---|---|
| T-F7-01 Tampering buffer entries | Tampering | Buffer entries deep-cloned via `structuredClone` (D-162); subscriber passivo (no event mutation). |
| T-F7-02 LiveTokenEditor in production bundle | InformationDisclosure | NODE_ENV !== 'production' inline detect (D-160); production no-op editor — bundler tree-shake del body. |
| T-F7-03 Ring buffer overflow | DoS | Cap 500 entries (D-167); shift FIFO su exceed; buffer cleared su disable. |

---

## MF Inspector — Subpath `@gluezero/devtools/mf-inspector` (v2.0)

Subpath additivo opt-in per observability micro-frontend (D-V2-05 BLOCKING — NON nuovo package standalone). Bundle 8 KB gzipped cap; zero overhead se non importato (tree-shaken). Pattern carryover diretto da F11/F12/F13/F14/F15 (13 sezioni standard).

### 1. Quick start

```ts
import { createDevtoolsBroker } from '@gluezero/devtools'
import { microfrontendModule } from '@gluezero/microfrontends'
import { mfInspectorModule, SERVICE_MF_INSPECTOR, type MfInspectorService }
  from '@gluezero/devtools/mf-inspector'

// Install custom: DevtoolsBroker + microfrontendModule + mfInspectorModule via plugin pattern.
const broker = createDevtoolsBroker({})
// (Vedi packages/microfrontends/README.md per il bootstrap microfrontendModule.)
// mfInspectorModule().install(ctx) viene invocato dal plugin loader F8.

// Inspector snapshot — 17 fields per MF attivo via SnapshotProvider Registry (MF-DEVTOOLS-01/02)
const snap = broker.getDebugSnapshot()
console.log(snap.external?.mf?.microFrontends)

// Metrics — 14 metriche per-MF (MF-OBS-02 + D-V2-19)
const metrics = broker.getMetrics()
console.log(metrics.microFrontends) // Array<MfMetricsEntry>

// Service Locator API — pause/resume/flush
const inspector = broker.getService<MfInspectorService>(SERVICE_MF_INSPECTOR)
inspector?.pause()
const drained = inspector?.flush()
inspector?.resume()
```

### 2. Install

Il subpath è incluso in `@gluezero/devtools` v2.0+ — nessun package separato da installare. Importare via subpath specifico `@gluezero/devtools/mf-inspector` (tree-shake aggressive: il barrel core NON include il subpath; il subpath NON è raggiungibile da `import { ... } from '@gluezero/devtools'`).

```bash
npm install @gluezero/devtools@^2.0.0 @gluezero/microfrontends@^2.0.0
```

### 3. Inspector — 17 campi PRD §30.3

Per ogni MF registrato, `getDebugSnapshot().external?.mf?.microFrontends[i]` espone 17 campi (vedi type `MicroFrontendDebugSnapshot`). Strategia hybrid pull (descriptor via Service Locator graceful degradation) + push (eventi aggregati via subscribe 29 topics F8 lifecycle/error/governance).

| # | Campo | Tipo | Sorgente |
|---|---|---|---|
| 1 | `id` | string | Pull `mfService.list()` |
| 2 | `state` | string | Pull `reg.state` FSM |
| 3 | `version` | string | Pull `reg.descriptor.version` |
| 4 | `owner` | unknown? | Pull `reg.descriptor.owner` |
| 5 | `loaderType` | string? | Pull `reg.descriptor.loader.type` |
| 6 | `mountTarget` | unknown? | Pull `reg.descriptor.mount` |
| 7 | `isolation` | unknown? | Pull `SERVICE_ISOLATION.getResolvedPolicy(id)` (F13 opt) |
| 8 | `permissions` | unknown? | Pull `SERVICE_PERMISSIONS.getCapabilities(id)` (F11 opt) |
| 9 | `capabilities` | unknown? | Pull `reg.descriptor.capabilities` |
| 10 | `compatibility` | unknown? | Pull `SERVICE_COMPAT.getCompatibilityReport(id)` (F12 opt) |
| 11 | `theme` | unknown? | Pull `reg.descriptor.theme` |
| 12 | `topicsPublished` | readonly string[] | Push wildcard `metadata.microFrontendId` MF-OBS-01 |
| 13 | `topicsSubscribed` | readonly string[] | Reserved V2.1 (Set vuoto baseline V2) |
| 14 | `routeCallsCount` | number | Push topic match (placeholder data attribution) |
| 15 | `workerTasksCount` | number | Push topic match (placeholder data attribution) |
| 16 | `errors` | readonly unknown[] | Push topic `*.failed`/`*.failure` |
| 17 | `fallbacksApplied` | readonly unknown[] | Push topic `microfrontend.fallback.rendered` (F14) |

Più 5 ancillari: `contextReadCount`, `contextWriteCount`, `subscriptionsCreated`, `cleanupResources`, `timings`, `fallbackPolicy`.

### 4. 11 Timings lifecycle (PRD §30.5)

Inspector subscribe ai 11 lifecycle topics F8 e popola `MicroFrontendTimings` con 11 fields (first-write-wins D-V2-F16-09):

```ts
{
  registeredAt?: number       // microfrontend.registered
  loadStartedAt?: number      // microfrontend.loading
  loadedAt?: number           // microfrontend.loaded
  bootstrapStartedAt?: number // microfrontend.bootstrapping
  bootstrappedAt?: number     // microfrontend.bootstrapped
  mountStartedAt?: number     // microfrontend.mounting
  mountedAt?: number          // microfrontend.mounted
  unmountStartedAt?: number   // microfrontend.unmounting
  unmountedAt?: number        // microfrontend.unmounted
  destroyStartedAt?: number   // microfrontend.destroying
  destroyedAt?: number        // microfrontend.destroyed
}
```

**Composition esterna pura:** ZERO diff `packages/microfrontends/src/` (D-83 strict septuple esteso preserved). Topic gerund `*ing` mappa al field `*StartedAt`; topic past tense mappa al field `*At`. RESEARCH §7.2 RESOLVED conferma empirical: tutti 11 topic emessi da `publishLifecycleEvent()` in `registry.ts`.

### 5. Ring buffer 500 + pause/resume/flush

Per-MF ring buffer `Map<mfId, RingBuffer<MfEvent>(500)>` (D-V2-F16-09):

- **FIFO drop-oldest** quando buffer pieno (`shift()` su exceed). Cap 500 per-MF — isolamento garantito (overflow di un MF non droppa eventi di altri).
- **Pause API globale** (D-V2-F16-10):
  - `inspector.pause()` — sospende il flusso al gate `intercept(event)` → queued
  - `inspector.resume()` — riprende il passthrough verso aggregator/timings
  - `inspector.flush()` — drena pause queue + ring buffer aggregator (concat ritorno `readonly MfEvent[]`)
- **Semantica diversa F6**: NON re-emette gli eventi al resume (snapshot-retention, non replay-broker — vedi RESEARCH §2.3 + Pitfall §3.4).
- **Memoria O(N_MF × 500)** accettabile debug-time. Cardinality cap globale N_MF reserved V2.1 (D-V2-F16-12).

### 6. 14 metriche per-MF (MF-OBS-02)

Namespace `gluezero.mfs.*` dot.case (D-163 carryover F6). Semantica B2 fix chiarita:

**6 counter GLOBALI** (no label `mfId` — totale across tutti i MF, replicati IDENTICI in ogni entry):

| Counter | Topic source |
|---|---|
| `registered` | `microfrontend.registered` |
| `mounted` | `microfrontend.mounted` |
| `failed` | `microfrontend.failed` |
| `permissionDenied` | `microfrontend.permission.denied` |
| `compatFailures` | `microfrontend.compatibility.failed` |
| `capMissing` | `microfrontend.capability.missing` |

**5 counter PER-MF** (label `{mfId}` strict — scoped per entry):

| Counter | Topic source |
|---|---|
| `mountFailures` | `microfrontend.mount.failed` |
| `events` | wildcard `*` + `metadata.microFrontendId` MF-OBS-01 |
| `routeCalls` | `route.*` / `routing.dispatched` (forward-compat) |
| `workerTasks` | `worker.*` / `worker.task` (forward-compat) |
| `contextWrites` | `context.write` / `context.updated` (forward-compat) |

**1 gauge PER-MF** (label `{mfId}` strict — last-write-wins): `activeSubs`.

**2 histogram PER-MF** (label `{mfId}` strict — reservoir Algorithm R Vitter F6 D-165, percentili `{p50, p95, p99, count}`): `timeAvgLoad`, `timeAvgMount`.

Output via `getMetrics().microFrontends[]: MfMetricsEntry[]` — D-V2-19 shape preservation (BC §42 API #14: `microFrontends` field ABSENT su DevtoolsBroker baseline senza provider; `[]` quando provider registrato con 0 MF).

### 7. SnapshotProvider Registry MIN-3

API plug-in pattern (MF-DEVTOOLS-05 + D-V2-F16-01/02/03) per estensibilità multi-provider:

```ts
const broker = createDevtoolsBroker({})
broker.registerSnapshotProvider('custom', () => ({ customField: 'value' }))
const snap = broker.getDebugSnapshot()
console.log(snap.external?.custom) // { customField: 'value' }
```

Sync invocation a ogni `getDebugSnapshot()` call (D-V2-F16-03 — NO caching, NO async). External field assente quando zero provider registrati (BC §42 API #13 bit-exact v1.x preservation). Provider che throw vengono saltati silenziosamente (try/catch swallow pattern F1 D-20 `safeTapStep` carryover).

Convention F16: `mfInspectorModule()` registra automaticamente il provider `'mf'` su DevtoolsBroker quando rileva `broker.registerSnapshotProvider` come function (graceful guard su plain Broker → skip silenzioso).

### 8. Examples

Vedi `examples/microfrontends/mf-devtools-inspector.html` per demo interattiva standalone — 3 MF dichiarati (ESM + WebComponent + iframe) + Inspector UI panel + ring buffer pause/resume visualization + metrics dashboard live + dropdown selettore MF + tabella 17 campi snapshot + counter 14 metriche live update + pause/resume/flush button bar.

```bash
pnpm build:packages
open examples/microfrontends/mf-devtools-inspector.html
```

### 9. Q&A

- **Posso usare il subpath senza DevtoolsBroker?** Sì, ma niente `external.mf` in `getDebugSnapshot()` né `microFrontends` in `getMetrics()`. Solo Service Locator API esposta via `broker.getService(SERVICE_MF_INSPECTOR)`.
- **Il subpath modifica i miei MF?** No, composition esterna pura via subscribe + Service Locator pull. ZERO diff `packages/microfrontends/src/` (D-83 strict septuple esteso preserved).
- **Cardinality protection?** Sì, `createCardinalityTracker({cap: 100})` su wildcard `eventsPerMfId` evita label explosion. Default cap 100 distinct `mfId` per metric base.
- **Plain Broker (non DevtoolsBroker)?** Graceful skip — `mfInspectorModule` controlla `typeof broker.registerSnapshotProvider === 'function'` prima di registrare. Su plain Broker `SERVICE_MF_INSPECTOR` resta accessibile via `broker.getService()`.
- **Idempotent install?** Sì, re-install rileva `SERVICE_MF_INSPECTOR` already registered → `console.warn` + early return (carryover F14 fallbacks-module pattern).

### 10. Migration v1.x → v2.0 mf-inspector opt-in

Il subpath è opt-in: consumer v1.x continua a funzionare bit-exact (BC §42 14 API preserved — `getDebugSnapshot()` 5 fields baseline + `getMetrics()` 3 fields baseline). Per attivare in v2.0:

```diff
+ import { mfInspectorModule } from '@gluezero/devtools/mf-inspector'

  const broker = createDevtoolsBroker({})
+ // Plugin loader F8: chiama mfInspectorModule().install(ctx)
```

Snapshot/Metrics shape automaticamente esteso con `external.mf` e `microFrontends` field. Consumer narrowing TypeScript:

```ts
const snap = broker.getDebugSnapshot()
const mfSnap = snap.external?.mf as
  | { microFrontends: ReadonlyArray<MicroFrontendDebugSnapshot> }
  | undefined
```

### 11. Limitations

- **Inspector è observability/governance, NON crypto sandbox** (PRD §44.1). I dati sono read-only — Inspector non blocca operazioni MF. Per enforcement runtime usare F11 permissions/F13 isolation/F14 fallbacks.
- **`cleanupResources` field — placeholder `[]` in V2.0** (data quality limitation; full attribution V2.1 quando F8 registry emetterà payload `cleanupResources` su `microfrontend.destroyed`). Popolazione richiederebbe diff `packages/microfrontends/src/runtime-context-factory.ts` — VIOLA D-83 strict septuple esteso. Vedi RESEARCH §7.1 RESOLVED.
- **Route/Worker/Context counter** (`routeCalls`/`workerTasks`/`contextWrites`) — pattern matching liberale forward-compat: in F16 V2.0 baseline restano a `0` perché F3/F5/F10 NON emettono topic `gluezero.routing.*`/`gluezero.worker.*`/`gluezero.context.*` esplicito. V2.1 wiring quando F3/F5/F10 emetteranno topic con `metadata.microFrontendId` standardizzato. Vedi RESEARCH §7.5 RESOLVED.
- **4 intermediate `*StartedAt` timings** (loadStartedAt, bootstrapStartedAt, mountStartedAt, unmountStartedAt, destroyStartedAt) sono opzionali — mappati ai topic `*ing` gerund. RESEARCH §7.2 RESOLVED conferma tutti 11 topic SONO emessi da F8 in lifecycle baseline. Quando un MF salta una phase (es. failed in load), i field intermedi corrispondenti restano `undefined`.

### 12. Performance

- **`buildSnapshot()` complexity**: O(N_MF × M_lookups) per call — tipico 50 MF × 5 lookups ~250 ops < 10ms. Hot path consumer (`getDebugSnapshot()` ogni 500ms) → check empirical via Inspector UI panel.
- **Pause API zero-overhead debug-time**: `inspector.pause()` short-circuita il subscribe handler chain via gate `intercept(event)` — l'aggregator/timings NON viene invocato. Queue accumulata in memoria fino a `flush()`.
- **`structuredClone` snapshot output**: cost O(snap.size). D-162 carryover F6 — caller responsibility garantire payload POJO-compatible (no function/WeakMap/Proxy).
- **`registerSnapshotProvider` sync invocation**: NO caching, NO async — D-V2-F16-03. Provider che throw → skip silenzioso (NO propagation upstream).

### 13. Bundle

- **`@gluezero/devtools/mf-inspector` ≤ 8 KB gzipped** (D-V2-F16-15 lockato — empirical 6.27 KB W4 closure).
- **Devtools core invariato**: ~150 B Registry methods delta (`registerSnapshotProvider` + `registerMetricsProvider`).
- **Subpath tree-shaken**: importing dal subpath `@gluezero/devtools/mf-inspector` NON include core devtools internals (Event/Route Inspector, MetricsCollector base) — bundler resolution via `package.json#exports`.
- **Pattern S1 stretto** (D-V2-F16-19): `augment.ts` no-op marker — NO declaration merging upstream, NO runtime prototype patching, NO side-effect runtime. Solo detection tree-shake-fail.

## Licenza

MIT.

*Phase 6 closure date: 2026-05-05. Milestone v1.0 chiusa. PRD §39 #10 (TOOL-05) → CLOSED.*

*Phase 7 W5a closure date: 2026-05-09. Subpath `@gluezero/devtools/theme-inspector` chiuso (UI-DEVTOOLS-01..05 + DOC-05 ext F7). Ready for parallel W5b (aggregate) e W6 (final gate).*

*Phase 16 closure date: 2026-05-16. Subpath `@gluezero/devtools/mf-inspector` chiuso (MF-DEVTOOLS-01..05 + MF-OBS-02..03 + D-V2-05 + D-V2-19 BLOCKING). 4/4 plans + 7/7 REQ-IDs + 20/20 decisioni traceabili. Bundle 6.27 KB ≤ 8 KB cap.*
