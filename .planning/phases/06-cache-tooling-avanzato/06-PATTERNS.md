# Phase 6: Cache & Tooling avanzato — Pattern Map

**Mapped:** 2026-05-05
**Files analyzed:** ~38 file F6 (cache + devtools + sembridge aggregato)
**Analogs found:** 36 / 38 (2 nuovi pattern: reservoir-sampling + structuredClone-based snapshot)
**Plan structure consumata:** 9 plan / 5 wave (W1 bootstrap → W2 cache-adapter ∥ tap-registry → W2-bis cache-handler → W3 inspector ∥ metrics ∥ pause-controller → W4 composition + integration test → W5 final gate)
**Confidence overall:** HIGH (pattern F1-F5 consolidati 5 volte; D-83 STRICT meccanico)

> Lingua: testo descrittivo italiano; identificatori, code excerpt, path:line, log keyword in inglese (vincolo CLAUDE.md).

---

## File Classification

### Package `@sembridge/cache` (W1 bootstrap + W2 + W2-bis + W4)

| File F6 | Ruolo | Data Flow | Closest Analog | Match Quality | Plan |
|---------|-------|-----------|----------------|---------------|------|
| `packages/cache/package.json` (popolare) | config (npm package) | build/publish | `packages/worker/package.json` (D-122 scaffold + sideEffects glob) | exact | 06-01 |
| `packages/cache/tsconfig.json` | config (TS) | build | `packages/worker/tsconfig.json` | exact | 06-01 |
| `packages/cache/tsup.config.ts` | config (build bundler) | build | `packages/worker/tsup.config.ts` | exact | 06-01 |
| `packages/cache/vitest.config.ts` | config (test runner) | test (jsdom Tier-1) | `packages/worker/vitest.config.ts` | exact | 06-01 |
| `packages/cache/vitest.browser.config.ts` | config (Tier-3 browser) | test (Playwright Chromium) | `packages/worker/vitest.browser.config.ts` (D-150) | exact | 06-01 |
| `packages/cache/biome.json` | config (lint/format) | static analysis | `packages/worker/biome.json` | exact | 06-01 |
| `packages/cache/src/index.ts` | barrel export | re-export | `packages/worker/src/index.ts` (S1 anti tree-shake `__augmentLoaded` re-export) | exact | 06-01 |
| `packages/cache/src/augment.ts` | type augmentation (TS declaration merging) | type-only (compile-time) | `packages/worker/src/augment.ts` (D-122 D-126) | exact | 06-01 |
| `packages/cache/src/types/cache-adapter.ts` | type definition (interface CacheAdapter) | type-only | `packages/worker/src/types/worker-config.ts` (interface contract) | role-match | 06-01/02 |
| `packages/cache/src/types/cache-entry.ts` | type definition | type-only | `packages/worker/src/types/worker-task-outcome.ts` | role-match | 06-01/02 |
| `packages/cache/src/types/cache-config.ts` | type definition (BrokerConfig.cache shape) | type-only | `packages/worker/src/types/worker-config.ts` | exact | 06-01 |
| `packages/cache/src/memory-cache-adapter.ts` | adapter implementation (LRU bounded) | CRUD (in-memory, capacity-bound) | NESSUN ANALOG diretto — pattern Map insertion order idiomatic JS (RESEARCH §2.2) + F3 dedupe `Map<key, Promise>` cap pattern | partial-match | 06-02 |
| `packages/cache/src/memory-cache-adapter.test.ts` | unit test | test (jsdom) | `packages/gateway/src/http/strategies/dedupe-strategy.test.ts` (cap + cleanup) | role-match | 06-02 |
| `packages/cache/src/stable-hash.ts` | utility pura (FNV-1a + stableStringify) | transform (value → string hash) | `packages/gateway/src/http/strategies/dedupe-strategy.ts:15-30` (KeyBased D-74 stable hash inline) | exact (D-74 carryover) | 06-02 |
| `packages/cache/src/stable-hash.test.ts` | unit test | test | analog test dedupe-strategy.test.ts | role-match | 06-02 |
| `packages/cache/src/cache-handler.ts` | route handler (Strategy F3 D-77 concretizza) | request-response (cache lookup → publish or delegate) | `packages/worker/src/worker-handler.ts` (Strategy F3 dispatch) + `packages/routing/src/route-handlers/local-handler.ts` (sync handler base) | exact (D-77 + D-152 carryover) | 06-03 |
| `packages/cache/src/cache-handler.test.ts` | unit test | test | `packages/worker/src/worker-handler.test.ts` (3 strategy + scope + audit) | exact | 06-03 |
| `packages/cache/src/composite-handler.ts` | route handler (concretizza F3 stub) | composite workflow (cache → http → publish) | `packages/routing/src/route-handlers/composite-handler.ts:67-130` (factory + closure flag warn-once) | exact (estende D-77) | 06-03 |
| `packages/cache/src/composite-handler.test.ts` | unit test | test | analog routing/handlers.test.ts | exact | 06-03 |
| `packages/cache/src/cache-broker.ts` | composition wrapper (Opzione B) | event-driven (publish intercept + delegate inner) | `packages/worker/src/worker-broker.ts` (D-121) + `packages/gateway/src/sse-ws/realtime-broker.ts` (D-101) | exact (D-83 STRICT carryover) | 06-08 |
| `packages/cache/src/cache-broker.test.ts` | unit test | test | `packages/worker/src/worker-broker.test.ts` | exact | 06-08 |
| `packages/cache/src/public-factory.ts` | factory pubblica (createCacheBroker) | bootstrap (config → broker instance) | `packages/worker/src/public-factory.ts` (D-30 anti-singleton + Valibot safeParse) | exact | 06-08 |
| `packages/cache/src/public-factory.test.ts` | unit test | test | `packages/worker/src/public-factory.test.ts` | exact | 06-08 |
| `packages/cache/src/test-utils/cache-harness.ts` | test util (factory + fake clock) | test infrastructure | `packages/worker/src/test-utils/worker-harness.ts` (D-150 carryover) | exact | 06-08 |
| `packages/cache/src/__integration__/cache-then-network-flow.test.ts` | integration test (Tier-2 jsdom + msw) | test (multi-component flow) | `packages/gateway/src/sse-ws/__integration__/realtime-flow.test.ts` | role-match | 06-09 |
| `packages/cache/src/__browser__/cache-hit-ordering.test.ts` | browser test (Tier-3 Playwright) | test (real timing browser) | `packages/worker/src/__browser__/worker-real.test.ts` (D-150) | exact | 06-09 |
| `packages/cache/README.md` (italiano) | documentation | docs | `packages/worker/README.md` (429 LOC, 11 sezioni italiane) + `packages/gateway/README.md` (579 LOC) | exact | 06-09 |

### Package `@sembridge/devtools` (W1 + W2 ∥ + W3 + W4)

