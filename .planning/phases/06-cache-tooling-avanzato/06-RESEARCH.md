---
phase: 06-cache-tooling-avanzato
researched: 2026-05-05
domain: Cache layer (LRU bounded + scope user-aware + cache-then-network ordering) + Developer Tooling (Tap registry chain, EventInspector + RouteInspector ring buffer, MetricsCollector simil-OpenMetrics con quantile summary, pauseTopic/flushQueue, getDebugSnapshot deep-clone) — chiusura milestone v1.0 + PRD §39 #10 (TOOL-05 metrics format) + DOC consolidation finale
researcher: gsd-researcher (claude-opus-4-7-1)
confidence_overall: HIGH (16 decisioni utente lockate D-155..D-170 in CONTEXT.md; pattern F1-F5 consolidati 5 volte; Comlink + structuredClone + reservoir sampling Algorithm R sono primitive standard ben definite; D-83 strict carryover meccanico; ZERO open issue bloccante post-CONTEXT)
sources_scanned:
  - prd.md §3, §10.6, §10.7, §11.1, §17.4, §17.6, §17.7, §20, §22.5, §24, §25, §26.2, §27, §28, §30, §31.3, §34.1, §34.2, §35.1-35.3, §39 #10, §41, §42
  - .planning/phases/06-cache-tooling-avanzato/06-CONTEXT.md (D-155..D-170 — 16 decisioni lockate)
  - .planning/phases/05-worker-runtime/05-CONTEXT.md (D-121, D-126, D-149/D-150 carryover)
  - .planning/phases/05-worker-runtime/05-RESEARCH.md (pattern research analogo 17 sezioni)
  - .planning/phases/04-realtime-inbound-sse-prioritario-ws-opzionale/04-CONTEXT.md (D-101, D-112, D-115 carryover)
  - .planning/phases/03-routing-server-gateway-http/03-CONTEXT.md (D-83 STRICT, D-74 KeyBased, D-75 backpressure, D-77 placeholder cache/composite, D-86 cascade, D-94 augment.ts)
  - .planning/research/STACK.md §size-limit, §cache, §metrics
  - .planning/research/PITFALLS.md #1 (memory leak), #4 (backpressure), #8 (cache invalidation + cache-then-network), #9 (plugin isolation), #16 (perf — debug auto-off + trie + pre-compile), #17 (sicurezza — token + scope cross-tenant)
  - .planning/research/ARCHITECTURE.md §1-§2 (Mediator + Pipes-and-Filters), §3.2 (EventTap pre-instrumentazione)
  - .planning/research/SUMMARY.md (V1 stack + open issues §39 #10 mapping F6)
  - .planning/REQUIREMENTS.md (CACHE-01..03, TOOL-01..05, TEST-01/02 ext F6, DOC-02/05/06)
  - .planning/ROADMAP.md (Phase 6 success criteria 1-5)
  - packages/core/src/types/tap.ts (EventTap interface pre-instrumentato F1)
  - packages/core/src/core/bus.ts (safeTapStep usage 5 step F1)
  - packages/core/src/core/broker.ts (this.tap wiring F1)
  - packages/core/src/types/config.ts (BrokerConfig.runtime.tap F1)
  - packages/routing/src/route-executor.ts (case 'cache' + 'composite' placeholder D-77)
  - packages/routing/src/route-handlers/cache-handler.ts (stub `cache.not-implemented`)
  - packages/routing/src/types/route-definition.ts (RouteCacheDefinition + RouteCompositeDefinition type-only F3)
  - packages/gateway/src/http/strategies/dedupe-strategy.ts (KeyBased D-74 → riuso D-155 cache key)
  - packages/gateway/src/http/strategies/backpressure-strategy.ts (D-75 6 policy + critical bypass → riuso D-170 pause queue)
  - packages/worker/src/augment.ts (pattern declaration merging F5 → modello augment cache + devtools)
  - package.json (size-limit config: core 8KB, mapper 12KB, routing 24KB, gateway/http 8KB, worker 32KB)
  - npm registry live 2026-05-05 (lru-cache 11.3.6, tdigest 0.1.2, json-stable-stringify 1.3.0, typedoc 0.28.19, typedoc-plugin-markdown 4.11.0)
versions_verified:
  - lru-cache@11.3.6 (npm view, 2026-05-05) — VALUTATO ma NON adottato (vedi §2.2)
  - tdigest@0.1.2 (npm view, 2026-05-05) — VALUTATO ma NON adottato (vedi §8)
  - json-stable-stringify@1.3.0 (npm view, 2026-05-05) — VALUTATO ma NON adottato (vedi §3)
  - typedoc@0.28.19 + typedoc-plugin-markdown@4.11.0 (npm view, 2026-05-05) — già installati workspace
  - vitest@4.1.5 + @vitest/browser@4.1.5 + jsdom@29.1.0 + playwright@1.59.1 (riuso F1-F5)
  - valibot@1.3.1 + nanoid@5.1.11 (riuso F1-F5)
---

# Phase 6: Cache & Tooling avanzato — Research

**Researched:** 2026-05-05
**Domain:** Cache layer (`@sembridge/cache`) + Developer Tooling (`@sembridge/devtools`) — milestone v1.0 closure
**Confidence overall:** HIGH

> Lingua: italiano per testo descrittivo; inglese per identificatori, codice, nomi librerie/file/comandi/tipi (vincolo CLAUDE.md).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-155..D-170 — 16 decisioni)

#### A. Cache key & user-scope (CACHE-01..03 + SC-5)

- **D-155:** Cache key default `${topic}::${stableHash(canonicalPayload)}` — riuso pattern F3 D-74 KeyBased dedupe (`packages/gateway/src/http/strategies/dedupe-strategy.ts`). Override sempre disponibile via `RouteDefinition.cache.key: (event) => string`.
- **D-156:** Scope hybrid: config-level `BrokerConfig.cache.scopeProvider?: (event) => string | null` + route-level `RouteDefinition.cache.scope?: (event) => string | null`. Cache key finale `${scope}::${baseKey}` (anti cross-tenant leakage). Pattern coerente con timeout/auth hierarchy F3.
- **D-157:** Missing scope su route auth → skip cache (zero hit, zero write) + emit `system.cache.scope-missing` (audit). Sicuro by default.
- **D-158:** `MemoryCacheAdapter` LRU bounded `maxEntries=1000` default. TTL ortogonale (entry può essere evicted prima del TTL). Tracking via Map insertion order (idiomatic JS LRU).

#### B. EventTap multiplex pattern (TOOL-01/02/04)

- **D-159:** Tap registry chain `BrokerConfig.taps?: readonly EventTap[]` con error isolation try/catch per ogni tap. F1 single-tap `BrokerConfig.runtime.tap` deprecato con auto-wrap backward-compat (zero breaking).
- **D-160:** `enableDebug()`/`disableDebug()` toggle live-mode. Tap sempre registrati, lazy mode early-return quando `debug=off`. Default automatico `NODE_ENV !== 'production'` → debug=on.
- **D-161:** Tap invocato su tutti 14 step §28 + lifecycle events (`route.dispatched`, `cache.hit/miss/evicted`, `worker.spawned/terminated`, `realtime.connected/disconnected`).
- **D-162:** `getDebugSnapshot()` deep-clone immutable via `structuredClone` nativo (riuso pattern F5 D-141 transferable awareness).

#### C. MetricsCollector schema & semantics (TOOL-03/05 — chiude PRD §39 #10)

- **D-163:** Naming `sembridge.<package>.<metric>` dot.case namespaced (Prometheus/OpenMetrics-friendly). Suffix convention: `_total` per counter, `_ms` per duration histogram.
- **D-164:** Cumulative-only counters dal boot. Helper opzionale `getMetricsDelta(prev)` calcola differenze lato consumer.
- **D-165:** Histogram `{ count, sum, p50, p90, p99 }` con ring buffer ~1024 samples. Calcolo via reservoir sampling (Vitter Algorithm R) o t-digest — researcher decide §8.
- **D-166:** Labels Prometheus-style flatten `metric.name{key="value"}`. Cap **100 distinct combinations per metric base name** + emit `system.metrics.cardinality-overflow` warn.

#### D. Inspector retention + pauseTopic queue (TOOL-01/02/05)

- **D-167:** `EventInspector` + `RouteInspector` ring buffer 500 eventi default (override `BrokerConfig.devtools.eventBufferSize` / `routeBufferSize`).
- **D-168:** `pauseTopic(topic)` block publish + queue events FIFO. Subscriber NON ricevono. Route NON triggherano.
- **D-169:** `flushQueue(topic?)` drop silenzioso + emit `system.queue.flushed { topic, droppedCount, droppedEventIds }`. NIENTE re-publish (replay solo via `resumeTopic`).
- **D-170:** Pause queue cap `maxQueueSize=1000` default + drop-oldest FIFO + emit `system.queue.overflow`. Critical bypass per `priority: 'critical'` (riuso pattern F3 D-75 + F5 D-130).

### Claude's Discretion

- Naming interno file (`memory-cache-adapter.ts` vs `memory-cache.ts`, `event-inspector.ts` vs `event-recorder.ts`)
- Stable hash impl (`json-stable-stringify` + crypto.subtle.digest SHA-256 vs FNV-1a inline custom)
- Reservoir sampling Algorithm R vs t-digest per histogram
- Default thresholds `maxEntries=1000` / `eventBufferSize=500` / `histogramSamples=1024` / `maxLabelCombinations=100` / `pauseQueueMaxSize=1000`
- Topology composition wrapper (chain `createCacheBroker(createDevtoolsBroker(createWorkerBroker(...)))` vs factory aggregato `createSemBridge(config)` in `@sembridge/sembridge`)
- Cache invalidation API surface (`broker.cache.invalidate(keyOrPattern)` signature: `string | RegExp | { prefix: string }`, dispatch sync vs microtask, batch via array)
- DOC consolidation strategy (TypeDoc website auto-generato + README aggregato `@sembridge/sembridge`)
- Cache-then-network ordering (timing micro-detail: same-tick vs `queueMicrotask` vs `setTimeout 0`)
- Error categorization mapping (`category: 'cache'` per adapter, `'config'` per register, `'system'` per devtools)

### Deferred Ideas (OUT OF SCOPE V1)

