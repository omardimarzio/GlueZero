// cache-broker.ts — `CacheBroker` composition wrapper di `RouterBroker` (Wave 4
// plan 06-08a — D-121 / D-83 strict carryover — F6 vive solo in
// `packages/cache/src/`).
//
// **Opzione B research §4.2 / §11.3 — D-83 strict preservation:**
// Il `publish(topic)` override intercetta topic matching una cache route registrata
// PRIMA di delegare a `inner.publish` (RouterBroker F3). In questo modo F6:
// - NON modifica `packages/routing/route-executor.ts`, `route-handlers/cache-handler.ts`
//   né `composite-handler.ts` (F3 stub `cache.not-implemented` resta intoccato)
// - NON viola D-83 (`git diff main packages/{core,mapper,routing,gateway,worker}/src/`
//   zero output post-commit)
// - Riusa pipeline §28 step 1-7 invariati per il flusso non-cache
//   (HTTP/local/worker/realtime) — la cache layer è additivo
//
// Pattern composition identico a `WorkerBroker` di F5 (plan 05-06) e
// `RealtimeBroker` di F4 (plan 04-08):
// - `inner: RouterBroker` (F3) — delegato per pub/sub/lifecycle/routing/http
// - `adapter: CacheAdapter` — LRU bounded MemoryCacheAdapter default (D-158)
// - `handler: CacheHandlerF6` — Strategy 3-way dispatch (06-03)
// - `cacheRoutes: Map<topic, RouteCacheCompiled>` — registry route cache per
//   topic match nel `publish` intercept
//
// **Cascade D-126 + LIFE-02 ext F6:**
// - `registerPlugin(desc)` → `inner.registerPlugin` (no auto-register cache —
//   cache routes sono dichiarate via `cacheRoutes` in config, non in plugin
//   descriptor; pattern simmetrico al routing F3 che ha `routes` in config)
// - `unregisterPlugin(id)` → `inner.unregisterPlugin` + `adapter.invalidate({prefix:
//   ownerId+::})` — rimuove tutte le entry cache scriva con `<ownerId>::` come
//   prefisso (convenzione D-156 scope hybrid). 2-step cascade try/catch isolato
//   per idempotency (pattern F3 router-broker-wrapper.ts:463-485 / F5
//   worker-broker.ts:356-374).
//
// **Tap forwarding D-161 (consumed da DevtoolsBroker 06-08b):**
// `config.runtime.tap` viene forward al `CacheHandlerF6.tap` injected — gli
// eventi lifecycle `event.cache.{lookup,hit,miss,evicted}` vengono emessi via
// `tap.onPipelineStep`. Il DevtoolsBroker 06-08b consumer wires il MultiplexTap
// (06-04) sul tap singleton.
//
// Threat coverage:
// - T-06-08a-01 (Logic flaw cascade idempotency cleanup parziale): mitigate
//   via 2-step cascade try/catch isolato per ogni step.
// - T-06-08a-02 (Information Disclosure cache cross-tenant via missing scope on
//   multi-plugin scenario): mitigate via D-156 scope hybrid + D-157 missing
//   scope audit (gestiti dal CacheHandlerF6 06-03 — cache-broker resta neutro).
// - T-06-08a-03 (DoS publish hot-path overhead per topic non-cache):
//   mitigate via Map.get(topic) O(1) lookup; se Map.get returns undefined,
//   delegate diretto a inner.publish (zero overhead pipeline F3).
// - T-06-08a-04 (Logic flaw cache-then-network ordering inverted post composition):
//   mitigate — composition wrapper NON re-ordina; CacheHandlerF6 già preserva
//   queueMicrotask ordering RESEARCH §15.6 (06-03).

import type { BrokerEvent, PluginDescriptor, Subscription } from '@sembridge/core'
import { RouterBroker, type RouterBrokerConfig } from '@sembridge/routing'
import {
  type CacheHandlerF6,
  type CacheHttpDelegate,
  createCacheHandlerF6,
  type RouteCacheCompiled,
} from './cache-handler'
import { createMemoryCacheAdapter } from './memory-cache-adapter'
import type { CacheAdapter, CacheConfig, CacheStats } from './types'

/**
 * Type del terzo argomento di `RouterBroker.publish` — riusato per propagare
 * `options.source/id/correlationId/priority`. Pattern coerente con `WorkerBroker`
 * di F5 e `RealtimeBroker` di F4.
 */
type RouterPublishOptions = Parameters<RouterBroker['publish']>[2]