| File F6 | Ruolo | Data Flow | Closest Analog | Match Quality | Plan |
|---------|-------|-----------|----------------|---------------|------|
| `packages/devtools/package.json` (popolare) | config | build/publish | `packages/worker/package.json` | exact | 06-01 |
| `packages/devtools/tsconfig.json` + `tsup.config.ts` + `vitest.config.ts` + `vitest.browser.config.ts` + `biome.json` | config files | build/test | `packages/worker/*` (set completo) | exact | 06-01 |
| `packages/devtools/src/index.ts` | barrel export | re-export | `packages/worker/src/index.ts` (S1 + `__augmentDevtoolsLoaded`) | exact | 06-01 |
| `packages/devtools/src/augment.ts` | TS declaration merging (BrokerConfig.taps + BrokerConfig.devtools + F6PipelineStep) | type-only | `packages/worker/src/augment.ts` (D-122 + F5PipelineStep) | exact (D-159 + D-167 + D-170) | 06-01 |
| `packages/devtools/src/types/metrics.ts` | type definition (MetricsSnapshot, HistogramSummary) | type-only | `packages/worker/src/types/worker-task-outcome.ts` (interface readonly contract) | role-match | 06-01/06 |
| `packages/devtools/src/types/inspector-entry.ts` | type definition (PipelineSnapshot extension + RouteInspectorEntry) | type-only | `packages/core/src/types/tap.ts` (PipelineSnapshot base) + `packages/worker/src/task-tracker.ts:71-81` (TaskTrackerSnapshot) | exact | 06-01/05 |
| `packages/devtools/src/types/pause-state.ts` | type definition (PauseController + queue entry) | type-only | `packages/worker/src/task-tracker.ts` interface contract | role-match | 06-01/07 |
| `packages/devtools/src/multiplex-tap.ts` | tap aggregator (chain N tap con error isolation) | event-driven (fan-out per step §28) | `packages/core/src/core/bus.ts:79-110` (`safeTapStep` try/catch isolato D-20) + `packages/routing/src/outcome-collector.ts:75-90` (try/catch swallow inline) | exact (D-159 + D-20 carryover) | 06-04 |
| `packages/devtools/src/multiplex-tap.test.ts` | unit test | test | analog `packages/core/src/core/bus.test.ts` tap test | role-match | 06-04 |
| `packages/devtools/src/tap-registry.ts` | tap registry (auto-wrap F1 single-tap → array) | adapter (legacy → new) | `packages/worker/src/worker-registry.ts:104-110` (Map registry pattern) | role-match | 06-04 |
| `packages/devtools/src/tap-registry.test.ts` | unit test | test | analog | role-match | 06-04 |
| `packages/devtools/src/event-inspector.ts` | inspector (ring buffer 500 + enable/disable) | event-driven (capture + bounded buffer) | `packages/worker/src/task-tracker.ts:140-220` (state Map atomic + bounded counter `lateResponses`) + `packages/gateway/src/sse-ws/realtime-channel-manager.ts:90-110` (ChannelEntry registry) | exact (D-167) | 06-05 |
| `packages/devtools/src/event-inspector.test.ts` | unit test | test | `packages/worker/src/task-tracker.test.ts` (CAS atomic + counter) | exact | 06-05 |
| `packages/devtools/src/route-inspector.ts` | inspector (route execution history) | event-driven (capture step 9+10) | `packages/worker/src/task-tracker.ts` (state machine atomico) + `packages/routing/src/outcome-collector.ts` (step 10 capture) | exact | 06-05 |
| `packages/devtools/src/route-inspector.test.ts` | unit test | test | analog task-tracker.test.ts | exact | 06-05 |
| `packages/devtools/src/metrics-collector.ts` | metrics aggregator (counters/gauges/histograms) | aggregate (observe → compute summary on demand) | `packages/worker/src/worker-pool.ts:113-160` (counter atomic JS event loop, single-threaded) + `packages/worker/src/task-tracker.ts:140-220` (Map<key, state>) | role-match (D-163 + D-164) | 06-06 |
| `packages/devtools/src/metrics-collector.test.ts` | unit test | test | analog worker-pool.test.ts (counter + state) | role-match | 06-06 |
| `packages/devtools/src/reservoir-sampling.ts` | algorithm pure (Vitter Algorithm R 1985) | sampling (~30 LOC standalone) | NESSUN ANALOG diretto — algoritmo standard. Pattern Math.random() coerente con F4 `reconnect-strategy.ts:140` (jitter random) e F5 `worker-pool.ts` (no Math.random ma queue determ.) | new pattern (cited C2 RESEARCH §8) | 06-06 |
| `packages/devtools/src/reservoir-sampling.test.ts` | unit test | test | none — test deterministic con seed Math.random mock | new pattern | 06-06 |
| `packages/devtools/src/cardinality-cap.ts` | guard (cap label combinations + audit emit) | guard (insert-or-drop + emit warn) | `packages/worker/src/worker-registry.ts:39 + 104-180` (D-128 cap pool 8 + console.warn) + `packages/gateway/src/sse-ws/reconnect-strategy.ts` (D-109 cap reconnect + emit) | exact (D-166 + D-128 ext F6) | 06-06 |
| `packages/devtools/src/cardinality-cap.test.ts` | unit test | test | analog worker-registry.test.ts (cap + audit) | exact | 06-06 |
| `packages/devtools/src/pause-controller.ts` | flow controller (pauseTopic + queue + flushQueue) | request-response (intercept publish + queue or pass) | `packages/gateway/src/http/strategies/backpressure-strategy.ts:131-160` (D-75 queue-bounded + critical bypass) + F5 D-130 critical bypass `worker-pool.ts:39` | exact (D-170 + D-75 carryover) | 06-07 |
| `packages/devtools/src/pause-controller.test.ts` | unit test | test | `packages/gateway/src/http/strategies/backpressure-strategy.test.ts` | exact | 06-07 |
| `packages/devtools/src/devtools-broker.ts` | composition wrapper | event-driven (publish intercept + tap install) | `packages/worker/src/worker-broker.ts` (D-121) + `packages/gateway/src/sse-ws/realtime-broker.ts` (D-101) | exact (D-83 STRICT) | 06-08 |
| `packages/devtools/src/devtools-broker.test.ts` | unit test | test | `packages/worker/src/worker-broker.test.ts` | exact | 06-08 |
| `packages/devtools/src/public-factory.ts` | factory (createDevtoolsBroker) | bootstrap | `packages/worker/src/public-factory.ts` (D-30 + Valibot safeParse) | exact | 06-08 |
| `packages/devtools/src/public-factory.test.ts` | unit test | test | analog worker public-factory.test.ts | exact | 06-08 |
| `packages/devtools/src/__browser__/structuredclone-perf.test.ts` | browser perf test | test (real timing) | `packages/worker/src/__browser__/worker-real.test.ts` (Tier-3 D-150) | exact | 06-09 |
| `packages/devtools/README.md` (italiano, 11 sezioni, ~400 LOC target) | documentation (DOC-06 closure) | docs | `packages/worker/README.md` (429 LOC, 11 sezioni) + `packages/gateway/README.md` (579 LOC) | exact | 06-09 |

### Package `@sembridge/sembridge` (aggregato, W4 + W5)

