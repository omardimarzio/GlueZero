# GlueZero Examples — End-to-end cross-package

> Esempi consolidati italiano per tutte le 6 fasi PRD. Ogni esempio è completo (consumer-side + config + subscribe + publish) e direttamente eseguibile con `pnpm install @gluezero/gluezero`.

## Indice

1. [Hello World pub/sub (F1 base)](#1-hello-world-pubsub-f1-base)
2. [Mapping canonical (F2 scenario meteo)](#2-mapping-canonical-f2-scenario-meteo)
3. [HTTP route + retry/timeout (F3 weather-fetch)](#3-http-route--retrytimeout-f3-weather-fetch)
4. [Realtime SSE inbound (F4)](#4-realtime-sse-inbound-f4)
5. [Worker offload report generation (F5)](#5-worker-offload-report-generation-f5)
6. [Cache-then-network UI flicker control (F6)](#6-cache-then-network-ui-flicker-control-f6)
7. [Inspector + Metrics dashboard data (F6)](#7-inspector--metrics-dashboard-data-f6)
8. [pauseTopic admin flow (F6)](#8-pausetopic-admin-flow-f6)
9. [Multi-tenant scope (D-156)](#9-multi-tenant-scope-d-156)
10. [Cross-feature integrato F1+F2+F3+F4+F5+F6 (scenario meteo full chain)](#10-cross-feature-integrato-f1f2f3f4f5f6-scenario-meteo-full-chain)

---

## 1. Hello World pub/sub (F1 base)

```ts
import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  features: {
    realtime: false,
    worker: false,
    cache: false,
    devtools: false,
  },
})

broker.subscribe('greeting.hello', (event) => {
  console.log(`Ciao, ${(event.payload as { name: string }).name}!`)
})

await broker.publish('greeting.hello', { name: 'Mondo' })
// → "Ciao, Mondo!"
```

## 2. Mapping canonical (F2 scenario meteo)

```ts
import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  features: { realtime: false, worker: false, cache: false, devtools: false },
  canonicalModel: {
    'weather.canonical': {
      fields: {
        location: { type: 'string', required: true },
        temperatureCelsius: { type: 'number', required: true },
        condition: { type: 'string' },
      },
    },
  },
  aliasRegistry: {
    'weather.canonical': {
      // Plugin A invia "city" + "temp_c" — auto-aliased a "location" + "temperatureCelsius"
      city: 'location',
      temp_c: 'temperatureCelsius',
    },
  },
})

broker.subscribe('weather.loaded', (event) => {
  // Il consumer riceve la canonical shape:
  const canonical = event.payload as {
    location: string
    temperatureCelsius: number
  }
  console.log(`${canonical.location}: ${canonical.temperatureCelsius}°C`)
})

await broker.publish('weather.loaded', {
  city: 'Roma', // → mappato a 'location'
  temp_c: 22, // → mappato a 'temperatureCelsius'
})
```

## 3. HTTP route + retry/timeout (F3 weather-fetch)

```ts
import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  features: { realtime: false, worker: false, cache: false, devtools: false },
  routes: [
    {
      type: 'http',
      id: 'weather-http',
      topic: 'weather.requested',
      method: 'GET',
      url: ({ payload }) => `/api/weather?city=${(payload as { city: string }).city}`,
      mapResponse: 'weather.canonical',
      policies: {
        timeout: { ms: 5000 },
        retry: { maxAttempts: 3, backoff: 'exponential', baseMs: 200 },
        dedupe: 'key-based',
      },
    },
  ],
  gateway: {
    baseUrl: 'https://api.example.com',
    allowlist: ['https://api.example.com/api/'],
  },
})

broker.subscribe('weather.loaded', (e) => console.log(e.payload))
broker.subscribe('weather.failed', (e) => console.error('Fetch failed:', e.payload))

await broker.publish('weather.requested', { city: 'Roma' })
// → HTTP GET /api/weather?city=Roma con retry 3 attempts su 5xx + dedupe key-based
```

## 4. Realtime SSE inbound (F4)

```ts
import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  features: { worker: false, cache: false, devtools: false },
  realtime: {
    channels: [
      {
        name: 'notifications-stream',
        type: 'sse',
        url: 'https://api.example.com/notifications/stream',
        eventTypes: ['notification.new', 'notification.read'],
      },
    ],
  },
})

broker.subscribe('notification.new', (event) => {
  console.log('Nuova notifica:', event.payload)
})

// Il broker apre automaticamente la connessione SSE al primo subscribe
// (lazy init D-110). Reconnect con full jitter + auto-fallback SSE→WS (D-107).
```

## 5. Worker offload report generation (F5)

```ts
import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  features: { realtime: false, cache: false, devtools: false },
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

await broker.registerPlugin({
  id: 'reports-plugin',
  workers: [
    {
      id: 'report-worker',
      factory: () =>
        new Worker(new URL('./report.worker.ts', import.meta.url), { type: 'module' }),
      tasks: ['generateReport'] as const,
      mode: 'pool' as const,
      size: 2,
    },
  ],
})

broker.subscribe('report.generation.progress', (e) =>
  updateProgressBar((e.payload as { value: number }).value),
)
broker.subscribe('report.generation.completed', (e) => showReport(e.payload))
broker.subscribe('report.generation.failed', (e) => showError(e.payload))

await broker.publish('report.generation.requested', { period: '2026-Q1' })
```

## 6. Cache-then-network UI flicker control (F6)

```ts
import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  features: { realtime: false, worker: false, devtools: false },
  cache: { maxEntries: 500 },
  cacheRoutes: [
    {
      type: 'cache',
      id: 'weather-cache',
      topic: 'weather.requested',
      strategy: 'cache-then-network',
      ttl: 5 * 60_000,
    },
  ],
  routes: [
    {
      type: 'http',
      id: 'weather-http',
      topic: 'weather.requested',
      method: 'GET',
      url: ({ payload }) => `/api/weather?city=${(payload as { city: string }).city}`,
    },
  ],
  gateway: {
    baseUrl: 'https://api.example.com',
    allowlist: ['https://api.example.com/api/'],
  },
})

broker.subscribe('weather.loaded', (event) => {
  const origin = event.metadata?.origin // 'cache' | 'remote'
  const replaces = event.metadata?.replaces

  if (origin === 'cache') {
    renderInstant(event.payload) // istantaneo, da cache
  } else if (origin === 'remote' && replaces) {
    replaceWeather(replaces, event.payload) // refresh background
  } else {
    renderInstant(event.payload) // primo load
  }
})

await broker.publish('weather.requested', { city: 'Roma' })
// 1° call: MISS → fetch + render
// 2° call entro 5min: HIT (microtask) + fetch background + replace
```

## 7. Inspector + Metrics dashboard data (F6)

```ts
import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  features: { realtime: false, worker: false },
  cache: { maxEntries: 500 },
  devtools: {
    enableByDefault: true,
    eventBufferSize: 1000,
    histogramSamples: 2048,
  },
  cacheRoutes: [
    {
      type: 'cache',
      id: 'weather',
      topic: 'weather.requested',
      strategy: 'cache-first',
      ttl: 60_000,
    },
  ],
})

await broker.publish('weather.requested', { city: 'Roma' })
await broker.publish('weather.requested', { city: 'Milano' })
await broker.publish('weather.requested', { city: 'Napoli' })

const snap = (broker as { getDebugSnapshot: () => unknown }).getDebugSnapshot()
console.table(
  (snap as { recentRoutes: Array<Record<string, unknown>> }).recentRoutes.map((r) => ({
    eventId: String(r.eventId).slice(0, 8),
    routeId: r.routeId,
    outcome: r.outcome,
    duration: `${r.durationMs}ms`,
    cacheHit: r.cacheHit ?? '—',
  })),
)
console.log('Counters:', (snap as { currentMetrics: { counters: unknown } }).currentMetrics.counters)
```

## 8. pauseTopic admin flow (F6)

```ts
import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  features: { realtime: false, worker: false, cache: false },
  devtools: { enableByDefault: true, pauseQueueMaxSize: 1000 },
})

broker.subscribe('chat.message', (e) => renderChatMessage(e.payload))

// Admin scenario: maintenance mode
;(broker as { pauseTopic: (t: string) => void }).pauseTopic('chat.message')

// Eventi accodati FIFO (cap 1000 + drop-oldest se overflow):
await broker.publish('chat.message', { text: 'Ciao' })
await broker.publish('chat.message', { text: 'Come va?' })
await broker.publish('chat.message', { text: 'Bene' })

// Maintenance done → replay FIFO:
;(broker as { resumeTopic: (t: string) => void }).resumeTopic('chat.message')
// → renderChatMessage chiamato 3 volte nell'ordine di publish

// Alternative: scarta accodati invece di replay (es. dopo logout):
;(broker as { pauseTopic: (t: string) => void }).pauseTopic('chat.message')
await broker.publish('chat.message', { text: 'Stale' })
;(broker as { flushQueue: (t?: string) => unknown }).flushQueue('chat.message')
// → drop silenzioso + emit 'system.queue.flushed' audit (NO replay)
```

## 9. Multi-tenant scope (D-156)

```ts
import { createGlueZero } from '@gluezero/gluezero'

// Pattern: una istanza per tenant — D-30 anti-singleton:
function brokerForTenant(tenantId: string) {
  return createGlueZero({
    cache: {
      maxEntries: 200,
      scopeProvider: () => tenantId, // tutti i cache key prefix `<tenantId>::`
    },
    cacheRoutes: [
      {
        type: 'cache',
        id: 'config',
        topic: 'config.requested',
        strategy: 'cache-first',
        ttl: 60 * 60_000,
        auth: true, // → D-157 fail-secure se scope=null
      },
    ],
  })
}

const brokerAcme = brokerForTenant('acme')
const brokerInitech = brokerForTenant('initech')

// Cache isolata per tenant:
await brokerAcme.publish('config.requested', { key: 'theme' })
await brokerInitech.publish('config.requested', { key: 'theme' })
// → 2 cache key distinte: 'acme::config.requested::<hash>' e 'initech::config.requested::<hash>'
// → no cross-tenant leakage (T-06-08a-02 mitigation D-156 scope hybrid)
```

## 10. Cross-feature integrato F1+F2+F3+F4+F5+F6 (scenario meteo full chain)

```ts
import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  // F2 canonical
  canonicalModel: {
    'weather.canonical': {
      fields: {
        location: { type: 'string', required: true },
        temperatureCelsius: { type: 'number', required: true },
      },
    },
  },
  // F3 routing HTTP
  routes: [
    {
      type: 'http',
      id: 'weather-http',
      topic: 'weather.requested',
      method: 'GET',
      url: ({ payload }) => `/api/weather?city=${(payload as { city: string }).city}`,
      mapResponse: 'weather.canonical',
      policies: {
        timeout: { ms: 5000 },
        retry: { maxAttempts: 3, backoff: 'exponential', baseMs: 200 },
        dedupe: 'key-based',
      },
    },
  ],
  // F4 realtime SSE
  realtime: {
    channels: [
      {
        name: 'weather-stream',
        type: 'sse',
        url: 'https://api.example.com/weather/stream',
        eventTypes: ['weather.update'],
      },
    ],
  },
  // F5 worker
  workerRoutes: [
    {
      type: 'worker',
      id: 'forecast-route',
      topic: 'weather.forecast.requested',
      worker: 'forecast-worker',
      task: 'computeForecast',
      policies: { timeout: 10_000, concurrency: 'latest-only' },
    },
  ],
  // F6 cache
  cache: {
    maxEntries: 1000,
    scopeProvider: (event) => (event.payload as { tenantId?: string })?.tenantId ?? null,
  },
  cacheRoutes: [
    {
      type: 'cache',
      id: 'weather-cache',
      topic: 'weather.requested',
      strategy: 'cache-then-network',
      ttl: 5 * 60_000,
    },
  ],
  // F6 devtools
  devtools: {
    enableByDefault: true,
    eventBufferSize: 1000,
  },
  // F3 gateway
  gateway: {
    baseUrl: 'https://api.example.com',
    allowlist: ['https://api.example.com/api/'],
  },
})

// Plugin form (F1 lifecycle):
await broker.registerPlugin({
  id: 'weather-form',
  subscriptions: [
    {
      topic: 'user.search.submitted',
      handler: (event) => {
        const { city, tenantId } = event.payload as { city: string; tenantId: string }
        broker.publish('weather.requested', { city, tenantId })
      },
    },
  ],
})

// Plugin widget (F1+F2+F3+F6):
await broker.registerPlugin({
  id: 'weather-widget',
  subscriptions: [
    {
      topic: 'weather.loaded',
      handler: (event) => {
        const origin = event.metadata?.origin
        const replaces = event.metadata?.replaces
        if (origin === 'cache') renderInstant(event.payload)
        else if (origin === 'remote' && replaces) replaceWeather(replaces, event.payload)
        else renderInstant(event.payload)
      },
    },
    {
      topic: 'weather.update', // F4 SSE inbound
      handler: (event) => updateWeatherLive(event.payload),
    },
  ],
})

// Plugin forecast worker (F5):
await broker.registerPlugin({
  id: 'forecast-plugin',
  workers: [
    {
      id: 'forecast-worker',
      factory: () =>
        new Worker(new URL('./forecast.worker.ts', import.meta.url), { type: 'module' }),
      tasks: ['computeForecast'] as const,
      mode: 'pool' as const,
      size: 2,
    },
  ],
})

// Trigger user flow:
await broker.publish('user.search.submitted', {
  tenantId: 'acme',
  city: 'Roma',
})

// Pipeline:
// 1. F1 broker: 'user.search.submitted' → 'weather.requested' (via plugin form)
// 2. F6 cache intercept: cache-then-network → microtask cache HIT (origin: 'cache')
// 3. F3 routing HTTP: GET /api/weather?city=Roma → mapper canonical (F2)
// 4. F1 broker: 'weather.loaded' (origin: 'remote', replaces: <eventId>)
// 5. F4 SSE: server push → 'weather.update' inbound canonicalizzato
// 6. F5 worker (parallelo): 'weather.forecast.requested' → pool dispatch
// 7. F6 devtools: tutti gli step §28 catturati in EventInspector + RouteInspector
// 8. F6 metrics: counter gluezero.cache.hits_total incrementato

// Debug live:
const snap = (broker as { getDebugSnapshot?: () => unknown }).getDebugSnapshot?.()
console.log('Pipeline trace:', snap)

// Logout user → cascade atomico TUTTE le risorse F1+F2+F3+F4+F5+F6:
await broker.unregisterPlugin('weather-form')
await broker.unregisterPlugin('weather-widget')
await broker.unregisterPlugin('forecast-plugin')
```

---

## Helper functions usate negli esempi

```ts
// UI rendering helpers (consumer-side, non parte di GlueZero):
declare function renderInstant(payload: unknown): void
declare function replaceWeather(eventId: string, payload: unknown): void
declare function updateWeatherLive(payload: unknown): void
declare function renderChatMessage(payload: unknown): void
declare function updateProgressBar(value: number): void
declare function showReport(payload: unknown): void
declare function showError(payload: unknown): void
```

## Riferimenti

- [`DECISIONS.md`](../../DECISIONS.md) — 170 decisioni architetturali con riferimenti a sezioni di design
- [`@gluezero/gluezero` README.md](./README.md)
- Sub-pacchetti README (per dettagli per-fase): F1 [`core`](../core/README.md) / F2 [`mapper`](../mapper/README.md) / F3 [`routing`](../routing/README.md) / F4 [`gateway`](../gateway/README.md) / F5 [`worker`](../worker/README.md) / F6 [`cache`](../cache/README.md) + [`devtools`](../devtools/README.md)

*Phase 6 closure date: 2026-05-05. Milestone v1.0 chiusa.*