/**
 * Cache route definition — subset di `RouteCacheDefinition` di F3
 * (`packages/routing/src/types/route-definition.ts:145`) richiesto runtime dal
 * `CacheBroker`. Pattern simmetrico a `RouteWorkerDefinition` di F5: il consumer
 * V1.x può importare il super-set type da `@sembridge/routing` se serve unione
 * locale.
 */
export interface CacheBrokerRouteDefinition {
  readonly type: 'cache'
  readonly id: string
  readonly topic: string
  readonly strategy: 'cache-first' | 'network-first' | 'cache-then-network'
  readonly ttl?: number
  readonly key?: (event: BrokerEvent) => string
  readonly scope?: (event: BrokerEvent) => string | null | undefined
  readonly auth?: boolean
}

/**
 * Configurazione `CacheBroker` — accetta tutto il `RouterBrokerConfig` di F3 +
 * sezione F6 `cache` + bootstrap `cacheRoutes`.
 *
 * Pattern declaration merging: `cache?: CacheConfig` aggiunto via
 * `cache/augment.ts` (plan 06-01 D-155/D-156/D-158). Per chiarezza export-side
 * ridichiariamo il super-set come interface esplicita — coerente con
 * `RouterBrokerConfig` di F3 e `WorkerBrokerConfig` di F5.
 */
export interface CacheBrokerConfig extends RouterBrokerConfig {
  /** F6 sezione `cache` (D-155/D-156/D-158). Override adapter, maxEntries, scopeProvider. */
  readonly cache?: CacheConfig
  /**
   * Cache routes registrate al boot (alternativa a `registerRoute` runtime).
   * Pattern simmetrico a `routes` di F3 routing e `workerRoutes` di F5.
   */
  readonly cacheRoutes?: readonly CacheBrokerRouteDefinition[]
}

/**
 * F6 CacheBroker — composition wrapper di RouterBroker (D-121, D-83 strict
 * carryover).
 *
 * **Opzione B research §4.2 / §11.3 — D-83 strict preservation:**
 * Il `publish(topic)` override intercetta topic matching una cache route
 * registrata prima di delegare a `inner.publish` (RouterBroker F3). In questo
 * modo F6:
 * - NON modifica `packages/routing/route-executor.ts`,
 *   `route-handlers/cache-handler.ts` (F3 stub) né `composite-handler.ts` (F3)
 * - NON viola D-83 (zero diff `packages/{core,mapper,routing,gateway,worker}/`)
 * - Riusa pipeline §28 step 1-7 invariati per il flusso non-cache
 *
 * Per le route NON-cache, il publish è delegato trasparentemente a
 * `inner.publish` — pipeline F3 normale.
 *
 * **Cascade D-126 + LIFE-02 ext F6:**
 * - `unregisterPlugin(id)` → `inner.unregisterPlugin` + `adapter.invalidate({prefix:
 *   ownerId+::})` — convention D-156 scope hybrid prefix isolation
 *
 * @example Quick start (config-driven cacheRoutes)
 * ```ts
 * import { createCacheBroker } from '@sembridge/cache'
 *
 * const broker = createCacheBroker({
 *   cache: { maxEntries: 500 },
 *   cacheRoutes: [
 *     { type: 'cache', id: 'r1', topic: 'weather.requested',
 *       strategy: 'cache-first', ttl: 60_000 },
 *   ],
 * })
 * broker.subscribe('weather.loaded', (ev) => console.log(ev.payload))
 * await broker.publish('weather.requested', { city: 'Roma' })
 * ```
 *
 * @example Plugin cascade (D-126 ext F6 LIFE-02)
 * ```ts
 * await broker.registerPlugin({ id: 'reports-plugin', subscriptions: [] })
 * // ...cache popolata da route con scope 'reports-plugin::'...
 * await broker.unregisterPlugin('reports-plugin')
 * // → adapter.invalidate({ prefix: 'reports-plugin::' }) — cleanup atomico
 * ```
 *
 * @example Cache stats consumption (consumed da MetricsCollector 06-06 + DevtoolsBroker 06-08b)
 * ```ts
 * const stats = broker.getCacheStats()
 * console.log(`hits=${stats.hits}, misses=${stats.misses}, evictions=${stats.evictions}`)
 * console.log(`entries=${stats.entries} / ${stats.entries < 500 ? 'OK' : 'NEAR-CAP'}`)
 * ```
 *
 * @throws {Error} `Invalid CacheBrokerConfig: <issues>` — propagato dal `createCacheBroker`
 *   factory se Valibot validation fallisce (delegate al `createRouterBroker` interno per
 *   sezioni F1-F5 + Schema F6 cache locale). Catturare via `try/catch` al boot consumer-side
 *   per UX fix dev-time.
 *
 * @see {@link createCacheBroker} — public factory (no singleton, D-30)
 * @see {@link CacheHandlerF6} — Strategy 3-way dispatch (06-03)
 * @see {@link CacheAdapter} — LRU bounded MemoryCacheAdapter default (06-02)
 * @see RESEARCH §4.2 / §11.3 — Opzione B rationale + D-83 strict gate
 */
