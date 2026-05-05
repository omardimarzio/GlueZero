# Phase 6: Cache & Tooling avanzato - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `06-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 6-cache-tooling-avanzato
**Areas discussed:** Cache key & user-scope, EventTap multiplex pattern, MetricsCollector schema & semantics, Inspector retention + pauseTopic queue
**Mode:** `--chain` (interactive discuss + auto-advance to plan-phase)

---

## Cache key & user-scope

### Question 1 — Cache key default derivation

| Option | Description | Selected |
|--------|-------------|----------|
| topic + canonical-payload hash | Hash deterministico di `${topic}::${stableHash(canonicalPayload)}`. Funziona uniformemente per route HTTP/worker/cache/composite. Stable hash via JSON.stringify con key ordering deterministico (utility patternata in F3 dedupe D-74). | ✓ |
| URL + queryMap risolto (HTTP-only) | Default per route 'http': hash di `${method}::${url}::${stableQueryMap}`. Per worker/composite: throw 'cache.key.required' al register. | |
| Sempre callback obbligatorio (no default) | Nessun default: `RouteDefinition.cache.key` callback obbligatorio. Massima esplicitezza zero magia. | |
| Tu decidi | Lascia al planner/researcher in base a code patterns esistenti. | |

**User's choice:** topic + canonical-payload hash (Recommended)
**Notes:** Pattern coerente con F3 D-74 KeyBased dedupe. Override sempre disponibile via `RouteDefinition.cache.key` callback.

### Question 2 — scopeProvider hook architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Config-level + route opt-in | `BrokerConfig.cache.scopeProvider` globale + `RouteDefinition.cache.scoped?: boolean`. Provider chiamato solo quando scoped=true. | |
| Route-level callback puro | `RouteDefinition.cache.scope` per ogni route. Niente registrazione globale. Massima esplicitezza. | |
| Hybrid: route-level override > config-level fallback | Config-level scopeProvider come default + route-level override opzionale. | ✓ |
| Tu decidi | Lascia al planner se emerge pattern più chiaro. | |

**User's choice:** Hybrid: route-level override > config-level fallback
**Notes:** Pattern coerente con timeout/auth hierarchy F3 D-69/D-79.

### Question 3 — Missing scope behavior (route auth)

| Option | Description | Selected |
|--------|-------------|----------|
| Skip cache + system.warn | Cache lookup miss + write no-op + publish `system.cache.scope-missing` warning. La route prosegue come cold cache. Sicuro by default, DX progressive. | ✓ |
| Throw BrokerError fail-fast | Throw `BrokerError({ code:'cache.scope.missing', category:'config' })` al dispatch. Bloccante. | |
| Fallback a scope='anonymous' | Stringa fissa 'anonymous' come scope. Cache funziona sempre ma RISCHIO leakage in apps multi-tenant. | |
| Tu decidi | Lascia al researcher analizzando pattern auth tipici. | |

**User's choice:** Skip cache + system.warn (Recommended)
**Notes:** Zero leakage by default, pattern coerente con F3 D-78 graceful degradation.

### Question 4 — Eviction policy + bounded size

| Option | Description | Selected |
|--------|-------------|----------|
| LRU + max 1000 entries default | MemoryCacheAdapter LRU bounded `maxEntries=1000`. Override via config. TTL ortogonale a LRU. | ✓ |
| TTL-only (unbounded entries) | Niente cap, solo TTL. Eviction periodica scan. Footprint memoria può esplodere. | |
| LRU + max bytes-based | Cap per bytes con estimateSize. Più preciso ma overhead + complica V1. | |
| Tu decidi | Lascia al planner basandosi su benchmark microtask. | |

**User's choice:** LRU + max 1000 entries default (Recommended)
**Notes:** Pattern allineato a stack web standard, predictable footprint.

---

## EventTap multiplex pattern

