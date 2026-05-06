# GlueZero

**Connect frontend modules without glue code.**

GlueZero is a **browser-side orchestration runtime** for modular frontend applications.

It connects components, plugins, backend APIs, realtime events, cache and Web Workers through **declarative events**, **canonical data mapping** and a **single observable gateway**.

> Not a framework.  
> Not a state manager.  
> Not just an event emitter.  
> **A frontend integration runtime for modular browser applications.**

---

## Why GlueZero exists

Modern frontend applications are no longer just trees of UI components.

They are becoming ecosystems made of:

- independent components;
- third-party plugins;
- dashboard widgets;
- backend APIs;
- realtime channels;
- cache layers;
- background workers;
- low-code modules;
- micro-frontend fragments;
- customer-specific customizations.

As this ecosystem grows, integration becomes the real problem.

Without a governed integration layer, teams usually end up with:

- components calling each other directly;
- `fetch()` calls scattered across the UI;
- custom adapters between every pair of modules;
- duplicated retry, timeout and error logic;
- plugin field names that do not match;
- worker logic handled as isolated hacks;
- realtime events managed ad hoc;
- no clear way to inspect what happened when data moved across the app.

GlueZero introduces a controlled event layer inside the browser.

Components and plugins declare what they publish and consume. GlueZero handles routing, canonical mapping, server communication, worker delegation, cache policies, validation and observability.

---

## The core idea

Traditional frontend integration often looks like this:

```text
Component A ───▶ Component B ───▶ fetch('/api/...')
     │                │
     ▼                ▼
Component C ───▶ Custom Adapter ───▶ Worker Logic
     │
     ▼
Inconsistent field names
```

GlueZero turns that into a governed event flow:

```text
Component / Plugin
        │
        ▼
   publish(topic, payload)
        │
        ▼
┌───────────────────────────────┐
│           GlueZero             │
│                               │
│  Event Broker                  │
│  Canonical Mapper              │
│  Routing Engine                │
│  Server Gateway                │
│  Worker Runtime                │
│  Cache Layer                   │
│  Event Inspector               │
└───────────────────────────────┘
        │
        ├──▶ Local subscribers
        ├──▶ Backend APIs
        ├──▶ Realtime events
        ├──▶ Web Workers
        └──▶ Cache
```

The difference is not more abstraction.

**The difference is controlled integration.**

---

## Value proposition

GlueZero helps teams build frontend ecosystems where modules can collaborate without being tightly coupled.

It is designed for applications where:

- many components need to exchange data;
- plugins are developed by different authors;
- field names and payload shapes are not always aligned;
- backend communication must be centralized and observable;
- heavy work must be moved away from the main thread;
- every integration flow must be traceable and debuggable.

### One-line promise

**From glue code to governed flows.**

### Longer promise

GlueZero reduces the cost of frontend integration by turning component communication, backend calls, semantic payload translation, worker execution and debugging into explicit, declarative and observable runtime behavior.

---

## What GlueZero is

GlueZero is a JavaScript/TypeScript browser-side runtime that provides:

- a local event broker;
- topic-based publish/subscribe;
- declarative routing;
- canonical data mapping;
- bidirectional local/canonical payload translation;
- a single server gateway for HTTP and realtime inbound events;
- Web Worker routing for heavy tasks;
- cache-aware flows;
- validation hooks;
- retry, timeout, deduplication and backpressure policies;
- lifecycle-safe subscription cleanup;
- event, mapping and route inspection.

---

## What GlueZero is not

GlueZero is not intended to replace your UI framework.

It does not replace:

- React;
- Vue;
- Svelte;
- Angular;
- Solid;
- Qwik.

It also does not try to be a classic state manager.

GlueZero can live alongside Redux, Zustand, Jotai, Pinia, RxJS, React Query, TanStack Query or your existing application architecture.

Its role is different:

> GlueZero coordinates integration flows between modules, plugins, APIs, workers, cache and realtime events.

---

## Core concepts

### Event Broker

A local pub/sub runtime where modules communicate through semantic topics instead of direct references.

