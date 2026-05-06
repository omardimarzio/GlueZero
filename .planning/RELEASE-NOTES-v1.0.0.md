# GlueZero v1.0.0 — Milestone Release

**The frontend integration runtime for modular browser applications.**

> Connect modules. Map meaning. Observe flows.

This is the first public major release of GlueZero — a TypeScript-first, browser-side library that combines six capabilities into one cohesive runtime: in-page pub/sub broker, declarative routing, single observable HTTP gateway, SSE/WebSocket realtime, Web Worker delegation, canonical data mapping, and developer tooling.

## Highlights

- **8 packages published** under `@gluezero/*` scope — opt into the parts you need
- **6 PRD phases complete** (Core → Mapper → Routing → Realtime → Worker → Cache/Tooling)
- **91 / 91 v1 requirements** implemented and verified
- **10 / 11 PRD §39 open issues closed** (1 deferred to V1.x as opt-in)
- **170 architectural decisions** indexed in [`DECISIONS.md`](./DECISIONS.md)
- **ESM-only**, TypeScript declarations included, evergreen browser target (ES2022)
- **Zero unnecessary deps**: only `nanoid`, `valibot`, `comlink` (worker)
- **1165 / 1168 tests pass** across the 8 packages (3 deferred to V1.x for MSW 2.5+ ws.link)

## Install

```bash
pnpm add @gluezero/gluezero
```

```ts
import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  debug: true,
  canonicalModel: { /* ... */ },
})

broker.registerPlugin({ /* ... */ })
broker.registerRoute({ /* ... */ })
broker.publish('weather.requested', { città: 'Roma', data: '30/04/2026' })
```

See the full weather scenario across all 6 features in [`packages/gluezero/EXAMPLES.md`](./packages/gluezero/EXAMPLES.md).

## Packages

| Package | Phase | Role | Bundle (gz) |
|---------|-------|------|-------------|
| [`@gluezero/core`](./packages/core/README.md) | 1 | Pub/sub broker, plugin registry, EventTap | ~6 KB |
| [`@gluezero/mapper`](./packages/mapper/README.md) | 2 | Canonical model + bidirectional mapper + Inspector | ~12 KB |
| [`@gluezero/routing`](./packages/routing/README.md) | 3 | Declarative routing engine + policy chain | ~19 KB |
| [`@gluezero/gateway`](./packages/gateway/README.md) | 3 + 4 | HTTP gateway + SSE/WS realtime adapters | ~6 KB (HTTP) |
| [`@gluezero/worker`](./packages/worker/README.md) | 5 | Worker runtime, registry, pool, cancellation | ~26 KB |
| [`@gluezero/cache`](./packages/cache/README.md) | 6 | LRU adapter + 3 strategies + scope hybrid | ~22 KB |
| [`@gluezero/devtools`](./packages/devtools/README.md) | 6 | Inspector, MetricsCollector, PauseController | ~22 KB |
| [`@gluezero/gluezero`](./packages/gluezero/README.md) | aggregate | `createGlueZero()` chain composition | ~35 KB |

## What's in the box

### Phase 1 — Core broker (`@gluezero/core`)