### Question 1 — Tap architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Tap registry (chain di tap) | `BrokerConfig.taps?: readonly EventTap[]`. Broker invoca tutti i tap in ordine con error isolation. F1 single-tap deprecated con auto-wrap. | ✓ |
| Single tap swap globale via enableDebug() | Un solo tap attivo. enableDebug() swappa noopTap con compositeTap interno. Custom user tap richiede wrapping manuale. | |
| Plugin pattern (devtools.attach(broker)) | Devtools plugin che si auto-registra come tap via API imperativa. | |
| Tu decidi | Lascia al researcher analizzando coexistence Inspector+Metrics+custom. | |

**User's choice:** Tap registry (chain di tap) (Recommended)
**Notes:** Composability + separation of concerns + zero boilerplate. Backward-compat via auto-wrap di config.tap singleton.

### Question 2 — enableDebug() / disableDebug() semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle live-mode dei tap devtools | Tap sempre registrati ma in lazy mode (zero capture/alloc) quando debug=off. Default `NODE_ENV !== 'production'` → debug=on auto. | ✓ |
| Register/unregister dei tap devtools | enableDebug() registra tap, disableDebug() unregistra. getMetrics() vuoto se debug=off. | |
| enableDebug() solo per Inspector, MetricsCollector sempre on | Metriche sempre attive, solo Inspector ha toggle. | |
| Tu decidi | Lascia al planner basandosi su PRD §34.1. | |

**User's choice:** Toggle live-mode dei tap devtools (Recommended)
**Notes:** Coerente con D-139 assertSerializable dev-mode auto + PRD §34.1.

### Question 3 — Tap step granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Tutti i 14 step + lifecycle events | Tap invocato per ogni step §28 + eventi lifecycle (route.dispatched, cache.hit/miss, worker.spawned, realtime.connected). Inspector ricostruisce timeline completa. | ✓ |
| Solo step ad alto valore (5-7 chiave) | Subset: ingestion, mapping, validation, route, dispatch, outcome, delivery. | |
| Configurable via tap.steps array | `EventTap.steps?: readonly PipelineStep[]` per filtro per-tap. Più flessibile ma complica API. | |
| Tu decidi | Lascia al planner mappando 14 step contro TOOL-01/02. | |

**User's choice:** Tutti i 14 step + lifecycle events (Recommended)
**Notes:** Uniformità + Inspector ricostruisce timeline completa. Overhead lazy-mode ~1 hot-path branch.

### Question 4 — getDebugSnapshot() semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Deep clone immutable | structuredClone deep clone di {recentEvents, routes, plugins, subscriberCounts, metrics, cacheStats, workerPoolState, realtimeChannels}. Sicuro, zero side-effect. | ✓ |
| Live readonly view | Proxy/freeze readonly del live state. Zero overhead clone ma rischio inconsistency con concurrent mutations. | |
| Lazy projection per chiave | `getDebugSnapshot({ include: ['events','routes'] })`. Più efficiente ma complica API. | |
| Tu decidi | Lascia al planner basandosi sul use-case primario. | |

**User's choice:** Deep clone immutable (Recommended)
**Notes:** Sicuro by default, zero race con publish concurrent.

---

## MetricsCollector schema & semantics

### Question 1 — Naming convention

| Option | Description | Selected |
|--------|-------------|----------|
| dot.case namespaced gluezero.<package>.<metric> | Namespace anti-conflict, hierarchy navigabile, OpenMetrics-friendly (`_total`, `_ms`), mapping 1:1 a Prometheus/OTel exporter V1.x. | ✓ |
| snake_case flat (no namespace) | `events_published`, `cache_hits`. Più corto ma rischio collision e niente hierarchy. | |
| camelCase JS-native | `eventsPublished`, `cacheHits`. JS-idiomatic ma divergente da standard Prometheus. | |
| Tu decidi | Lascia al planner verificando standard OpenMetrics. | |

**User's choice:** dot.case namespaced gluezero.<package>.<metric> (Recommended)
**Notes:** Pattern industriale, traduzione 1:1 a OpenTelemetry/Prometheus V1.x banale.