```ts
broker.publish('weather.requested', {
  città: 'Roma',
  data: '30/04/2026'
})
```

A subscriber does not need to know who published the event.

```ts
broker.subscribe('weather.loaded', (payload) => {
  renderWeather(payload)
})
```

---

### Declarative Routing

Routes define what should happen when a topic is published.

A topic can be routed to:

- local subscribers;
- an HTTP endpoint;
- a realtime channel;
- a Web Worker;
- cache;
- a composite flow.

Example:

```ts
broker.registerRoute({
  id: 'weather-http',
  on: 'weather.requested',
  type: 'http',
  request: {
    method: 'GET',
    url: '/api/weather',
    queryMap: {
      location: 'location',
      forecast_date: 'date'
    }
  },
  publishes: {
    success: 'weather.loaded',
    error: 'weather.failed'
  }
})
```

The component does not contain the server call.

The route does.

---

### Canonical Data Mapping

This is one of the key differentiators of GlueZero.

In modular applications, different plugins often use different names for the same concept.

One plugin may emit:

```json
{
  "città": "Roma",
  "data": "30/04/2026"
}
```

Another plugin may expect:

```json
{
  "location": "Roma",
  "day-prevision": "2026-04-30"
}
```

Traditionally, you would write custom glue code between those two plugins.

With GlueZero, each plugin maps its own local fields to a canonical model.

```json
{
  "location": "Roma",
  "forecast_date": "2026-04-30"
}
```

Then GlueZero can remap the canonical payload to the consumer plugin shape.

**Map once. Interoperate everywhere.**

---

### Server Gateway

GlueZero centralizes frontend/server communication.

Instead of scattering calls like this:

```ts
fetch('/api/customers')
fetch('/api/customer-stats')
fetch('/api/customer-save')
```

inside different components, modules publish semantic topics:

```text
customer.list.requested
customer.stats.requested
customer.save.requested
```

Routes decide how to call the backend, how to map request parameters, how to normalize responses and which success or error event to publish.

This centralizes:

- authentication headers;
- retry policies;
- timeout policies;
- response mapping;
- error handling;
- request deduplication;
- logging;
- observability.

---

### Worker Runtime

Heavy frontend work should not freeze the UI.

GlueZero can route selected topics to Web Workers.

```text
report.generation.requested
        ↓
worker route
        ↓
report.generation.progress
        ↓
report.generation.completed
```

Useful for:

- large JSON/CSV/XML parsing;
- dataset transformation;
- deduplication;
- aggregations;
- report generation;
- canonical normalization;
- CPU-heavy preprocessing.

Worker tasks remain part of the same event lifecycle, instead of becoming isolated custom code.

---

### Observability

GlueZero is designed to make integration flows inspectable.

A full event trace can show:

- original topic;
- publisher;
- original local payload;
- canonical payload;
- mapping rules applied;
- route activated;
- server request or worker task;
- response payload;
- final consumer payload;
- subscribers reached;
- errors;
- warnings;
- timings.

The goal is simple:

**Debug the flow, not just the component.**

---

## Before / After examples

### 1. Plugin field mismatch

#### Traditional approach

Plugin A emits:

```json
{
  "città": "Roma",
  "data": "30/04/2026"
}
```

Plugin B expects:

```json
{
  "location": "Roma",
  "day-prevision": "2026-04-30"
}
```

You write a custom adapter between A and B.

Then Plugin C arrives.

Then Plugin D arrives.

The number of adapters grows with every new integration.

#### GlueZero approach

Each plugin maps once to the canonical model.

```ts
broker.registerPlugin({
  id: 'weather-form',
  name: 'Weather Form',
  version: '1.0.0',
  publishes: [{ topic: 'weather.requested' }],
  outputMap: {
    città: { to: 'location', transform: 'normalizeLocationName' },
    data: { to: 'forecast_date', transform: 'parseItalianDate' }
  }
})
```

Consumers receive the shape they expect through their own input map.

Result:

```text
Plugin A local payload
        ↓
Canonical model
        ↓
Plugin B local payload
```

