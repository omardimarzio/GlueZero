# @gluezero/gluezero

> Pacchetto aggregato pubblico GlueZero — milestone v1.0.0 closure (chain composition F1+F2+F3+F4+F5+F6 + features opt-out + scenario meteo end-to-end cross-feature).

ESM-only TypeScript library. Browser evergreen target (ES2022). Factory aggregato `createGlueZero(config)` (RESEARCH §11.3 Opzione B convenience) che orchestra l'intera chain GlueZero in un singolo entry-point. Ogni call ritorna un broker con il superset di API attive in funzione di `config.features` (default: tutte le feature enabled).

Sette dipendenze runtime (i sub-pacchetti GlueZero): [`@gluezero/core`](../core/README.md) (F1), [`@gluezero/mapper`](../mapper/README.md) (F2), [`@gluezero/routing`](../routing/README.md) (F3), [`@gluezero/gateway`](../gateway/README.md) (F3 HTTP + F4 SSE/WS sub-modulo), [`@gluezero/worker`](../worker/README.md) (F5), [`@gluezero/cache`](../cache/README.md) (F6), [`@gluezero/devtools`](../devtools/README.md) (F6) + [`valibot`](https://valibot.dev) (config validation).

## Indice

1. [Quick start (createGlueZero chain completa)](#1-quick-start-creategluezero-chain-completa)
2. [Power-user chain explicit (Opzione A)](#2-power-user-chain-explicit-opzione-a)
3. [Features flag — opt-out cache/devtools/worker/realtime](#3-features-flag--opt-out-cachedevtoolsworkerrealtime)
4. [Chain composition F1+F2+F3+F4+F5+F6](#4-chain-composition-f1f2f3f4f5f6)
5. [Plugin lifecycle + cascade LIFE-02](#5-plugin-lifecycle--cascade-life-02)
6. [Scenario meteo end-to-end F1+F2+F3+F4+F5+F6](#6-scenario-meteo-end-to-end-f1f2f3f4f5f6)
7. [Tree-shake selective import](#7-tree-shake-selective-import)
8. [Versioning v1.0 milestone closure](#8-versioning-v10-milestone-closure)
9. [Migration guide (V1 → V1.x roadmap)](#9-migration-guide-v1--v1x-roadmap)
10. [Limitazioni V1 + roadmap V1.x](#10-limitazioni-v1--roadmap-v1x)
11. [Q&A](#11-qa)

---

## 1. Quick start (createGlueZero chain completa)

`createGlueZero(config)` è il **single entry-point** raccomandato per la stragrande maggioranza dei consumer. Restituisce un broker pronto all'uso con TUTTE le feature attive di default (F1 broker pub/sub + F2 mapper canonical + F3 routing/HTTP + F4 realtime SSE/WS + F5 worker runtime + F6 cache + F6 devtools).

```ts
import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  cache: { maxEntries: 500 },
  devtools: { enableByDefault: true },
  routes: [
    {
      type: 'http',
      id: 'weather-http',
      topic: 'weather.requested',
      method: 'GET',
      url: ({ payload }) => `/api/weather?city=${(payload as { city: string }).city}`,
    },
  ],
  cacheRoutes: [
    {
      type: 'cache',
      id: 'weather-cache',
      topic: 'weather.requested',
      strategy: 'cache-then-network',
      ttl: 60_000,
    },
  ],
  gateway: {
    baseUrl: 'https://api.example.com',
    allowlist: ['https://api.example.com/api/'],
  },
})

broker.subscribe('weather.loaded', (event) => {
  console.log('Origin:', event.metadata?.origin) // 'cache' o 'remote'
  console.log('Payload:', event.payload)
})

await broker.publish('weather.requested', { city: 'Roma' })
```

`createGlueZero` è una **pure function** (D-30 anti-singleton) — ogni call ritorna istanza indipendente. La validazione `GlueZeroConfigSchema` Valibot avviene al boot: errori schema → `Error` nativo con prefix `Invalid GlueZeroConfig:`.

## 2. Power-user chain explicit (Opzione A)

Per consumer che richiedono controllo esplicito sulla chain (multi-tenant + lazy-init + DI test), si possono usare i factory dei sub-pacchetti direttamente. RESEARCH §11.1 documenta Opzione A — composizione manuale outermost → innermost:

```ts
// Opzione A — chain manuale esplicita (controllo totale)
import { createBroker } from '@gluezero/core'
import { createMapperBroker } from '@gluezero/mapper'
import { createRouterBroker } from '@gluezero/routing'
import { createRealtimeBroker } from '@gluezero/gateway/sse-ws'
import { createWorkerBroker } from '@gluezero/worker'
import { createCacheBroker } from '@gluezero/cache'
import { createDevtoolsBroker } from '@gluezero/devtools'

// Step-wise composition — il consumer controlla ogni layer:
const f1 = createBroker({ debug: { enabled: true } })
// ... wiring custom ...

// Equivalente moralmente a createGlueZero — ma con possibilità di skip layer:
const router = createRouterBroker({ ...config })
// (createRouterBroker include implicitamente F1+F2 via composition interna)
```

V1 mantiene l'astrazione che ogni `createXxxBroker` di F4/F5/F6 estende `RouterBroker` (F3) via composition Opzione B. La researcher §11.3 documenta la roadmap V1.x per chain letterale multi-wrapper (es. `Devtools(Cache(Worker(Realtime(Router(...)))))`).

## 3. Features flag — opt-out cache/devtools/worker/realtime

Per SPA che non usano realtime o worker, `createGlueZero` espone `config.features` per selective opt-out:

```ts
import { createGlueZero } from '@gluezero/gluezero'

// SPA non realtime, no worker → minimal F1+F2+F3+F6 cache+devtools
const broker = createGlueZero({
  features: {
    realtime: false,
    worker: false,
    cache: true,
    devtools: true,
  },
  cache: { maxEntries: 100 },
  devtools: { enableByDefault: false },
})

// SPA dashboard read-only — solo broker pub/sub + routing + cache
const minimal = createGlueZero({
  features: {
    realtime: false,
    worker: false,
    cache: true,
    devtools: false,
  },
})

// Bare minimum F1+F2+F3 (uguale a createRouterBroker direct)
const bare = createGlueZero({
  features: {
    realtime: false,
    worker: false,
    cache: false,
    devtools: false,
  },
})
```

Il bundle è già ESM tree-shakable (vedi sez. 7) — i sub-pacchetti non usati vengono **comunque** importati staticamente da `sem-bridge.ts` (i bundler moderni Rollup/Vite/esbuild riconoscono branch dead-code via constant fold se `features` è statico). Per garantire tree-shake aggressivo su micro-bundle, vedi sezione 7.

## 4. Chain composition F1+F2+F3+F4+F5+F6

**Order chain (OUTERMOST → INNERMOST)**: `createGlueZero` ritorna il wrapper più esterno in funzione di `features`. La gerarchia di precedenza è:

```
createGlueZero
  → createDevtoolsBroker (F6)     [if features.devtools]   ← OUTERMOST
  → createCacheBroker (F6)        [if features.cache]
  → createWorkerBroker (F5)       [if features.worker]
  → createRealtimeBroker (F4)     [if features.realtime]
  → createRouterBroker (F3)
    → createMapperBroker (F2)     [implicit via routing]
    → createBroker (F1)           [implicit via routing/mapper]   ← INNERMOST
```

**Topology rationale (RESEARCH §11.3):** ogni wrapper F4/F5/F6 estende `RouterBroker` (F3) via composition Opzione B. La chain qui istanzia il wrapper più esterno (devtools) passandogli il config completo — quel wrapper costruisce internamente la propria istanza di `RouterBroker(config)`. I wrapper "intermedi" (realtime/worker/cache) NON sono effettivamente compositi uno sull'altro in V1: sono ortogonali (l'utente sceglie un entry-point in funzione delle feature).

**BLOCKER-2 fix critico**: la chain include OBBLIGATORIAMENTE `createWorkerBroker` + `createRealtimeBroker` quando `features` li abilita (default: tutte enabled). Type union completa:

```ts
export type GlueZero =
  | ReturnType<typeof createBroker>
  | ReturnType<typeof createMapperBroker>
  | ReturnType<typeof createRouterBroker>
  | ReturnType<typeof createRealtimeBroker>
  | ReturnType<typeof createWorkerBroker>
  | ReturnType<typeof createCacheBroker>
  | ReturnType<typeof createDevtoolsBroker>
```

Il consumer riceve l'union — narrowing avviene tramite type guard runtime (es. `if ('connectRealtime' in broker)`).

## 5. Plugin lifecycle + cascade LIFE-02

**`registerPlugin(descriptor)`** — registra un plugin con id, subscriptions, routes, workers, channels. Ogni risorsa è marcata internamente con `ownerId = pluginId` (D-86 cascade ownership).

**`unregisterPlugin(id)`** — cascade cleanup multi-step (LIFE-02 ext F1+F3+F4+F5+F6, idempotente con try/catch isolato per step):

1. **F1**: rimozione subscription + topic registry orphan
2. **F2**: cascade canonical schema/aliasRegistry/transforms (D-58)
3. **F3**: cascade routes + httpGateway abort in-flight by ownerId (D-86)
4. **F4**: `realtimeManager.disconnectByOwner(ownerId)` — chiude SSE/WS channels (D-112)
5. **F5**: `workerPool.terminateByOwner(ownerId)` + `registry.unregisterByOwner(ownerId)` — terminate worker + bridge teardown (D-126)
6. **F6 cache**: `adapter.invalidate({ prefix: '<ownerId>::' })` — convention scope hybrid (D-126 ext F6)
7. **F6 devtools**: 1-step (Inspector + Metrics + PauseController NON hanno per-owner state in V1)

```ts
const broker = createGlueZero({})

await broker.registerPlugin({
  id: 'weather-widget',
  subscriptions: [
    { topic: 'weather.loaded', handler: (e) => renderWeather(e.payload) },
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
})

// Logout user → cleanup atomico tutte le risorse del plugin:
await broker.unregisterPlugin('weather-widget')
```

## 6. Scenario meteo end-to-end F1+F2+F3+F4+F5+F6

PRD §29 esteso a tutte le feature: widget meteo + plugin form input + plugin worker forecasting + cache layer + Inspector full-on. Cross-feature integrato.

```ts
import { createGlueZero } from '@gluezero/gluezero'

const broker = createGlueZero({
  cache: {
    maxEntries: 1000,
    scopeProvider: (event) => (event.payload as { tenantId?: string })?.tenantId ?? null,
  },
  devtools: {
    enableByDefault: true,
    eventBufferSize: 1000,
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
  routes: [
    {
      type: 'http',
      id: 'weather-http',
      topic: 'weather.requested',
      method: 'GET',
      url: ({ payload }) => `/api/weather?city=${(payload as { city: string }).city}`,
      mapResponse: 'weather.canonical',
    },
  ],
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
  realtime: {
    channels: [
      {
        name: 'weather-stream',
        type: 'sse',
        url: 'https://api.example.com/weather/stream',
      },
    ],
  },
  gateway: {
    baseUrl: 'https://api.example.com',
    allowlist: ['https://api.example.com/api/'],
  },
})

// Plugin form: triggera weather request:
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

// Plugin widget meteo: rendering F6 cache-then-network anti-flicker:
await broker.registerPlugin({
  id: 'weather-widget',
  subscriptions: [
    {
      topic: 'weather.loaded',
      handler: (event) => {
        const origin = event.metadata?.origin
        if (origin === 'cache') renderInstant(event.payload)
        else if (origin === 'remote' && event.metadata?.replaces)
          replaceWeather(event.metadata.replaces, event.payload)
        else renderInstant(event.payload)
      },
    },
    {
      topic: 'weather.forecast.completed',
      handler: (event) => renderForecast(event.payload),
    },
  ],
})

// Plugin forecast worker (F5): heavy compute offloaded:
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

// In parallelo: weather.requested → cache-then-network (F6) → cache HIT (microtask) +
// HTTP fetch background (F3) → publish weather.loaded { origin: 'remote', replaces }
// → weather.forecast.requested triggered → worker pool dispatch (F5) → publish
// weather.forecast.completed
//
// In aggiunta: realtime SSE stream (F4) può publish weather.update spontaneo
// (server-side push) → mappato canonicamente via F2 + dispatch via F1 broker.

// Debug live:
const snap = (broker as { getDebugSnapshot?: () => unknown }).getDebugSnapshot?.()
console.log('Pipeline trace:', snap)

// Logout user → cascade atomico TUTTE le risorse:
await broker.unregisterPlugin('weather-form')
await broker.unregisterPlugin('weather-widget')
await broker.unregisterPlugin('forecast-plugin')
// → F4 realtime SSE close + F5 worker terminate + F6 cache invalidate prefix +
//   F3 routes + F2 schema cascade + F1 sub orphan removal
```

## 7. Tree-shake selective import

Per consumer micro-bundle (es. landing page con < 50KB JS budget), preferire import selettivo dei sub-pacchetti invece di `createGlueZero`:

```ts
// Tree-shake aggressivo — solo F1 broker pub/sub (~6 KB gz):
import { createBroker } from '@gluezero/core'
const broker = createBroker({})

// Tree-shake F1+F2+F3 — broker + routing HTTP (~25 KB gz):
import { createRouterBroker } from '@gluezero/routing'
const broker = createRouterBroker({ /* config F1+F2+F3 */ })

// Tree-shake F1+F2+F3+F6 cache (~30 KB gz):
import { createCacheBroker } from '@gluezero/cache'
const broker = createCacheBroker({ /* config */ })
```

**Bundle cost stimato** (post tsup ESM-only build, con all deps cross-package — measured size-limit budget 06-09a):

| Entry-point                  | Bundle size gz (with deps) |
| ---------------------------- | -------------------------- |
| `@gluezero/core`            | ~6 KB                      |
| `@gluezero/routing` (F1+2+3) | ~19 KB                     |
| `@gluezero/cache` (+F6)     | ~22 KB                     |
| `@gluezero/devtools` (+F6)  | ~22 KB                     |
| `@gluezero/gluezero` full  | ~35 KB                     |

**Convention sub-path import**: `@gluezero/gateway/http` e `@gluezero/gateway/sse-ws` sono sub-modulo separati (F3 vs F4) con `package.json` exports map — il bundler include solo il sub-modulo richiesto.

## 8. Versioning v1.0 milestone closure

Versione `1.0.0` = milestone v1.0 closure (PRD §32 — 6 fasi complete). Tutti gli 8 pacchetti `@gluezero/*` sono allineati a `1.0.0` (Changesets fixed mode):

| Pacchetto              | Versione | Phase | Open issue PRD §39 chiuso        |
| ---------------------- | -------- | ----- | -------------------------------- |
| `@gluezero/core`      | 1.0.0    | F1    | LIFE-02 cascade unsubscribe      |
| `@gluezero/mapper`    | 1.0.0    | F2    | MAP-17, VAL-08, VAL-09           |
| `@gluezero/routing`   | 1.0.0    | F3    | ROUTE-09, ROUTE-15, ROUTE-16     |
| `@gluezero/gateway`   | 1.0.0    | F3+F4 | RT-07 (reconnection rules)       |
| `@gluezero/worker`    | 1.0.0    | F5    | WK-07 (serializzazione worker)   |
| `@gluezero/cache`     | 1.0.0    | F6    | —                                |
| `@gluezero/devtools`  | 1.0.0    | F6    | **TOOL-05 (metrics format)**     |
| `@gluezero/gluezero` | 1.0.0    | F1-F6 | (aggregato)                      |

Tutti gli 11 punti della checklist PRD §39 sono chiusi in milestone v1.0. Vedi `CHANGELOG.md` per dettagli release notes.

## 9. Migration guide (V1 → V1.x roadmap)

Nessuna breaking change attesa V1 → V1.x. La V1.x roadmap include estensioni opt-in che mantengono semver minor compatibility:

- `@gluezero/cache-idb` (cache adapter IndexedDB persistente)
- `@gluezero/metrics-prometheus` (exporter ufficiale)
- `@gluezero/metrics-otel` (exporter OpenTelemetry)
- `superjson` adapter pluggable per worker serialization (D-142)
- Custom histogram bucketing per route
- Anti-flap pause/resume (debounce N ms)
- Worker retry policy idempotent opt-in (D-143)
- Auto-detect transferable heuristic (D-141 fallback)

## 10. Limitazioni V1 + roadmap V1.x

**Out-of-scope V1** (deferred a V1.x o V2):

- **Cache idb persistence** → V1.x (`@gluezero/cache-idb`)
- **OpenTelemetry exporter nativo** → V1.x (`@gluezero/metrics-otel`)
- **Inspector UI standalone** (DevTools panel browser extension) → V2
- **Distributed tracing W3C** (traceparent/tracestate header) → V1.x
- **Pool autoscaling worker** (CPU-pressure-based) → V2
- **`SharedWorker` cross-tab** → V2 (architettonicamente separato)
- **Service Worker bridge** (background sync) → V2
- **Custom RPC alternative to Comlink** → V1.x se Comlink mostra friction
- **Multi-tier cache** (L1 in-memory + L2 IndexedDB) → V1.x mobile use case
- **WorkerInspector dedicated** (analogo a EventInspector per worker lifecycle) → V1.x
- **MappingInspector integrato in DevtoolsBroker** → V1.x
- **User-defined metric registration API** (`registerCustomMetric()`) → V1.x

## 11. Q&A

| Domanda                                                                              | Risposta                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1: Quando usare `createGlueZero` vs chain manuale?**                             | `createGlueZero` per il 95% dei casi (single-tenant + tutte le feature default). Chain manuale (Opzione A) per multi-tenant esplicito (es. SaaS multi-app), DI test (mock per layer), micro-bundle aggressivo (skip layer non usati con dead-code elimination forzato).                          |
| **Q2: Come fare opt-out per SPA non realtime?**                                      | `createGlueZero({ features: { realtime: false, worker: false } })`. Il broker ritornato espone solo F1+F2+F3+F6 API. Bundle size gz ~30KB invece di ~35KB.                                                                                                                                       |
| **Q3: createGlueZero vs createBroker base — differenze?**                           | `createBroker` (F1) espone solo pub/sub + plugin lifecycle (~6KB gz). `createGlueZero` aggrega tutta la chain F1+F2+F3+F4+F5+F6 — broker plus routing + canonical mapper + HTTP gateway + realtime SSE/WS + worker pool + cache layer + devtools. La chain completa ~35KB gz.                     |
| **Q4: Come integrare con framework (React/Vue/Svelte)?**                             | GlueZero è framework-agnostic. Pattern raccomandato: `createGlueZero` al boot (es. `main.ts`), espose il broker via Context API React (`BrokerContext.Provider`) / Vue `provide/inject` / Svelte store. Subscribe su `useEffect` (React) / `onMount` (Vue/Svelte) con cleanup `subscription.unsubscribe()`. |
| **Q5: Tree-shake — quanto pesa selective import vs full bundle?**                    | `@gluezero/gluezero` full ~35KB gz (con tutte le dep). Selective import F1 only ~6KB. Selective F1+F2+F3 ~19KB. Selective F1+F2+F3+F6 cache ~22KB. Diff netto = ~13KB risparmio se SPA non usa worker/realtime.                                                                                  |
| **Q6: Multi-tenant isolation D-30 — come si garantisce?**                            | `createGlueZero` è pure function (D-30 anti-singleton). Ogni call ritorna istanza indipendente con state isolato (RouterBroker, MemoryCacheAdapter, MetricsCollector, WorkerPool). Multi-tenant pattern: 1 istanza per tenant + scopeProvider che ritorna tenantId per cache/metric labels.        |
| **Q7: Plugin scope hybrid — `registerPlugin` con `scopeProvider`?**                  | Lo scope provider è config-level (non per-plugin in V1). Il plugin che ha bisogno di scope custom usa `route.scope` route-level override (D-156 hybrid layer 1 — più alto della config-level fallback). V1.x roadmap: `PluginDescriptor.scopeProvider` per scope dichiarato per-plugin.            |
| **Q8: Migration da V0.x → V1.0 — breaking changes?**                                 | V1.0 è la prima release pubblica major. V0.x era pre-release alpha (zero consumer pubblici). Nessuna migration documentata necessaria. Per consumer interni che hanno usato V0.x: l'API `createGlueZero` è la stessa; le sezioni `cache` / `devtools` / `realtime` sono nuove (additive, non breaking). |

---

## Riferimenti

- `prd.md` (root) §10 (chain composition F1-F6), §29 (scenario meteo), §31 (packaging), §32 (6 fasi roadmap), §39 (open issues — TUTTI chiusi v1.0)
- `.planning/ROADMAP.md` (6 fasi PRD complete v1.0)
- `.planning/REQUIREMENTS.md` (91 REQ-IDs Complete v1.0)
- `.planning/phases/06-cache-tooling-avanzato/06-RESEARCH.md` §11 composition wrapper topology + §11.3 Opzione B convenience factory aggregato
- `EXAMPLES.md` (in questo pacchetto) — esempi consolidati end-to-end cross-package
- [`@gluezero/core`](../core/README.md) (F1)
- [`@gluezero/mapper`](../mapper/README.md) (F2)
- [`@gluezero/routing`](../routing/README.md) (F3)
- [`@gluezero/gateway`](../gateway/README.md) (F3 HTTP + F4 SSE/WS)
- [`@gluezero/worker`](../worker/README.md) (F5)
- [`@gluezero/cache`](../cache/README.md) (F6)
- [`@gluezero/devtools`](../devtools/README.md) (F6 — TOOL-05 closure PRD §39 #10)

## Licenza

MIT.

*Phase 6 closure date: 2026-05-05. Milestone v1.0 chiusa. Ready for `gsd-verifier 6` finale + `npm publish v1.0.0`.*