### Question 2 — Reset semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Cumulative-only + getMetricsDelta opzionale | Counter sempre cumulativi dal boot. Helper opzionale calcola delta lato consumer. Pattern OpenMetrics/Prometheus standard. | ✓ |
| Reset-on-read | Ogni getMetrics() azzera counter. Rompe consumer multipli. | |
| Hybrid: cumulative + resetMetrics() esplicito | Default cumulative + API esplicita resetMetrics(keys?). | |
| Tu decidi | Lascia al planner basandosi su pattern standard. | |

**User's choice:** Cumulative-only + getMetricsDelta opzionale (Recommended)
**Notes:** Side-effect-free, concurrent-safe.

### Question 3 — Histogram structure

| Option | Description | Selected |
|--------|-------------|----------|
| Quantile summary p50/p90/p99 + count + sum | `{ count, sum, p50, p90, p99 }` via reservoir sampling/t-digest. Ring buffer cap 1024 samples. Compatto, copre 95% use-case dashboard. | ✓ |
| Bucketed histogram standard Prometheus | Bucket pre-definiti con counter per bucket. Più verboso ma quantile arbitrari client-side. | |
| Raw samples ring buffer | `{ samples: number[], count }`. Massima fedeltà ma memory-heavy. | |
| Tu decidi | Lascia al planner basandosi su STACK.md. | |

**User's choice:** Quantile summary p50/p90/p99 + count + sum (Recommended)
**Notes:** Standard Prometheus 'summary' compatible. Reservoir vs t-digest lasciato al researcher in base a bundle budget.

### Question 4 — Labels/tags representation

| Option | Description | Selected |
|--------|-------------|----------|
| Flatten label nel name | `metric{label="v"}` Prometheus-style. Cap 100 distinct combinations per metric (cardinality protection). | ✓ |
| Nested object per label | `{ counters: { 'metric_total': { 'label_combo': N } } }`. JS-idiomatic ma divergente da Prometheus. | |
| No labels in V1 | Niente label, esplosione di metric keys flat. | |
| Tu decidi | Lascia al planner valutando trade-off cardinality vs DX dashboard. | |

**User's choice:** Flatten label nel name (Recommended)
**Notes:** Pattern Prometheus 1:1, parser standard. Cap 100 combinations + system.metrics.cardinality-overflow audit.

---

## Inspector retention + pauseTopic queue

### Question 1 — Inspector ring buffer size

| Option | Description | Selected |
|--------|-------------|----------|
| Ring buffer 500 eventi default + config | EventInspector ring buffer 500 eventi (incluse PipelineSnapshot 14 step). Override via config. ~5-10MB con payload medio. | ✓ |
| Ring buffer 100 eventi default | Meno memoria (~1-2MB) ma meno history. | |
| Unbounded buffer durante debug=on | Cattura tutto finché debug=on. Rischio memory leak in long-running session. | |
| Tu decidi | Lascia al planner basandosi su benchmark memory cap. | |

**User's choice:** Ring buffer 500 eventi default + config (Recommended)
**Notes:** Sweet spot DX vs memory. RouteInspector segue stesso pattern.

### Question 2 — pauseTopic granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Block publish + queue events | publish bloccato + FIFO queue. Subscriber + route NON triggherano. resumeTopic() flushha queue in ordine. Coerente SC-4 wording. | ✓ |
| Allow publish + skip subscriber/route delivery | publish prosegue (Inspector vede), subscriber/route non triggherano. Contraddice SC-4 "eventi accodati". | |
| Only route-level pause | Ferma solo route HTTP/worker/cache/realtime/composite. Subscriber locali continuano. Più fine-grained ma confonde semantica. | |
| Tu decidi | Lascia al planner verificando SC-4 wording. | |

**User's choice:** Block publish + queue events (Recommended)
**Notes:** Coerente con SC-4 esplicito "gli eventi vengono accodati".