No pairwise glue code.

---

### 2. Scattered server calls

#### Traditional approach

Every component owns its own server calls.

```text
CustomerTable   ───▶ fetch('/api/customers')
CustomerChart   ───▶ fetch('/api/customers/stats')
CustomerForm    ───▶ fetch('/api/customers/save')
```

Over time, each component handles auth, retry, timeout and errors slightly differently.

#### GlueZero approach

Components publish events.

```text
customer.list.requested
customer.stats.requested
customer.save.requested
```

GlueZero routes those events through a central gateway.

```text
topic → route → HTTP request → response map → success/error topic
```

The network lifecycle becomes explicit and inspectable.

---

### 3. Debugging broken data flows

#### Traditional approach

A value appears wrong in a widget.

To understand why, you inspect:

- the component that emitted the action;
- the component that received the props;
- the custom hook;
- the fetch call;
- the response transformation;
- the cache;
- the worker;
- the rendering component.

Debugging becomes reverse engineering.

#### GlueZero approach

The inspector shows the event lifecycle:

```text
publisher
  → output mapping
  → canonical payload
  → route
  → server/worker/cache
  → response mapping
  → subscriber delivery
```

You inspect the flow directly.

---

### 4. Heavy processing on the main thread

#### Traditional approach

A component loads a large CSV and parses it directly.

The UI freezes.

Later, a developer creates a custom worker implementation that is hard to reuse.

#### GlueZero approach

The component publishes:

```text
file.parse.requested
```

A worker route handles the task.

```text
file.parse.requested
        ↓
worker task
        ↓
file.parse.progress
        ↓
file.parse.completed
```

The processing is offloaded, but the flow remains part of the same runtime.

---

## Example: weather plugin flow

### 1. Create the broker

```ts
const broker = createBroker({
  debug: true,
  canonicalModel: {
    fields: {
      location: {
        type: 'string',
        aliases: ['city', 'città', 'place']
      },
      forecast_date: {
        type: 'date',
        aliases: ['date', 'data', 'day-prevision']
      },
      temperature_celsius: {
        type: 'number',
        aliases: ['temp', 'temperature']
      },
      weather_condition: {
        type: 'string',
        aliases: ['condition', 'status']
      }
    }
  },
  transforms: {
    parseItalianDate,
    normalizeLocationName
  }
})
```

### 2. Register an HTTP route

```ts
broker.registerRoute({
  id: 'weather-http',
  on: 'weather.requested',
  type: 'http',
  request: {
    method: 'GET',
    url: '/api/weather',
    queryMap: {
      location: 'location',
      forecast_date: 'date'
    }
  },
  publishes: {
    success: 'weather.loaded',
    error: 'weather.failed'
  }
})
```

### 3. Register a publisher plugin

```ts
broker.registerPlugin({
  id: 'weather-form',
  name: 'Weather Form',
  version: '1.0.0',
  publishes: [{ topic: 'weather.requested' }],
  outputMap: {
    città: {
      to: 'location',
      transform: 'normalizeLocationName'
    },
    data: {
      to: 'forecast_date',
      transform: 'parseItalianDate'
    }
  }
})
```

### 4. Register a consumer plugin

```ts
broker.registerPlugin({
  id: 'weather-widget',
  name: 'Weather Widget',
  version: '1.0.0',
  subscribes: [{ topic: 'weather.loaded' }],
  inputMap: {
    location: 'location',
    'day-prevision': 'forecast_date',
    temperature: 'temperature_celsius',
    status: 'weather_condition'
  },
  handlers: {
    'weather.loaded': (payload) => renderWeather(payload)
  }
})
```

### 5. Publish an event

```ts
broker.publish('weather.requested', {
  città: 'Roma',
  data: '30/04/2026'
})
```

### 6. Event lifecycle

```text
Plugin emits local payload
        ↓
GlueZero maps to canonical payload
        ↓
HTTP route calls backend
        ↓
Server response is normalized
        ↓
GlueZero remaps for consumer plugin
        ↓
Weather widget receives expected payload
```

---

## API preview