| File F6 | Ruolo | Data Flow | Closest Analog | Match Quality | Plan |
|---------|-------|-----------|----------------|---------------|------|
| `packages/sembridge/package.json` (popolare deps su tutti F1-F6) | config (aggregate) | build | `packages/worker/package.json` per shape; nuovo per scope (re-export 7 sub-package) | role-match | 06-01 |
| `packages/sembridge/src/index.ts` | aggregate barrel (re-export 7 package) | re-export | `packages/core/src/index.ts` (barrel pattern) ma scope aggregato | role-match | 06-08 |
| `packages/sembridge/src/sem-bridge.ts` | factory aggregato `createSemBridge(config)` | bootstrap (chain createCacheBroker → createDevtoolsBroker → createWorkerBroker → createRealtimeBroker → createRouterBroker → createMapperBroker) | `packages/worker/src/public-factory.ts` (Valibot safeParse al boundary) + chain composition `worker-broker.ts:1-50` (D-121 doc chain example) | exact + new aggregate scope | 06-08 |
| `packages/sembridge/src/sem-bridge.test.ts` | unit test (chain composition) | test | analog public-factory.test.ts | role-match | 06-08 |
| `packages/sembridge/README.md` (italiano, DOC-02 + DOC-05) | documentation (guida integrazione plugin + esempi end-to-end + scenario meteo F5+F6) | docs | `packages/worker/README.md` 11 sezioni (carryover scenario meteo §7) + scenario meteo PRD §29 | exact (estende worker README scenario) | 06-09 |
| `packages/sembridge/EXAMPLES.md` (italiano, DOC-05) | examples + Q&A 20+ | docs | `packages/worker/README.md` §11 Q&A pattern (PRD §39 #11 closure) | exact | 06-09 |

### File globali F6 (W1 + W5)

| File F6 | Ruolo | Data Flow | Closest Analog | Match Quality | Plan |
|---------|-------|-----------|----------------|---------------|------|
| `package.json` (root, size-limit additions) | config (CI gate) | static analysis | F3 `package.json` size-limit array (entries `core 8KB`, `mapper 12KB`, `routing 24KB`, `gateway/http 8KB`, `worker 32KB`) | exact | 06-09 |
| `.changeset/v1-0-0-release.md` | release config (major bump 7 package) | publish | analog F3 03-14 / F4 04-09 / F5 05-07 changeset closure | exact | 06-09 |
| `.planning/REQUIREMENTS.md` (REQ matrix flip) | requirements tracking | docs | F5 05-07 flip pattern | exact | 06-09 |
| `.planning/ROADMAP.md` (Phase 6 ✓ Complete + milestone v1.0 closure) | roadmap | docs | F5 05-07 close pattern | exact | 06-09 |
| `.planning/STATE.md` + `.planning/TRACKER.md` | tracking | docs | F1-F5 protocol carryover | exact | 06-09 |

---

## Pattern Assignments

### `packages/cache/src/augment.ts` (TS declaration merging)

**Analog:** `packages/worker/src/augment.ts:48-77` (D-122 + D-126 esatto)

**Imports pattern** (riga 1-7):
```typescript
// augment.ts — TS declaration merging per estendere @sembridge/core con tipi F6
// Cache (D-155 / D-156 / D-167 / D-170 in 06-CONTEXT.md — replica simmetrica
// di worker/augment.ts di F5).
//
// Vincolo D-83 STRICT: NESSUNA modifica a packages/{core,mapper,routing,gateway,worker}/src/.
import type { CacheConfig } from './types/cache-config'
import type { CacheAdapter } from './types/cache-adapter'
```

**Declare module pattern** (analog `packages/worker/src/augment.ts:48-77`):
```typescript
declare module '@sembridge/core' {
  interface BrokerConfig {
    /** F6 sezione `cache` (D-155, PRD §20): config cache layer LRU + scope hybrid. */
    cache?: CacheConfig
  }
}

/**
 * F6 PipelineStep — eventi step §28 emessi dal CacheHandler / step 14
 * (D-161 attivazione step 14 reale + cache.hit/miss/evicted lifecycle events).
 */
export type F6CachePipelineStep =
  | 'event.cache.lookup'    // pre-cache check
  | 'event.cache.hit'       // cache.hit lifecycle
  | 'event.cache.miss'      // cache.miss lifecycle
  | 'event.cache.evicted'   // LRU/TTL/invalidate eviction
```

**Marker S1 anti tree-shake** (analog `packages/worker/src/augment.ts:124`):
```typescript
export const __augmentCacheLoaded: true = true
```

**Carryover decisions:** D-83 STRICT, D-94 (declaration merging F3), D-122 (F5 carryover), D-155, D-156, D-161.

---

### `packages/cache/src/stable-hash.ts` (FNV-1a + stableStringify)

**Analog:** `packages/gateway/src/http/strategies/dedupe-strategy.ts:65-90` (D-74 KeyBased — riuso 1:1 in D-155 cache key default)

**Pattern dedupe inline (D-74)** — stable-hash è la generalizzazione del pattern KeyBased:
```typescript
// dedupe-strategy.ts:62-93 (analog estratto)
export function createDedupeStrategy(options: DedupeStrategyOptions = {}): DedupeStrategy {
  const inflight = new Map<string, Promise<unknown>>()
  return {
    async execute<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const existing = inflight.get(key)
      if (existing !== undefined) return existing as Promise<T>
      // ... cap + Promise singleton
    }
  }
}
```

**Pattern F6 stable-hash (RESEARCH §3.2):**
```typescript
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value as Record<string, unknown>).sort()
  const parts = keys.map(k => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
  return `{${parts.join(',')}}`
}

function fnv1a32(str: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function cacheKey(opts: { topic: string; payload: unknown; scope?: string | null }): string {
  const baseKey = `${opts.topic}::${fnv1a32(stableStringify(opts.payload))}`
  return opts.scope ? `${opts.scope}::${baseKey}` : baseKey
}
```

**Carryover decisions:** D-155 (cache key default), D-156 (scope hybrid prefix), D-74 (KeyBased dedupe carryover esatto).

---

### `packages/cache/src/memory-cache-adapter.ts` (LRU bounded Map insertion order)

**Analog parziale:** nessun analog diretto in F1-F5 (Map idiomatic JS standard, RESEARCH §2.2). Pattern vicini:
- `packages/gateway/src/http/strategies/dedupe-strategy.ts:62-105` (Map<key, ...> + cap + cleanup `finally`)
- `packages/worker/src/worker-registry.ts:104-180` (Map registry + cap hard 8 + duplicate guard pattern)

**Imports pattern (analog dedupe-strategy.ts:22-27):**
```typescript
import type { CacheAdapter, CacheEntry } from './types/cache-adapter'
```

**Eviction LRU pattern (RESEARCH §2.2 — NEW pattern, no analog ma idiomatic):**
```typescript
export function createMemoryCacheAdapter(opts: { maxEntries?: number } = {}): CacheAdapter {
  const maxEntries = opts.maxEntries ?? 1000  // D-158
  const cache = new Map<string, CacheEntry>()
  let hits = 0, misses = 0, evictions = 0

  return {
    get(key) {
      const entry = cache.get(key)
      if (!entry) { misses++; return undefined }
      if (entry.expiresAt < Date.now()) {
        cache.delete(key); evictions++; misses++; return undefined
      }
      // LRU touch: re-insert per portare in coda (insertion order = LRU order)
      cache.delete(key); cache.set(key, entry); hits++
      return entry as CacheEntry<unknown>
    },
    set(key, value, ttlMs) {
      if (cache.size >= maxEntries && !cache.has(key)) {
        const oldestKey = cache.keys().next().value
        if (oldestKey !== undefined) { cache.delete(oldestKey); evictions++ }
      }
      const expiresAt = ttlMs !== undefined ? Date.now() + ttlMs : Number.POSITIVE_INFINITY
      cache.set(key, { value, expiresAt, setAt: Date.now() })
    },
    invalidate(pattern) { /* string | RegExp | { prefix } dispatch */ },
    stats() { return { hits, misses, evictions, entries: cache.size } },
  }
}
```

**Pattern cap+drop (analog F3 D-75 backpressure-strategy.ts:139-145):**
```typescript
// backpressure-strategy.ts:138-156 estratto — pattern queue-bounded drop-oldest
case 'queue-bounded': {
  const max = state.policy.max
  if (state.inFlight >= max) {
    if (dropOldest && state.pending.length > 0) {
      const oldest = state.pending.shift()
      // ... drop + audit emit
    }
  }
}
```

**Carryover decisions:** D-158 (LRU bounded maxEntries=1000), D-30 (anti-singleton factory), D-128 ext F6 (cap pattern).

---

### `packages/cache/src/cache-handler.ts` (Strategy F3 D-77 concretizza placeholder)

**Analog:** `packages/worker/src/worker-handler.ts` (Strategy F3 dispatch step 9 D-152 — pattern handler factory completo)

**Imports + DI pattern** (analog `packages/worker/src/worker-handler.ts:50-77`):
```typescript
import { type BrokerError, type BrokerEvent, createBrokerError } from '@sembridge/core'
import type { CacheAdapter } from './types/cache-adapter'
import type { CompiledRoute } from '@sembridge/routing'
import type { RouteOutcome } from '@sembridge/routing'

export type CachePublishFn = (
  topic: string,
  payload: unknown,
  options?: {
    readonly source?: { readonly type: string; readonly id: string; readonly name?: string }
    readonly correlationId?: string
    readonly priority?: 'low' | 'normal' | 'high' | 'critical'
  },
) => void | Promise<void>

export interface CacheHandlerDeps {
  readonly cache: CacheAdapter
  readonly publishFn: CachePublishFn
  readonly scopeProvider?: (event: BrokerEvent) => string | null  // D-156 config-level
  readonly httpHandler: (event: BrokerEvent, route: CompiledRoute, signal: AbortSignal) => Promise<RouteOutcome>  // delegate cache-miss
}
```

**Strategy dispatch (analog `packages/routing/src/route-executor.ts:130-170`):**
```typescript
// Pattern dispatch by strategy: cache-first / network-first / cache-then-network
async function executeCacheStrategy(
  event: BrokerEvent,
  route: CompiledRoute,
  strategy: 'cache-first' | 'network-first' | 'cache-then-network',
): Promise<RouteOutcome> {
  const scope = route.cache?.scope?.(event) ?? deps.scopeProvider?.(event) ?? null
  // D-157 missing scope su route auth → skip cache + audit
  if (route.auth && scope === null) {
    deps.publishFn('system.cache.scope-missing', { routeId: route.id, topic: event.topic, eventId: event.id })
    return await deps.httpHandler(event, route, signal)  // cold fetch sempre
  }
  const key = route.cache?.key?.(event) ?? cacheKey({ topic: event.topic, payload: event.payload, scope })

  switch (strategy) {
    case 'cache-first': { /* lookup → HIT publish {origin:'cache'} | MISS fetch + cache.set */ }
    case 'network-first': { /* fetch → success cache.set | error cache lookup fallback */ }
    case 'cache-then-network': {
      // RESEARCH §15.6: queueMicrotask SYNC subito al RouteExecutor entry, prima di await fetch
      const hit = deps.cache.get(key)
      if (hit) queueMicrotask(() => deps.publishFn(deriveTopic(event.topic, 'loaded'), hit.value, { source: { type: 'cache', id: 'cache-hit' } }))
      // Poi fetch background
      return await deps.httpHandler(event, route, signal).then(outcome => { /* cache.set + publish {origin:'remote', replaces: hitEventId} */ })
    }
  }
}
```

**Pattern composite Opzione B carryover (D-83 strict):** identico a `worker-handler.ts:1-50` doc commento — NON modifica `route-executor.ts`/`cache-handler.ts` di F3, intercept publish PRE-RouterBroker.

**Carryover decisions:** D-77 (placeholder F3 → concretizza F6), D-152 (Strategy DI pattern), D-83 STRICT, D-155, D-156, D-157, D-130 critical bypass.

---

### `packages/cache/src/composite-handler.ts` (concretizza F3 stub cache step)

**Analog:** `packages/routing/src/route-handlers/composite-handler.ts:67-130` (factory + closure flag warn-once F3)

**Pattern factory + closure flag** (riga 67-90):
```typescript
// composite-handler.ts:67-72 estratto
export function createCompositeHandler(
  deps: CompositeHandlerDeps,
): (event: BrokerEvent, route: CompiledRoute) => Promise<RouteOutcome> {
  let cacheWarnEmitted = false  // closure per warning UNA volta

  return async function compositeHandler(event, route): Promise<RouteOutcome> {
    const def = route.definition as RouteCompositeDefinition
    const httpStep = def.steps.find((s) => s.type === 'http')
    if (!httpStep) return errorOutcome('route.composite.no-http')
    // ...
  }
}
```

**Pattern F6 estensione cache step (concretizza Q3 opzione b → opzione a):**
```typescript
// In F6 il cache step NON è più skipped: factory accetta cacheHandler come dep
export function createCompositeHandlerF6(deps: {
  httpHandler: ...
  cacheHandler: (event, subRoute) => Promise<RouteOutcome>  // F6 NEW — concretizza F3 stub
  resolveSubRoute: ...
}): (event, route) => Promise<RouteOutcome> {
  return async function compositeF6(event, route) {
    // 1. Find cache step → cacheHandler(event, cacheStep)
    // 2. HIT → publish {origin:'cache'} + return
    // 3. MISS → find http step → httpHandler → cache.set → publish {origin:'remote'}
  }
}
```

**Carryover decisions:** D-77 (F3 placeholder), D-83 STRICT, D-94 declaration merging RouteDefinition.cache route-level.

---

### `packages/cache/src/cache-broker.ts` (composition wrapper Opzione B)

**Analog:** `packages/worker/src/worker-broker.ts:1-100` (D-121 + D-83 STRICT carryover esatto) + `packages/gateway/src/sse-ws/realtime-broker.ts:1-100` (D-101)

**Header pattern doc (analog `packages/worker/src/worker-broker.ts:1-46`):**
```typescript
// cache-broker.ts — `CacheBroker` composition wrapper di `RouterBroker` (Wave 4
// plan 06-08 — D-83 strict carryover — F6 vive solo in `packages/cache/src/`).
//
// **Opzione B research §4.2 — D-83 strict preservation:**
// Il `publish(topic)` override intercetta topic matching una cache route registrata
// PRIMA di delegare a `inner.publish` (RouterBroker F3). In questo modo F6:
// - NON modifica `packages/routing/route-resolver.ts` né `route-executor.ts`
// - NON modifica `packages/routing/route-handlers/cache-handler.ts` (stub F3)
// - NON viola D-83 (`git diff main packages/{core,mapper,routing,gateway,worker}/src/` zero output)
// - Riusa pipeline §28 mapper F2 step 5-6 + step 11-12 invariati
// - Aggiunge step 9 dispatch cache pre-publish per route cache/composite matching
```

**Constructor + composition pattern (analog `packages/worker/src/worker-broker.ts:60-140`):**
```typescript
import { RouterBroker, type RouterBrokerConfig } from '@sembridge/routing'

export interface CacheBrokerConfig extends RouterBrokerConfig {
  readonly cache?: CacheConfig  // D-155 D-156
  readonly cacheRoutes?: readonly RouteCacheDefinition[]
}

export class CacheBroker {
  private readonly inner: RouterBroker
  private readonly adapter: CacheAdapter
  private readonly handler: CacheHandlerF6
  private readonly cacheRoutes: Map<string, RouteCacheDefinition>

  constructor(config: CacheBrokerConfig) {
    this.inner = new RouterBroker(config)
    this.adapter = config.cache?.adapter ?? createMemoryCacheAdapter({ maxEntries: config.cache?.maxEntries })
    this.handler = createCacheHandlerF6({ cache: this.adapter, publishFn: this.inner.publish.bind(this.inner), ... })
    this.cacheRoutes = new Map((config.cacheRoutes ?? []).map(r => [r.topic, r]))
  }

  publish(topic: string, payload: unknown, options?: RouterPublishOptions): Promise<void> | void {
    // Intercept Opzione B: se topic ha cache route, dispatch al handler F6
    const cacheRoute = this.cacheRoutes.get(topic)
    if (cacheRoute) return this.handler.execute(event, cacheRoute)
    return this.inner.publish(topic, payload, options)
  }

  registerPlugin(desc: PluginDescriptor): PluginRegistration {
    const reg = this.inner.registerPlugin(desc)
    // Cascade D-126 ext F6: auto-register cache invalidation per ownerId
    return reg
  }

  unregisterPlugin(id: string): void {
    this.inner.unregisterPlugin(id)
    // Cascade cleanup cache invalidation by owner (LIFE-02 ext F6)
    this.adapter.invalidate({ prefix: `${id}::` })  // o pattern owner-scoped
  }
}
```

**Carryover decisions:** D-83 STRICT (carryover F1-F5), D-101 (composition F4), D-121 (composition F5 esatto), D-126 ext F6 (cascade cleanup).

---

### `packages/cache/src/public-factory.ts` (createCacheBroker)

**Analog:** `packages/worker/src/public-factory.ts:147-157` (D-30 anti-singleton + Valibot safeParse) + `packages/gateway/src/sse-ws/public-factory.ts:30-78` (Valibot schema strutturato)

**Imports + Valibot schema** (analog `packages/worker/src/public-factory.ts:33-95`):
```typescript
import * as v from 'valibot'
import { CacheBroker, type CacheBrokerConfig } from './cache-broker'

const CacheConfigSchema = v.optional(
  v.looseObject({
    maxEntries: v.optional(v.pipe(v.number(), v.minValue(1))),
    adapter: v.optional(v.unknown()),  // CacheAdapter passthrough
    scopeProvider: v.optional(v.unknown()),  // function passthrough
  }),
)

const CacheBrokerConfigSchema = v.looseObject({
  // F1-F5 sections pass-through
  runtime: v.optional(v.unknown()),
  debug: v.optional(v.unknown()),
  canonicalModel: v.optional(v.unknown()),
  routes: v.optional(v.unknown()),
  gateway: v.optional(v.unknown()),
  realtime: v.optional(v.unknown()),
  workers: v.optional(v.unknown()),
  // F6 sections strict
  cache: CacheConfigSchema,
  cacheRoutes: v.optional(v.array(v.looseObject({ type: v.literal('cache'), topic: v.string(), strategy: v.picklist(['cache-first','network-first','cache-then-network']) }))),
})
```

**Factory pattern (analog `packages/worker/src/public-factory.ts:147-154`):**
```typescript
export function createCacheBroker(config: CacheBrokerConfig = {}): CacheBroker {
  const parsed = v.safeParse(CacheBrokerConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid CacheBrokerConfig: ${messages}`)
  }
  return new CacheBroker(config)
}
```

**JSDoc pattern (analog `packages/worker/src/public-factory.ts:97-146`):** preserva `@example`, `@throws`, `@see` italian descriptive — TypeDoc-ready.

**Carryover decisions:** D-30 (anti-singleton), D-56 (validation at boundary), D-94 (declaration merging compatibility).

---

### `packages/devtools/src/multiplex-tap.ts` (chain N tap con error isolation)

**Analog:** `packages/core/src/core/bus.ts:79-110` (`safeTapStep` D-20 try/catch isolato) + `packages/routing/src/outcome-collector.ts:75-90` (try/catch swallow inline pattern)

**Pattern try/catch swallow (analog `packages/core/src/core/bus.ts` — `safeTapStep` non esposto al barrel, replica inline):**
```typescript
// Pattern documentato in worker-broker.ts e route-executor.ts:236-260
// Replica del pattern safeTapStep di core (D-20 carryover)
import type { EventTap, PipelineSnapshot, PipelineStep } from '@sembridge/core'

