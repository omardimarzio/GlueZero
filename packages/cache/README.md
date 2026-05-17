# @gluezero/cache

> Cache layer per GlueZero — Phase 6 (in-memory LRU bounded + 3-strategy dispatch + scope hybrid D-156 + cache-then-network ordering microtask + cascade invalidate ext LIFE-02).

> 🎉 **v2.0.0 GA (2026-05-17)** — Cache scope per-MF disponibile via `microFrontendModule()` + `@gluezero/isolation` (Phase F13). Vedi [root README](../../README.md#microfrontend-governance-layer-v20-opt-in) · [docs/v2/](../../docs/v2/index.md) · [migration guide A/B/C](../../docs/v2/17-migration-guide.md).

ESM-only TypeScript library. Browser evergreen target (ES2022). Composition wrapper di [`@gluezero/routing`](../routing/README.md) `RouterBroker` (D-121, D-83 strict carryover): un singolo entry point `createCacheBroker(config)` orchestra route HTTP/local/composite F3 + nuovo route `cache` con 3 strategie (`cache-first`, `network-first`, `cache-then-network`) e adapter pluggable (default `MemoryCacheAdapter` LRU bounded `maxEntries=1000` D-158).

Quattro dipendenze runtime: [`@gluezero/core`](../core/README.md) (BrokerError + BrokerEvent + EventTap, F1), [`@gluezero/mapper`](../mapper/README.md) (canonical mapping, F2 — implicit via routing), [`@gluezero/routing`](../routing/README.md) (RouterBroker base composta, F3), [`valibot`](https://valibot.dev) (config validation al boundary).

## Indice

1. [Quick start](#1-quick-start)
2. [Cache adapter contract](#2-cache-adapter-contract)
3. [Cache key + scope hybrid](#3-cache-key--scope-hybrid)
4. [TTL + invalidate](#4-ttl--invalidate)
5. [Le tre cache strategies](#5-le-tre-cache-strategies)
6. [Cache-then-network ordering microtask](#6-cache-then-network-ordering-microtask)
7. [Scope user-aware (D-157 missing scope auth bypass)](#7-scope-user-aware-d-157-missing-scope-auth-bypass)
8. [Scenario meteo F1+F2+F3+F6 end-to-end](#8-scenario-meteo-f1f2f3f6-end-to-end)
9. [Anti-pattern cache stampede](#9-anti-pattern-cache-stampede)
10. [Limitazioni V1](#10-limitazioni-v1)
11. [Q&A](#11-qa)

---

## 1. Quick start

`@gluezero/cache` espone `createCacheBroker(config)` come factory pubblico (D-30 anti-singleton). Il broker compone trasparentemente il `RouterBroker` di Phase 3 (D-121, D-83 strict carryover): per topic con cache route registrata, intercetta la `publish` PRIMA del `RouterBroker.publish` (Opzione B research §4.2 / §11.3) e dispatch al `CacheHandlerF6` 3-way; per topic non-cache delega trasparente al `RouterBroker` invariato (pipeline F3 HTTP/local/composite preservata).

```ts
import { createCacheBroker } from '@gluezero/cache'

const broker = createCacheBroker({
  cache: { maxEntries: 500 },
  cacheRoutes: [
    {
      type: 'cache',
      id: 'weather-cache',
      topic: 'weather.requested',
      strategy: 'cache-first',
      ttl: 60_000,
    },
  ],
})

broker.subscribe('weather.loaded', (event) => {
  console.log('Origin:', event.metadata?.origin) // 'cache' | 'remote'
  console.log('Payload:', event.payload)
})

await broker.publish('weather.requested', { city: 'Roma' })
```

`createCacheBroker` è una **pure function** — ogni chiamata ritorna una nuova istanza isolata (D-30). La validazione `CacheBrokerConfigSchema` Valibot avviene al boot: errori schema → `Error` nativo con prefix `Invalid CacheBrokerConfig:` e dettagli per fixing developer-time.

## 2. Cache adapter contract

L'interfaccia `CacheAdapter` è il punto di estensione per backend custom (Redis-like, IndexedDB V1.x). Default V1 = `MemoryCacheAdapter` LRU bounded.

```ts
interface CacheAdapter {
  get<T>(key: string): CacheEntry<T> | undefined
  set<T>(key: string, value: T, ttlMs?: number): void
  delete(key: string): boolean
  invalidate(pattern: string | RegExp | { readonly prefix: string }): number
  size(): number
  clear(): void
  stats(): CacheStats
}
```

**MemoryCacheAdapter (D-158):** LRU bounded `maxEntries=1000` default, basato su `Map` insertion order (ECMAScript 2015 spec universale Baseline). Re-insert on `get` → LRU touch. Eviction → drop primo (oldest) via `cache.keys().next().value`. TTL ortogonale a LRU (entry può essere evicted prima della scadenza TTL se cap raggiunto).

**Pattern caratterizzanti:**

- Zero dependency esterna (pattern carryover F3 D-74 KeyBased dedupe, F5 D-130 BackpressureStrategy 1:1 reuse).
- Cap predictable in entries (NON bytes — D-158 trade-off: predictability + zero overhead misurazione bytes).
- Atomic single-thread JS event loop (no race condition F5 D-133 carryover).
- Lazy TTL expiration (no proactive sweeper — RESEARCH §15.7).

**Tampering caveat (T-06-02-03):** la cache restituisce reference (NO deep clone su `get` — perf consideration, 5-10ms overhead 500 entries rejected RESEARCH §15.3). Il consumer è responsabile di NON mutare il valore restituito. In dev può applicare `Object.freeze` (pattern F1 D-29 carryover).

## 3. Cache key + scope hybrid

**D-155 default cacheKey:** `${topic}::${stableHash(canonicalPayload)}` (riuso pattern F3 D-74 KeyBased dedupe). Stable hash via FNV-1a + JSON canonical (`stableStringify` con sorted keys) → ~50 LOC inline zero-dep, predicabile cross-version.

```ts
import { cacheKey } from '@gluezero/cache' // helper utility

const key = cacheKey({
  topic: 'weather.requested',
  payload: { city: 'Roma', units: 'metric' },
  scope: 'tenant-acme',
})
// → 'tenant-acme::weather.requested::a1b2c3d4'
```

**D-156 scope hybrid (3 layer di precedence):**

1. **Route-level callback** (override più alto): `route.scope: (event) => string | null`
2. **Config-level provider** (default): `cache.scopeProvider: (event) => string | null`
3. **Nessuno scope** → key globale (cross-tenant — esplicito rischio cross-leakage se non usato consapevolmente)

```ts
const broker = createCacheBroker({
  cache: {
    scopeProvider: (event) => {
      const tenantId = (event.payload as { tenantId?: string })?.tenantId
      return tenantId ?? null
    },
  },
  cacheRoutes: [
    {
      type: 'cache',
      id: 'user-profile',
      topic: 'user.profile.requested',
      strategy: 'cache-first',
      ttl: 30_000,
      // Override route-level: scope esplicito da userId
      scope: (event) => (event.payload as { userId?: string })?.userId ?? null,
      auth: true, // → D-157: missing scope su auth route → bypass cache
    },
  ],
})
```

## 4. TTL + invalidate

**TTL ortogonale a LRU:** `ttlMs` su `set(key, value, ttlMs)` definisce expiry assoluto (`Date.now() + ttlMs`). Lazy expiration su read (RESEARCH §15.7): se entry scaduto, `get` ritorna `undefined` + incrementa `evictions` counter.

**Invalidate API (3 forme):**

```ts
// Forma 1: exact string
adapter.invalidate('weather.requested::a1b2c3d4') // → 0 | 1

// Forma 2: RegExp pattern
adapter.invalidate(/^weather\./) // tutti i topic 'weather.*' → count

// Forma 3: prefix (più efficiente, no regex)
adapter.invalidate({ prefix: 'tenant-acme::' }) // tenant cleanup → count
```

**invalidateOn declarativo (V1.x roadmap):** la route definition F3 prevede `invalidateOn: readonly string[]` per invalidate automatico a fronte di topic side-effect (es. `user.profile.updated` invalida `user.profile.requested`). V1 espone solo invalidate API runtime + cascade plugin (D-126 ext F6 LIFE-02).

**Cascade unregisterPlugin (D-126 ext F6 LIFE-02):**

```ts
await broker.registerPlugin({ id: 'reports-plugin', subscriptions: [] })
// ... cache popolata da route con scope 'reports-plugin::...' ...
await broker.unregisterPlugin('reports-plugin')
// → adapter.invalidate({ prefix: 'reports-plugin::' }) atomico nel cleanup
```

Il pattern prefix-isolation per ownerId è una **convention** scope hybrid D-156 — il consumer è responsabile di prefissare le chiavi con `<ownerId>::` (default cacheKey lo fa automaticamente quando `scope` ritorna l'ownerId).

## 5. Le tre cache strategies

PRD §17.6 + RESEARCH §4 enumerano 3 strategie dispatch per `route.strategy`. Tutti i path async terminano con `publish('<topic>.loaded' | '<topic>.failed', payload, { metadata: { origin } })`.

| Strategy            | Comportamento                                                     | Topic outcome             | metadata.origin    |
| ------------------- | ----------------------------------------------------------------- | ------------------------- | ------------------ |
| `cache-first`       | Cache HIT → publish; MISS → fetch + cache.set                     | `.loaded` (HIT o success) | `cache` o `remote` |
| `network-first`     | Fetch → success cache.set; error → cache fallback (HIT o failed)  | `.loaded` o `.failed`     | `remote` o `cache` |
| `cache-then-network`| HIT → microtask publish + fetch background publish replaces       | `.loaded` 1-2x            | `cache` poi `remote` |

```ts
const broker = createCacheBroker({
  cacheRoutes: [
    // 'cache-first': massimizza cache reuse (UI dashboard read-mostly)
    {
      type: 'cache',
      id: 'dashboard',
      topic: 'dashboard.requested',
      strategy: 'cache-first',
      ttl: 5 * 60_000,
    },
    // 'network-first': dato fresco prevale (notifiche, stato realtime)
    {
      type: 'cache',
      id: 'notifications',
      topic: 'notifications.requested',
      strategy: 'network-first',
      ttl: 30_000,
    },
    // 'cache-then-network': UI fluida (anti-flicker) + background refresh
    {
      type: 'cache',
      id: 'weather',
      topic: 'weather.requested',
      strategy: 'cache-then-network',
      ttl: 60_000,
    },
  ],
})
```

## 6. Cache-then-network ordering microtask

**Pitfall ordering (RESEARCH §15.6):** la sequenza `cache HIT → publish` + `fetch → publish remote` deve garantire che il consumer riceva PRIMA il payload cached e POI il payload remote (anti-flicker UI). Implementazione default usa `queueMicrotask`:

```ts
// In cache-handler.ts — strategy 'cache-then-network' HIT branch:
queueMicrotask(() => {
  publishFn(deriveTopicFromCache(event.topic, 'loaded'), hit.value, {
    metadata: { origin: 'cache' },
  })
})
// Fetch background — quando risolve, publish remote with replaces metadata:
const httpResult = await deps.httpHandler(event, route, signal)
if (httpResult.outcome === 'success') {
  cache.set(key, httpResult.value, route.ttl)
  publishFn(deriveTopicFromCache(event.topic, 'loaded'), httpResult.value, {
    metadata: { origin: 'remote', replaces: event.id },
  })
}
```

Il `queueMicrotask` garantisce che la publish cache HIT sia dispatch al consumer PRIMA che la fetch HTTP risolva (anche se la fetch fosse istantanea — es. mock test). Il consumer riconosce la sequenza tramite `metadata.origin`:

```ts
broker.subscribe('weather.loaded', (event) => {
  if (event.metadata?.origin === 'cache') {
    renderWeather(event.payload) // istantaneo
  } else if (event.metadata?.origin === 'remote') {
    if (event.metadata?.replaces) {
      replaceWeather(event.metadata.replaces, event.payload)
    } else {
      renderWeather(event.payload)
    }
  }
})
```

## 7. Scope user-aware (D-157 missing scope auth bypass)

**D-157 sicurezza by default**: se `route.auth === true` e lo scope risolto è `null` o `undefined`, la cache layer:

1. **Skip cache lookup E cache.set** — zero hit, zero write per quella request.
2. **Emit audit** `system.cache.scope-missing { routeId, topic, eventId }` — il consumer può sottoscrivere per alerting.
3. **Cold fetch sempre** — bypass totale (pattern coerente con HTTP allowlist F3 SEC-04).

```ts
const broker = createCacheBroker({
  cache: {
    scopeProvider: (event) => {
      const userId = (event.payload as { userId?: string })?.userId
      return userId ?? null
    },
  },
  cacheRoutes: [
    {
      type: 'cache',
      id: 'user-private',
      topic: 'user.private.requested',
      strategy: 'cache-first',
      ttl: 30_000,
      auth: true,
    },
  ],
})

broker.subscribe('system.cache.scope-missing', (event) => {
  console.warn('Scope mancante per route auth:', event.payload)
})
```

Il rationale è "fail-secure": meglio una cache miss + un fetch di troppo che un cross-tenant leak. Il consumer auth-aware **deve** garantire che lo scope provider ritorni un valore non-null per le route con `auth: true`; il missing scope è SEMPRE un bug consumer-side.

## 8. Scenario meteo F1+F2+F3+F6 end-to-end

Esempio integrato: un widget meteo che usa cache layer con `cache-then-network` + scope tenant + cascade cleanup al logout plugin.

```ts
import { createCacheBroker } from '@gluezero/cache'

const broker = createCacheBroker({
  cache: {
    maxEntries: 500,
    scopeProvider: (event) => {
      const tenant = (event.payload as { tenantId?: string })?.tenantId
      return tenant ?? null
    },
  },
  cacheRoutes: [
    {
      type: 'cache',
      id: 'weather-route',
      topic: 'weather.requested',
      strategy: 'cache-then-network',
      ttl: 5 * 60_000,
      auth: false,
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
  gateway: {
    baseUrl: 'https://api.example.com',
    allowlist: ['https://api.example.com/api/'],
  },
})

await broker.registerPlugin({
  id: 'weather-widget',
  subscriptions: [
    {
      topic: 'weather.loaded',
      handler: (event) => {
        const origin = event.metadata?.origin
        const replaces = event.metadata?.replaces
        if (origin === 'cache') renderWeather(event.payload)
        else if (origin === 'remote' && replaces) updateWeather(event.payload)
        else renderWeather(event.payload)
      },
    },
  ],
})

await broker.publish('weather.requested', {
  tenantId: 'acme',
  city: 'Roma',
  units: 'metric',
})

// Al logout user:
await broker.unregisterPlugin('weather-widget')
// → cascade LIFE-02 ext F6: invalidate({ prefix: 'weather-widget::' })
```

Il `correlationId` (F1) viaggia end-to-end nel `BrokerEvent.correlationId` — il plugin può raggruppare cache hit + remote refresh sotto lo stesso "weather request" anche se il consumer triggera N publish in parallelo.

## 9. Anti-pattern cache stampede

**Cache stampede** (PRD §17.6 / RESEARCH §4.5): N publish concorrenti sullo stesso topic+key con cache MISS → N fetch HTTP paralleli identici → server overload + cache write race.

**Mitigazione F3 D-74 KeyBased dedupe carryover (riuso 1:1):** la dedupe strategy F3 (in `@gluezero/gateway/http`) coalesce N fetch concorrenti sullo stesso key in 1 Promise singleton. Il pattern KeyBased usa lo stesso `cacheKey()` derivation di F6 (D-155 `${topic}::${stableHash(canonicalPayload)}`) → coerenza cross-fase cache+dedupe.

```ts
const broker = createCacheBroker({
  routes: [
    {
      type: 'http',
      id: 'weather-http',
      topic: 'weather.requested',
      method: 'GET',
      url: ({ payload }) => `/api/weather?city=${(payload as { city: string }).city}`,
      // F3 dedupe — coalesce N publish concorrenti durante MISS
      policies: { dedupe: 'key-based' },
    },
  ],
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
```

**Cardinality limit (D-166 carryover devtools):** evita label di alta cardinalità (userId, eventId) come parte della cache key — usa `tenantId` o `routeId`. Cardinalità eccessiva → memory pressure + LRU thrashing.

## 10. Limitazioni V1

- **`@gluezero/cache-idb`** (IndexedDB persistence) → V1.x quando emerge use case offline-first / cross-session cache.
- **Bytes-based eviction** (cap in MB invece che entries) → V1.x. Trade-off rejected V1: predictability entries vs misurazione bytes (overhead `JSON.stringify` per ogni set).
- **`invalidateOn` declarativo** route-level — V1.x. V1 espone solo `adapter.invalidate()` runtime + cascade plugin.
- **Cache warming** (preload al boot) → V1.x.
- **Distributed cache invalidation** (cross-tab via `BroadcastChannel`) → V2.
- **`Object.freeze` automatico su get** → V1 lascia al consumer (perf 5-10ms su 500 entries rejected RESEARCH §15.3).
- **Multi-tier cache** (L1 in-memory + L2 IndexedDB) → V1.x quando emerge use case mobile.

## 11. Q&A

| Domanda                                                                                | Risposta                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1: Quando usare `cache-first` vs `cache-then-network`?**                            | `cache-first` per dato che cambia raramente (config, vocabolari) — minimizza fetch. `cache-then-network` per UI fluida con dato fresco (dashboard, weather) — anti-flicker + background refresh. `network-first` per dato critico fresh-priority (notifiche, stato realtime) con fallback offline.       |
| **Q2: Come invalidare cache quando un plugin si disregistra?**                         | Cascade automatica via D-126 ext F6 LIFE-02: `unregisterPlugin(id)` → `adapter.invalidate({ prefix: '<id>::' })`. Convention: il default `cacheKey()` con `scope: ownerId` produce key prefisse `<id>::topic::hash`.                                                                                    |
| **Q3: Cosa succede a un cache hit in `scope=null` su route con `auth: true`?**         | D-157 fail-secure: skip cache (lookup E set) + emit `system.cache.scope-missing` audit + cold fetch sempre. Il consumer auth-aware **deve** garantire scope non-null per route con `auth: true` — missing scope è bug consumer-side. Audit consumable per alerting/telemetry.                            |
| **Q4: Come si configura un custom adapter (Redis-like / IndexedDB)?**                  | Implementa `CacheAdapter` interface (get/set/delete/invalidate/size/clear/stats) e passa via `cache.adapter` config. V1.x roadmap: `@gluezero/cache-idb` ufficiale.                                                                                                                                     |
| **Q5: Quando TTL scade durante `cache-then-network` background fetch?**                | Lazy expiration su read (RESEARCH §15.7): cache HIT viene servito se entry presente E `expiresAt > Date.now()` AT lookup time. Background fetch parte indipendentemente — al return `cache.set(key, value, ttl)` rinnova l'expiry.                                                                      |

---

## Riferimenti

- [`DECISIONS.md`](../../DECISIONS.md) — 170 decisioni architetturali con riferimenti a sezioni di design
- [`@gluezero/core`](../core/README.md) (BrokerError + BrokerEvent + EventTap, F1)
- [`@gluezero/mapper`](../mapper/README.md) (canonical mapping registries, F2)
- [`@gluezero/routing`](../routing/README.md) (RouterBroker + RouteResolver, F3)
- [`@gluezero/gateway`](../gateway/README.md) (HTTP gateway + F3 dedupe KeyBased riusato)
- [`@gluezero/devtools`](../devtools/README.md) (MetricsCollector + Inspector, F6 — TOOL-05 closure PRD §39 #10)

## Licenza

MIT.

*Phase 6 closure date: 2026-05-05. Milestone v1.0 chiusa. Ready for `gsd-verifier 6` finale.*