> API names may evolve while the project is under active development.

```ts
const broker = createBroker(config)

broker.publish(topic, payload, options?)
broker.subscribe(topic, handler, options?)
broker.unsubscribe(subscriptionId)

broker.registerPlugin(pluginDescriptor)
broker.unregisterPlugin(pluginId)

broker.registerRoute(routeDefinition)
broker.unregisterRoute(routeId)

broker.registerCanonicalSchema(schemaDefinition)
broker.registerTransform(name, fn)

broker.connectRealtime()
broker.disconnectRealtime()

broker.getDebugSnapshot()
broker.getMetrics()
```

---

## Architecture overview

```text
Browser Runtime
│
├── Core Broker
│   ├── Event Bus
│   ├── Topic Registry
│   ├── Subscriber Registry
│   └── Event Lifecycle Manager
│
├── Routing Engine
│   ├── Local Route Handler
│   ├── HTTP Route Handler
│   ├── Realtime Inbound Handler
│   ├── Worker Route Handler
│   ├── Cache Route Handler
│   └── Composite Route Handler
│
├── Canonical Model & Mapping Engine
│   ├── Canonical Vocabulary Registry
│   ├── Alias Registry
│   ├── Plugin Field Maps
│   ├── Transformation Pipeline
│   └── Validation Layer
│
├── Server Gateway
│   ├── Fetch Client
│   ├── SSE Client
│   ├── WebSocket Client
│   └── Auth / Retry / Timeout Policies
│
├── Worker Runtime
│   ├── Worker Registry
│   ├── Worker Pool
│   ├── Message Bridge
│   └── Worker Task Tracking
│
├── State / Cache Layer
│   ├── In-memory Cache
│   ├── Optional IndexedDB Adapter
│   └── Invalidation / Revalidation
│
└── Developer Tooling
    ├── Event Inspector
    ├── Mapping Inspector
    ├── Route Inspector
    ├── Metrics
    └── Error Diagnostics
```

---

## When to use GlueZero

GlueZero is useful when your frontend has become an integration surface.

Use it when you are building:

- modular SaaS dashboards;
- ERP or CRM frontends;
- plugin-based applications;
- low-code or no-code builders;
- micro-frontend platforms;
- complex admin panels;
- frontend architectures with multiple backend APIs;
- applications with realtime events and background processing;
- systems where third-party modules must interoperate.

---

## When not to use GlueZero

You may not need GlueZero if:

- your app is small;
- your components are simple and tightly controlled;
- you do not have plugin interoperability problems;
- you do not need canonical data mapping;
- you do not need route-driven server communication;
- your existing state/data-fetching solution already fully covers your integration needs.

GlueZero is designed for frontend complexity that has crossed the boundary from “component state” to “application ecosystem”.

---

## Comparison with common tools

| Tool / Pattern | Great for | Does not solve alone | Where GlueZero fits |
|---|---|---|---|
| Redux | Predictable global state management | Canonical mapping, route-driven gateway, worker routing, plugin contracts | Coordinates integration flows; Redux can still manage UI state |
| RxJS | Reactive streams and async composition | Plugin registry, canonical model, server gateway, mapping inspector | Provides a higher-level integration contract around event flows |
| React Query / TanStack Query | Server state, caching and request lifecycle | Cross-plugin event routing, canonical payload translation, worker orchestration | Coordinates frontend ecosystem flows beyond data fetching |
| EventEmitter | Simple pub/sub | Routing, validation, mapping, retry, workers, cache, realtime, observability | Pub/sub evolved into governed frontend orchestration |
| Custom hooks/services | App-specific abstractions | Long-term consistency across teams and plugin authors | Turns integration into explicit runtime configuration |

Use existing tools for rendering and state.

Use GlueZero when your real problem is integration.

---

## Design principles

### 1. Components should not know each other

A component should declare what it publishes and what it consumes.

It should not need direct knowledge of the module that will react to its event.

### 2. Server communication should be route-driven

Network calls should not be scattered across the UI.

They should be declared, governed and inspectable.