`publish` / `subscribe` / `unsubscribe`, segmented `TopicTrie` wildcard matching (`weather.*` matches `weather.alert.requested`), `BrokerEvent` with metadata, deep-freeze runtime in dev, pluggable lifecycle (`onMount`/`onUnmount`), `unregisterPlugin` cascade (PRD §39 #7 LIFE-02 closed), `EventTap` pre-instrumentation for the §28 14-step pipeline.

### Phase 2 — Canonical model & mapper (`@gluezero/mapper`)

Canonical schema registry, alias registry (global + plugin-scoped), `MapperEngine` with bidirectional `inputMap` / `outputMap` per plugin, cycle detection at `registerPlugin` time (not at publish), `ValidatorAdapter` (Valibot default, Zod/Ajv pluggable), `TransformPipeline` with `block` / `skip` / `fallback` policy. Closes PRD §39 #1, #3, #4.

### Phase 3 — Routing & HTTP gateway (`@gluezero/routing` + `@gluezero/gateway`)

Six route types (`local` / `http` / `realtime-inbound` / `worker` / `cache` / `composite`), pre-compiled route resolver, declarative policy chain: `timeout` / `retry` / `backoff` / `dedupe` / `cache` / `concurrency` / `auth` / `idempotency` / `URL allowlist` / `circuit-breaker` / `backpressure`. Bearer auth + single-flight refresh, idempotency auto-key on POST/PATCH/PUT/DELETE, sanitized error shape on `<topic>.failed`. Closes PRD §39 #5, #6, #2 (RETRY 4xx vs 5xx), #4 (route-resolution).

### Phase 4 — Realtime inbound (`@gluezero/gateway/sse-ws`)

`SseAdapter` (native `EventSource`) + `WebSocketAdapter` (envelope JSON), auto-fallback SSE→WS with cycle cap, visibility-aware reconnection (Page Visibility API), application-level ping/pong with stale watchdog, full-jitter backoff with anti-flap consolidation, `Last-Event-ID` for SSE replay. Closes PRD §39 #8 (RT-07).

### Phase 5 — Worker runtime (`@gluezero/worker`)

Worker registry + bounded pool (`min(hardwareConcurrency, 4)`, hard cap 8), `WorkerBridge` Comlink RPC wrapper, hybrid cancellation (dedicated → `terminate`, pool → cooperative `AbortSignal` proxied), `assertSerializable` deep-walk in dev mode (throws **before** `postMessage` with field path), transferable opt-in via JSON-path-like array, `progress` events with throttled latest-only delivery, atomic state machine (Pitfall 2C closure: late responses silently discarded post-timeout). Closes PRD §39 #9 (WK-07).

### Phase 6 — Cache & advanced observability (`@gluezero/cache` + `@gluezero/devtools`)

`MemoryCacheAdapter` LRU bounded (`maxEntries: 1000` default, TTL orthogonal to LRU), three strategies (`cache-first` / `network-first` / `cache-then-network` with microtask ordering), scope hybrid 3-layer (config-level `scopeProvider` + route-level `scope` override + missing-scope fail-secure), `EventInspector` + `RouteInspector` ring buffer 500 (deep-cloned via `structuredClone`), `MetricsCollector` simil-OpenMetrics (`{counters, gauges, histograms}` with reservoir Algorithm R Vitter 1985 + cardinality cap 100 + Prometheus dot.case naming), `MultiplexTap` chain with per-tap error isolation, `PauseController` (`pauseTopic` / `resumeTopic` / `flushQueue` with critical-priority bypass). Closes PRD §39 #10 (TOOL-05).

## Open issues PRD §39 — final state

| # | Issue | Status |
|---|-------|--------|
| 1 | Precedenza alias automatici vs mapping esplicito | ✅ closed (F2) |
| 2 | Field mancante: errore o default | ✅ closed (F2) |
| 3 | Transform failure: skip o block | ✅ closed (F2) |
| 4 | Topic senza route | ✅ closed (F3) |
| 5 | Più route applicabili | ✅ closed (F3) |
| 6 | Retry 4xx vs 5xx | ✅ closed (F3) |
| 7 | Unsubscribe automatico in unregister plugin | ✅ closed (F1) |
| 8 | Reconnection rules realtime | ✅ closed (F4) |
| 9 | Serializzazione messaggi worker | ✅ closed (F5) |
| 10 | Format metriche | ✅ closed (F6) |
| 11 | Ordine pipeline mapping/validation cross-fase | ⏸️ deferred V1.x (opt-in) |

## Breaking changes

None. v0.x was pre-release with no public consumers.

## V1.x roadmap (deferred opt-ins)

- `@gluezero/cache-idb` — IndexedDB persistence adapter
- `@gluezero/metrics-prometheus` / `@gluezero/metrics-otel` — exporters
- `superjson` adapter for worker serialization
- Custom histogram bucketing per route
- Anti-flap pause/resume debounce
- Worker retry policy (idempotent opt-in)
- Cross-phase pipeline ordering canonical doc (PRD §39 #11)

## Documentation

- [README](./README.md) — overview, value proposition, comparison with Redux/RxJS/React Query
- [`prd.md`](./prd.md) — authoritative product requirements document
- [`DECISIONS.md`](./DECISIONS.md) — 170 architectural decisions, navigable index
- [`packages/gluezero/EXAMPLES.md`](./packages/gluezero/EXAMPLES.md) — 10 cross-feature consolidated examples
- Per-package READMEs (italiano, with Q&A and runnable code) — see "Documentation" section in root README

## Acknowledgements

Built with deep AI-assisted development using Claude Opus 4.7. The full design rationale, decision log, and verification artifacts live under [`.planning/`](./.planning/) for transparency.

---

**License:** MIT — see [LICENSE](./LICENSE).
**Repository:** https://github.com/omardimarzio/GlueZero
**Issues / Discussions:** GitHub
