# Phase 6: Cache & Tooling avanzato - Context

**Gathered:** 2026-05-05
**Status:** Ready for research and planning

<domain>
## Phase Boundary

Esiste un cache layer con `MemoryCacheAdapter` di default (LRU bounded), chiave configurabile per route/topic con default `${topic}::${stableHash(canonicalPayload)}`, TTL configurabile + invalidazione manuale/automatica, scope user-aware obbligatorio per route auth (anti cross-tenant leakage); il metadata di consegna distingue origine `cache` vs `remote` (SC-1). Il developer tooling è completo: **Event Inspector** mostra il ciclo di vita di ogni evento attraverso i 14 step di pipeline §28 (`EventTap` instrumentato in F1 si attiva con implementazione reale via tap registry); **Route Inspector** mostra route intercettate + policy + esito; **MetricsCollector** espone `getMetrics()` con `{ counters, gauges, histograms }` simil-OpenMetrics naming `gluezero.<package>.<metric>` con quantile summary p50/p90/p99 (chiude PRD §39 #10 — TOOL-05); controlli runtime `pauseTopic`/`resumeTopic`/`flushQueue`, `enableDebug`/`disableDebug`/`getDebugSnapshot`. Pipeline §28 step 14 (logging/metrics/debug snapshot) attivato come implementazione reale. DOC consolidamento finale (DOC-01..DOC-06) come deliverable PRD §41.

**In scope:**
- `@gluezero/cache` package: `CacheAdapter` interface + `MemoryCacheAdapter` (LRU bounded `maxEntries=1000` default), policy `cache-first` / `network-first` / `cache-then-network`, `RouteDefinition.cache` schema (key, ttl, scope, invalidateOn), `broker.cache.invalidate(keyOrPattern)` API, route handler `type: 'cache'` + `type: 'composite'` integrati in F3 RouteExecutor (Strategy pattern carryover D-77/D-152)
- `@gluezero/devtools` package: `EventInspector`, `RouteInspector`, `MetricsCollector`, `getDebugSnapshot()`, `enableDebug/disableDebug`, `pauseTopic/resumeTopic/flushQueue` controlli
- **Tap registry pattern (D-159)**: `BrokerConfig.taps?: readonly EventTap[]` (chain con error isolation try/catch isolato per tap); F1 single-tap deprecato con auto-wrap
- **Composition wrapper (D-83 strict carryover)**: F6 vive solo in `packages/cache/src/` + `packages/devtools/src/` + `augment.ts`. Zero modifiche runtime a F1-F5. Pattern: `createCacheBroker` + `createDevtoolsBroker` o aggregazione via factory pubblico in `@gluezero/gluezero` se researcher conferma topology unificata
- **Pipeline §28 step 14** (logging/metrics/debug snapshot): attivato come implementazione reale (no-op F1 → real F6); tap invocato per tutti 14 step + lifecycle events
- **EventTap pre-instrumentato F1** (`packages/core/src/types/tap.ts`: `EventTap`, `PipelineSnapshot`, `PipelineStep` già esportati): F6 sostituisce no-op con implementazioni reali via tap registry
- **Mapper canonical riuso (F2 carryover)**: Inspector mostra payloadOriginal / payloadCanonical / payloadFinalPerConsumer (TOOL-01 deliverable)
- **BackpressureStrategy F3 D-75 reuse**: pause queue cap usa pattern `queue-bounded` + drop-oldest + critical bypass (consistency D-130)
- **Cascade cleanup LIFE-02 ext F6**: `unregisterPlugin` deve invalidare cache scoped a quel plugin (D-126 ext F6 / D-86 ext F6) — TBD se pattern automatico via `ownerId` o opt-in
- Test TDD RED→GREEN co-located (D-88/D-117/D-149 carryover) + coverage v8 ≥90% (D-92) + 3-tier (jsdom unit + msw integration + Playwright browser per real perf benchmarks)
- DOC consolidation finale (DOC-01..DOC-06) come deliverable PRD §41

**Out of scope (deferred):**
- `@gluezero/cache-idb` IndexedDB-backed cache (V1.x — ROADMAP esplicito)
- Service Worker / Push notification bridge (V2 — RT2-01 / PRD §18.7)
- OpenTelemetry / Prometheus exporter nativo (V1.x — il design metric format dot.case `gluezero.<pkg>.<metric>` rende mapping 1:1 banale ma export adapter è separato)
- Real-time dashboard UI (V1 espone API `getMetrics()` + `getDebugSnapshot()` consumabili da UI esterna; non shipping un'UI built-in)
- Distributed tracing W3C (`traceparent`/`tracestate` propagation): V1 mantiene `traceId` field in BrokerEvent (F1 CORE-05) ma non implementa propagazione cross-process
- Cache size-bytes-based eviction (V1.x se profiling mostra need; V1 = entry-count LRU)
- Custom histogram bucketing per route policy (V1 = quantile summary only)
- Auto-instrumentation di tap custom oltre EventInspector + MetricsCollector (V1.x — consumer registra i propri tap manualmente)
- Inspector persistence (LocalStorage / IndexedDB): V1 = ring buffer in-memory only (drop al disableDebug)
- HMR / hot reload del config devtools (V1.x bundler-specific)

</domain>

<decisions>
## Implementation Decisions

### A. Cache key & user-scope (CACHE-01..03 + SC-5)

- **D-155:** **Cache key default = `${topic}::${stableHash(canonicalPayload)}`** — derivazione deterministica via stable hash (JSON.stringify con key ordering deterministico, utility patternata in F3 dedupe D-74 KeyBased). Funziona uniformemente per route HTTP/worker/cache/composite. Override sempre disponibile via `RouteDefinition.cache.key: (event) => string` callback (massima esplicitezza per use-case complessi). Payload canonico (post-mapper F2) garantisce stabilità cross-plugin nomenclatura.

- **D-156:** **Scope hybrid: config-level scopeProvider + route-level override** — `BrokerConfig.cache.scopeProvider?: (event) => string | null` registrato globalmente come default. Override per route via `RouteDefinition.cache.scope?: (event) => string | null`. Quando scopeProvider attivo, la cache key finale è `${scope}::${baseKey}` (anti cross-tenant leakage). Pattern coerente con timeout/auth hierarchy F3 D-69/D-79 (route-level overrides config-level fallback).

- **D-157:** **Missing scope su route auth → skip cache + system.warn** — Se la route ha `cache: { scoped: true }` (esplicito o implicito quando `auth: true`) e `scopeProvider` ritorna `null`/`undefined` (es. utente non loggato ancora, race condition al boot): cache lookup ritorna miss (zero hit), cache write è no-op, broker pubblica `system.cache.scope-missing` con `{ routeId, topic, eventId }` per audit. La route prosegue come se cache fosse cold. **Sicuro by default** (zero leakage), DX progressive (logged ma non blocking), pattern coerente con F3 D-78 graceful degradation.

- **D-158:** **MemoryCacheAdapter LRU bounded `maxEntries=1000` default** — Default V1: LRU eviction policy con cap entries (NON bytes) `maxEntries: 1000`. Override via `BrokerConfig.cache.maxEntries: N` o `BrokerConfig.cache.adapter` per swap completo. TTL ortogonale a LRU (entry può essere evicted prima della scadenza TTL se cache piena). Tracking access timestamp via Map order (insertion order = LRU order in JS Map idiomatic). Memory footprint predictable. Pattern allineato a stack web standard (lru-cache npm package, sw-cache patterns).

### B. EventTap multiplex pattern (TOOL-01/02/04)

- **D-159:** **Tap registry (chain di tap) — `BrokerConfig.taps?: readonly EventTap[]`** — Sostituisce single `tap?: EventTap` di F1. Il broker invoca tutti i tap registrati in ordine per ogni step §28 con error isolation (try/catch per ogni tap → failure di un tap NON ferma downstream taps né bloccca pipeline). Devtools registra `EventInspector` + `RouteInspector` + `MetricsCollector` come tap separati, user può aggiungere custom tap. Vantaggi: composability, separation of concerns, niente `if(this.tap)` boilerplate. Backward-compat: se config ha `tap: singleTap`, F6 auto-wrappa in `taps: [singleTap]` (zero breaking).

- **D-160:** **`enableDebug()/disableDebug()` toggle live-mode** — I tap di devtools sono **sempre registrati** (zero overhead structural) ma operano in 'lazy mode' (zero capture, zero alloc, hot-path early return) quando `debug=off`. `enableDebug()` flippa flag interno → tap iniziano a catturare/aggregare. `disableDebug()` torna a lazy. **Default automatico**: `NODE_ENV !== 'production'` → debug=on auto (DX dev-friendly); `NODE_ENV === 'production'` → debug=off auto (zero overhead in production, allineato D-139 assertSerializable dev-mode auto + PRD §34.1 "debug mode disattivabile in produzione").

- **D-161:** **Tap invocato su tutti 14 step §28 + lifecycle events** — Coerenza uniforme: tap invocato per ogni step pipeline (1=ingestion, 2=enrichment, 3=validation-syntactic, 4=identify-source, 5=mapping-out-canonical, 6=validation-canonical, 7=dedupe-backpressure, 8=resolve-route, 9=dispatch-cache/http/worker/realtime/local, 10=collect-outcome, 11=mapping-canonical-input, 12=validation-final, 13=delivery, 14=logging-metrics-snapshot) + eventi lifecycle (`route.dispatched`, `cache.hit`, `cache.miss`, `cache.evicted`, `worker.spawned`, `worker.terminated`, `realtime.connected`, `realtime.disconnected`). `PipelineSnapshot` include: `step`, `event`, `payloadBefore?`, `payloadAfter?`, `routeId?`, `error?`, `duration_ms`. Inspector ricostruisce timeline completa. Overhead in lazy-mode: ~1 hot-path branch + 0 alloc per step (early return).

- **D-162:** **`getDebugSnapshot()` deep-clone immutable via structuredClone** — Ritorna deep clone (structuredClone nativo, riuso pattern F5 D-141 transferable awareness) di `DebugSnapshot { recentEvents (ring buffer), routes registered, plugins registered, subscriberCountsPerTopic, currentMetrics, cacheStats, workerPoolState, realtimeChannelsState }`. Caller può ispezionare/serializzare senza mutare stato live. Costo: clone su demand (snapshot rare-call accettabile, NON per profiling continuo). Sicuro, zero side-effect, zero race con publish concurrent.

### C. MetricsCollector schema & semantics (TOOL-03/05 — chiude PRD §39 #10)

- **D-163:** **Naming `gluezero.<package>.<metric>` dot.case namespaced** — Pattern Prometheus/OpenMetrics-friendly. Esempi:
  - Counters: `gluezero.broker.events_published_total`, `gluezero.broker.events_dropped_total{reason="..."}`, `gluezero.cache.hits_total`, `gluezero.cache.miss_total`, `gluezero.cache.evictions_total`, `gluezero.http.requests_total{status="200"}`, `gluezero.http.errors_total{category="..."}`, `gluezero.worker.tasks_total{state="completed|failed|cancelled|timeout"}`, `gluezero.realtime.reconnects_total`, `gluezero.mapper.transformations_total`
  - Gauges: `gluezero.broker.subscribers_count{topic="..."}`, `gluezero.broker.backlog_size{topic="..."}`, `gluezero.worker.active_tasks`, `gluezero.worker.pool_size`, `gluezero.cache.entries_count`, `gluezero.realtime.channels_active`
  - Histograms: `gluezero.http.duration_ms`, `gluezero.worker.task_duration_ms`, `gluezero.mapper.duration_ms`, `gluezero.pipeline.step_duration_ms{step="..."}`
  - Vantaggi: namespace anti-conflict (no clash con user metrics), hierarchy navigabile, `_total` suffix per counter (Prometheus convention), `_ms` suffix per duration, mapping 1:1 a OpenTelemetry/Prometheus exporter V1.x.

- **D-164:** **Cumulative-only counters + helper `getMetricsDelta(previousSnapshot)`** — `getMetrics()` ritorna sempre valori cumulativi dal boot del broker (counter sempre crescente, gauge attuale, histogram aggregate). Nessun side-effect: chiamabile concurrent da N consumer senza race. Helper opzionale `getMetricsDelta(prev: MetricsSnapshot): MetricsDelta` calcola differenze lato consumer (utility pattern). Pattern OpenMetrics/Prometheus standard. Histogram conservano samples in ring buffer interno (capped, non resettato — vedi D-165).

- **D-165:** **Histogram = quantile summary `{ count, sum, p50, p90, p99 }` con ring buffer ~1024 samples** — Per ogni histogram metric: `{ count: number, sum: number, p50: number, p90: number, p99: number }` (number = ms). Calcolo via reservoir sampling (Vitter Algorithm R o equivalente — researcher decide tra t-digest vs reservoir). Ring buffer interno cap default 1024 samples per metric (override `BrokerConfig.devtools.histogramSamples: N`). Compatto, leggibile, copre 95% use-case dashboard, evita memory bloat. Standard Prometheus 'summary' compatible.

- **D-166:** **Labels Prometheus-style flatten in name + cap 100 distinct combinations** — Le label sono parte della metric key concatenata in stringa: `gluezero.http.duration_ms{route_id="weather-fetch",topic="weather.requested"}`. Counter: `gluezero.http.requests_total{route_id="weather-fetch",status="200"}`. Vantaggi: zero ambiguità nel JSON output, parser Prometheus 1:1, sintassi standard. **Cap cardinality: max 100 distinct label combinations per metric base name** (default override `BrokerConfig.devtools.maxLabelCombinations: N`). All'overflow: drop nuove combinazioni + emit `system.metrics.cardinality-overflow` warn (audit). Coerente con pattern anti memory-bloat F5 D-128 cap pool + F4 D-109 cap reconnect.

### D. Inspector retention + pauseTopic queue (TOOL-01/02/05)

- **D-167:** **EventInspector + RouteInspector ring buffer 500 eventi default + config** — Ring buffer in-memory degli ultimi 500 eventi (incluse `PipelineSnapshot` complete: 14 step + payloadBefore/After + duration per step). Override via `BrokerConfig.devtools.eventBufferSize: N` (analog `BrokerConfig.devtools.routeBufferSize`). Consumer legge via `getEventInspectorBuffer()` / `getRouteInspectorBuffer()` (deep clone immutable via structuredClone, pattern D-162). Eventi più vecchi droppati FIFO silenziosamente. Memory footprint atteso ~5-10MB con payload medio. RouteInspector segue stesso pattern (storia esecuzione route con retry, cache hit/miss, policy applicate, esito).

- **D-168:** **`pauseTopic(topic)` = block publish + queue events FIFO** — Semantica completa "pause": nuove `publish(topic)` vengono accodate in FIFO queue dedicata al topic; subscriber NON ricevono; route NON triggherano (HTTP/worker/cache/realtime/composite/local tutti bloccati). `resumeTopic(topic)` flushha la queue in ordine cronologico delivery FIFO (eventi accodati replayyati attraverso pipeline §28 normale). Coerente con SC-4 wording esplicito "gli eventi vengono accodati". Inspector vede stato `paused` esplicito (gauge `gluezero.broker.paused_topics_count`).

- **D-169:** **`flushQueue(topic?)` = drop silenzioso + emit `system.queue.flushed`** — Svuota la FIFO queue scartando gli eventi accodati durante pauseTopic. Pubblica evento audit `system.queue.flushed` con payload `{ topic, droppedCount, droppedEventIds: readonly string[] }`. **NIENTE re-publish** automatico (evita double-effect side-effect su HTTP/worker/realtime). Per replay → usare resumeTopic() (che fa replay automatico). flushQueue semantica destructive-by-design coerente con admin tool pattern. Argomento opzionale: `flushQueue()` senza topic svuota TUTTE le queue paused.

- **D-170:** **Pause queue cap `maxQueueSize: 1000` default + drop-oldest FIFO + critical bypass** — Default `maxQueueSize: 1000` per topic in pausa. All'overflow: drop FIFO **oldest** event + publish `system.queue.overflow` con `{ topic, droppedEventId }` (audit). Override via `BrokerConfig.devtools.pauseQueueMaxSize: N`. Eventi `priority: 'critical'` bypassano cap (consistency Pitfall 4.C, riuso pattern F3 D-75 backpressure-strategy + F5 D-130 worker pool critical bypass). Pattern uniforme cross-fase: cap esplicito + critical pass + audit emit.

### Claude's Discretion

- **Naming interno dei file** (`memory-cache-adapter.ts` vs `memory-cache.ts`, `event-inspector.ts` vs `event-recorder.ts`): lasciato al planner, convenzione coerente con F3-F5 (`http-gateway.ts`, `retry-strategy.ts`, `worker-pool.ts`, `task-tracker.ts`).
- **Stable hash implementation per cache key** (D-155): library nativa (es. `json-stable-stringify` + crypto-API SHA256/MD5 oppure custom djb2/FNV-1a hash veloce) lasciato al researcher. Vincolo: zero dependency esterna se possibile (browser-native). Pattern preferenziale: stable JSON serializer + native `crypto.subtle.digest('SHA-256')` o cheap hash (FNV-1a) se collision-rare basta.
- **Reservoir sampling vs t-digest** per histogram (D-165): lasciato al researcher in base a STACK.md + benchmark dimensione bundle. t-digest è più accurato p99/p999 ma più LOC; reservoir Algorithm R è ~30 LOC e p50/p90/p99 accettabili.
- **Default thresholds** (`maxEntries=1000`, `eventBufferSize=500`, `histogramSamples=1024`, `maxLabelCombinations=100`, `pauseQueueMaxSize=1000`): lockati come default ragionevoli; tutti override-abili via `BrokerConfig.cache`/`BrokerConfig.devtools`. Researcher può proporre tweak basati su benchmark in F6 RESEARCH.md.
- **Topology composition wrapper o aggregate factory**: pattern `createCacheBroker(createWorkerBroker(createRealtimeBroker(...)))` chain o factory unificato `createGlueZero(config)` aggregato in `@gluezero/gluezero`: lasciato al researcher per analizzare DX optimal. Vincolo D-83 strict carryover: F6 vive solo in `packages/cache/src/` + `packages/devtools/src/` + `augment.ts`.
- **Cache invalidation API surface** (`broker.cache.invalidate(keyOrPattern)` + `RouteDefinition.cache.invalidateOn: ['topic.x']` event-driven): pattern lockato concettualmente (CACHE-02 + SC-5) ma signature precisa lasciata al planner — `keyOrPattern: string | RegExp | { prefix: string }`, dispatch synchronous vs microtask-deferred, batch invalidation via array.
- **DOC consolidation strategy** (TypeDoc website auto-generato + README aggregato `@gluezero/gluezero`): lasciato al planner — STACK.md raccomanda TypeDoc + `typedoc-plugin-markdown`.
- **Cache-then-network ordering** (cache hit publishato in same-tick microtask vs `queueMicrotask` vs `setTimeout(..., 0)`): SC-1 garantisce 2 publish consecutivi `weather.loaded` con `metadata.origin: 'cache'` poi `'remote'`. Researcher decide micro-detail timing per rispettare ordering garantito + DX consumer (es. animation flicker control).
- **Error categorization**: `category: 'cache'` per errori cache adapter (read/write/evict failures), `category: 'config'` per errori al register (`cache.key.required`, `cache.adapter.invalid`), `category: 'system'` per devtools errors (`metrics.cardinality-overflow`, `queue.overflow`). Pattern coerente con F3/F4/F5 mapping.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PRD (fonte autoritativa)
- `prd.md` §3 — Problemi che la libreria risolve (osservabilità + cache come motivazione F6)
- `prd.md` §10.6 — Sotto-sistema **Cache** (CACHE-01..03 main authority)
- `prd.md` §10.7 — Sotto-sistema **Developer Tooling** (TOOL-01..05 main authority)
- `prd.md` §11.1 — `BrokerEvent.metadata.origin: 'cache' | 'remote'` (SC-1 closure)
- `prd.md` §17.4 — Route `cache` policy (cache-first / network-first / cache-then-network)
- `prd.md` §20 — **Cache layer requisiti minimi** (PRD §20 main authority — adapter, key, TTL, invalidation, metadata, scope user-aware)
- `prd.md` §22.5 — Eventi `system.*` (D-157, D-169, D-170)
- `prd.md` §24-26 — Auth policy + scope user-aware (D-156, D-157)
- `prd.md` §28 — **Pipeline 14 step** (D-161 tap su tutti gli step + step 14 logging/metrics/snapshot)
- `prd.md` §30 — **Developer tooling requisiti minimi** (PRD §30 main authority — TOOL-01..05)
- `prd.md` §30.5 — Controlli `pauseTopic`/`resumeTopic`/`flushQueue` (D-168, D-169, D-170)
- `prd.md` §31.3 — Vincolo browser evergreen (impatta cache adapter API)
- `prd.md` §34.1 — Debug mode disattivabile in produzione (D-160 NODE_ENV auto-on/off)
- `prd.md` §34.2 — Obiettivi qualitativi (no soglie numeriche)
- `prd.md` §35.1-35.3 — Test obbligatori unit/integration/robustness (TEST-01/02/03 ext F6)
- `prd.md` §39 #10 — **Open issue TOOL-05 closure** (formato metriche — `getMetrics()` ritorna `{ counters, gauges, histograms }` simil-OpenMetrics, D-163, D-164, D-165, D-166)
- `prd.md` §41 — Deliverable finali (DOC consolidamento)
- `prd.md` §42 — Checklist finale (success criteria fase + closure milestone v1.0)

### Roadmap & requirements
- `.planning/ROADMAP.md` — Phase 6 success criteria 1-5 (definitive lock per goal F6)
- `.planning/REQUIREMENTS.md` — **CACHE-01..CACHE-03**, **TOOL-01..TOOL-05** (sezione Cache + Tooling Fase 6) + TEST-01/02/03 subset F6 + DOC-01..DOC-06 consolidation

### Decisioni fasi precedenti (riusate / estese in F6)
- `.planning/phases/05-worker-runtime/05-CONTEXT.md`:
  - **D-121** — Composition wrapper Opzione B (esteso a F6 → cacheBroker / devtoolsBroker o factory aggregato)
  - **D-126** — Cascade cleanup `unregisterPlugin` (esteso a cache invalidation per ownerId / scope → ext F6 LIFE-02)
  - **D-149/D-150** — TDD RED→GREEN co-located + 3-tier test pattern (riuso identico)
- `.planning/phases/04-realtime-inbound-sse-prioritario-ws-opzionale/04-CONTEXT.md`:
  - **D-101** — Composition wrapper pattern (esteso → F6)
  - **D-112** — Cascade cleanup `unregisterPlugin` (esteso a cache scope-by-owner → D-156/D-157)
  - **D-115** — BackpressureStrategy riusata (esteso a pause queue cap → D-170)
  - **D-117/D-118** — TDD + 3-tier test pattern
- `.planning/phases/03-routing-server-gateway-http/03-CONTEXT.md`:
  - **D-69** — Default 30s timeout pattern (cache lookup non blocking; non applica direttamente ma pattern config-level + route-level override coerente con D-156)
  - **D-74** — KeyBased dedupe stable hash (riusato 1:1 in D-155 cache key default)
  - **D-75** — `BackpressureStrategy` (riusata → D-170 pause queue cap drop-oldest + critical bypass)
  - **D-77** — `RouteExecutor.dispatchByType` placeholder cache/composite (concretizzato → handler `type: 'cache'` + `type: 'composite'` F6)
  - **D-78/D-80** — OutcomeCollector + `<topic>.failed` shape (riuso pattern publish per cache errors / system events D-157/D-169/D-170)
  - **D-83** — **Composition wrapper STRICT (carryover hard, F6 vive solo in `packages/cache/src/` + `packages/devtools/src/`)**
  - **D-86** — Cascade cleanup `unregisterByOwner` (esteso a cache scope-by-owner)
  - **D-88** — TDD RED→GREEN pattern (riuso)
  - **D-92** — Coverage v8 ≥ 90% (riuso)
  - **D-94** — Declaration merging pattern `augment.ts` (riusato → `BrokerConfig.cache`, `BrokerConfig.devtools`, `BrokerConfig.taps`, `RouteDefinition.cache`)
- `.planning/phases/02-canonical-model-mapper/02-CONTEXT.md`:
  - **D-44** — `onFailure: 'block' | 'skip' | 'fallback'` (pattern per cache miss handling)
  - **D-49** — Composition wrapper Mapper (precedente di D-83/D-101/D-121)
  - **D-57** — PluginDescriptor extension via declaration merging (precedente di D-94/D-103/D-126)
- `.planning/phases/01-core-essenziale/01-CONTEXT.md`:
  - **D-25/D-26** — Lifecycle plugin + cascade cleanup base
  - **D-30** — No singleton (D-158 MemoryCacheAdapter factory + D-167 Inspector factory)
  - **EventTap interface** (`packages/core/src/types/tap.ts` — `EventTap`, `PipelineSnapshot`, `PipelineStep`): pre-instrumentato F1, F6 sostituisce no-op con tap registry reale (D-159, D-160, D-161)

### Stack & research già consolidati
- `.planning/research/STACK.md` §metrics — JSON-serializable simil-OpenMetrics (`{ counters, gauges, histograms }`)
- `.planning/research/STACK.md` §size-limit — CI gate budget (core <8KB gz, gateway <6KB, mapper <5KB) — F6 cache + devtools devono rispettare budget propri
- `.planning/research/STACK.md` §cache — LRU + TTL + scope key in-memory
- `.planning/research/SUMMARY.md` — V1 stack confirm Phase 6 + tabella open issues §39 #10
- `.planning/research/PITFALLS.md` #4 — Backpressure priority bypass (D-170 critical pass)
- `.planning/research/ARCHITECTURE.md` §3.2 — **EventTap interface architecture** (pre-instrumentazione F1 + sostituzione F6 — riferimento autoritativo per D-159/D-160/D-161)
- `.planning/research/ARCHITECTURE.md` §13 — Phase ordering rationale F6 finale post-F3 (cache route handler dipende da F3 RouteExecutor)

### Plan precedenti (codebase scaffolding già in place)
- `packages/cache/package.json` — placeholder F1 da popolare in F6 (deps: `@gluezero/core`, `@gluezero/mapper`, `@gluezero/routing`, `@gluezero/gateway`)
- `packages/cache/src/` — vuota (da popolare in F6)
- `packages/devtools/package.json` — placeholder F1 da popolare in F6 (deps: `@gluezero/core`, eventualmente `@gluezero/cache` per cache stats inspector)
- `packages/devtools/src/` — vuota (da popolare in F6)
- `packages/core/src/types/tap.ts` — `EventTap` interface + `PipelineSnapshot` + `PipelineStep` (pre-instrumentato F1, F6 fornisce implementazioni reali)
- `packages/core/src/types/config.ts` — `BrokerConfig.tap?: EventTap` (F1 single-tap; F6 estende con `taps?: readonly EventTap[]` array via augment.ts + auto-wrap backward-compat — D-159)
- `packages/core/src/types/broker-event.ts` — `BrokerEvent.metadata.origin?: 'cache' | 'remote'` (verificare se già supportato F1 union o richiede augment F6 — SC-1 closure)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`EventTap` interface + `PipelineSnapshot` + `PipelineStep`** (`packages/core/src/types/tap.ts`): pre-instrumentato F1, F6 fornisce implementazioni reali (EventInspector + RouteInspector + MetricsCollector come tap separati, D-159 chain registry)
- **`BrokerConfig.tap?: EventTap`** (`packages/core/src/types/config.ts`): F6 estende a `taps?: readonly EventTap[]` via augment.ts (D-159) con auto-wrap backward-compat
- **Stable hash pattern KeyBased** (F3 dedupe-strategy `packages/gateway/src/http/strategies/dedupe-strategy.ts` D-74): F6 riusa 1:1 per `${topic}::${stableHash(canonicalPayload)}` cache key default (D-155)
- **`BackpressureStrategy` union** (F3 D-75 `packages/gateway/src/http/strategies/backpressure-strategy.ts`): F6 riusa pattern `queue-bounded` + drop-oldest + critical bypass per pause queue cap (D-170)
- **`MapperEngine.mapToCanonical(raw, schemaId)`** (`packages/mapper/src/mapper-engine.ts`): F6 EventInspector mostra payloadOriginal → payloadCanonical → payloadFinalPerConsumer (TOOL-01)
- **`createRouterBroker(config)`** (`packages/routing/src/router-broker.ts`): F6 base per `createCacheBroker(config)` composition wrapper (D-83 → D-121 → ext F6)
- **`RouteExecutor.dispatchByType` dispatch table** (F3 routing): F6 aggiunge handler `cache` + `composite` (concretizza D-77 placeholder)
- **`OutcomeCollector` + `<topic>.failed` shape** (F3 03-07): F6 riusa pattern publish per cache errors + system events (D-157/D-169/D-170)
- **`unsubscribeByOwner`/`unregisterByOwner` cascade pattern** (F1 LIFE-02 → F3 D-86 → F4 D-112 → F5 D-126): F6 estende a cache invalidation scope-by-owner + Inspector cleanup ext F6
- **`structuredClone` pattern** (F5 D-141 awareness): F6 usa per `getDebugSnapshot()` deep clone (D-162)
- **`createPerRouteCircuitBreaker` utility** (F3 03-09): NON riusato direttamente in F6 (cache non ha breaker semantica) ma pattern factory per-route disponibile

### Established Patterns
- **Composition wrapper Opzione B** (F2 D-49 → F3 D-83 → F4 D-101 → F5 D-121): F6 segue stesso pattern. Possibili topology: chain `createCacheBroker(createWorkerBroker(...))` o factory aggregato `createGlueZero(config)` in `@gluezero/gluezero`. Decisione lasciata al researcher
- **Declaration merging via `augment.ts`** (`packages/{routing,gateway,gateway/sse-ws,worker}/src/augment.ts`): F6 crea `packages/cache/src/augment.ts` + `packages/devtools/src/augment.ts` per estendere `BrokerConfig.cache`, `BrokerConfig.devtools`, `BrokerConfig.taps`, `RouteDefinition.cache`, `PluginDescriptor` (eventualmente). Pattern S1 anti tree-shake (`__augmentCacheLoaded` + `__augmentDevtoolsLoaded` const literal) coerente con F1-F5
- **TDD RED→GREEN co-located test** (`*.test.ts` accanto a `*.ts`): F6 mantiene
- **3-tier test (Tier-1 jsdom + Tier-2 mock util + Tier-3 Playwright)** (F4 D-118 / F5 D-150): F6 riusa, Tier-3 utile per benchmark cache hit timing reale e structuredClone perf
- **Reserved internal topics `__X__` filtrati** (F4 D-111 `__ping__`/`__pong__` + F5 D-131 `__cancel__` + F5 D-135 `__progress__`): F6 può usare `__metrics__`/`__inspector__` per internal coordination se serve (planner decide)
- **System events `system.*` audit** (F3 D-78 `system.warn` + F4 `system.realtime.*` + F5 `system.cache.scope-missing`): F6 estende con `system.cache.*`, `system.queue.flushed`, `system.queue.overflow`, `system.metrics.cardinality-overflow`
- **CI gates final phase** (F3 03-14 / F4 04-09 / F5 05-07): F6 final gate include publint, attw ESM-only, biome, typecheck, build, size-limit budget per `@gluezero/cache` + `@gluezero/devtools` (TBD researcher), DOC consolidation
- **Wave-based plan parallelization con file ownership disgiunta** (F3 14 wave, F4 9 wave, F5 7 wave): F6 simile (5-7 plan stimati: bootstrap + cache-adapter + cache-broker-handler + tap-registry + event-inspector + route-inspector + metrics-collector + pause-queue + final-gate-doc-consolidation)

### Integration Points
- **`Broker.publish(event)` API**: punto di ingresso per system events `system.cache.*`/`system.queue.*` (D-157/D-169/D-170), unchanged dal contratto F1
- **`PluginRegistration.workers` / `realtimeChannels`** (F4-F5 cascade): F6 estende cascade per cache invalidation scope-by-owner (D-126 ext F6)
- **`createCacheBroker(config)` / `createDevtoolsBroker(config)` / `createGlueZero(config)`**: nuovo factory pubblico (researcher decide topology)
- **`MemoryCacheAdapter` lifecycle**: registra entries on-demand, evict LRU/TTL (D-158)
- **`BrokerEvent.metadata.origin: 'cache' | 'remote'`** (SC-1): popolato da cache handler F6
- **Pipeline §28 step 14**: tap real implementations (Inspector + Metrics) catturano debug snapshot finale (D-161)
- **`@gluezero/gluezero` aggregato**: package pubblico finale che re-esporta tutto + factory `createGlueZero` (DOC-01..06 consolidation point)

</code_context>

<specifics>
## Specific Ideas

- **Tap registry come architettura primaria** (D-159): l'utente ha esplicitamente scelto chain di tap (con error isolation) come pattern primario, deprecando soft single-tap F1 con auto-wrap backward-compat. Questa è una scelta architetturale chiave perché abilita Inspector + Metrics + custom user tap a coesistere senza interfere. Researcher dovrà documentare il pattern in DOC-06 con scenario "consumer registra custom AnalyticsTap accanto a EventInspector built-in".
- **Lazy-mode per debug=off** (D-160): scelta esplicita di mantenere i tap sempre registrati ma con hot-path early return quando debug=off. Pattern `if (!this.enabled) return;` first-line. Zero alloc, zero capture. Coerente con D-139 assertSerializable dev-mode auto. Researcher può proporre micro-benchmark per quantificare overhead in lazy-mode (target: <1% overhead vs no-tap).
- **`PipelineSnapshot` versioning** (D-161): l'utente non ha discusso versioning esplicito ma la decisione "tutti 14 step" implica uno schema stabile cross-fase. Researcher dovrebbe documentare la struttura `PipelineSnapshot` come parte del contract pubblico (DOC-06) per evitare breaking change retroattivi. Possibile aggiunta `snapshot.version: 1` field per future-proofing V1.x extensions.
- **Histogram p50/p90/p99 con reservoir sampling** (D-165): scelto quantile summary su bucket istogrammi Prometheus per JSON output più compatto. Researcher analizzerà reservoir Algorithm R (~30 LOC, accuratezza p50/p90/p99 buona) vs t-digest (più accurato p999 ma +200 LOC) e proporrà la scelta in F6 RESEARCH.md. Default V1 = reservoir if bundle budget tight.
- **Pause queue critical bypass** (D-170): coerenza cross-fase con F3 D-75 + F5 D-130 (critical priority bypass cap). L'utente vuole pattern uniforme: ogni place dove c'è cap+drop, `priority: 'critical'` passa sempre. Researcher mappa esplicitamente tutti i punti dove la regola si applica.

</specifics>

<deferred>
## Deferred Ideas

- **`@gluezero/cache-idb` IndexedDB-backed** (V1.x — ROADMAP esplicito): adapter per cache persistente cross-session. API contract definito in V1 (`CacheAdapter` interface) prepara lo swap a costo zero per consumer.
- **OpenTelemetry / Prometheus exporter nativo** (V1.x): mapping 1:1 da `{ counters, gauges, histograms }` D-163 a OTLP/Prometheus exposition format. Implementazione in `@gluezero/devtools-otel` package separato.
- **Real-time dashboard UI built-in** (V2): V1 espone API `getMetrics()` + `getDebugSnapshot()` consumabili. Dashboard UI (es. embedded preact app) considerato per V2 milestone separato.
- **Distributed tracing W3C `traceparent`/`tracestate`** (V1.x): V1 mantiene `traceId` field in BrokerEvent (F1 CORE-05) ma non implementa propagazione. Aggiungere via plugin custom in V1.x quando emerge use case.
- **Cache size-bytes-based eviction** (V1.x): V1 = entry-count LRU (D-158). Bytes-based eviction richiede estimateSize per entry (overhead + euristica). Riconsiderato se profiling SPA long-lived mostra problema.
- **Custom histogram bucketing per route policy** (V1.x): V1 = quantile summary only (D-165). Bucket Prometheus configurabili come opt-in via `BrokerConfig.devtools.histograms.<metric>.buckets: number[]` se emerge use case dashboard.
- **Auto-instrumentation di tap custom oltre Inspector + Metrics** (V1.x): V1 = consumer registra manualmente. Auto-wire tap di terze parti (es. Sentry tap, LogRocket tap) considerato come plugin ecosystem V1.x.
- **Inspector persistence** (LocalStorage / IndexedDB): V1 = ring buffer in-memory only. Persistenza considerata se utenti chiedono "save debug session for replay".
- **HMR / hot reload del config devtools** (V1.x bundler-specific): non vincolo GlueZero. Documentazione in DOC-06 punta al bundler docs.
- **`SharedWorker` cross-tab metrics aggregation** (V2): aggregazione metriche cross-tab via SharedWorker. Use case raro, complica lifecycle.
- **Service Worker / Push notification bridge** (V2 — RT2-01 / PRD §18.7): use case oltre la vita della pagina.
- **WorkerInspector dedicated** (V1.x): F5 ha già `getDebugSnapshot().workerPoolState` + `workerLateResponses` counter (D-133). Inspector dedicato con timeline visuale dei worker task considerato per V1.x.
- **MappingInspector dedicated**: F2 ha già `MappingInspector` esposto (`MAP-15`). F6 può integrarlo nel pannello Event Inspector come sub-view, ma estensione UI deferred.
- **User-defined metric registration** (`broker.metrics.register('my.metric', 'counter')`): V1 = metric standard pre-definite + label esplicite. Custom metric registration considerato V1.x se emerge come pattern.
- **Anti-flap pause/resume** (debounce su pauseTopic+resumeTopic in rapida sequenza): V1 = pause/resume immediato. Anti-flap V1.x se emerge use case admin-tooling.

</deferred>

---

*Phase: 06-cache-tooling-avanzato*
*Context gathered: 2026-05-05*