### 3. Plugin interoperability should not require identical naming

Third-party plugins should not be forced to share the same local vocabulary.

They should map into a canonical model.

### 4. Heavy work should not block the UI

Expensive tasks should be routable to workers without escaping the event architecture.

### 5. Every integration flow should be observable

If data moves, transforms, routes, fails or reaches a subscriber, developers should be able to inspect what happened.

---

## Project status

GlueZero **v1.0 milestone is closed** (2026-05-05). All 6 phases of the PRD §32 roadmap are complete and verified, with 91/91 v1 requirements implemented and 10/11 PRD §39 open issues closed (the remaining one is intentionally deferred to V1.x as a cross-phase pipeline ordering opt-in).

The implementation lives in 8 published packages under the `@gluezero/*` npm scope:

| Package | Phase | Role |
|---------|-------|------|
| [`@gluezero/core`](./packages/core/README.md) | 1 | Pub/sub broker, plugin registry, EventTap pre-instrumentation |
| [`@gluezero/mapper`](./packages/mapper/README.md) | 2 | Canonical model + bidirectional mapper + Mapping Inspector |
| [`@gluezero/routing`](./packages/routing/README.md) | 3 | Declarative routing engine, route resolver, policy chain |
| [`@gluezero/gateway`](./packages/gateway/README.md) | 3 + 4 | HTTP gateway with auth/retry/timeout + SSE/WS realtime adapters |
| [`@gluezero/worker`](./packages/worker/README.md) | 5 | Worker runtime, registry, pool, cancellation, task tracking |
| [`@gluezero/cache`](./packages/cache/README.md) | 6 | LRU memory cache adapter, 3 strategies, scope hybrid |
| [`@gluezero/devtools`](./packages/devtools/README.md) | 6 | Event/Mapping/Route Inspector, MetricsCollector, PauseController |
| [`@gluezero/gluezero`](./packages/gluezero/README.md) | aggregate | `createGlueZero()` factory composing F1+F2+F3+F4+F5+F6 |

CI gates passing on the full monorepo: typecheck 8/8, build 8/8, publint 8/8, attw ESM-only 8/8, size-limit 8/8, biome zero errors, **1165/1168 tests pass** (3 skipped, MSW V1.x deferred).

---

## Roadmap

### v1.0 — completed (2026-05-05)

All six phases of the original PRD §32 roadmap are implemented and verified.

- **Phase 1 — Core broker** (`@gluezero/core`): publish/subscribe/unsubscribe, segmented TopicTrie wildcard matching, plugin registry with cascade `unregisterPlugin` (LIFE-02), EventTap pre-instrumentation, deep-freeze runtime, BrokerError + sanitized error shape
- **Phase 2 — Canonical model and mapper** (`@gluezero/mapper`): canonical schema registry, alias registry (global + scoped), pluggable Valibot validation, bidirectional mapper engine, mapping cycle detection at register-time, MappingInspector (no-op V1, full snapshot in F6)
- **Phase 3 — Routing and HTTP gateway** (`@gluezero/routing`, `@gluezero/gateway`): declarative route registry, 6 route types (`local`/`http`/`realtime-inbound`/`worker`/`cache`/`composite`), Strategy chain (timeout/retry/backoff/dedupe/auth/idempotency/URL allowlist/concurrency/circuit-breaker/backpressure), success/error event publication
- **Phase 4 — Realtime inbound** (`@gluezero/gateway/sse-ws`): SSE adapter (`EventSource`) + WebSocket adapter (envelope JSON), auto-fallback SSE→WS with cycle cap (D-107/D-108), visibility-aware behavior, application-level ping/pong, reconnect policy with exponential backoff
- **Phase 5 — Worker runtime** (`@gluezero/worker`): worker registry, bounded worker pool, Comlink RPC bridge, hybrid cancellation (`AbortSignal` proxied), `assertSerializable` deep-walk, transferable opt-in via JSONPath, progress events, ESM module loading
- **Phase 6 — Cache and advanced observability** (`@gluezero/cache`, `@gluezero/devtools`): LRU bounded `MemoryCacheAdapter`, scope hybrid 3-layer (D-156), 3 strategies (cache-first/network-first/cache-then-network), Event/Mapping/Route Inspector, `MetricsCollector` (simil-OpenMetrics + reservoir Algorithm R + cardinality cap), `PauseController`, full pipeline §28 14-step