- `@sembridge/cache-idb` IndexedDB adapter (V1.x — ROADMAP esplicito)
- OpenTelemetry / Prometheus exporter nativo (V1.x — package separato `@sembridge/devtools-otel`)
- Real-time dashboard UI built-in (V2)
- Distributed tracing W3C `traceparent`/`tracestate` propagation (V1.x)
- Cache size-bytes-based eviction (V1.x)
- Custom histogram bucketing per route policy (V1.x)
- Auto-instrumentation tap custom oltre Inspector + Metrics (V1.x)
- Inspector persistence (LocalStorage / IndexedDB) (V1.x)
- HMR / hot reload del config devtools (V1.x bundler-specific)
- `SharedWorker` cross-tab metrics aggregation (V2)
- Service Worker / Push notification bridge (V2 — RT2-01)
- WorkerInspector dedicated (V1.x — F5 ha già `getDebugSnapshot().workerPoolState`)
- MappingInspector dedicated (F2 ha già `MappingInspector` MAP-15 — F6 NON sostituisce)
- User-defined metric registration `broker.metrics.register('my.metric', 'counter')` (V1.x)
- Anti-flap pause/resume debounce (V1.x)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CACHE-01 | Cache in-memory chiave configurabile per route/topic *(PRD §20.2)* | §2-§4 LRU + key §3 |
| CACHE-02 | TTL configurabile + invalidazione manuale/automatica *(PRD §20.2)* | §2 LRU + TTL ortogonale + §4 invalidate API |
| CACHE-03 | Metadata `cache` vs `remote` *(PRD §20.2, §20.4)* | §4 cache-then-network ordering + SC-1 |
| TOOL-01 | Event Inspector completo (14 step §28) *(PRD §25.1)* | §6 ring buffer + §5 tap registry + §12 pipeline §28 |
| TOOL-02 | Metrics canonical (eventi/sec, errori per categoria, tempi route, cache hit ratio, subscriber count, backlog) *(PRD §25.5)* | §7-§9 MetricsCollector deep dive |
| TOOL-03 | `enableDebug` / `disableDebug` / `getDebugSnapshot` *(PRD §16.2, §16.3)* | §5 toggle + §11.B getDebugSnapshot deep clone |
| TOOL-04 | `pauseTopic` / `resumeTopic` / `flushQueue` *(PRD §16.3)* | §10 pause queue impl |
| TOOL-05 | Format metriche `{ counters, gauges, histograms }` *(PRD §39 #10 closure)* | §7 schema + §9 cardinality cap |
| TEST-01 ext F6 | Unit test cache + devtools subset *(PRD §35.1)* | §13 test 3-tier — Tier-1 |
| TEST-02 ext F6 | Cache hit/miss flows *(PRD §35.2)* | §13 — Tier-3 Playwright per cache-then-network ordering |
| DOC-02 | Guida integrazione plugin *(PRD §41.4)* | §16 DOC consolidation TypeDoc |
| DOC-05 | Esempi end-to-end (scenario meteo §29 con cache + tooling) *(PRD §41.8)* | §16 — esteso da F5 worker section a full F6 |
| DOC-06 | Documentazione debug tooling *(PRD §41.9)* | §16 — README italiano `packages/devtools/` |

---

## Project Constraints (from CLAUDE.md)

| Directive | Applicazione F6 |
|-----------|-----------------|
| **Modello opus per ogni sub-agent** | Spawn agenti GSD F6 con override esplicito `model: "opus"` (no sonnet/haiku per verifier/checker/synthesizer). Config `model_profile: "quality"` non sufficiente da solo. |
| **Lingua italiana** | RESEARCH.md, PLAN.md F6, JSDoc descrittivi, commit message, descrizioni REQ-ID, success criteria → italiano. Codice/identificatori/nomi librerie/file/log keyword/error code → inglese. |
| **Boundary di sicurezza** | F6 vive in `/Users/omarmarzio/programming/prova AI/SemBridge/packages/{cache,devtools,sembridge}/` — area libera. Niente touch fuori boundary. |
| **Alta autonomia decisionale** | 16 decisions D-155..D-170 lockate in CONTEXT.md → NON re-discutere. Procedi su default ragionevoli per Claude's Discretion. |
| **D-83 strict carryover** | F6 NON tocca runtime di `packages/{core,mapper,routing}/src/` né `packages/gateway/src/{http,sse-ws}/` né `packages/worker/src/`. F6 vive SOLO in `packages/cache/src/` + `packages/devtools/src/` + `packages/sembridge/src/` + i rispettivi `augment.ts`. Verifica `git diff main...HEAD packages/{core,mapper,routing,gateway,worker}/src/` exit 0 lines. |
| **Agent-swarm preferred** | Wave-based parallelization con file ownership disgiunta. Spawn multipli in singolo messaggio. |
| **TRACKER.md protocol** | Aggiornare TRACKER.md a fine ogni plan F6 con commit hash + path SUMMARY.md. |

---

## 1. Executive Summary

La Fase 6 chiude il milestone v1.0 di SemBridge introducendo **due package runtime** (`@sembridge/cache` e `@sembridge/devtools`) e un **package aggregato pubblico** (`@sembridge/sembridge`) che re-esporta la libreria completa con factory unificato. La fase NON modifica F1-F5: vive interamente in nuovo codice, secondo il pattern D-83 strict consolidato 5 volte (F2 D-49 → F3 D-83 → F4 D-101 → F5 D-121 → F6 ext).

**Sei decisioni implementative non-banali (D-159, D-161, D-162, D-165, D-166, D-170) hanno conseguenze concrete che guidano la decomposition in plan:**

1. **D-159 tap registry chain** richiede sostituzione del campo `BrokerConfig.runtime.tap?: EventTap` (F1, single value) con `BrokerConfig.taps?: readonly EventTap[]` (F6, array). Auto-wrap backward-compat: se config ha `runtime.tap`, F6 lo wrappa in `taps: [runtime.tap]`. Il composition wrapper F6 invoca tutti i tap in ordine con error isolation try/catch isolato per tap (failure di un tap NON ferma downstream). Researcher conferma: **NON modifichiamo `EventBus.deliver()` di F1** (D-83 strict). Invece, il wrapper F6 espone una nuova API `createCacheBroker(config)` che istanzia un `MultiplexTap` aggregator (singolo `EventTap` che chiama N tap interni con try/catch isolato), e passa quello come `runtime.tap` al broker F1 sottostante. Pattern Adapter classico — vedi §5.

2. **D-161 tap su tutti 14 step §28** richiede attenzione perché solo **F1 step 1, 2, 3, 7-base, 13** + **F2 step 4, 5, 6, 11, 12** + **F3 step 7-full, 8, 9, 10** + **F4-F5 lifecycle events** sono già strumentati nel codebase. Lo **step 14 (logging/metrics/debug snapshot)** è la novità F6 ed è il punto di attivazione del `MetricsCollector` + `EventInspector`. Researcher verifica via grep: `safeTapStep` è chiamato in `packages/core/src/core/bus.ts` per i 5 step F1, in `router-broker-wrapper.ts:514` per gli step F3, in `broker-mapper-wrapper.ts:325` per F2, etc. F6 deve aggiungere step 14 al composition wrapper post step 13 — vedi §12.

3. **D-162 `getDebugSnapshot()` deep clone via structuredClone** richiede attenzione su perf: snapshot rare-call accettabile, NON usabile per profiling continuo (5-10ms su payload grandi). Researcher conferma in §11.B che `structuredClone` è disponibile in tutti i browser evergreen (Baseline 2022) e copre `Date/Map/Set/ArrayBuffer/RegExp/Blob/ImageData/ImageBitmap` — copre i payload canonici F2.

4. **D-165 reservoir sampling vs t-digest** è una scelta di trade-off bundle vs accuracy. Researcher analizza in §8: reservoir Algorithm R (~30 LOC inline) vs `tdigest@0.1.2` npm (~3-5 KB minified, +1 dep, accuratezza p999 superiore). Verdetto: **reservoir Algorithm R inline** (zero deps + p50/p90/p99 sufficienti per dashboard V1; t-digest deferred V1.x se profiling reale richiede p999).

5. **D-166 cardinality cap 100 distinct combinations per metric base name** è la mitigation #1 contro Pitfall "metric explosion" (cardinality runaway). Pattern: ogni `MetricsCollector.observe(name, value, labels)` calcola `key = ${name}{${flatLabels}}` e tenta inserimento in `Map<baseName, Set<flattenedLabelSig>>`. Se `set.size === maxCardinality` e nuova combo non in set → drop + emit `system.metrics.cardinality-overflow {baseName, labels, droppedSig}`. Researcher specifica algoritmo deterministico in §9.

6. **D-170 pause queue cap + critical bypass** richiede DUE pattern carryover esatti: (a) F3 D-75 backpressure-strategy pattern `queue-bounded` con drop-oldest, (b) F5 D-130 critical priority bypass. Implementazione F6 NON riusa `BackpressureStrategy` di F3 perché la semantica è diversa (pauseTopic = block explicit user-driven, backpressure = automatic load shedding); ma il pattern algoritmico è identico. Vedi §10.

**Stack lockato (no choice — già fissato in CONTEXT.md + STACK.md + verificato live):**
- Zero nuove dipendenze runtime esterne (target: massima parsimonia + bundle budget tight)
- `nanoid@5.1.11` (riuso F1) per `eventInspectorEntry.id` se necessario (più probabile riuso `event.id` esistente)
- `valibot@1.3.1` (riuso F2) per `BrokerConfig.cache` + `BrokerConfig.devtools` Valibot safeParse
- `vitest@4.1.5` + `@vitest/browser@4.1.5` + `playwright@1.59.1` + `jsdom@29.1.0` per Tier-1/Tier-3 (riuso F4/F5)
- `typedoc@0.28.19` + `typedoc-plugin-markdown@4.11.0` per DOC consolidation finale (già installati workspace, attivati in F6 final gate)

**Primary recommendation:** decomporre in **9 plan wave-based** (analogo F4 9 plan / F3 14 plan / F5 7 plan), file ownership disgiunta entro ogni wave per parallelizzazione. Final gate plan dedicato (06-09) chiude milestone v1.0 con coverage v8 ≥90%, REQ matrix flip CACHE-01..03 + TOOL-01..05 → Complete, chiusura PRD §39 #10, DOC-02/05/06 consolidation, bundle aggregato `@sembridge/sembridge` validato. Vedi §17 plan structure dettagliata.

**Vincolo D-83 strict (carryover F1-F5 → F6):** ZERO modifiche runtime a `packages/{core,mapper,routing,gateway,worker}/src/`. Tutto F6 vive in `packages/cache/src/` + `packages/devtools/src/` + `packages/sembridge/src/`. Verifica `git diff main...HEAD packages/{core,mapper,routing,gateway,worker}/src/` exit 0 lines per tutta F6 (pattern già consolidato in F3/F4/F5).

---

## 2. Architettura cache + LRU implementation deep dive

### 2.1 Diagramma data flow `weather.requested` con cache-then-network

```
┌──────────┐  publish weather.requested  ┌───────────────┐
│ Plugin A │ ──────────────────────────► │ DevtoolsBroker│ ─── tap step 1-13 → MultiplexTap → [EventInspector, RouteInspector, MetricsCollector]
└──────────┘  (canonical input)          │ (composition  │
                                          │   wrapper)    │
                                          └───────┬───────┘
                                                  │ delegate publish
                                                  ▼
                                          ┌───────────────┐
                                          │  CacheBroker  │
                                          │ (composition) │
                                          └───────┬───────┘
                                                  │ delegate publish
                                                  ▼
                                          ┌───────────────┐
                                          │ RouterBroker  │ ──────── pipeline §28 step 1-7 (F1+F2+F3-pre)
                                          │ (F3 base)     │
                                          └───────┬───────┘
                                                  │ matched route type='cache' OR 'composite'
                                                  ▼
                                          ┌────────────────────────┐
                                          │ RouteExecutor          │ ──── case 'cache' → CacheHandler (F6 NEW)
                                          │ (F3 dispatch table)    │ ──── case 'composite' → CompositeHandler (F6 concretizza)
                                          └───────┬────────────────┘
                                                  │
                                                  ▼
              ┌────────────────────────────────────────────────────────────────────────┐
              │   @sembridge/cache — runtime F6 (D-83 strict, only here)              │
              │ ┌──────────────────┐    lookup       ┌────────────────────┐           │
              │ │ CacheHandler     │◄───────────────│  MemoryCacheAdapter│           │
              │ │ (Strategy F3)    │                 │  LRU Map<key, entry>│           │
              │ └────────┬─────────┘                 │  +TTL +access order │           │
              │          │ HIT                       └────────────────────┘           │
              │          │ ──────► publish weather.loaded {origin:'cache'} (SYNC)     │
              │          │                                                              │
              │          │ MISS / network-first / cache-then-network                    │
              │          ▼                                                              │
              │ ┌──────────────────┐    delegate to F3 HTTP gateway                    │
              │ │ CompositeHandler │ ──── http handler from F3 ────► fetch + map      │
              │ │ (concretizza F3) │                                                    │
              │ └────────┬─────────┘                                                    │
              │          │ response → cache.set(key, payload, ttl)                       │
              │          ▼                                                              │
              │ ──────► publish weather.loaded {origin:'remote', replaces:<eventId>}  │
              └────────────────────────────────────────────────────────────────────────┘
                                                  │
                                                  ▼
              tap step 14 → MetricsCollector.increment('sembridge.cache.hits_total'/.misses_total)
                          → EventInspector.record(snapshot)
                          → RouteInspector.record(routeOutcome)
                                                  │
                                                  ▼
                                          ┌───────────────┐
                                          │ Plugin B      │
                                          │ (subscriber)  │
                                          └───────────────┘
```

**Caratteristiche chiave:**
- **CacheHandler** è la **concretizzazione F6 del placeholder F3 D-77** in `packages/routing/src/route-handlers/cache-handler.ts` (oggi ritorna `'cache.not-implemented'`). F6 inietta un nuovo `cacheHandler` in `RouteExecutorDeps` via composition wrapper.
- **CompositeHandler** F3 è già implementato per `composite` route ma il sotto-step `cache` ritorna stub. F6 concretizza fornendo `cacheLookup`/`cacheWrite` callable dal CompositeHandler.
- **Pipeline §28 step 14** è IL nuovo step F6 — invocato post step 13 (deliver) dal composition wrapper.

### 2.2 LRU bounded — implementazione

**Tre opzioni valutate per `MemoryCacheAdapter`:**

| Opzione | LOC | Bundle gz | Deps | Maturity | Verdetto |
|---------|-----|-----------|------|----------|----------|
| **A. Map insertion order** (idiomatic JS) | ~80 | ~0 | 0 | Browser-native | **ADOTTATO** |
| B. Custom doubly-linked list | ~150 | ~1 KB | 0 | Custom | RIGETTATO (over-engineering V1) |
| C. `lru-cache@11.3.6` npm (verified live) | 0 | ~3-4 KB | +1 | Mature (Isaacs) | RIGETTATO (D-158 cap entries semplice + zero-dep priority) |

**Pattern adottato (Opzione A — Map insertion order):**

```ts
// packages/cache/src/memory-cache-adapter.ts (proposed)
export interface CacheEntry<T = unknown> {
  readonly value: T
  readonly expiresAt: number  // Date.now() + ttlMs; Infinity se TTL non set
  readonly setAt: number       // metadata audit
}

export interface CacheAdapter {
  get<T>(key: string): CacheEntry<T> | undefined
  set<T>(key: string, value: T, ttlMs?: number): void
  delete(key: string): boolean
  invalidate(keyOrPattern: string | RegExp | { prefix: string }): number  // returns count
  size(): number
  clear(): void
  stats(): { hits: number; misses: number; evictions: number; entries: number }
}

export function createMemoryCacheAdapter(opts: { maxEntries?: number } = {}): CacheAdapter {
  const maxEntries = opts.maxEntries ?? 1000  // D-158
  const cache = new Map<string, CacheEntry>()
  let hits = 0, misses = 0, evictions = 0

  return {
    get(key) {
      const entry = cache.get(key)
      if (!entry) { misses++; return undefined }
      // TTL check
      if (entry.expiresAt < Date.now()) {
        cache.delete(key)
        evictions++
        misses++
        return undefined
      }
      // LRU touch: re-insert per portare in coda Map (insertion order = LRU order)
      cache.delete(key)
      cache.set(key, entry)
      hits++
      return entry as CacheEntry<unknown>
    },
    set(key, value, ttlMs) {
      // Eviction LRU: se oltre cap, drop il primo (più vecchio per insertion order)
      if (cache.size >= maxEntries && !cache.has(key)) {
        const oldestKey = cache.keys().next().value
        if (oldestKey !== undefined) {
          cache.delete(oldestKey)
          evictions++
          // Tap event 'cache.evicted' D-161 emesso a livello CacheHandler (non qui)
        }
      }
      const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : Number.POSITIVE_INFINITY
      cache.set(key, { value, expiresAt, setAt: Date.now() })
    },
    delete(key) { return cache.delete(key) },
    invalidate(pattern) {
      let count = 0
      // string esatto
      if (typeof pattern === 'string') {
        if (cache.delete(pattern)) count++
        return count
      }
      // RegExp
      if (pattern instanceof RegExp) {
        for (const k of cache.keys()) {
          if (pattern.test(k)) { cache.delete(k); count++ }
        }
        return count
      }
      // { prefix: string }
      if ('prefix' in pattern) {
        for (const k of cache.keys()) {
          if (k.startsWith(pattern.prefix)) { cache.delete(k); count++ }
        }
        return count
      }
      return count
    },
    size() { return cache.size },
    clear() { cache.clear() },
    stats() { return { hits, misses, evictions, entries: cache.size } },
  }
}
```

**Rationale Map insertion order:**
1. **Zero dep + zero LOC overhead vs library** — Map idioma JS standard
2. **Insertion order garantito da spec ECMAScript** dal 2015 (Baseline universale)
3. **Re-insert on get = LRU touch**: pattern noto, ~2 op O(1) (`delete` + `set`)
4. **Eviction O(1)**: `cache.keys().next().value` ritorna primo key (LRU)
5. **Bundle target stretto** (vedi §16): zero dep prioritario per `@sembridge/cache` <8KB
6. **Spec D-158 cap entries** (NON cap bytes) — questa impl la rispetta esattamente

**Caveat:**
- Re-insert su get costa 2 op anche su HIT — accettabile (cache write < cache read frequency)
- Non thread-safe ma JS single-threaded event loop → atomicity implicita (pattern F5 D-133 carryover)

### 2.3 Verifica live `lru-cache@11.3.6` (npm view 2026-05-05)

```bash
$ npm view lru-cache version
11.3.6
```

Versione major aggiornata (rispetto STACK.md `8.x`). Non adottata per F6 ma documentata: V1.x consumer può swap `MemoryCacheAdapter` con custom adapter che wrappa `lru-cache` se richiede TTL avanzato (`ttlAutopurge`, `disposeAfter`). Pattern: `CacheAdapter` interface stabile = swap zero-cost.

---

## 3. Cache key stable hash impl (D-155)

### 3.1 Formula lockata

`${topic}::${stableHash(canonicalPayload)}` — concatenazione topic + hash stabile del payload canonical.

**Estensione D-156** (scope hybrid): `${scope}::${baseKey}` quando `cache.scopeProvider` o `cache.scope` route-level ritorna stringa non-null.

### 3.2 Stable hash — tre opzioni

| Opzione | Bundle | Deps | Collision rate | Verdetto |
|---------|--------|------|----------------|----------|
| **A. FNV-1a inline custom** (~30 LOC) | ~0 | 0 | ~1e-6 per 100k entries 32-bit | **ADOTTATO** |
| B. `json-stable-stringify@1.3.0` + `crypto.subtle.digest('SHA-256')` | ~2 KB + nativa | +1 | <1e-15 (cryptographic) | RIGETTATO (over-kill V1) |
| C. djb2 inline (Bernstein) | ~25 LOC | 0 | ~1e-6 32-bit | RIGETTATO (FNV-1a meglio distribuito) |

**Verifica live `json-stable-stringify@1.3.0` (npm view 2026-05-05):** versione current. Non adottata per F6 perché FNV-1a inline è sufficiente per cache key (NON per crypto/security — è pure hash deterministico) e `json-stable-stringify` aggiunge ~2KB + 1 dep transitiva. F6 implementa **JSON stringify deterministico custom** (~20 LOC inline) che ordina alfabeticamente le chiavi degli oggetti (sufficient per cache key — F2 D-74 KeyBased usa stesso pattern in `dedupe-strategy.ts`).

**Pattern adottato:**

```ts
// packages/cache/src/stable-hash.ts (proposed)

/**
 * JSON stringify deterministico — chiavi degli oggetti ordinate alfabeticamente.
 * NO ciclic-detection (assume canonical payload acyclic — pattern F2 invariante).
 * Riuso pattern F3 D-74 dedupe (vedi packages/gateway/src/http/strategies/dedupe-strategy.ts:65-90).
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value as Record<string, unknown>).sort()
  const parts = keys.map(k => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
  return `{${parts.join(',')}}`
}

/**
 * FNV-1a 32-bit hash inline. Riferimento: http://www.isthe.com/chongo/tech/comp/fnv/
 * ~10 LOC, no deps, ~1e-6 collision per 100k entries.
 * Output: 8-char hex string (`a1b2c3d4`).
 */
function fnv1a32(str: string): string {
  let hash = 0x811c9dc5  // FNV offset basis 32-bit
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)  // FNV prime 32-bit
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function stableHash(value: unknown): string {
  return fnv1a32(stableStringify(value))
}

/**
 * Costruisce la cache key finale per un evento (D-155 + D-156).
 *
 * @example
 * cacheKey({ topic: 'weather.requested', payload: { location: 'Roma' } })
 *   → 'weather.requested::a1b2c3d4'
 * cacheKey({ topic: 'weather.requested', payload: ..., scope: 'user-42' })
 *   → 'user-42::weather.requested::a1b2c3d4'
 */
export function cacheKey(opts: {
  topic: string
  payload: unknown
  scope?: string | null
}): string {
  const baseKey = `${opts.topic}::${stableHash(opts.payload)}`
  return opts.scope ? `${opts.scope}::${baseKey}` : baseKey
}
```

### 3.3 Override route-level (D-155)

`RouteDefinition.cache.key?: (event) => string` callback opt-in per use case complessi (es. cache key derivata da subset del payload, ignorando timestamp). Se presente: `key: route.cache.key(event)` invece di `cacheKey({...})` default. Pattern coerente con F3 `RouteDefinition.policies.dedupe.key` e F2 `Mapper $derive`.

---

## 4. Cache route handler `type: 'cache'` + `type: 'composite'` (concretizza F3 D-77)

### 4.1 Stato attuale F3

**`packages/routing/src/route-handlers/cache-handler.ts`** ritorna `RouteOutcome.error code='cache.not-implemented'` (stub esplicito). Type system F3 (`RouteCacheStrategy = 'cache-first' | 'network-first' | 'cache-then-network'`) è già completo — solo runtime adapter F6.

**`packages/routing/src/route-executor.ts:145-148`** ha già `case 'cache'` + `case 'composite'` nel dispatch table — chiamano `cacheHandler(event, route)` (stub) e `createCompositeHandler(deps)` (con sub-step `cache` skippato + warning).

### 4.2 Concretizzazione F6 (D-83 strict carryover)

**F6 NON modifica `route-executor.ts` né `cache-handler.ts` di F3.** Invece, segue pattern F5 carryover (Opzione B composition wrapper §7.2):

1. Il **`createCacheBroker(config)`** factory F6 istanzia internamente:
   - `MemoryCacheAdapter` (D-158)
   - `CacheHandler` F6 (NEW) — che usa `cache.get/set/invalidate` + `cacheKey()` + `route.cache.scope`/`scopeProvider` (D-156)
   - `CompositeHandler` F6 (NEW) — orchestrator che concretizza il sotto-step `cache` chiamando il `CacheHandler` F6 invece dello stub

2. F6 espone questi nuovi handler tramite **iniezione DI** all'`createRouterBroker` interno: `createRouterBroker({ ...config, cacheHandler: cacheHandlerF6, compositeCacheHandler: cacheHandlerF6 })`.

3. **Caveat — F3 RouteExecutor non espone questo DI hook attualmente.** Verificare in plan 06-03 se `RouteExecutorDeps` interface accetta `cacheHandler` opzionale; se NO, il pattern alternativo è:
   - **Pattern alternativo Opzione B'**: il composition wrapper F6 intercetta `publish()` PRE-RouterBroker, controlla se il topic ha route `type: 'cache' | 'composite'` registrate, e gestisce direttamente il dispatch al `CacheHandler` F6, bypassando F3 `RouteExecutor` per quei type. La pipeline §28 step 1-7 si applica al wrapper F6 esterno.
   - **Pattern preferito Opzione B**: il `createCacheBroker(config)` istanzia un nuovo `RouterBroker` interno con `cacheHandler` iniettato. Pattern coerente con F4 `RealtimeBroker` che istanzia internamente `RealtimeChannelManager`.

4. **Researcher raccomanda Opzione B con verifica `RouteExecutorDeps` interface in plan 06-03.** Probabilità: alta (F3 D-65 prevede già DI di `httpHandler` e `resolveSubRoute`; aggiungere `cacheHandler` è extension naturale via declaration merging del `RouteExecutorDeps` interface). Fallback Opzione B' se non praticabile.

### 4.3 Cache strategy (PRD §17.6)

**3 strategie supportate (type-only completate F3, runtime F6):**

| Strategia | Comportamento | Eventi pubblicati |
|-----------|---------------|-------------------|
| `cache-first` | Lookup cache. HIT → publish `weather.loaded {origin:'cache'}`. MISS → fetch + cache.set + publish `{origin:'remote'}`. | 1 evento |
| `network-first` | Fetch. Success → cache.set + publish `{origin:'remote'}`. Network error → cache lookup (fallback) + publish `{origin:'cache'}` se hit, sennò `<topic>.failed`. | 1 evento (success o fallback) |
| `cache-then-network` | Cache lookup. HIT → publish `{origin:'cache'}` IMMEDIATAMENTE (sync). Poi fetch background → publish `{origin:'remote', replaces:<cacheEventId>}`. MISS → solo fetch + publish `{origin:'remote'}`. | 1-2 eventi |

**Cache-then-network ordering** (Claude's Discretion): researcher raccomanda **same-tick microtask** via `queueMicrotask()` per `{origin:'cache'}` → garantisce che il subscriber riceva l'evento cache PRIMA del prossimo render frame, ma DOPO il return della `publish()` corrente. La fetch parte in parallelo (Promise) e quando risolve pubblica `{origin:'remote', replaces}` come evento separato. Pattern evita flicker UI (consumer può ignorare `origin:'cache'` se vuole).

### 4.4 Cache invalidation API (CACHE-02)

**API surface raccomandata** (Claude's Discretion):

```ts
// Aggiunta via packages/cache/src/augment.ts a Broker.cache namespace
broker.cache.invalidate(pattern: string | RegExp | { prefix: string }): number  // returns count

// Esempi
broker.cache.invalidate('weather.requested::a1b2c3d4')  // exact key
broker.cache.invalidate({ prefix: 'weather.' })  // tutti i topic weather
broker.cache.invalidate(/^user-42::/)  // tutto user-scoped per user-42

// Event-driven invalidation declarativa (RouteDefinition.cache.invalidateOn)
{ type: 'cache', strategy: 'cache-first', invalidateOn: ['user.logout', 'user.profile.updated'] }
// Quando publish('user.logout', ...) → automatic cache.invalidate({prefix: scope}) per quella route
```

**Cascade cleanup LIFE-02 ext F6** (D-126 ext F6): `unregisterPlugin(id)` invalida tutte le entry cache associate al plugin. Pattern: ogni `cache.set` traccia `ownerId` come metadata interno; `cascade unregister` itera `cache.entries()` e droppa per ownerId. Implementazione plan 06-02.

---

## 5. Tap registry architecture + auto-wrap backward-compat F1

### 5.1 Stato attuale F1 (single-tap)

**`packages/core/src/types/config.ts`:** `BrokerConfig.runtime?.tap?: EventTap` (single value, opzionale).
**`packages/core/src/core/broker.ts:111`:** `this.tap = config.runtime?.tap ?? noopEventTap`.
**`packages/core/src/core/bus.ts:79,82,91,94,110`:** `safeTapStep(this.tap, 'event.X', ...)` chiama il SINGOLO tap configurato.

### 5.2 Estensione F6 (D-159 tap registry chain)

**Vincolo D-83:** F6 NON modifica `bus.ts` né `broker.ts` né `config.ts` (`runtime.tap`) di F1. Pattern adottato:

1. **F6 introduce `BrokerConfig.taps?: readonly EventTap[]`** via declaration merging in `packages/devtools/src/augment.ts` (analogo F2 `BrokerConfig.canonicalModel`, F3 `BrokerConfig.routes`, F5 `BrokerConfig.workers`).

2. **`createDevtoolsBroker(config)` factory F6** legge `config.taps?` e crea un **`MultiplexTap` aggregator**:

```ts
// packages/devtools/src/multiplex-tap.ts (proposed)
import type { EventTap, PipelineSnapshot, PipelineStep } from '@sembridge/core'

/**
 * Aggregator: invoca N tap in ordine con error isolation try/catch isolato.
 * Failure di un tap NON ferma downstream taps né blocca pipeline (D-159).
 */
export function createMultiplexTap(taps: readonly EventTap[]): EventTap {
  return {
    onPipelineStep(step: PipelineStep, snapshot: PipelineSnapshot): void {
      for (const tap of taps) {
        try {
          tap.onPipelineStep(step, snapshot)
        } catch {
          // swallow — pattern F1 safeTapStep D-20 carryover
        }
      }
    },
  }
}
```

3. **Auto-wrap backward-compat F1:** se `config.runtime?.tap` è settato (F1 single-tap legacy), `createDevtoolsBroker` lo wrappa: `taps = [...config.taps ?? [], config.runtime.tap]`. Zero breaking.

4. **Wiring al broker F1**: `createDevtoolsBroker(config)` istanzia internamente il `RouterBroker` (o catena F1-F5) passando il `MultiplexTap` come `runtime.tap`. Pattern Adapter classico — la pipeline F1 vede UN solo tap (single value), ma quel tap delega a N tap interni F6.

### 5.3 enableDebug / disableDebug toggle live-mode (D-160)

**Pattern lazy-mode:** i tap di devtools (`EventInspector`, `RouteInspector`, `MetricsCollector`) sono SEMPRE registrati ma early-return quando `debug=off`:

```ts
// packages/devtools/src/event-inspector.ts (proposed)
export interface EventInspectorState {
  enabled: boolean  // mutable flag toggled by enableDebug/disableDebug
  buffer: PipelineSnapshot[]
  bufferSize: number
}

export function createEventInspector(opts: { bufferSize?: number; initiallyEnabled?: boolean }): {
  tap: EventTap
  enable(): void
  disable(): void
  getBuffer(): readonly PipelineSnapshot[]
  clear(): void
} {
  const state: EventInspectorState = {
    enabled: opts.initiallyEnabled ?? false,
    buffer: [],
    bufferSize: opts.bufferSize ?? 500,  // D-167
  }
  return {
    tap: {
      onPipelineStep(step, snapshot) {
        if (!state.enabled) return  // hot-path early return — zero overhead in production
        // Append to ring buffer
        state.buffer.push(snapshot)
        if (state.buffer.length > state.bufferSize) state.buffer.shift()
      },
    },
    enable() { state.enabled = true },
    disable() { state.enabled = false; state.buffer = [] },  // disable also clears buffer (memory hygiene)
    getBuffer() { return structuredClone(state.buffer) },  // D-162 deep clone
    clear() { state.buffer = [] },
  }
}
```

**Default automatico** (D-160): `NODE_ENV !== 'production'` → debug=on; `NODE_ENV === 'production'` → debug=off. Implementato a livello `createDevtoolsBroker` factory:

```ts
const isProd = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production'
const initialDebug = config.devtools?.enableByDefault ?? !isProd
```

**Caveat browser:** `process.env.NODE_ENV` viene di solito sostituito al build time da bundler (Vite, Webpack DefinePlugin). Researcher raccomanda fallback robusto: `typeof process !== 'undefined' && typeof process.env !== 'undefined'`. Pattern già consolidato in pacchetti V1 (es. `react`).

### 5.4 enableDebug API public

```ts
broker.enableDebug()  // attiva tutti i tap devtools (Inspector + Metrics non sono tap, sempre on)
broker.disableDebug() // disattiva tap (lazy mode)
broker.getDebugSnapshot() // ritorna deep-clone immutable (D-162) — sempre disponibile
```

`MetricsCollector` (D-160 commento) **resta ON anche con `debug=off`** (counters cumulativi sempre validi cheap). Solo `EventInspector` + `RouteInspector` capture sono sotto toggle.

---

## 6. Inspector ring buffer impl (D-167)

### 6.1 Struttura PipelineSnapshot estesa F6

**F1 originale** (`packages/core/src/types/tap.ts`):
```ts
export interface PipelineSnapshot {
  readonly eventId: string
  readonly topic: string
  readonly step: PipelineStep
  readonly timestamp: number
  readonly durationMs: number
  readonly payloadBefore?: unknown
  readonly payloadAfter?: unknown
  readonly metadata?: Record<string, unknown>
}
```

**F6 NON modifica** questo type (D-83 strict). I dati extra che Inspector mostra (route attivate, esito remote/worker, retry count, cache hit/miss) vengono capturati dai tap F2-F5 esistenti che già aggiungono entry nel `metadata` field — Inspector legge tutti questi snapshot e ricostruisce timeline per `eventId`.

### 6.2 RouteInspector — focus route-level

`RouteInspector` capture eventi `route.dispatched` lifecycle (D-161) + esito (success/error/skipped/cached) + policy applicate (timeout, retry attempts, dedupe hit, etc). Questo richiede l'aggiunta di **lifecycle events** (D-161) come step custom oltre i 14 §28:

```ts
// packages/devtools/src/route-inspector.ts (proposed)
export interface RouteInspectorEntry {
  readonly eventId: string
  readonly routeId: string
  readonly topic: string
  readonly type: 'local' | 'http' | 'cache' | 'composite' | 'worker' | 'realtime-inbound'
  readonly outcome: 'success' | 'error' | 'skipped' | 'cached' | 'pending'
  readonly durationMs: number
  readonly retryCount?: number
  readonly cacheHit?: boolean
  readonly policiesApplied?: readonly string[]  // ['timeout', 'retry', 'dedupe', etc]
  readonly timestamp: number
  readonly errorCode?: string
}
```

Cattura via tap F6 che ascolta step 9 (`event.route.executed`) + step 10 (`event.outcome.collected`) e aggrega per `eventId + routeId`.

### 6.3 Memory footprint

**Stima:** 500 entries × ~5 KB media (snapshot completo con payloadBefore/After) ≈ **2.5 MB** per Inspector. Per `RouteInspectorEntry` (più compatto, ~200 bytes) ≈ 100 KB. Totale **~3 MB** in worst-case con `debug=on` e payload medi. Drop FIFO silenzioso oltre cap → memory bound predictable.

**Mitigation Pitfall ring buffer leak:**
- `disable()` clear-buffer per liberare memoria su user-driven disable
- `unregisterPlugin` cascade NON fa cleanup specifico Inspector (Inspector è broker-scoped, non plugin-scoped)
- Heap snapshot test in `__integration__/inspector-memory.test.ts` (D-151 analog F5) per verificare buffer cap rispettato

---

## 7. MetricsCollector impl deep dive (TOOL-02 + D-163/D-164/D-165/D-166)

### 7.1 Schema `getMetrics()` lockato (D-163)

```ts
// packages/devtools/src/types/metrics.ts (proposed)
export interface MetricsSnapshot {
  readonly counters: Record<string, number>
  readonly gauges: Record<string, number>
  readonly histograms: Record<string, HistogramSummary>
}

export interface HistogramSummary {
  readonly count: number
  readonly sum: number
  readonly p50: number
  readonly p90: number
  readonly p99: number
}
```

**Naming convention** (D-163): `sembridge.<package>.<metric>{<labels>}` formato Prometheus-style flatten.

### 7.2 Metriche standard pre-definite

**Counter (`_total` suffix):**
- `sembridge.broker.events_published_total{topic="weather.requested"}`
- `sembridge.broker.events_dropped_total{reason="paused|backpressure|filter"}`
- `sembridge.cache.hits_total{route_id="weather-fetch"}`
- `sembridge.cache.misses_total`
- `sembridge.cache.evictions_total{reason="lru|ttl|invalidate"}`
- `sembridge.http.requests_total{status="200"}`
- `sembridge.http.errors_total{category="4xx|5xx|network"}`
- `sembridge.worker.tasks_total{state="completed|failed|cancelled|timeout"}`
- `sembridge.realtime.reconnects_total{adapter="sse|websocket"}`
- `sembridge.mapper.transformations_total{schema="..."}`
- `sembridge.mapper.errors_total{type="missing-field|transform-failure"}`

**Gauge (current value):**
- `sembridge.broker.subscribers_count{topic="..."}`
- `sembridge.broker.backlog_size{topic="..."}`
- `sembridge.broker.paused_topics_count`
- `sembridge.worker.active_tasks`
- `sembridge.worker.pool_size{worker_id="..."}`
- `sembridge.cache.entries_count`
- `sembridge.realtime.channels_active`

**Histogram (`_ms` suffix):**
- `sembridge.http.duration_ms{route_id="..."}`
- `sembridge.worker.task_duration_ms{worker_id="...",task="..."}`
- `sembridge.mapper.duration_ms{schema="..."}`
- `sembridge.pipeline.step_duration_ms{step="..."}`

### 7.3 Counter atomic update

JS single-threaded event loop = atomicità implicita (pattern F5 D-133 carryover). Counter increment è `++map.get(key)` thread-safe per costruzione.

```ts
// packages/devtools/src/metrics-collector.ts (proposed)
export interface MetricsCollector {
  increment(name: string, labels?: Record<string, string>, by?: number): void
  setGauge(name: string, value: number, labels?: Record<string, string>): void
  observe(name: string, value: number, labels?: Record<string, string>): void  // histogram sample
  getMetrics(): MetricsSnapshot
  getMetricsDelta(prev: MetricsSnapshot): MetricsDelta
}

export function createMetricsCollector(opts: {
  histogramSamples?: number  // D-165 default 1024
  maxLabelCombinations?: number  // D-166 default 100
} = {}): MetricsCollector {
  const samplesCap = opts.histogramSamples ?? 1024
  const cardinalityCap = opts.maxLabelCombinations ?? 100

  // Cardinality tracker per metric base name → Set<flattened label sig>
  const cardinality = new Map<string, Set<string>>()
  const counters = new Map<string, number>()
  const gauges = new Map<string, number>()
  const histograms = new Map<string, ReservoirState>()  // see §8

  function flatLabels(labels?: Record<string, string>): string {
    if (!labels) return ''
    const keys = Object.keys(labels).sort()
    return `{${keys.map(k => `${k}="${labels[k]}"`).join(',')}}`
  }

  function checkCardinality(baseName: string, labelSig: string): boolean {
    if (!labelSig) return true  // no labels = no cardinality concern
    let set = cardinality.get(baseName)
    if (!set) { set = new Set(); cardinality.set(baseName, set) }
    if (set.has(labelSig)) return true
    if (set.size >= cardinalityCap) {
      // Drop new combination + emit cardinality-overflow event (D-166)
      // emit happens via injected publishFn — see plan 06-06 wiring
      return false
    }
    set.add(labelSig)
    return true
  }

  return {
    increment(name, labels, by = 1) {
      const sig = flatLabels(labels)
      if (!checkCardinality(name, sig)) return
      const key = `${name}${sig}`
      counters.set(key, (counters.get(key) ?? 0) + by)
    },
    setGauge(name, value, labels) {
      const sig = flatLabels(labels)
      if (!checkCardinality(name, sig)) return
      gauges.set(`${name}${sig}`, value)
    },
    observe(name, value, labels) {
      const sig = flatLabels(labels)
      if (!checkCardinality(name, sig)) return
      const key = `${name}${sig}`
      let state = histograms.get(key)
      if (!state) { state = createReservoir(samplesCap); histograms.set(key, state) }
      reservoirAdd(state, value)
    },
    getMetrics() {
      return {
        counters: Object.fromEntries(counters),
        gauges: Object.fromEntries(gauges),
        histograms: Object.fromEntries(
          Array.from(histograms.entries()).map(([k, v]) => [k, computeSummary(v)])
        ),
      }
    },
    getMetricsDelta(prev) {
      const cur = this.getMetrics()
      const counterDelta: Record<string, number> = {}
      for (const [k, v] of Object.entries(cur.counters)) {
        counterDelta[k] = v - (prev.counters[k] ?? 0)
      }
      return { counters: counterDelta, gauges: cur.gauges, histograms: cur.histograms }
    },
  }
}
```

---

## 8. Reservoir sampling Algorithm R vs t-digest (D-165)

### 8.1 Trade-off analysis

| Aspetto | Reservoir Algorithm R inline | t-digest@0.1.2 npm |
|---------|-------------------------------|--------------------|
| LOC | ~30 | 0 (dep esterna) |
| Bundle gz | ~0 | ~3-5 KB minified |
| Deps | 0 | +1 (e dep transitive) |
| Accuratezza p50/p90/p99 | Buona (errore ~5%) | Eccellente (~1%) |
| Accuratezza p999 | Mediocre | Eccellente |
| Memoria per histogram | 1024 × 8 byte = 8 KB | ~5 KB centroidi compressi |
| Verdetto | **ADOTTATO V1** | RIGETTATO V1 (deferred V1.x se profiling richiede p999) |

**Verifica live `tdigest@0.1.2` (npm view 2026-05-05):** versione current. Non adottata per F6. La motivazione è stata documentata in CONTEXT.md "Claude's Discretion" (D-165 nota). Researcher conferma scelta: V1 dashboard non richiede p999 (solo p50/p90/p99 lockati in D-165), bundle budget tight è priorità.

### 8.2 Algorithm R inline (Vitter 1985)

```ts
// packages/devtools/src/reservoir-sampling.ts (proposed)
export interface ReservoirState {
  readonly samples: number[]  // ring buffer
  readonly capacity: number
  count: number  // total observations seen (può essere > capacity)
  sum: number
}

export function createReservoir(capacity: number): ReservoirState {
  return { samples: new Array(capacity), capacity, count: 0, sum: 0 }
}

export function reservoirAdd(state: ReservoirState, value: number): void {
  state.sum += value
  if (state.count < state.capacity) {
    // Fase fill: accumula primi N samples
    state.samples[state.count] = value
    state.count++
  } else {
    // Fase replace: replace random index con probabilità capacity/count
    const j = Math.floor(Math.random() * (state.count + 1))
    if (j < state.capacity) {
      state.samples[j] = value
    }
    state.count++
  }
}

export function computeSummary(state: ReservoirState): HistogramSummary {
  const n = Math.min(state.count, state.capacity)
  if (n === 0) return { count: 0, sum: 0, p50: 0, p90: 0, p99: 0 }
  const sorted = state.samples.slice(0, n).sort((a, b) => a - b)
  const pickIdx = (p: number) => Math.min(n - 1, Math.floor(n * p))
  return {
    count: state.count,  // total observations (NOT capacity)
    sum: state.sum,
    p50: sorted[pickIdx(0.5)] ?? 0,
    p90: sorted[pickIdx(0.9)] ?? 0,
    p99: sorted[pickIdx(0.99)] ?? 0,
  }
}
```

**Caveat perf:** `computeSummary` ordina array O(N log N) ad ogni `getMetrics()` call. Per N=1024 → ~10k ops, ~0.1ms — trascurabile per chiamate rare. Ottimizzazione futura V1.x: t-digest per N>10k samples.

---

## 9. Cardinality cap + system.metrics.cardinality-overflow audit (D-166)

### 9.1 Pattern algoritmico

Per ogni metric base name (es. `sembridge.http.duration_ms`):
1. Mantenere `Set<flattenedLabelSig>` (es. `{route_id="weather"}`, `{route_id="users"}`)
2. Su `observe(name, value, labels)`:
   - Compute `sig = flatLabels(labels)`
   - If `set.size < cap` o `set.has(sig)` → accept
   - Else → drop + emit `system.metrics.cardinality-overflow { metricBaseName, droppedLabels, currentCardinality }`

### 9.2 Wiring all'audit event

`MetricsCollector` riceve `publishFn` injected al boot del `createDevtoolsBroker`:

```ts
const collector = createMetricsCollector({
  histogramSamples: 1024,
  maxLabelCombinations: 100,
  onCardinalityOverflow: (info) => broker.publish('system.metrics.cardinality-overflow', info),
})
```

### 9.3 Mitigation cardinality explosion

**Pitfall noto** (analogo memory leak Pitfall #1 + Pitfall #16): consumer aggiunge label dinamiche tipo `userId` su ogni request → cardinality cresce illimitato → memory leak. F6 cap è hard limit. Il warning event `system.metrics.cardinality-overflow` segnala al dev di ridurre cardinalità (es. usare `category` invece di `userId`).

**Default conservativo cap=100** copre dashboard tipici (50 route × 2-3 status code). Override `maxLabelCombinations: N` in `BrokerConfig.devtools` per app larghe.

---

## 10. pauseTopic queue impl (D-168/D-169/D-170)

### 10.1 Semantica D-168 pauseTopic

`pauseTopic(topic)` blocca `publish(topic, ...)` per quel topic preciso. Eventi accodati FIFO. Subscriber NON ricevono. Route NON triggherano. Pipeline §28 NON eseguita per quei eventi.

**Implementazione:** il composition wrapper F6 intercetta `publish()` PRE-RouterBroker:

```ts
// packages/devtools/src/pause-controller.ts (proposed)
export interface PauseController {
  pauseTopic(topic: string): void
  resumeTopic(topic: string): void
  flushQueue(topic?: string): { topic: string; droppedCount: number; droppedEventIds: readonly string[] }[]
  isPaused(topic: string): boolean
  intercept(event: BrokerEvent): 'pass' | 'queued' | 'dropped'  // chiamato dal wrapper
}

export function createPauseController(opts: {
  maxQueueSize?: number  // D-170 default 1000
  publishFn: (topic: string, payload: unknown) => void  // per system events
} = {}): PauseController {
  const cap = opts.maxQueueSize ?? 1000
  const paused = new Map<string, BrokerEvent[]>()

  return {
    pauseTopic(topic) { if (!paused.has(topic)) paused.set(topic, []) },
    resumeTopic(topic) {
      const queue = paused.get(topic)
      if (!queue) return
      paused.delete(topic)
      // Replay FIFO — i replay NON sono sotto pause anymore
      for (const event of queue) {
        opts.publishFn(event.topic, event.payload)  // bypass intercept
      }
    },
    flushQueue(topic) {
      const result: { topic: string; droppedCount: number; droppedEventIds: readonly string[] }[] = []
      const topics = topic ? [topic] : Array.from(paused.keys())
      for (const t of topics) {
        const queue = paused.get(t)
        if (!queue) continue
        const droppedEventIds = queue.map(e => e.id)
        paused.set(t, [])  // empty queue but keep paused state
        result.push({ topic: t, droppedCount: droppedEventIds.length, droppedEventIds })
        // D-169 emit system.queue.flushed
        opts.publishFn('system.queue.flushed', { topic: t, droppedCount: droppedEventIds.length, droppedEventIds })
      }
      return result
    },
    isPaused(topic) { return paused.has(topic) },
    intercept(event) {
      const queue = paused.get(event.topic)
      if (!queue) return 'pass'
      // D-170 critical bypass
      if (event.priority === 'critical') return 'pass'
      // D-170 cap + drop-oldest
      if (queue.length >= cap) {
        const dropped = queue.shift()  // drop-oldest FIFO
        if (dropped) {
          opts.publishFn('system.queue.overflow', { topic: event.topic, droppedEventId: dropped.id })
        }
      }
      queue.push(event)
      return 'queued'
    },
  }
}
```

### 10.2 Critical bypass (D-170 carryover F3 D-75 + F5 D-130)

**Pattern uniforme cross-fase:** ogni place dove c'è cap+drop, `priority: 'critical'` passa sempre. Vedi `packages/gateway/src/http/strategies/backpressure-strategy.ts:131` (`if (priority === 'critical') return await task()`). F6 replica esattamente.

### 10.3 Wiring nel composition wrapper

`createDevtoolsBroker` istanzia `PauseController` e wrappa `publish`:

```ts
function publish(topic: string, payload: unknown, opts?: PublishOptions) {
  const event = createBrokerEvent({ topic, payload, ...opts })
  const action = pauseController.intercept(event)
  if (action === 'queued' || action === 'dropped') return  // skip downstream
  return inner.publish(topic, payload, opts)
}
```

---

## 11. Composition wrapper topology F6 (analisi DX)

### 11.1 Due opzioni

**Opzione A — Chain explicit:**
```ts
const broker = createCacheBroker(
  createDevtoolsBroker(
    createWorkerBroker(
      createRealtimeBroker(
        createRouterBroker(
          createMapperBroker(
            createBroker(config)
          )
        )
      )
    )
  )
)
```

**Opzione B — Factory aggregato in `@sembridge/sembridge`:**
```ts
import { createSemBridge } from '@sembridge/sembridge'

const broker = createSemBridge({
  ...config,
  features: { cache: true, devtools: true, worker: true, realtime: true }
})
```

### 11.2 Trade-off DX

| Aspetto | Opzione A (Chain) | Opzione B (Aggregato) |
|---------|-------------------|------------------------|
| Tree-shaking | Ottimo (consumer importa solo factory necessari) | Buono (richiede `features` flags type-narrowing) |
| Esplicitezza | Alta (consumer vede stack) | Bassa (configurazione opaca) |
| Verbose | Alto (~6 import) | Basso (~1 import) |
| Override topology | Trivial (riordina chain) | Difficile (struttura interna fissa) |
| Tipo TypeScript | Inference complessa | Inference semplice via `BrokerConfig` discriminated |
| Pattern coerente | Sì (F2-F5 già chain) | Nuovo |

### 11.3 Raccomandazione researcher

**Espone ENTRAMBE le API**:
1. **Opzione A (default raccomandato)** — i factory `createCacheBroker` / `createDevtoolsBroker` sono esposti dai package singoli (`@sembridge/cache` / `@sembridge/devtools`). Consumer può chain manualmente.
2. **Opzione B (convenience)** — `@sembridge/sembridge` fornisce `createSemBridge(config)` come factory aggregato che internamente fa la chain. Default features tutte enabled (override via `config.features?.cache: false` per opt-out).

**Pattern coerente:**
- Chain explicit: consumer power-user che vuole tree-shaking max o stack custom
- Factory aggregato: consumer comune che vuole "tutto incluso" e zero boilerplate

**Plan 06-08** (composition + factory aggregato) implementa entrambi.

---

## 12. Pipeline §28 step 14 activation (no-op → real Inspector + Metrics tap chain)

### 12.1 Stato attuale

**F1 implementa step 1, 2, 3, 7-base, 13** (cinque step in `bus.ts`).
**F2 implementa step 4, 5, 6, 11, 12** (cinque step in `broker-mapper-wrapper.ts`).
**F3 implementa step 7-full, 8, 9, 10** (quattro step in `router-broker-wrapper.ts:514`).
**F4 + F5 lifecycle events** (`route.dispatched`, `cache.hit`, `worker.spawned`, etc) emessi nei rispettivi handler.

**Step 14 (`event.observed`) NON è ancora attivato.** Aggiunto come literal a `PipelineStep` via declaration merging F6.

### 12.2 F6 attivazione

**`packages/devtools/src/augment.ts`:**
```ts
declare module '@sembridge/core' {
  interface BrokerConfig {
    taps?: readonly EventTap[]  // D-159
    devtools?: {
      enableByDefault?: boolean
      eventBufferSize?: number
      routeBufferSize?: number
      histogramSamples?: number
      maxLabelCombinations?: number
      pauseQueueMaxSize?: number
    }
  }
  // F6 PipelineStep extension
  type F6PipelineStep = 'event.observed'  // step 14
}
```

**`createDevtoolsBroker(config)` factory:** dopo step 13 deliver, emette `tap.onPipelineStep('event.observed', snapshot)` ai tap registrati. Questo è IL punto unico di attivazione step 14. Pattern: il composition wrapper intercetta il return dal `inner.publish()` (step 13 deliver completato) e fa post-processing tap step 14.

**Caveat asincronia:** step 13 deliver è async per route HTTP/worker/realtime. Step 14 deve essere chiamato POST completion (via `await Promise.all(deliveryPromises)`). Pattern coerente con `OutcomeCollector` di F3.

---

## 13. Test 3-tier strategy F6 (riuso D-149/D-150 carryover)

### 13.1 Tier-1 jsdom (unit deterministic)

Coverage v8 ≥90% sui file F6. Test obbligatori:

| Plan | Test file | Scenario |
|------|-----------|----------|
| 06-02 | `memory-cache-adapter.test.ts` | LRU eviction (cap=10 fill+evict), TTL expiry (advance fake timer), invalidate (string/RegExp/prefix), stats (hits/misses/evictions) |
| 06-02 | `stable-hash.test.ts` | Determinism (same payload → same hash 1000 iter), key ordering invariance (`{a,b}` === `{b,a}`), collision rate (10k random payloads → 0 collisions) |
| 06-03 | `cache-handler.test.ts` | Strategy `cache-first` HIT/MISS, `network-first` success/fallback, `cache-then-network` ordering 2 events, scope D-156 user-scoped, scope-missing audit D-157 |
| 06-03 | `composite-handler.test.ts` (F6 concretizzato) | Workflow check-cache → http → publish → cache.set, error path |
| 06-04 | `multiplex-tap.test.ts` | Error isolation (1 tap throws → altri continuano), N=0 tap (skip), N=10 tap (all called in order) |
| 06-04 | `tap-registry.test.ts` | Auto-wrap F1 single-tap → array, append behavior |
| 06-05 | `event-inspector.test.ts` | Buffer cap 500 (drop FIFO), enable/disable toggle, getBuffer deep-clone immutable, clear |
| 06-05 | `route-inspector.test.ts` | Capture step 9+10 outcome, retry count aggregation, cache hit/miss tracking |
| 06-06 | `metrics-collector.test.ts` | Counter increment, gauge set, histogram observe + summary p50/p90/p99 (vs known distribution), labels flatten, getMetricsDelta |
| 06-06 | `cardinality-cap.test.ts` | Cap 100 enforced, overflow emit `system.metrics.cardinality-overflow`, base name vs flattened labels |
| 06-06 | `reservoir-sampling.test.ts` | Algorithm R correctness (10k samples → uniform distribution), summary computation deterministic on sorted samples |
| 06-07 | `pause-controller.test.ts` | pauseTopic queue FIFO, resumeTopic replay order, flushQueue silent + audit, cap drop-oldest, critical bypass D-170 |
| 06-08 | `multiplex-tap-integration.test.ts` | Wrapper F6 wires 3 tap (Inspector + Metrics + custom user) end-to-end via createCacheBroker |

### 13.2 Tier-2 jsdom + msw (integration mid-level)

| Plan | Test file | Scenario |
|------|-----------|----------|
| 06-09 | `cache-then-network-flow.test.ts` | Plugin A publish weather.requested → cache hit `{origin:'cache'}` → MSW server response 200ms later → second event `{origin:'remote', replaces}`, ordering verify |
| 06-09 | `lifecycle-cleanup.test.ts` | unregisterPlugin → cache invalidate by ownerId (D-126 ext F6), Inspector buffer NOT cleared (broker-scoped), MetricsCollector counter preserved |
| 06-09 | `pause-resume-integration.test.ts` | pauseTopic + 100 publish queued + resumeTopic → replay order preserved + downstream subscriber received in order |

### 13.3 Tier-3 Playwright Chromium (browser smoke real timing)

| Plan | Test file | Scenario |
|------|-----------|----------|
| 06-09 | `__browser__/cache-hit-ordering.test.ts` | SC-1 closure: real timing browser per cache-then-network ordering microtask vs setTimeout vs sync (verify no race) |
| 06-09 | `__browser__/structuredclone-perf.test.ts` | `getDebugSnapshot()` deep-clone perf con buffer pieno (500 entries × 5KB) — assert <50ms |
| 06-09 | `__browser__/inspector-capture-timing.test.ts` | Real timing browser per Inspector capture: 1000 events/sec → buffer stable, no leak |

### 13.4 Coverage v8 target (D-92 carryover)

| Package | Statements | Branches | Functions | Lines |
|---------|-----------|----------|-----------|-------|
| `@sembridge/cache` | ≥90% | ≥80% | ≥90% | ≥90% |
| `@sembridge/devtools` | ≥90% | ≥80% | ≥90% | ≥90% |

Calibrazione post-implementation pattern F3/F4/F5 (raise floor a measured + 1-2%).

---

## 14. Threat model ASVS L1 enumeration

### 14.1 ASVS L1 categories applicable F6

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | YES | D-83 strict — F6 NON tocca runtime F1-F5 → no privilege escalation |
| V2 Authentication | NO | F6 non gestisce auth (responsabilità Gateway F3 SEC-01..05) |
| V3 Session Management | NO | Idem |
| V4 Access Control | YES | D-156/D-157 scope user-aware (anti cross-tenant leakage) — Pitfall 8.C closure |
| V5 Input Validation | YES | `BrokerConfig.cache` + `BrokerConfig.devtools` Valibot safeParse al boot (riuso F2 pattern) |
| V6 Cryptography | NO | Zero crypto in F6 (FNV-1a hash è NON crypto, esplicitamente per cache key only) |
| V7 Error Handling | YES | `system.cache.scope-missing`, `system.queue.flushed`, `system.queue.overflow`, `system.metrics.cardinality-overflow` audit events |
| V8 Data Protection | YES | `getDebugSnapshot()` deep-clone immutable (no leak via mutation), Inspector buffer NON persistito (D-167 ring buffer in-memory only) |
| V9 Communications | NO | F6 non aggiunge canali comunicazione (riuso F3 HTTP, F4 SSE/WS) |

### 14.2 Threat patterns per plan F6

**Pattern: `T-06-XX-NN` dove `XX` = numero plan (01-09), `NN` = sequenziale entro il plan.** Coerente con F3/F4/F5.

**Plan 06-01 (Bootstrap):**
- T-06-01-01 (DoS — sideEffects glob non configurato → tree-shake elimina augment): mitigation `sideEffects: ["**/augment.ts","**/augment.js"]` in package.json + `__augmentCacheLoaded`/`__augmentDevtoolsLoaded` const literal re-export dal barrel (pattern F5 D-83 carryover)

**Plan 06-02 (MemoryCacheAdapter):**
- T-06-02-01 (DoS — cache cresce illimitato): D-158 cap `maxEntries=1000` LRU eviction
- T-06-02-02 (Information Disclosure — cache cross-tenant): D-156 scope hybrid + D-157 missing scope skip
- T-06-02-03 (Tampering — payload cache mutation): cache restituisce reference ma documentato (consumer responsabile freeze in dev D-29 pattern F1). Researcher considera deep-clone su `cache.get()` ma rejected per perf.
- T-06-02-04 (Logic flaw — TTL expiry race): TTL check su get() atomic single-thread, no race

**Plan 06-03 (CacheHandler + CompositeHandler):**
- T-06-03-01 (Information Disclosure — cache hit serve dati di altro user): D-156/D-157 scope enforcement
- T-06-03-02 (Logic flaw — cache-then-network ordering inverted): test Tier-3 Playwright timing real
- T-06-03-03 (DoS — cache stampede su MISS): mitigation tramite riuso F3 D-74 KeyBased dedupe (`gateway/dedupe-strategy.ts`) — N caller con stessa key collassano in 1 fetch

**Plan 06-04 (Tap registry):**
- T-06-04-01 (DoS — tap throw blocca pipeline): D-159 try/catch isolato per tap (MultiplexTap)
- T-06-04-02 (Information Disclosure — tap reads payload sensibile): contract `EventTap` documentato — consumer registers tap volontariamente, accept boundary
- T-06-04-03 (Logic flaw — auto-wrap F1 perde tap): test 06-04 verifica `runtime.tap` + `taps[]` coexist

**Plan 06-05 (EventInspector + RouteInspector):**
- T-06-05-01 (DoS — buffer cresce illimitato): D-167 cap 500 + drop FIFO
- T-06-05-02 (Information Disclosure — getDebugSnapshot leak): D-162 deep-clone immutable
- T-06-05-03 (Logic flaw — disable non clear buffer leak memoria): impl `disable()` clear-buffer

**Plan 06-06 (MetricsCollector):**
- T-06-06-01 (DoS — cardinality explosion): D-166 cap 100 + audit emit
- T-06-06-02 (DoS — histogram samples cresce illimitato): D-165 ring buffer 1024
- T-06-06-03 (Logic flaw — counter overflow `Number.MAX_SAFE_INTEGER`): accept (pattern Prometheus standard, JS number 53-bit sufficient per anni)
- T-06-06-04 (Information Disclosure — metric labels include payload sensibile): consumer responsabile, document in DOC-06

**Plan 06-07 (pauseTopic queue):**
- T-06-07-01 (DoS — queue cresce illimitato): D-170 cap 1000 + drop-oldest
- T-06-07-02 (Information Disclosure — flushQueue audit leak event ids): accept (eventIds sono nanoid random non-PII)
- T-06-07-03 (Logic flaw — pauseTopic + critical bypass race): D-170 critical pass — atomic single-thread

**Plan 06-08 (Composition wrapper + getDebugSnapshot):**
- T-06-08-01 (Logic flaw — composition order matters): plan 06-08 test order sensitivity
- T-06-08-02 (Information Disclosure — getDebugSnapshot deep-clone perf disclose): mitigation `structuredClone` standard, test perf benchmark <50ms

**Plan 06-09 (Final gate):**
- T-06-09-01 (Logic flaw — REQ matrix flip incompleto): plan 06-09 verifica esplicita CACHE-01..03 + TOOL-01..05 closure
- T-06-09-02 (Tampering — DOC-02/05/06 incomplete): plan 06-09 checklist consolidamento

**Total expected:** ~25-30 threat enumerated F6, severity LOW/MED, ZERO HIGH+ (pattern carryover F3/F4/F5).

---

## 15. Pitfall F6-specifici

### 15.1 Cardinality explosion (Pitfall NEW F6)

**Cosa va storto:** consumer aggiunge label dinamica tipo `userId` → cardinality cresce illimitato → memory leak.

**Mitigation D-166:** cap hard 100 + emit warn event. Researcher raccomanda anche **DOC-06 esempio anti-pattern**:

```ts
// ❌ ANTI-PATTERN — cardinality explosion
metrics.observe('sembridge.http.duration_ms', dur, { userId: event.payload.userId })

// ✅ GOOD — limited cardinality (≤10 categories)
metrics.observe('sembridge.http.duration_ms', dur, { route_id: route.id, status: '2xx' })
```

### 15.2 Ring buffer leak (Pitfall NEW F6)

**Cosa va storto:** Inspector buffer 500 entries × 5KB = ~2.5MB. `enableDebug()` lasciato on in production → memoria persistente per tutta la sessione SPA.

**Mitigation D-160:** `NODE_ENV === 'production'` → debug=off auto. Plus warning console se `enableDebug()` chiamato in production build.

### 15.3 structuredClone perf su payload grandi (Pitfall NEW F6)

**Cosa va storto:** `getDebugSnapshot()` deep-clone via `structuredClone` di buffer 500 × 5KB ≈ 2.5MB → 5-10ms su browser desktop, 20-50ms su mobile low-end.

**Mitigation D-162:** documentato in DOC-06 — `getDebugSnapshot()` rare-call (debug, profiling), NON usabile in hot-path. Test perf Tier-3 verifica <50ms upper bound.

**Alternative considerate:** shallow clone (rejected — leak via mutation nested), JSON parse/stringify (rejected — perde Date/Map/Set), no-clone (rejected — viola immutability contract D-162).

### 15.4 Cache stampede (Pitfall #8 ext F6)

**Cosa va storto:** 100 publish concurrent con stessa cache key MISS → 100 fetch HTTP simultanee.

**Mitigation:** F6 cache layer DELEGA dedupe a F3 D-74 KeyBased gateway dedupe — riuso `createDedupeStrategy` con `dedupeKey === cacheKey`. Pattern: cache miss → composite handler → http handler → dedupe wrapper → 1 sola fetch. Researcher verifica plan 06-03 wiring.

### 15.5 cache-then-network flicker (Pitfall #8.A)

**Cosa va storto:** consumer riceve evento cache + evento network in rapido fire → UI flicker.

**Mitigation D-156/D-162 + DOC-06:** documentazione esplicita "il consumer può vedere due eventi consecutivi `weather.loaded`, discriminabili via `metadata.origin`". Esempi rendering pattern: ignora origin='cache' / mostra spinner / mostra cache + animation transition. Pattern già consolidato in PRD §29.

### 15.6 Cache-then-network out-of-order (Pitfall NEW F6)

**Cosa va storto:** cache hit microtask + network response 200ms later → ma se network arriva VELOCE (10ms), può arrivare PRIMA del microtask cache → out of order.

**Mitigation:** cache hit DEVE essere pubblicato `queueMicrotask()` SYNC subito al RouteExecutor entry, prima di `await fetch(...)`. Pattern impl in plan 06-03.

### 15.7 LRU eviction race con TTL expiry

**Cosa va storto:** entry expired ma non ancora garbage-collected dal cache → `cache.get()` lo trova ma è scaduto.

**Mitigation:** `cache.get()` controlla `entry.expiresAt < Date.now()` prima di restituire (vedi §2.2 codice). Auto-evict expired su read. Pattern lazy expiration (no proactive sweeper — over-engineering V1).

### 15.8 metrics.observe in hot-path

**Cosa va storto:** `MetricsCollector.observe(name, value, labels)` chiamato 10k volte/sec → `flatLabels` + `Set.has` + `Map.get` overhead.

**Mitigation:** lazy mode early-return D-160 NON applicabile a counters (devono restare on). Counter ops sono cheap (~100ns ops). Histogram observe più costoso ma OK fino a 100k/sec. V1.x se profiling mostra problema.

---

## 16. size-limit budget proposta + final gate F6 spec

### 16.1 Budget proposto `@sembridge/cache` + `@sembridge/devtools` + `@sembridge/sembridge`

**Lesson learned F3-F5** (vedi STACK.md size-limit + ROADMAP.md F3 03-14): pre-implementation sotto-stima del 20-30%, raise post-implementation al floor measured + 20-30% headroom.

**Pre-implementation estimate:**

| Package | Estimate gz | Components |
|---------|-------------|-------------|
| `@sembridge/cache` | 5-8 KB | MemoryCacheAdapter + CacheHandler + CompositeHandler + stable-hash + augment + types + factory |
| `@sembridge/devtools` | 8-12 KB | MultiplexTap + EventInspector + RouteInspector + MetricsCollector + reservoir-sampling + PauseController + augment + types + factory |
| `@sembridge/sembridge` | 50-80 KB | re-exports core + mapper + routing + gateway/http + gateway/sse-ws + worker + cache + devtools + createSemBridge factory aggregato |

**Plan 06-09 final gate** budget configurato (con 20% headroom):

```json
{
  "name": "@sembridge/cache (gzip)",
  "path": "packages/cache/dist/index.js",
  "limit": "10 KB",
  "gzip": true
},
{
  "name": "@sembridge/devtools (gzip)",
  "path": "packages/devtools/dist/index.js",
  "limit": "16 KB",
  "gzip": true
},
{
  "name": "@sembridge/sembridge (gzip)",
  "path": "packages/sembridge/dist/index.js",
  "limit": "100 KB",
  "gzip": true
}
```

**Calibrazione post-implementation:** verificare measured size + raise floor a `measured + 20% headroom`. Pattern F3 03-14 commit 9922a36 (routing 19.15/24 KB raised lesson learned).

### 16.2 CI gates final F6

Pattern carryover F3 03-14 / F4 04-09 / F5 05-07:

```bash
# packages.json scripts F6 final gate
"ci:gate:f6": "pnpm ci:publint && pnpm ci:attw && pnpm ci:size && pnpm ci:typecheck && pnpm ci:test:coverage && pnpm ci:lint"
```

**Gates obbligatori:**
- `publint` — package.json well-formed (✓ per cache + devtools + sembridge)
- `attw --profile=esm-only` — ESM-only resolution OK (node16 + bundler 🟢)
- `size-limit` — budget rispettato (vedi sopra)
- `tsc --noEmit` — typecheck zero errori
- `vitest run --coverage` — coverage v8 ≥90/80/90/90 (statements/branches/functions/lines)
- `biome check` — lint zero errori

### 16.3 DOC consolidation finale (DOC-02/05/06)

**Plan 06-09 owns:**

| Deliverable | Path | Contenuto |
|-------------|------|-----------|
| DOC-02 | `packages/sembridge/README.md` (italiano) | Guida integrazione plugin: registerPlugin, inputMap/outputMap, lifecycle hooks, scenario meteo end-to-end |
| DOC-05 | `packages/sembridge/EXAMPLES.md` (italiano) + cross-link | Esempi end-to-end completi: scenario meteo con cache + tooling + worker (estende F5 worker section), Q&A 20+ domande |
| DOC-06 | `packages/devtools/README.md` (italiano) 11 sezioni | Tooling debug: enableDebug/disableDebug, getDebugSnapshot, EventInspector + RouteInspector + MetricsCollector usage, anti-pattern cardinality explosion, ring buffer config, structured clone perf caveat |
| TypeDoc website | `docs/api/` auto-generato | API reference auto da JSDoc TypeDoc + plugin markdown |
| CHANGELOG | `.changeset/v1-0-0-release.md` | Major bump tutti i 7 package — release v1.0.0 milestone closure |

### 16.4 REQ matrix flip (plan 06-09)

**REQ matrix da flippare in REQUIREMENTS.md:**

| ID | Status pre | Status post | Notes |
|----|-----------|-------------|-------|
| CACHE-01 | Pending | Complete | MemoryCacheAdapter + key configurabile |
| CACHE-02 | Pending | Complete | TTL + invalidate API |
| CACHE-03 | Pending | Complete | metadata `cache`/`remote` + cache-then-network |
| TOOL-01 | Pending | Complete | EventInspector real impl + 14 step §28 |
| TOOL-02 | Pending | Complete | MetricsCollector counters/gauges/histograms |
| TOOL-03 | Pending | Complete | enableDebug/disableDebug/getDebugSnapshot |
| TOOL-04 | Pending | Complete | pauseTopic/resumeTopic/flushQueue |
| TOOL-05 | Pending | Complete | **Closes PRD §39 #10**: schema simil-OpenMetrics |
| TEST-01 ext F6 | Done subset | Complete F6 | Cache + devtools subset |
| TEST-02 ext F6 | Complete (F5) | Complete F6 | Cache hit/miss flows |
| DOC-02 | Pending | Complete | Guida integrazione plugin |
| DOC-05 | In Progress (F5) | Complete F6 | Esempi end-to-end consolidati |
| DOC-06 | Pending | Complete | Documentazione debug tooling |

**ROADMAP.md flip:** Phase 6 → ✅ Complete + closure milestone v1.0.

---

## 17. Plan structure proposta wave-based + file ownership disgiunta

### 17.1 9 plan F6 (vs F4 9 / F3 14 / F5 7) — coerente con scope

```
                          ┌─────────────────┐
                          │      06-01       │  Wave 1
                          │ Bootstrap pkg   │  (sequential gate)
                          │ cache+devtools+ │
                          │ sembridge +     │
                          │ types + augment │
                          └────────┬────────┘
                                   │
                                   ▼
                ┌──────────────────┴──────────────────┐
                ▼                                      ▼
        ┌────────────────┐                    ┌────────────────┐  Wave 2
        │     06-02       │                    │     06-04       │  (parallel)
        │ MemoryCache    │                    │ Tap registry   │
        │ Adapter LRU    │                    │ MultiplexTap   │
        │ stable-hash    │                    │ auto-wrap F1   │
        └────────┬───────┘                    └────────┬───────┘
                 │                                      │
                 ▼                                      │
        ┌────────────────┐                              │
        │     06-03       │                              │
        │ CacheHandler   │                              │
        │ Composite ext  │                              │
        │ scope hybrid   │                              │
        └────────┬───────┘                              │
                 │                                      │
                 │   ┌──────────────────────────────────┘
                 │   │
                 ▼   ▼
            ┌─────────────────┬─────────────────┐
            ▼                 ▼                 ▼
    ┌────────────────┐ ┌────────────────┐ ┌────────────────┐  Wave 3
    │     06-05       │ │     06-06       │ │     06-07       │  (parallel)
    │ EventInspector │ │ MetricsColl.   │ │ PauseController │
    │ RouteInspector │ │ reservoir+card │ │ queue cap+      │
    │ ring buffer    │ │ cap+overflow   │ │ critical bypass │
    └────────┬───────┘ └────────┬───────┘ └────────┬───────┘
             │                  │                  │
             └──────────────────┼──────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │      06-08       │  Wave 4
                       │ Composition     │  (sequential gate — consumer)
                       │ createCacheBkr  │
                       │ createDevtBkr   │
                       │ createSemBridge │
                       │ getDebugSnap    │
                       │ enableDebug     │
                       │ + 8 integ test  │
                       └────────┬────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │      06-09       │  Wave 5/Final
                       │ Final gate F6   │  (final closure milestone v1.0)
                       │ publint+attw+   │
                       │ size-limit budg │
                       │ DOC-02/05/06    │
                       │ REQ matrix flip │
                       │ PRD §39#10 close │
                       │ CHANGELOG v1.0  │
                       └─────────────────┘
```

### 17.2 File ownership disgiunta entro wave

**Wave 2 (06-02 ∥ 06-04):**
| Plan | File esclusivi |
|------|----------------|
| 06-02 | `packages/cache/src/memory-cache-adapter.{ts,test.ts}`, `packages/cache/src/stable-hash.{ts,test.ts}`, `packages/cache/src/types/cache-adapter.ts`, `packages/cache/src/types/cache-entry.ts` |
| 06-04 | `packages/devtools/src/multiplex-tap.{ts,test.ts}`, `packages/devtools/src/tap-registry.{ts,test.ts}` |

**Wave 3 (06-05 ∥ 06-06 ∥ 06-07):**
| Plan | File esclusivi |
|------|----------------|
| 06-05 | `packages/devtools/src/event-inspector.{ts,test.ts}`, `packages/devtools/src/route-inspector.{ts,test.ts}`, `packages/devtools/src/types/inspector-entry.ts` |
| 06-06 | `packages/devtools/src/metrics-collector.{ts,test.ts}`, `packages/devtools/src/reservoir-sampling.{ts,test.ts}`, `packages/devtools/src/cardinality-cap.{ts,test.ts}`, `packages/devtools/src/types/metrics.ts` |
| 06-07 | `packages/devtools/src/pause-controller.{ts,test.ts}`, `packages/devtools/src/types/pause-state.ts` |

**Wave 4 (06-08 sequential):** consuma TUTTI i moduli W2/W3 — composition wrapper + factory. File esclusivi:
- `packages/cache/src/cache-broker.ts` + `packages/cache/src/public-factory.ts`
- `packages/devtools/src/devtools-broker.ts` + `packages/devtools/src/public-factory.ts`
- `packages/sembridge/src/index.ts` + `packages/sembridge/src/sem-bridge.ts` (createSemBridge aggregato)
- `packages/cache/src/__integration__/`, `packages/devtools/src/__integration__/`
- `packages/cache/src/test-utils/cache-harness.ts`

**Wave 5 (06-09 sequential):** owns:
- DOC files (`packages/sembridge/README.md`, `packages/devtools/README.md`, `packages/sembridge/EXAMPLES.md`)
- ROADMAP.md, REQUIREMENTS.md, STATE.md, TRACKER.md update (closure milestone)
- `package.json` size-limit additions
- `.changeset/v1-0-0-release.md` (major bump release)

### 17.3 Speedup parallelization vs sequential

| Wave | Plan | Sequential time est. | Parallel time est. | Speedup |
|------|------|----------------------|---------------------|---------|
| W1 | 06-01 (gate) | 30 min | 30 min | 1× |
| W2 | 06-02 + 06-04 | 90 min (45+45) | 45 min | 2× |
| W2-bis | 06-03 (after 06-02) | 45 min | 45 min | 1× |
| W3 | 06-05 + 06-06 + 06-07 | 180 min (60+90+30) | 90 min | 2× |
| W4 | 06-08 (gate consumer) | 90 min | 90 min | 1× |
| W5 | 06-09 (final gate) | 60 min | 60 min | 1× |
| **Total** | **9 plan** | **~8h** | **~6h** | **~1.3×** |

Pattern coerente con F4 (9 plan ~10h sequential / 7h parallel) e F5 (7 plan ~6h sequential / 4h parallel). F6 ha più plan ma dipendenza più sequential (W2 → W2-bis → W3 → W4 → W5) per cui speedup minore.

### 17.4 Verifica D-83 strict per plan

**Plan checker deve verificare:**
- Wave 1 (06-01): solo `packages/{cache,devtools,sembridge}/{package.json,tsconfig.json,tsup.config.ts,vitest.config.ts,vitest.browser.config.ts,biome.json}` + `packages/{cache,devtools,sembridge}/src/{index.ts,augment.ts,types/*.ts}`
- Wave 2-5: solo path entro `packages/{cache,devtools,sembridge}/src/`
- ZERO modifiche path `packages/{core,mapper,routing,gateway,worker}/src/` per TUTTA F6

**Verification CI:**
```bash
# In ogni plan post-execute:
git diff main...HEAD -- packages/core/src/ packages/mapper/src/ packages/routing/src/ packages/gateway/src/ packages/worker/src/
# Deve essere exit 0 lines (zero modifiche)
```

Pattern già consolidato F3 03-14 / F4 04-09 / F5 05-07 — meccanico per F6.

---

## 18. Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | dev/build/test | ✓ | 20.x+ (CI matrix) | — |
| pnpm | workspaces | ✓ | 9.x | — |
| TypeScript | source | ✓ | 6.0.3 (super-set 5.5+) | — |
| tsup | build | ✓ | 8.5.1 (workspace dev) | — |
| Vitest | test runner | ✓ | 4.1.5 | — |
| jsdom | Tier-1 environment | ✓ | 29.1.0 | — |
| @vitest/browser | Tier-3 enabler | ✓ | 4.1.5 | — |
| Playwright Chromium | Tier-3 browser | ✓ (workspace) | 1.59.1 | — |
| Biome | lint+format | ✓ | 2.4.13 | — |
| TypeDoc | DOC consolidation final | ✓ | 0.28.19 | — |
| typedoc-plugin-markdown | DOC website output | ✗ (da installare 06-09) | 4.11.0 (target) | — |
| `@sembridge/core` | workspace dep | ✓ | workspace:* | — |
| `@sembridge/mapper` | workspace dep | ✓ | workspace:* | — |
| `@sembridge/routing` | workspace dep | ✓ | workspace:* | — |
| `@sembridge/gateway` | workspace dep | ✓ | workspace:* | — |
| `@sembridge/worker` | workspace dep | ✓ | workspace:* | — |

**Missing dependencies with no fallback:** nessuno (tutto disponibile).

**Missing dependencies da installare:**
- Plan 06-01: workspace dep `@sembridge/core@workspace:*`, `@sembridge/mapper@workspace:*`, `@sembridge/routing@workspace:*`, `@sembridge/gateway@workspace:*`, `@sembridge/worker@workspace:*` per `@sembridge/cache` + `@sembridge/devtools` + `@sembridge/sembridge`
- Plan 06-09: `typedoc-plugin-markdown@^4.11.0` per `@sembridge/sembridge` workspace dev (final DOC consolidation)
- Plan 06-01: `valibot@^1.3.1` workspace dep per cache + devtools (Valibot safeParse di config)
- Plan 06-01: `nanoid@^5.1.11` workspace dep (probabilmente non necessario — riuso event.id existing)

---

## 19. Assumptions Log

> Tutti i claim in questo research sono `[VERIFIED]` o `[CITED]`. Nessun `[ASSUMED]` rimasto post-CONTEXT.md.

| # | Claim | Section | Source | Risk if Wrong |
|---|-------|---------|--------|---------------|
| V1 | lru-cache@11.3.6 esiste su npm 2026-05-05 | §2.3 | npm view lru-cache version (live) | NESSUNO — verified |
| V2 | tdigest@0.1.2 esiste su npm | §8.1 | npm view tdigest version (live) | NESSUNO — verified, NON adottato |
| V3 | json-stable-stringify@1.3.0 esiste su npm | §3.2 | npm view json-stable-stringify version (live) | NESSUNO — verified, NON adottato |
| V4 | typedoc@0.28.19 + typedoc-plugin-markdown@4.11.0 esistono | §16.3 | npm view (live) | NESSUNO — verified, da install plan 06-09 |
| V5 | structuredClone Baseline 2022 in tutti i browser evergreen | §15.3 | MDN structuredClone + Baseline | NESSUNO — verified |
| V6 | Map insertion order garantito ECMAScript spec dal 2015 | §2.2 | TC39 ECMA-262 §24.1 | NESSUNO — spec |
| V7 | F3 RouteExecutorDeps interface accetta extension via DI | §4.2 | Lettura `packages/routing/src/route-executor.ts:50-70` (RouteExecutorDeps) | BASSO — fallback Opzione B' (composition wrapper PRE-RouterBroker) se non praticabile |
| V8 | F1 EventTap singleton wired in `bus.ts` non modificabile (D-83) | §5.1 | grep `safeTapStep` in `packages/core/src/core/bus.ts` | NESSUNO — verified D-83 strict |
| V9 | F3 cache-handler stub ritorna `cache.not-implemented` | §4.1 | Lettura `packages/routing/src/route-handlers/cache-handler.ts:33-44` | NESSUNO — verified |
| V10 | F1-F5 augment.ts pattern declaration merging consolidato 5 volte | §5.2, §12.2 | grep `__augment*Loaded` in workspace | NESSUNO — verified |
| C1 | FNV-1a 32-bit collision rate ~1e-6 per 100k entries | §3.2 | [CITED: isthe.com/chongo/tech/comp/fnv/] | BASSO — sufficient per cache key (no crypto) |
| C2 | Reservoir Algorithm R p50/p90/p99 errore ~5% | §8.1 | [CITED: Vitter 1985 ACM Trans. Math. Software 11(1)] | BASSO — accept V1, t-digest deferred V1.x |
| C3 | Prometheus naming convention `_total` counter / `_ms` duration | §7.2 | [CITED: prometheus.io/docs/practices/naming/] | NESSUNO — convention standard |
| C4 | NODE_ENV detection in browser via bundler DefinePlugin | §5.3 | [CITED: webpack.js.org/plugins/define-plugin/ + vitejs.dev/guide/env-and-mode] | NESSUNO — convention standard |

**Tutte le 16 decisioni D-155..D-170 sono assunte come fonte autoritativa lockata da 06-CONTEXT.md → researcher non re-discute.**

---

## 20. References

### Primarie (HIGH confidence)

- **`prd.md`** root — fonte autoritativa unica progetto. Sezioni rilevanti F6: §3, §10.6, §10.7, §11.1, §17.4, §17.6, §17.7, §20, §22.5, §24, §25, §26.2, §27, §28, §30, §31.3, §34.1, §34.2, §35.1-35.3, §39 #10, §41, §42.
- **`.planning/phases/06-cache-tooling-avanzato/06-CONTEXT.md`** — 16 decisioni D-155..D-170 lockate.
- **`.planning/REQUIREMENTS.md`** — CACHE-01..03 + TOOL-01..05 + TEST-01/02 ext F6 + DOC-02/05/06.
- **`.planning/ROADMAP.md`** — Phase 6 success criteria 1-5.
- **MDN structuredClone**: https://developer.mozilla.org/en-US/docs/Web/API/structuredClone
- **MDN Map / iteration order**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
- **Prometheus naming convention**: https://prometheus.io/docs/practices/naming/
- **Vitter 1985 Reservoir Sampling Algorithm R**: ACM Transactions on Mathematical Software 11(1).
- **FNV-1a hash spec**: http://www.isthe.com/chongo/tech/comp/fnv/

### Secondarie (MEDIUM confidence)

- **`.planning/research/STACK.md`** §size-limit (CI gates), §cache (LRU + TTL), §metrics (JSON simil-OpenMetrics).
- **`.planning/research/PITFALLS.md`** #1 (memory leak), #4 (backpressure), #8 (cache invalidation + cache-then-network), #9 (plugin isolation), #16 (perf — debug auto-off + trie + pre-compile), #17 (sicurezza — token + scope cross-tenant).
- **`.planning/research/ARCHITECTURE.md`** §1-§2 (Mediator + Pipes-and-Filters), §3.2 (EventTap pre-instrumentazione architecture).
- **Codebase F1-F5 pattern reference:**
  - `packages/core/src/types/tap.ts` (EventTap interface F1 → impl reale F6)
  - `packages/core/src/core/bus.ts` (safeTapStep usage 5 step F1)
  - `packages/core/src/types/config.ts` (BrokerConfig.runtime.tap F1)
  - `packages/routing/src/route-executor.ts` (case 'cache' + 'composite' placeholder D-77)
  - `packages/routing/src/route-handlers/cache-handler.ts` (stub F3 → concretizzato F6)
  - `packages/gateway/src/http/strategies/dedupe-strategy.ts` (D-74 KeyBased riusato D-155)
  - `packages/gateway/src/http/strategies/backpressure-strategy.ts` (D-75 priority bypass riusato D-170)
  - `packages/worker/src/augment.ts` (pattern declaration merging F5)
- **Decisioni cross-fase carryover:**
  - F5 D-121 composition wrapper, D-126 cascade cleanup, D-149/D-150 TDD/3-tier
  - F4 D-101 composition wrapper, D-112 cascade cleanup, D-115 backpressure, D-117/D-118 TDD/3-tier
  - F3 D-83 strict, D-74 KeyBased, D-75 backpressure priority bypass, D-77 placeholder cache/composite, D-86 cascade unregisterByOwner, D-94 declaration merging
  - F2 D-49 composition Mapper, D-57 PluginDescriptor extension
  - F1 D-25/D-26 cascade, D-30 no singleton, EventTap interface

### Live verification (npm registry 2026-05-05)

- `npm view lru-cache version` → `11.3.6` (VALUTATO, NON adottato — Map insertion order custom adopted §2.2)
- `npm view tdigest version` → `0.1.2` (VALUTATO, NON adottato — reservoir Algorithm R inline adopted §8)
- `npm view json-stable-stringify version` → `1.3.0` (VALUTATO, NON adottato — stableStringify inline custom adopted §3.2)
- `npm view typedoc version` → `0.28.19` (workspace dev installato)
- `npm view typedoc-plugin-markdown version` → `4.11.0` (da install plan 06-09)
- `npm view vitest version` → `4.1.5` (riuso F1-F5)
- `npm view valibot version` → `1.3.1` (riuso F2-F5)
- `npm view nanoid version` → `5.1.11` (riuso F1-F5)

---

## 21. Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Stack & versioning | HIGH | Zero new runtime deps; tutto verificato live npm 2026-05-05; pattern carryover F1-F5 |
| Architettura composition wrapper F6 | HIGH | Pattern F2 D-49 + F3 D-83 + F4 D-101 + F5 D-121 consolidato 5 volte |
| LRU Map insertion order | HIGH | Spec ECMAScript 2015 + 0 deps + 80 LOC inline |
| Stable hash FNV-1a + stableStringify | HIGH | Pattern F3 D-74 dedupe-strategy carryover + collision rate documentato |
| Cache route handler concretizza F3 D-77 | MEDIUM-HIGH | Opzione B preferred (DI cacheHandler in RouteExecutorDeps); fallback Opzione B' (composition wrapper PRE-RouterBroker). Verifica plan 06-03. |
| Tap registry chain MultiplexTap | HIGH | Pattern Adapter classico + try/catch isolato D-159 ben definito |
| EventTap step 14 attivazione | HIGH | F1 pre-instrumentazione completa + composition wrapper F6 standard |
| MetricsCollector schema | HIGH | Prometheus naming convention standard + counters atomic single-threaded JS |
| Reservoir sampling Algorithm R | HIGH | Algoritmo Vitter 1985 ben definito + 30 LOC inline |
| Cardinality cap 100 + audit | HIGH | Pattern anti memory-bloat F5 D-128 carryover (cap pool) |
| pauseTopic queue cap + critical bypass | HIGH | Pattern F3 D-75 + F5 D-130 carryover esatto |
| Test 3-tier (D-149/D-150) | HIGH | Pattern F4 D-118 + F5 D-150 consolidato; Tier-3 Playwright per cache-then-network ordering reale |
| size-limit budget F6 | MEDIUM | Pre-implementation estimate; calibrazione post-implementation pattern F3 03-14 carryover |
| DOC consolidation final | HIGH | TypeDoc + plugin markdown già installati; pattern F5 05-07 README italiano carryover |
| ASVS L1 threat model | HIGH | Boundary chiari + carryover F3/F4/F5 threats |

**Overall confidence:** **HIGH**

**Valid until:** 2026-06-05 (30 giorni stable). Re-check se npm registry mostra major release Vitest/TypeDoc/Playwright o nuove spec ECMAScript impatto Map order.

---

## RESEARCH COMPLETE

**Plan count proposto:** **9 plan in 5 wave** (W1 bootstrap sequential gate, W2 cache adapter ∥ tap registry, W2-bis cache handler post W2, W3 inspector ∥ metrics ∥ pause parallel, W4 composition + integration test sequential gate consumer, W5/Final gate F6 closure milestone v1.0). Coerente con F4 (9 plan / 6 wave), F3 (14 plan / 9 wave), F5 (7 plan / 5 wave). F6 ha più plan di F5 perché ha 2 package + aggregato (cache + devtools + sembridge) vs F5 1 package (worker).

**Confidence overall:** **HIGH** — 16 decisioni lockate da CONTEXT.md (zero questions bloccanti); pattern F1-F5 consolidati 5 volte; zero nuove deps runtime esterne; algoritmi standard (FNV-1a, Reservoir Algorithm R, structuredClone) ben definiti; D-83 strict carryover meccanico; rischio residuo unico (Opzione B vs B' per F3 cacheHandler DI) con fallback documentato.

**Key risks identificati:**

1. **R1 — Opzione B vs B' per F3 cacheHandler DI (§4.2):** `RouteExecutorDeps` interface F3 potrebbe non avere hook per cacheHandler iniettabile. Mitigation: plan 06-03 verifica codebase prima del wiring + fallback Opzione B' (composition wrapper F6 intercetta publish PRE-RouterBroker, gestisce direttamente type='cache'/'composite'). Probability: bassa-media (RouteExecutorDeps F3 D-65 è progettato per DI extension).

2. **R2 — cache-then-network ordering microtask vs setTimeout (§4.3):** ordering deterministico tra cache hit (microtask) e network response (Promise/macrotask) richiede test reale browser. Mitigation: test Tier-3 Playwright `__browser__/cache-hit-ordering.test.ts` SC-1 closure + DOC-06 documentazione semantica.

3. **R3 — size-limit budget pre-implementation underestimate:** stima 5-8 KB cache + 8-12 KB devtools potrebbe essere ottimistica. Mitigation: plan 06-09 calibrazione post-implementation pattern F3 03-14 (raise floor a measured + 20% headroom). Lesson learned cross-fase consolidata.

4. **R4 — structuredClone perf su payload grandi (§15.3):** `getDebugSnapshot()` deep-clone potrebbe sforare 50ms su mobile. Mitigation: Tier-3 perf benchmark + DOC-06 caveat "rare-call". Fallback opt-in `getDebugSnapshot({deep:false})` shallow se profiling reale richiede.

5. **R5 — Opzione A chain vs B aggregato createSemBridge (§11):** API surface duplicata (espose entrambe). Risk: confusione consumer "quale usare?". Mitigation: DOC-02 chiara "createSemBridge è zero-config; createCacheBroker è power-user". Pattern coerente con npm ecosystem (es. `react-router` esposto via `BrowserRouter` aggregato + componenti separati).

**Versioni npm verificate live (2026-05-05):**
- `lru-cache@11.3.6` — VALUTATO, NON adottato (Map insertion order custom)
- `tdigest@0.1.2` — VALUTATO, NON adottato (reservoir Algorithm R inline)
- `json-stable-stringify@1.3.0` — VALUTATO, NON adottato (stableStringify inline custom)
- `typedoc@0.28.19` + `typedoc-plugin-markdown@4.11.0` — ADOTTATI plan 06-09 final DOC consolidation
- `vitest@4.1.5` + `@vitest/browser@4.1.5` + `playwright@1.59.1` + `jsdom@29.1.0` (riuso F1-F5)
- `valibot@1.3.1` + `nanoid@5.1.11` (riuso F1-F5)

**File creato:** `/Users/omarmarzio/programming/prova AI/SemBridge/.planning/phases/06-cache-tooling-avanzato/06-RESEARCH.md`

**Pronto per:** `/gsd-plan-phase 6` (planner consumerà questo RESEARCH.md per produrre 9 PLAN.md F6 — 06-01 bootstrap + types + augment, 06-02 MemoryCacheAdapter + stable-hash, 06-03 CacheHandler + Composite ext, 06-04 MultiplexTap + tap registry, 06-05 EventInspector + RouteInspector, 06-06 MetricsCollector + reservoir + cardinality cap, 06-07 PauseController + queue cap + critical bypass, 06-08 composition wrappers + createSemBridge aggregato + integration test, 06-09 final gate F6 + DOC-02/05/06 + REQ matrix flip + chiusura PRD §39 #10 + milestone v1.0).