export function createMultiplexTap(taps: readonly EventTap[]): EventTap {
  return {
    onPipelineStep(step: PipelineStep, snapshot: PipelineSnapshot): void {
      for (const tap of taps) {
        try {
          tap.onPipelineStep(step, snapshot)
        } catch {
          // swallow — pattern F1 safeTapStep D-20 carryover
          // Failure di un tap NON ferma downstream taps né blocca pipeline
        }
      }
    },
  }
}
```

**Auto-wrap F1 pattern (analog `packages/worker/src/augment.ts:9-20` doc):**
```typescript
// In createDevtoolsBroker:
const taps: readonly EventTap[] = config.runtime?.tap
  ? [...(config.taps ?? []), config.runtime.tap]  // auto-wrap legacy single-tap
  : (config.taps ?? [])
const multiplexTap = createMultiplexTap(taps)
// Wired al RouterBroker come single tap
```

**Carryover decisions:** D-20 (safeTapStep F1), D-159 (chain registry), D-83 STRICT (no modify bus.ts).

---

### `packages/devtools/src/event-inspector.ts` (ring buffer 500 + lazy mode toggle)

**Analog:** `packages/worker/src/task-tracker.ts:140-220` (state Map atomic + bounded counter `lateResponses`) + `packages/gateway/src/sse-ws/realtime-channel-manager.ts:90-120` (Map registry pattern)

**State + interface pattern (analog `packages/worker/src/task-tracker.ts:46-81`):**
```typescript
export interface EventInspectorState {
  enabled: boolean      // mutable flag toggled by enableDebug/disableDebug
  buffer: PipelineSnapshot[]
  bufferSize: number
}

