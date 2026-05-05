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

GlueZero is currently in early design / implementation phase.

The architectural direction is defined around:

- event broker;
- declarative routing;
- canonical model;
- semantic mapper;
- server gateway;
- worker runtime;
- observability tooling.

The initial implementation roadmap should prioritize:

1. core pub/sub;
2. topic registry;
3. plugin registry;
4. canonical model and mapper;
5. route engine;
6. HTTP gateway;
7. realtime inbound;
8. worker runtime;
9. cache layer;
10. debug tooling.

---

## Roadmap

### Phase 1 — Core broker

- publish / subscribe / unsubscribe;
- topic registry;
- event metadata;
- basic logging;
- lifecycle cleanup.

### Phase 2 — Canonical model and mapper

- canonical vocabulary registry;
- plugin input/output maps;
- aliases;
- transforms;
- mapping inspector.

### Phase 3 — Routing and server gateway

- route registry;
- HTTP routes;
- success/error event publication;
- retry;
- timeout;
- error handling.

### Phase 4 — Realtime inbound

- SSE adapter;
- optional WebSocket adapter;
- reconnect policy;
- server message normalization.

### Phase 5 — Worker runtime

- worker registry;
- worker route handler;
- task correlation;
- progress events;
- worker error propagation.

### Phase 6 — Cache and advanced observability

- in-memory cache;
- cache policies;
- route inspector;
- metrics;
- debug snapshot;
- optional browser devtool integration.

---

## Installation

> Package name and installation command will be finalized when the first public package is released.

Expected installation:

```bash
npm install gluezero
```

or:

```bash
yarn add gluezero
```

or:

```bash
pnpm add gluezero
```

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

Contributions will be welcome once the initial implementation is published.

Areas where help will be especially valuable:

- TypeScript API design;
- mapping engine;
- validation layer;
- route engine;
- worker runtime;
- debug tooling;
- examples;
- documentation;
- framework adapters.

---

## Final note

GlueZero is built around one architectural belief:

> Frontend applications are becoming ecosystems. Ecosystems need contracts, routing, translation and observability.

GlueZero provides that layer inside the browser.

**Connect modules. Map meaning. Observe flows.**