### Question 3 — flushQueue semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Drop silenzioso + emit system event | Svuota queue scartando eventi. Pubblica `system.queue.flushed` con droppedCount. Niente re-publish (evita double-effect). | ✓ |
| Re-publish in ordine + cleanup queue | Replay tutti gli eventi accodati. Rischia tempest di side-effect HTTP/worker. | |
| Return events to caller | Ritorna array eventi al chiamante per gestione custom. Più flessibile ma trasferisce responsabilità. | |
| Tu decidi | Lascia al planner valutando wording SC-4. | |

**User's choice:** Drop silenzioso + emit system event (Recommended)
**Notes:** Pattern destructive-by-design admin tool. Per replay → resumeTopic() (replay automatico).

### Question 4 — Pause queue cap + overflow

| Option | Description | Selected |
|--------|-------------|----------|
| maxQueueSize 1000 + drop-oldest + system.warn | Cap 1000 + drop FIFO oldest + emit `system.queue.overflow`. Critical priority bypass (consistency F3 D-75 / F5 D-130). | ✓ |
| maxQueueSize 1000 + drop-newest | Drop il NUOVO evento (back-pressure verso publisher). Publisher non sa che publish è droppata. | |
| Unbounded queue | Niente cap. Memory bloat se pauseTopic resta on a lungo. | |
| Tu decidi | Lascia al planner valutando coerenza con BackpressureStrategy. | |

**User's choice:** maxQueueSize 1000 + drop-oldest + system.warn (Recommended)
**Notes:** Pattern uniforme cross-fase: cap esplicito + critical pass + audit emit.

---

## Claude's Discretion

Aree dove l'utente non ha richiesto deep-dive ma ha indicato "lasciare al planner/researcher":
- Naming interno dei file (`memory-cache-adapter.ts` vs `memory-cache.ts`, `event-inspector.ts` vs `event-recorder.ts`)
- Stable hash implementation per cache key (json-stable-stringify + crypto.subtle.digest SHA256 vs FNV-1a custom)
- Reservoir sampling (Algorithm R ~30 LOC) vs t-digest (~200 LOC) per histogram
- Default thresholds tunable via config (maxEntries=1000, eventBufferSize=500, histogramSamples=1024, maxLabelCombinations=100, pauseQueueMaxSize=1000)
- Topology: composition wrapper chain `createCacheBroker(createWorkerBroker(...))` vs factory aggregato `createGlueZero(config)` in `@gluezero/gluezero`
- Cache invalidation API surface (signature precisa di `broker.cache.invalidate(keyOrPattern)`, dispatch sync vs microtask, batch via array)
- DOC consolidation strategy (TypeDoc + `typedoc-plugin-markdown` + README aggregato)
- Cache-then-network ordering micro-detail (microtask same-tick vs queueMicrotask vs setTimeout)
- Error categorization (`category: 'cache'` per cache errors, `category: 'config'` per register errors, `category: 'system'` per devtools errors)

## Deferred Ideas

Vedere sezione `<deferred>` di `06-CONTEXT.md` per la lista completa (15 idee deferred a V1.x/V2):
- @gluezero/cache-idb (V1.x)
- OpenTelemetry/Prometheus exporter nativo (V1.x)
- Real-time dashboard UI built-in (V2)
- Distributed tracing W3C traceparent (V1.x)
- Cache size-bytes-based eviction (V1.x)
- Custom histogram bucketing per route (V1.x)
- Auto-instrumentation tap custom (V1.x)
- Inspector persistence LocalStorage/IndexedDB
- HMR config devtools (bundler-specific)
- SharedWorker cross-tab metrics (V2)
- Service Worker / Push notification bridge (V2)
- WorkerInspector dedicated (V1.x)
- MappingInspector integrato in Event Inspector
- User-defined metric registration (V1.x)
- Anti-flap pause/resume debounce (V1.x)