export interface EventInspectorSnapshot {
  readonly enabled: boolean
  readonly bufferEntries: number
  readonly bufferSize: number
}
```

**Factory closure pattern (analog `packages/worker/src/task-tracker.ts` createTaskTracker):**
```typescript
export function createEventInspector(opts: {
  bufferSize?: number
  initiallyEnabled?: boolean
}): {
  tap: EventTap
  enable(): void
  disable(): void
  getBuffer(): readonly PipelineSnapshot[]  // D-162 deep clone
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
        if (!state.enabled) return  // hot-path early return — zero overhead D-160
        state.buffer.push(snapshot)
        if (state.buffer.length > state.bufferSize) state.buffer.shift()  // FIFO
      },
    },
    enable() { state.enabled = true },
    disable() { state.enabled = false; state.buffer = [] },  // memory hygiene
    getBuffer() { return structuredClone(state.buffer) },  // D-162
    clear() { state.buffer = [] },
  }
}
```

**Pattern lazy-mode (D-160) NODE_ENV detection (RESEARCH §5.3):**
```typescript
const isProd = typeof process !== 'undefined'
  && typeof process.env !== 'undefined'
  && process.env.NODE_ENV === 'production'
const initialDebug = config.devtools?.enableByDefault ?? !isProd
```

**Carryover decisions:** D-160 (lazy mode), D-162 (structuredClone deep clone), D-167 (ring buffer 500), D-133 (state machine pattern carryover).

---

### `packages/devtools/src/route-inspector.ts` (route execution history)

**Analog:** `packages/worker/src/task-tracker.ts:46-220` (state machine atomico + counter aggregation) + `packages/routing/src/outcome-collector.ts` (step 10 capture)

**Entry shape (analog `packages/worker/src/task-tracker.ts:71-81`):**
```typescript
// task-tracker.ts:71-81 estratto — pattern readonly snapshot
export interface RouteInspectorEntry {
  readonly eventId: string
  readonly routeId: string
  readonly topic: string
  readonly type: 'local' | 'http' | 'cache' | 'composite' | 'worker' | 'realtime-inbound'
  readonly outcome: 'success' | 'error' | 'skipped' | 'cached' | 'pending'
  readonly durationMs: number
  readonly retryCount?: number
  readonly cacheHit?: boolean
  readonly policiesApplied?: readonly string[]  // ['timeout', 'retry', 'dedupe']
  readonly timestamp: number
  readonly errorCode?: string
}
```

**Carryover decisions:** D-167 (routeBufferSize), D-161 (lifecycle events route.dispatched), D-133 (atomic transition pattern).

---

### `packages/devtools/src/metrics-collector.ts` (counters/gauges/histograms)

**Analog:** `packages/worker/src/worker-pool.ts:113-160` (counter atomic JS event loop) + `packages/worker/src/task-tracker.ts:140-220` (Map<key, state>)

**Imports + interface (analog mix worker-pool + task-tracker):**
```typescript
import type { ReservoirState } from './reservoir-sampling'

export interface MetricsCollector {
  increment(name: string, labels?: Record<string, string>, by?: number): void
  setGauge(name: string, value: number, labels?: Record<string, string>): void
  observe(name: string, value: number, labels?: Record<string, string>): void
  getMetrics(): MetricsSnapshot
  getMetricsDelta(prev: MetricsSnapshot): MetricsDelta
}
```

**Atomic counter pattern (analog `packages/worker/src/task-tracker.ts:198-220` markDone/markTimeout — atomic JS event loop):**
```typescript
// JS single-threaded → counter increment atomic per costruzione (D-133 carryover)
counters.set(key, (counters.get(key) ?? 0) + by)
```

**Cardinality cap pattern (analog `packages/worker/src/worker-registry.ts:39-180` D-128 cap pool 8):**
```typescript
// worker-registry.ts:39 estratto: const literal MAX_POOL_SIZE_HARD = 8 + audit emit
function checkCardinality(baseName: string, labelSig: string): boolean {
  if (!labelSig) return true
  let set = cardinality.get(baseName)
  if (!set) { set = new Set(); cardinality.set(baseName, set) }
  if (set.has(labelSig)) return true
  if (set.size >= cardinalityCap) {
    // D-166 emit audit event analog F5 D-128 console.warn
    onCardinalityOverflow?.({ baseName, droppedLabels: labelSig })
    return false
  }
  set.add(labelSig)
  return true
}
```

**Carryover decisions:** D-163 (naming sembridge.<package>.<metric>), D-164 (cumulative-only), D-165 (reservoir histogram), D-166 (cap 100 cardinality), D-128 ext F6 (cap+audit pattern).

---

### `packages/devtools/src/reservoir-sampling.ts` (Algorithm R Vitter 1985)

**Analog:** NESSUNO (algoritmo standard, RESEARCH §8.2 inline ~30 LOC). Pattern Math.random() consumer carryover F4 `reconnect-strategy.ts:140` (jitter random).

**Pattern algorithm R inline (RESEARCH §8.2 — NEW pattern, citazione Vitter 1985):**
```typescript
export interface ReservoirState {
  readonly samples: number[]
  readonly capacity: number
  count: number
  sum: number
}

export function createReservoir(capacity: number): ReservoirState {
  return { samples: new Array(capacity), capacity, count: 0, sum: 0 }
}

export function reservoirAdd(state: ReservoirState, value: number): void {
  state.sum += value
  if (state.count < state.capacity) {
    state.samples[state.count] = value
    state.count++
  } else {
    const j = Math.floor(Math.random() * (state.count + 1))
    if (j < state.capacity) state.samples[j] = value
    state.count++
  }
}