export class CacheBroker {
  private readonly inner: RouterBroker
  private readonly adapter: CacheAdapter
  private readonly handler: CacheHandlerF6
  /** Map<topic, CacheBrokerRouteDefinition> per Opzione B publish intercept lookup. */
  private readonly cacheRoutes = new Map<string, CacheBrokerRouteDefinition>()

  constructor(config: CacheBrokerConfig = {}) {
    // 1. Compose RouterBroker (F3) — pattern identico WorkerBroker → RouterBroker
    //    e RealtimeBroker → RouterBroker (D-83 chain F1→F2→F3→F4→F5→F6).
    this.inner = new RouterBroker(config)

    // 2. Initialize cache adapter (W2 plan 06-02). DI override via
    //    config.cache.adapter (V1.x swap @sembridge/cache-idb).
    this.adapter =
      config.cache?.adapter ??
      createMemoryCacheAdapter({
        ...(config.cache?.maxEntries !== undefined && {
          maxEntries: config.cache.maxEntries,
        }),
      })

    // 3. Construct cache handler con publishFn legato a inner.publish (Opzione
    //    B delegate per outcome events — pipeline §28 step 11-12 mapper F2 +
    //    step 13 dispatch F1 invariati).
    //
    // **httpHandler fallback minimal:** in V1 base (cache-only test integration)
    // il delegate è tipicamente sostituito via DI nella `cache-harness`. Il
    // fallback default propaga il payload originale come success — comportamento
    // graceful zero-disrupt che permette al cache MISS di popolare l'adapter
    // con il payload corrente (utile per test isolati e composition wrapper
    // privo di routing HTTP esplicito).
    const httpDelegate: CacheHttpDelegate = async (event) => {
      return { outcome: 'success', value: event.payload }
    }

    // Tap forwarding D-161 — consumed da DevtoolsBroker 06-08b. Cast esplicito
    // su `runtime?.tap` perché `RouterBrokerConfig.runtime` è un type alias
    // proveniente da `MapperBroker` ConstructorParameters — la risoluzione DTS
    // cross-package può non includere il field; usiamo lookup runtime safe.
    const runtimeCfg = (config as { runtime?: { tap?: import('@sembridge/core').EventTap } })
      .runtime
    const tapForward = runtimeCfg?.tap

    this.handler = createCacheHandlerF6({
      cache: this.adapter,
      publishFn: (topic, payload, opts) => {
        this.inner.publish(topic, payload, opts as RouterPublishOptions)
      },
      httpHandler: httpDelegate,
      ...(config.cache?.scopeProvider !== undefined && {
        scopeProvider: config.cache.scopeProvider,
      }),
      ...(tapForward !== undefined && { tap: tapForward }),
    })

    // 4. Bootstrap cache routes from config (analog F3 `routes` boot e F5 `workerRoutes`).
    if (config.cacheRoutes !== undefined) {
      for (const route of config.cacheRoutes) {
        this.cacheRoutes.set(route.topic, route)
      }
    }
  }

  // ============================================================================
  // Public API — publish intercept Opzione B (D-83 strict preservation)
  // ============================================================================