See [`.planning/ROADMAP.md`](./.planning/ROADMAP.md) for success criteria per phase and [`DECISIONS.md`](./DECISIONS.md) for the 170 architectural decisions across the 6 phases.

### V1.x — deferred opt-ins

These are intentional deferrals tracked in [`REQUIREMENTS.md`](./.planning/REQUIREMENTS.md), to be reopened when real-world consumers emerge:

- **PIPE-01** (PRD §39 #11) — cross-phase pipeline mapping/validation ordering opt-in
- **MSW 2.5+** integration tests — 3 `describe.skip` in `@gluezero/gateway/sse-ws` waiting for `ws.link` jsdom + EventSource fetch-based polyfill
- **IndexedDB cache adapter** — current default is `MemoryCacheAdapter`; the `CacheAdapter` interface already supports swap-in
- **Custom validator adapters** (Zod, Ajv) — `ValidatorAdapter` contract is no-throw discriminated-union; default is Valibot
- **Extended browser test tier** (Playwright across `@gluezero/cache`, `@gluezero/devtools`, etc.) — `test:browser` script slot already wired

---

## Installation

```bash
pnpm add @gluezero/gluezero
```

or:

```bash
npm install @gluezero/gluezero
```

or:

```bash
yarn add @gluezero/gluezero
```

The aggregate package re-exports the factory `createGlueZero` and the configuration types you need to compose the full chain. You can also depend only on the sub-packages you need (e.g. just `@gluezero/core` + `@gluezero/mapper` for a no-network setup).

```ts
import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  debug: true,
  // ...config
})
```

See the [`@gluezero/gluezero` README](./packages/gluezero/README.md) and [`EXAMPLES.md`](./packages/gluezero/EXAMPLES.md) for the end-to-end weather scenario covering all 6 features (broker → mapper → routing → realtime → worker → cache).

---

## Minimal usage example

```ts
import { createBroker } from 'gluezero'

const broker = createBroker({
  debug: true,
  canonicalModel: {
    fields: {
      customer_id: {
        type: 'string',
        aliases: ['customerId', 'clientId', 'cliente_id']
      },
      customer_name: {
        type: 'string',
        aliases: ['customerName', 'clientName', 'nome_cliente']
      }
    }
  }
})

broker.subscribe('customer.selected', (payload) => {
  console.log('Customer selected:', payload)
})

broker.publish('customer.selected', {
  cliente_id: 'C-001',
  nome_cliente: 'ACME S.p.A.'
})
```

With canonical mapping enabled, the payload can be normalized before delivery or routing.

---

## License

This project is intended to be released as open source.

License details will be defined in the repository.

Recommended options:

- MIT;
- Apache-2.0.

---

## Contributing

Contributions are welcome. Before opening a PR, please:

1. Read [`prd.md`](./prd.md) — it is the single authoritative source for v1 design choices and is referenced explicitly in every per-package README.
2. Read [`CLAUDE.md`](./CLAUDE.md) for operational conventions (italian for docs/commits, english for code, the 6-phase composition wrapper boundary D-83 strict carryover, etc.).
3. Pick an existing decision from [`DECISIONS.md`](./DECISIONS.md) before introducing a competing pattern — most "obvious" extensions have already been considered and rationalized.
4. Run `pnpm typecheck && pnpm test && pnpm build` locally; all 8 packages must pass with zero regressions.

Areas where contributions are especially welcome:

- additional **`CacheAdapter`** implementations (IndexedDB, sessionStorage)
- additional **`ValidatorAdapter`** implementations (Zod, Ajv)
- alternative **`WorkerBridge`** implementations (RPC custom for niche use-cases)
- framework integrations (React hooks, Vue composables, Svelte stores, Solid signals)
- examples and tutorials covering specific verticals (CRM, low-code, micro-frontend)
- TypeDoc → docs site automation (workflow scaffolding present, deploy not yet wired)

---

## Documentation

### For users of the library

- [`@gluezero/gluezero/README.md`](./packages/gluezero/README.md) — aggregate factory `createGlueZero` and chain composition order
- [`@gluezero/gluezero/EXAMPLES.md`](./packages/gluezero/EXAMPLES.md) — 10 cross-feature consolidated examples + full weather scenario F1+F2+F3+F4+F5+F6
- Per-package READMEs (italian, with Q&A and runnable code): [core](./packages/core/README.md) · [mapper](./packages/mapper/README.md) · [routing](./packages/routing/README.md) · [gateway](./packages/gateway/README.md) · [worker](./packages/worker/README.md) · [cache](./packages/cache/README.md) · [devtools](./packages/devtools/README.md)

### For contributors and architecture-curious readers

- [`prd.md`](./prd.md) — **authoritative PRD** (single source of truth for the v1 design)
- [`DECISIONS.md`](./DECISIONS.md) — navigable index of all 170 architectural decisions `D-01..D-170` across the 6 phases, with cross-links to PRD sections, REQ-IDs and source CONTEXT files
- [`.planning/REQUIREMENTS.md`](./.planning/REQUIREMENTS.md) — 91 v1 requirements mapped to phases and decisions
- [`.planning/ROADMAP.md`](./.planning/ROADMAP.md) — 6-phase implementation roadmap with success criteria
- [`.planning/research/`](./.planning/research/) — pre-implementation research: STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY
- [`CLAUDE.md`](./CLAUDE.md) — operational constraints, conventions, boundaries (relevant for AI-assisted contribution)

### PRD concepts index

The PRD §1-§30 introduces the conceptual model; the implementation interprets it through the decision index above. The most load-bearing concepts to start from:

| Concept | PRD § | Implementation entry-point | Decisions |
|---------|-------|---------------------------|-----------|
| `BrokerEvent` | §10 | [`@gluezero/core`](./packages/core/README.md) | D-01..D-07 (delivery semantics, deep-freeze) |
| Wildcard pattern matching | §12.3 | [`@gluezero/core`](./packages/core/README.md) | D-08..D-10 (TopicTrie segmented) |
| Plugin lifecycle + cascade `unregisterPlugin` (LIFE-02) | §11 | All packages | D-26 (cascade) extended to F2-F6 (D-86, D-126) |
| Canonical Model + Mapper (alias resolution) | §13.5, §15-§16 | [`@gluezero/mapper`](./packages/mapper/README.md) | D-31..D-58 |
| Routing & Policy chain | §17, §22-§23 | [`@gluezero/routing`](./packages/routing/README.md), [`@gluezero/gateway`](./packages/gateway/README.md) | D-60..D-100 |
| Realtime SSE/WS (auto-fallback) | §18, §31.3 | [`@gluezero/gateway`](./packages/gateway/README.md) | D-104..D-120 |
| Worker runtime + serialization | §19-§20 | [`@gluezero/worker`](./packages/worker/README.md) | D-121..D-154 (D-83 strict carryover) |
| Cache scope hybrid + 3 strategies | §21 | [`@gluezero/cache`](./packages/cache/README.md) | D-155..D-158 |
| Devtools, Inspector, Metrics | §27 | [`@gluezero/devtools`](./packages/devtools/README.md) | D-159..D-170 |
| Pipeline §28 14-step | §28 | Cross-phase | D-161 (step 14 `event.observed`) |
| PRD §39 open issues closure | §39 | All phases | 10/11 closed v1.0; 1 deferred V1.x (PIPE-01) |

For the complete list of decisions per phase with one-line summaries, see [`DECISIONS.md`](./DECISIONS.md).

---

## Final note

GlueZero is built around one architectural belief:

> Frontend applications are becoming ecosystems. Ecosystems need contracts, routing, translation and observability.

GlueZero provides that layer inside the browser.

**Connect modules. Map meaning. Observe flows.**