export function computeSummary(state: ReservoirState): HistogramSummary {
  const n = Math.min(state.count, state.capacity)
  if (n === 0) return { count: 0, sum: 0, p50: 0, p90: 0, p99: 0 }
  const sorted = state.samples.slice(0, n).sort((a, b) => a - b)
  const pickIdx = (p: number) => Math.min(n - 1, Math.floor(n * p))
  return { count: state.count, sum: state.sum, p50: sorted[pickIdx(0.5)], p90: sorted[pickIdx(0.9)], p99: sorted[pickIdx(0.99)] }
}
```

**Carryover decisions:** D-165 (reservoir Algorithm R adopted vs t-digest deferred V1.x), C2 RESEARCH (Vitter 1985 cited).

---

### `packages/devtools/src/pause-controller.ts` (pauseTopic + queue + critical bypass)

**Analog:** `packages/gateway/src/http/strategies/backpressure-strategy.ts:121-180` (D-75 queue-bounded + critical bypass riferimento esatto)

**Pattern critical bypass (analog `backpressure-strategy.ts:127-133` riga esatta):**
```typescript
// backpressure-strategy.ts:127-133 estratto — pattern carryover F3 D-75 + F5 D-130
// CRITICAL bypass — Pitfall 4 fix.
if (priority === 'critical') {
  return await task()
}
```

**Pattern F6 pause-controller (RESEARCH §10.1):**
```typescript
export function createPauseController(opts: {
  maxQueueSize?: number  // D-170 default 1000
  publishFn: (topic: string, payload: unknown) => void
}): PauseController {
  const cap = opts.maxQueueSize ?? 1000
  const paused = new Map<string, BrokerEvent[]>()

  return {
    pauseTopic(topic) { if (!paused.has(topic)) paused.set(topic, []) },
    resumeTopic(topic) {
      const queue = paused.get(topic)
      if (!queue) return
      paused.delete(topic)
      for (const event of queue) opts.publishFn(event.topic, event.payload)  // replay FIFO
    },
    flushQueue(topic) { /* drop silenzioso + emit system.queue.flushed D-169 */ },
    intercept(event) {
      const queue = paused.get(event.topic)
      if (!queue) return 'pass'
      // D-170 critical bypass — analog backpressure-strategy.ts:131
      if (event.priority === 'critical') return 'pass'
      // D-170 cap + drop-oldest FIFO — analog backpressure-strategy.ts:138-156
      if (queue.length >= cap) {
        const dropped = queue.shift()
        if (dropped) opts.publishFn('system.queue.overflow', { topic: event.topic, droppedEventId: dropped.id })
      }
      queue.push(event)
      return 'queued'
    },
  }
}
```

**Carryover decisions:** D-75 (backpressure strategy F3), D-130 (critical bypass F5 carryover), D-168 (pauseTopic semantica), D-169 (flushQueue), D-170 (cap + critical bypass).

---

### `packages/devtools/src/devtools-broker.ts` (composition wrapper devtools)

**Analog:** `packages/worker/src/worker-broker.ts:1-100` (D-121) + `packages/gateway/src/sse-ws/realtime-broker.ts:1-100` (D-101) — pattern composition Opzione B esatto

**Pattern (riuso 1:1 doc commento worker-broker.ts:1-46):**
```typescript
// devtools-broker.ts — `DevtoolsBroker` composition wrapper di `RouterBroker`
// (Wave 4 plan 06-08 — D-83 strict carryover — F6 vive solo in `packages/devtools/src/`).

import { RouterBroker, type RouterBrokerConfig } from '@sembridge/routing'

export interface DevtoolsBrokerConfig extends RouterBrokerConfig {
  readonly taps?: readonly EventTap[]  // D-159
  readonly devtools?: DevtoolsConfig
}

export class DevtoolsBroker {
  private readonly inner: RouterBroker
  private readonly inspector: EventInspector
  private readonly routeInspector: RouteInspector
  private readonly metrics: MetricsCollector
  private readonly pauseController: PauseController
  private readonly multiplexTap: EventTap

  constructor(config: DevtoolsBrokerConfig) {
    this.inspector = createEventInspector({ bufferSize: config.devtools?.eventBufferSize })
    this.metrics = createMetricsCollector({ histogramSamples: config.devtools?.histogramSamples, maxLabelCombinations: config.devtools?.maxLabelCombinations })
    this.routeInspector = createRouteInspector({ bufferSize: config.devtools?.routeBufferSize })
    this.pauseController = createPauseController({ maxQueueSize: config.devtools?.pauseQueueMaxSize, publishFn: (t, p) => this.inner.publish(t, p) })
    // Auto-wrap F1 single-tap + chain
    const userTaps = config.runtime?.tap ? [...(config.taps ?? []), config.runtime.tap] : (config.taps ?? [])
    this.multiplexTap = createMultiplexTap([this.inspector.tap, this.routeInspector.tap, this.metrics.tap, ...userTaps])
    // Wire al RouterBroker come single tap
    this.inner = new RouterBroker({ ...config, runtime: { ...config.runtime, tap: this.multiplexTap } })
  }

  publish(topic, payload, options) {
    const event = createBrokerEvent({ topic, payload, ...options })
    const action = this.pauseController.intercept(event)
    if (action === 'queued' || action === 'dropped') return
    return this.inner.publish(topic, payload, options)
  }

  enableDebug(): void { this.inspector.enable(); this.routeInspector.enable() }
  disableDebug(): void { this.inspector.disable(); this.routeInspector.disable() }
  pauseTopic(topic: string): void { this.pauseController.pauseTopic(topic) }
  resumeTopic(topic: string): void { this.pauseController.resumeTopic(topic) }
  flushQueue(topic?: string): void { this.pauseController.flushQueue(topic) }
  getDebugSnapshot(): DebugSnapshot { return structuredClone({ /* ... */ }) }  // D-162
  getMetrics(): MetricsSnapshot { return this.metrics.getMetrics() }
}
```

**Carryover decisions:** D-83 STRICT, D-101 (composition F4), D-121 (composition F5), D-159 (multiplex tap), D-160 (enableDebug toggle), D-162 (getDebugSnapshot deep clone).

---

### `packages/sembridge/src/sem-bridge.ts` (createSemBridge factory aggregato Opzione B RESEARCH §11)

**Analog:** chain composition documentata in `packages/worker/src/worker-broker.ts:1-46` (D-121) + Valibot pattern `packages/worker/src/public-factory.ts:147-154`

**Pattern factory aggregato (RESEARCH §11.3):**
```typescript
import { createCacheBroker } from '@sembridge/cache'
import { createDevtoolsBroker } from '@sembridge/devtools'
import { createWorkerBroker } from '@sembridge/worker'
import { createRealtimeBroker } from '@sembridge/gateway/sse-ws'
import { createRouterBroker } from '@sembridge/routing'
import { createMapperBroker } from '@sembridge/mapper'
import { createBroker } from '@sembridge/core'

export function createSemBridge(config: SemBridgeConfig = {}): SemBridge {
  // Default features: tutte enabled (override via config.features)
  const features = config.features ?? { cache: true, devtools: true, worker: true, realtime: true }
  // Chain explicit (Opzione A) — wrappato dal factory aggregato
  let broker: any = createBroker(config)  // F1 base
  broker = createMapperBroker({ ...config, inner: broker })  // F2
  broker = createRouterBroker({ ...config, inner: broker })  // F3
  if (features.realtime) broker = createRealtimeBroker({ ...config, inner: broker })  // F4
  if (features.worker) broker = createWorkerBroker({ ...config, inner: broker })      // F5
  if (features.cache) broker = createCacheBroker({ ...config, inner: broker })        // F6
  if (features.devtools) broker = createDevtoolsBroker({ ...config, inner: broker })  // F6
  return broker
}
```

**Carryover decisions:** D-30 (anti-singleton), D-83 STRICT (chain composition non modifica F1-F5 runtime), D-121 (chain pattern doc esempio).

---

## Shared Patterns

### Authentication / Scope user-aware (D-156, D-157)

**Source:** `packages/worker/src/worker-handler.ts:50-77` (publishFn pattern + DI) + nuovo F6 D-156/157
**Apply to:** `cache-handler.ts`, `composite-handler.ts`, `cache-broker.ts`

**Pattern:**
```typescript
// scopeProvider config-level + route-level override hierarchy (D-156)
// Pattern coerente con timeout/auth hierarchy F3 D-69/D-79
const scope = route.cache?.scope?.(event) ?? deps.scopeProvider?.(event) ?? null
// D-157 missing scope → skip + audit
if (route.auth && scope === null) {
  publishFn('system.cache.scope-missing', { routeId: route.id, topic: event.topic, eventId: event.id })
  return await fallback()  // cold network
}
```

---

### Error Handling — sanitized BrokerError (D-80 carryover)

**Source:** `packages/routing/src/outcome-collector.ts:34-80` (sanitizeError + recursion guard) + `packages/worker/src/worker-handler.ts:36-50` (no originalError leak)
**Apply to:** All handler files (cache-handler.ts, composite-handler.ts, devtools-broker.ts)

**Pattern (analog routing/outcome-collector.ts):**
```typescript
import { createBrokerError } from '@sembridge/core'

const error = createBrokerError({
  code: 'cache.adapter.failure',  // category 'cache' (Claude's Discretion CONTEXT)
  category: 'cache',
  message: 'Cache adapter operation failed',
  routeId: route.id,
  topic: event.topic,
  eventId: event.id,
  details: { phase: 'cache.set' },  // NO originalError, NO stack
})
// publishFn('<topic>.failed', { error })
```

---

### Validation — Valibot safeParse al boundary (D-56 carryover)

**Source:** `packages/worker/src/public-factory.ts:33-95` (Valibot schema strutturato + safeParse + Error throw con prefix `Invalid <X>BrokerConfig:`)
**Apply to:** All public-factory.ts files (cache, devtools, sembridge)

**Pattern:**
```typescript
import * as v from 'valibot'