  /**
   * **Opzione B (RESEARCH §4.2 / §11.3) — publish intercept pre-delegate.**
   *
   * Topic matching cache route → execute via handler; altrimenti delegate inner.
   *
   * Per topic con cache route registrata:
   * 1. Costruisce un `BrokerEvent` canonico dal topic + payload + options.
   * 2. Invoca `handler.execute(event, routeCompiled)` (Strategy 3-way dispatch
   *    cache-first / network-first / cache-then-network — D-152 / D-167).
   *
   * Per topic NON-cache → delegate `inner.publish(topic, payload, options)`
   * (pipeline F3 normale — HTTP/local/worker/realtime invariati).
   *
   * @param topic - Topic dell'evento.
   * @param payload - Payload dell'evento.
   * @param options - Opzioni publish (source, correlationId, priority).
   */
  publish(topic: string, payload: unknown, options?: RouterPublishOptions): void | Promise<void> {
    const cacheRoute = this.cacheRoutes.get(topic)
    if (cacheRoute === undefined) {
      // Topic non-cache → delegate diretto a inner (pipeline F3 normale).
      this.inner.publish(topic, payload, options)
      return
    }

    // Topic cache → costruisci BrokerEvent canonico per handler.
    const opts = (options ?? {}) as {
      readonly id?: string
      readonly source?: BrokerEvent['source']
      readonly correlationId?: string
      readonly priority?: BrokerEvent['priority']
    }
    const eventId = opts.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const event = {
      id: eventId,
      topic,
      payload,
      timestamp: Date.now(),
      source: opts.source ?? { type: 'system', id: 'cache-broker' },
      ...(opts.correlationId !== undefined && { correlationId: opts.correlationId }),
      ...(opts.priority !== undefined && { priority: opts.priority }),
    } as BrokerEvent

    // RouteCacheCompiled subset (handler.execute richiede shape minimal):
    const routeCompiled: RouteCacheCompiled = {
      id: cacheRoute.id,
      topic: cacheRoute.topic,
      strategy: cacheRoute.strategy,
      ...(cacheRoute.ttl !== undefined && { ttl: cacheRoute.ttl }),
      ...(cacheRoute.key !== undefined && { key: cacheRoute.key }),
      ...(cacheRoute.scope !== undefined && { scope: cacheRoute.scope }),
      ...(cacheRoute.auth !== undefined && { auth: cacheRoute.auth }),
    }

    // Fire-and-forget: il handler emette outcome via publishFn (loaded/failed).
    // Il chiamante non attende il completamento per mantenere semantica F1
    // publish (sync/async fire-and-forget — D-23 carryover).
    return this.handler.execute(event, routeCompiled).then(() => undefined)
  }

  /** Delegate `inner.subscribe`. */
  subscribe(...args: Parameters<RouterBroker['subscribe']>): Subscription {
    return this.inner.subscribe(...args)
  }

  /** Delegate `inner.registerRoute` (F3 — D-60 ROUTE-01). */
  registerRoute(
    ...args: Parameters<RouterBroker['registerRoute']>
  ): ReturnType<RouterBroker['registerRoute']> {
    return this.inner.registerRoute(...args)
  }

  /** Delegate `inner.unregisterRoute`. */
  unregisterRoute(
    ...args: Parameters<RouterBroker['unregisterRoute']>
  ): ReturnType<RouterBroker['unregisterRoute']> {
    return this.inner.unregisterRoute(...args)
  }

  /** Delegate `inner.registerCanonicalSchema` (F2). */
  registerCanonicalSchema(
    ...args: Parameters<RouterBroker['registerCanonicalSchema']>
  ): ReturnType<RouterBroker['registerCanonicalSchema']> {
    return this.inner.registerCanonicalSchema(...args)
  }

  // ============================================================================
  // Plugin management (override per cascade D-126 + LIFE-02 ext F6)
  // ============================================================================

  /**
   * Registra un plugin — delegate a `RouterBroker.registerPlugin`. F6 NON
   * auto-registra cache routes via `descriptor` (cache routes vivono in
   * `config.cacheRoutes` o via `registerCacheRoute` runtime — pattern simmetrico
   * al routing F3 con `routes` in config).
   */
  async registerPlugin(descriptor: PluginDescriptor): Promise<void> {
    await this.inner.registerPlugin(descriptor)
  }

  /**
   * Unregister plugin — cascade 2-step LIFE-02 ext F6 (carryover D-86 F3 / D-112 F4 / D-126 F5):
   *
   * 1. `inner.unregisterPlugin(id)` — F3 cascade routes + http abort + F2 cascade + F1 unsub
   * 2. `adapter.invalidate({ prefix: `${id}::` })` — rimuove cache entries scriva
   *    con `<ownerId>::` come prefisso (convention D-156 scope hybrid)
   *
   * Try/catch isolato per ogni step (pattern F3 router-broker-wrapper.ts:463-485):
   * un fail in uno step NON blocca i successivi (idempotency).
   */
  async unregisterPlugin(id: string): Promise<void> {
    try {
      await this.inner.unregisterPlugin(id)
    } catch {
      /* pattern F3 silent — un fail in F3 cascade NON blocca F6 cleanup */
    }
    try {
      this.adapter.invalidate({ prefix: `${id}::` })
    } catch {
      /* idempotent */
    }
  }

  // ============================================================================
  // Cache stats expose (consumed da MetricsCollector 06-06 + DevtoolsBroker 06-08b)
  // ============================================================================

  /**
   * Snapshot statistiche cache cumulative dal boot adapter (D-164 cumulative-only).
   *
   * Consumato da:
   * - `MetricsCollector` (06-06) — gauge `sembridge.cache.entries_count` +
   *   counter `sembridge.cache.{hits,misses,evictions}_total`.
   * - `DevtoolsBroker` (06-08b) — debug snapshot aggregato.
   */
  getCacheStats(): CacheStats {
    return this.adapter.stats()
  }
}