const ConfigSchema = v.looseObject({ /* ... */ })

export function createXBroker(config = {}): XBroker {
  const parsed = v.safeParse(ConfigSchema, config)
  if (!parsed.success) {
    const messages = parsed.issues.map((i) => i.message).join('; ')
    throw new Error(`Invalid XBrokerConfig: ${messages}`)
  }
  return new XBroker(config)
}
```

---

### TS Declaration Merging — augment.ts pattern S1 anti tree-shake (D-94 carryover)

**Source:** `packages/worker/src/augment.ts:48-125` (declaration merging + `__augmentWorkerLoaded: true` const literal)
**Apply to:** `packages/cache/src/augment.ts`, `packages/devtools/src/augment.ts`

**Pattern:**
```typescript
declare module '@sembridge/core' {
  interface BrokerConfig {
    [F6section]?: F6Config
  }
}
export type F6PipelineStep = '...' | '...'
export const __augment[X]Loaded: true = true  // S1 anti tree-shake

// In src/index.ts:
export { __augment[X]Loaded, type F6PipelineStep } from './augment'
// In package.json: "sideEffects": ["**/augment.ts", "**/augment.js"]
```

---

### Composition wrapper Opzione B (D-83 STRICT carryover F1→F2→F3→F4→F5→F6)

**Source:** `packages/worker/src/worker-broker.ts:1-100` (D-121 F5) + `packages/gateway/src/sse-ws/realtime-broker.ts:1-100` (D-101 F4)
**Apply to:** `cache-broker.ts`, `devtools-broker.ts`, `sem-bridge.ts`

**Pattern:**
```typescript
// 1. Header doc commento esplicito D-83 STRICT
// 2. Constructor: this.inner = new RouterBroker(config)
// 3. publish() override: intercept se topic match, altrimenti delegate inner.publish
// 4. registerPlugin/unregisterPlugin override: cascade D-126 try/catch isolato
// 5. Verifica CI: git diff main packages/{core,mapper,routing,gateway,worker}/src/ → 0 lines
```

---

### Cap + audit emit (D-128 ext F6 carryover)

**Source:** `packages/worker/src/worker-registry.ts:39 + 104-180` (D-128 MAX_POOL_SIZE_HARD = 8 + console.warn) + `packages/gateway/src/http/strategies/backpressure-strategy.ts:138-160` (D-75 cap + drop)
**Apply to:** `metrics-collector.ts` (cardinality cap D-166), `pause-controller.ts` (queue cap D-170), `event-inspector.ts` (buffer cap D-167)

**Pattern uniforme cross-fase:**
```typescript
const cap = opts.maxX ?? DEFAULT_X_CAP
if (currentSize >= cap) {
  // Emit audit (system.X.overflow / system.X.cardinality-overflow / etc)
  emitFn('system.X.overflow', { context, droppedY })
  // drop-oldest o drop-new (decisione per-pattern)
  // critical bypass se applicable (D-130 carryover)
}
```

---

### Ring buffer FIFO + drop-oldest (D-167 carryover)

**Source:** `packages/worker/src/task-tracker.ts:140-220` (Map<key, state> + counter aggregation) + `packages/gateway/src/sse-ws/realtime-channel-manager.ts:90-120` (ChannelEntry registry)
**Apply to:** `event-inspector.ts`, `route-inspector.ts`, `pause-controller.ts`

**Pattern:**
```typescript
state.buffer.push(entry)
if (state.buffer.length > state.bufferSize) state.buffer.shift()  // FIFO drop oldest
// Su disable() o cleanup: state.buffer = []
```

---

### Test 3-tier (D-149/D-150 carryover)

**Source:** `packages/worker/vitest.config.ts` (Tier-1 jsdom) + `packages/worker/vitest.browser.config.ts` (Tier-3 Playwright Chromium) + `packages/worker/src/test-utils/mock-worker.ts` (Tier-1 mock util) + `packages/worker/src/__browser__/` (Tier-3 real timing)
**Apply to:** Tutti i test F6 — Tier-1 (jsdom), Tier-2 (jsdom + msw integration), Tier-3 (Playwright cache-then-network ordering + structuredClone perf)

**Pattern:**
- Tier-1: `*.test.ts` co-located accanto a `*.ts` source (TDD RED→GREEN D-88)
- Tier-2: `__integration__/*.test.ts` con msw + multi-component flow
- Tier-3: `__browser__/*.test.ts` con `vitest.browser.config.ts` + Playwright Chromium real timing
- Test util: `test-utils/mock-clock.ts` (analog `mock-worker.ts` D-150, `mock-event-source.ts` F4 D-118)

---

### Documentation README italiano 11 sezioni (DOC-06 carryover)

**Source:** `packages/worker/README.md` (429 LOC, 11 sezioni italiane: Quick start → Worker contract → Pool → Cancellation → Progress → Serialization WK-07 → Scenario meteo → State machine → Worker module loading → Limitazioni V1 → Q&A PRD §39 #11 closure)
**Apply to:** `packages/cache/README.md`, `packages/devtools/README.md`, `packages/sembridge/README.md`

**Pattern:**
1. Quick start con factory esempio
2. Concetto centrale (cache adapter / tap registry / metrics)
3. Configurazione (config-driven + defaults)
4. Anti-pattern + best practice
5. Scenario meteo end-to-end (consistency con F5 README §7)
6. Edge case + limitazioni V1
7. Q&A PRD §39 #11 closure (per devtools README: PRD §39 #10 closure TOOL-05)

---

## Pattern carryover priority map (riferimento veloce per planner)

| F6 file | Pattern primario carryover | Pattern secondario | D-* |
|---------|---------------------------|---------------------|-----|
| `memory-cache-adapter.ts` | F3 D-74 dedupe Map<key, ...> + cap | NEW Map insertion order LRU (RESEARCH §2.2) | D-158 |
| `stable-hash.ts` | F3 D-74 KeyBased dedupe-strategy.ts:65-90 | FNV-1a inline (RESEARCH §3.2) | D-155 |
| `cache-handler.ts` | F5 worker-handler.ts Strategy F3 dispatch | F3 route-executor.ts switch | D-77, D-152, D-156 |
| `composite-handler.ts` | F3 composite-handler.ts:67-130 factory + closure flag | F5 D-83 strict | D-77, D-83 |
| `cache-broker.ts` | F5 worker-broker.ts:1-100 composition Opzione B | F4 realtime-broker.ts:1-100 | D-83, D-121 |
| `public-factory.ts` (cache) | F5 worker public-factory.ts:147-157 + Valibot | F4 sse-ws public-factory.ts:30-78 | D-30, D-56 |
| `multiplex-tap.ts` | F1 bus.ts safeTapStep:79-110 try/catch swallow | F3 outcome-collector.ts:75-90 inline | D-20, D-159 |
| `event-inspector.ts` | F5 task-tracker.ts:46-220 state Map + bounded | F4 realtime-channel-manager.ts:90-120 | D-160, D-162, D-167 |
| `route-inspector.ts` | F5 task-tracker.ts state machine | F3 outcome-collector.ts step 10 | D-167, D-161 |
| `metrics-collector.ts` | F5 worker-pool.ts counter atomic | F5 task-tracker.ts Map<key,state> | D-163, D-164, D-128 ext |
| `reservoir-sampling.ts` | NEW (Vitter 1985 cited C2) | F4 reconnect-strategy jitter | D-165 |
| `cardinality-cap.ts` | F5 worker-registry.ts:39 D-128 cap+console.warn | F4 reconnect-strategy cap | D-166, D-128 ext |
| `pause-controller.ts` | F3 backpressure-strategy.ts:127-160 D-75 cap+critical | F5 D-130 critical bypass | D-75, D-130, D-168, D-169, D-170 |
| `devtools-broker.ts` | F5 worker-broker.ts composition Opzione B | F4 realtime-broker.ts | D-83, D-101, D-121, D-159 |
| `sem-bridge.ts` | NEW chain composition aggregato (RESEARCH §11.3) | F1-F6 factory pattern | D-30, D-83 |
| `augment.ts` (cache + devtools) | F5 worker/augment.ts:48-125 declaration merging + S1 | F2 D-57, F3 D-94 | D-94, D-159 |
| `README.md` (cache + devtools + sembridge) | F5 worker/README.md 11 sezioni 429 LOC | F4 gateway/README.md 579 LOC | DOC-02, DOC-05, DOC-06 |

---

## No Analog Found

| F6 file | Ruolo | Data Flow | Reason |
|---------|-------|-----------|--------|
| `packages/devtools/src/reservoir-sampling.ts` | algorithm pure (Vitter 1985) | sampling | Algoritmo standard ben definito (~30 LOC), nessun analog F1-F5. Citation C2 RESEARCH §8.2. Math.random() consumer pattern coerente con F4 reconnect-strategy jitter. |
| `packages/devtools/src/__browser__/structuredclone-perf.test.ts` | browser perf test (deep clone benchmark) | test | Pattern Tier-3 Playwright F4/F5 carryover, ma scenario `structuredClone` perf su payload 500 entries è specifico F6 (no analog test in F1-F5 testa structuredClone direttamente). RESEARCH §15.3. |

Per entrambi: planner usa direttamente RESEARCH.md §8.2 (reservoir) e §15.3 (perf benchmark) come fonte pattern.

---

## Lesson learned cross-fase (carryover esplicito)

### Lesson #1 — size-limit pre-implementation underestimate 20-30%
**Source:** F3 03-14 commit `9922a36` (routing 19.15/24 KB raised post-impl), F4 04-09 (gateway/sse-ws raised post-impl), F5 05-07 (worker raised post-impl).
**Apply to F6:** Pre-implementation estimate `@sembridge/cache` 5-8 KB, `@sembridge/devtools` 8-12 KB, `@sembridge/sembridge` 50-80 KB. Calibrare post-impl in plan 06-09 a `measured + 20% headroom`. Pattern explicit nel plan 06-09 ROADMAP lesson learned.

### Lesson #2 — D-83 STRICT verification meccanico
**Source:** F3 03-14, F4 04-09, F5 05-07 (zero modifiche runtime upstream verificato CI).
**Apply to F6:** `git diff main...HEAD packages/{core,mapper,routing,gateway,worker}/src/` deve essere exit 0 lines per TUTTA F6. CI gate ogni plan F6 (06-01..06-09) include questa verifica.

### Lesson #3 — File ownership disgiunta entro wave
**Source:** F3 14 wave, F4 9 wave, F5 7 wave (zero merge conflict git index in agent-swarm).
**Apply to F6:** 9 plan / 5 wave — Wave 2 `06-02 ∥ 06-04` (file ownership disgiunta cache/* vs devtools/*), Wave 3 `06-05 ∥ 06-06 ∥ 06-07` (file disjoint within `packages/devtools/src/`). RESEARCH §17.2 mappatura esplicita.

### Lesson #4 — augment.ts pattern S1 anti tree-shake
**Source:** F2/F3/F4/F5 augment.ts uniformemente con `__augmentXLoaded: true` const literal + `package.json sideEffects: ["**/augment.ts", "**/augment.js"]` glob.
**Apply to F6:** Replica meccanica per cache + devtools augment.ts. Audit `grep "__augmentCacheLoaded\|__augmentDevtoolsLoaded" dist/` exit 0.

### Lesson #5 — TDD RED→GREEN co-located
**Source:** F1 D-88, F3 D-88, F4 D-117, F5 D-149 (pattern test `*.test.ts` accanto a `*.ts`).
**Apply to F6:** Tutti i 14 unit test F6 (RESEARCH §13.1) co-located accanto al file source. Tier-2 in `__integration__/`, Tier-3 in `__browser__/`.

### Lesson #6 — Coverage v8 raise floor post-impl
**Source:** F3 D-92 (≥90% statements/functions/lines, ≥80% branches), F4 D-92 ext, F5 D-92 ext.
**Apply to F6:** Plan 06-09 final gate calibra threshold v8 a measured ≥90/80/90/90 (non ≥95 per evitare flaky regressioni).

### Lesson #7 — Composition wrapper Opzione B doc commento esplicito
**Source:** F5 worker-broker.ts:1-46 + F4 realtime-broker.ts:1-46 (header commento spiega esplicitamente perché Opzione B preserva D-83 STRICT).
**Apply to F6:** cache-broker.ts e devtools-broker.ts replica meccanica del header commento (mention esplicito a `git diff main packages/{core,mapper,routing,gateway,worker}/src/` zero).

### Lesson #8 — Valibot looseObject per pass-through F1-F5 sections
**Source:** F4 sse-ws public-factory.ts:60-78 + F5 worker public-factory.ts:72-95 (sezioni upstream pass-through con `v.optional(v.unknown())`).
**Apply to F6:** cache + devtools + sembridge public-factory.ts replica pattern — validate strict solo F6 sezioni own (cache/devtools/taps), pass-through tutto upstream.

### Lesson #9 — README italiano 11 sezioni
**Source:** F5 worker/README.md 429 LOC + F4 gateway/README.md 579 LOC (struttura 11 sezioni: quick start → contract → policies → cancellation → progress → serialization → scenario meteo → state machine → loading → limits V1 → Q&A PRD §39 #X closure).
**Apply to F6:** Replica meccanica per cache (cache adapter contract + LRU + TTL + scope + invalidate + scenario meteo cache-then-network), devtools (tap registry + Inspector + Metrics + pauseTopic + Q&A PRD §39 #10 closure TOOL-05), sembridge (createSemBridge aggregato + DOC-02 plugin integration + DOC-05 esempi end-to-end + scenario meteo F1+F2+F3+F4+F5+F6).

### Lesson #10 — DOC consolidation TypeDoc finale
**Source:** F5 05-07 (TypeDoc + plugin markdown installati workspace, attivati F6 final gate).
**Apply to F6:** Plan 06-09 attiva `typedoc@0.28.19 + typedoc-plugin-markdown@4.11.0` per `docs/api/` auto-generato. CHANGELOG `.changeset/v1-0-0-release.md` major bump 7 package (milestone v1.0).

---

## Metadata

**Analog search scope:**
- `packages/core/src/` — bus.ts, broker.ts, types/tap.ts, types/config.ts (EventTap pre-instrumented F1, BrokerConfig.runtime.tap single-tap)
- `packages/mapper/src/` — augment.ts pattern (D-57)
- `packages/routing/src/` — route-executor.ts (D-65 dispatch table), route-handlers/cache-handler.ts (stub D-77), route-handlers/composite-handler.ts (factory + closure flag), outcome-collector.ts (step 10 capture, sanitize), augment.ts, public-factory.ts
- `packages/gateway/src/http/` — dedupe-strategy.ts (D-74 KeyBased), backpressure-strategy.ts (D-75 cap+critical bypass)
- `packages/gateway/src/sse-ws/` — realtime-broker.ts (D-101 composition), realtime-channel-manager.ts (registry pattern), augment.ts, public-factory.ts (Valibot schema F4)
- `packages/worker/src/` — worker-broker.ts (D-121 composition exatto), worker-handler.ts (Strategy DI), worker-pool.ts (counter atomic + cap), worker-registry.ts (D-128 cap pool 8 + audit), task-tracker.ts (state machine atomico Pitfall 2C closure), augment.ts (D-122 pattern + F5PipelineStep), public-factory.ts (D-30 + Valibot), test-utils/mock-worker.ts (D-150 Tier-1)
- `packages/sembridge/` — package.json + README.md (placeholder F1)
- `packages/cache/` + `packages/devtools/` — package.json + README.md (placeholder F1, src/ vuoto)

**Files scanned:** ~38 file F6 to create + ~25 file analog F1-F5 letti per estrazione pattern excerpts.

**Pattern extraction date:** 2026-05-05.

**Confidence overall:** HIGH — 36/38 file con analog 1:1 esatto carryover F1-F5 (5 fasi consolidate 5 volte D-49→D-83→D-101→D-121→D-83 ext F6); 2 file con NEW pattern documentato in RESEARCH.md (`reservoir-sampling.ts` Vitter 1985 cited C2; `structuredclone-perf.test.ts` benchmark scenario F6-specifico).

---

*Phase: 06-cache-tooling-avanzato*
*Pattern mapping: 2026-05-05*
*Pronto per: `/gsd-plan-phase 6` (planner consumerà questo PATTERNS.md insieme a 06-CONTEXT.md + 06-RESEARCH.md per produrre 9 PLAN.md F6 con per-file pattern assignment + analog code excerpt + D-* citation per ogni action).*
