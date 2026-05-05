// test-utils/cache-harness.ts — fixture per integration test F6 Cache layer
// (Wave 4a plan 06-08a — D-151 carryover F5 + W-3 closure F4 wildcard subscribe
// multi-depth).
//
// Pattern analog `worker-harness.ts` di F5 e `realtime-harness.ts` di F4 —
// collect events via subscribe wildcard multi-depth + reset deterministico per
// test isolation. NON è production code (escluso da coverage in `vitest.config.ts`
// plan 06-01 via `'src/test-utils/**'`).
//
// **Approccio collect events (W-3 closure F4 carryover)**: subscribe a 4 pattern
// (`'*'`, `'*.*'`, `'*.*.*'`, `'*.*.*.*'`) per coprire eventi 1-4 segmenti.
// Niente monkey-patch di `broker.publish` — la pipeline §28 viene esercitata
// interamente.
//
// **httpDelegate optional**: la harness costruisce un secondo CacheHandler
// dedicato con httpDelegate iniettato; il publish wrapped invoca questo handler
// per cache routes — il publishFn del handler propaga gli outcome via
// `baseBroker.publish` (che NON è una cache route, quindi delegate plain
// inner.publish → subscribers via wildcard collect).

import type { BrokerEvent } from '@gluezero/core'
import type { CacheBroker, CacheBrokerConfig } from '../cache-broker'
import {
  type CacheHttpDelegate,
  type CachePublishFn,
  createCacheHandlerF6,
  type RouteCacheCompiled,
} from '../cache-handler'
import { createMemoryCacheAdapter } from '../memory-cache-adapter'
import { createCacheBroker } from '../public-factory'
import type { CacheAdapter } from '../types/cache-adapter'

/** Pattern subscribe `'*'`, `'*.*'`, `'*.*.*'`, `'*.*.*.*'`. */
const COLLECT_PATTERNS: readonly string[] = ['*', '*.*', '*.*.*', '*.*.*.*']

/** Evento raccolto via subscribe wildcard. */
export interface CollectedEvent {
  readonly topic: string
  readonly payload: unknown
  readonly source?: BrokerEvent['source']
  readonly correlationId?: string
  readonly id?: string
  readonly timestamp: number
}

/** Harness ritornato da `createCacheHarness`. */
export interface CacheHarness {
  readonly broker: CacheBroker
  readonly adapter: CacheAdapter
  readonly events: CollectedEvent[]
  reset(): void
  flushAsync(ms?: number): Promise<void>
  publish(topic: string, payload: unknown, options?: unknown): void | Promise<void>
}

/** Opzioni `createCacheHarness`. Estende `CacheBrokerConfig` + httpDelegate optional. */
export interface CacheHarnessOptions extends CacheBrokerConfig {
  readonly httpDelegate?: CacheHttpDelegate
}

/**
 * Crea harness F6 cache layer con DI httpDelegate optional + collect events
 * via subscribe wildcard multi-depth.
 *
 * @example
 * ```ts
 * const h = createCacheHarness({
 *   cacheRoutes: [{ type: 'cache', id: 'r1', topic: 'weather.requested',
 *                   strategy: 'cache-first' }],
 *   httpDelegate: async () => ({ outcome: 'success', value: { remote: true } }),
 * })
 * await h.publish('weather.requested', {})
 * await h.flushAsync()
 * expect(h.events.find((e) => e.topic === 'weather.loaded')).toBeDefined()
 * ```
 */
export function createCacheHarness(opts: CacheHarnessOptions = {}): CacheHarness {
  const events: CollectedEvent[] = []

  const { httpDelegate, ...brokerConfigBase } = opts as {
    httpDelegate?: CacheHttpDelegate
  } & CacheBrokerConfig

  // Adapter condiviso tra baseBroker e custom handler.
  const sharedAdapter: CacheAdapter =
    brokerConfigBase.cache?.adapter ??
    createMemoryCacheAdapter({
      ...(brokerConfigBase.cache?.maxEntries !== undefined && {
        maxEntries: brokerConfigBase.cache.maxEntries,
      }),
    })

  const finalConfig: CacheBrokerConfig = {
    ...brokerConfigBase,
    cache: { ...brokerConfigBase.cache, adapter: sharedAdapter },
  }

  const baseBroker = createCacheBroker(finalConfig)

  // Subscribe wildcard pattern multi-depth (W-3 closure F4 carryover).
  for (const pattern of COLLECT_PATTERNS) {
    baseBroker.subscribe(pattern, (ev) => {
      const e = ev as BrokerEvent & { correlationId?: string }
      const collected: CollectedEvent = {
        topic: e.topic,
        payload: e.payload,
        timestamp: Date.now(),
        ...(e.source !== undefined && { source: e.source }),
        ...(e.correlationId !== undefined && { correlationId: e.correlationId }),
        ...(e.id !== undefined && { id: e.id }),
      }
      events.push(collected)
    })
  }

  // Costruzione publish wrapped:
  // - Se httpDelegate fornito → custom CacheHandler con delegate iniettato
  // - Altrimenti → baseBroker.publish plain
  let publishFn: (topic: string, payload: unknown, options?: unknown) => void | Promise<void>

  if (httpDelegate !== undefined) {
    const cacheRoutesMap = new Map<string, RouteCacheCompiled>()
    for (const r of brokerConfigBase.cacheRoutes ?? []) {
      cacheRoutesMap.set(r.topic, {
        id: r.id,
        topic: r.topic,
        strategy: r.strategy,
        ...(r.ttl !== undefined && { ttl: r.ttl }),
        ...(r.key !== undefined && { key: r.key }),
        ...(r.scope !== undefined && { scope: r.scope }),
        ...(r.auth !== undefined && { auth: r.auth }),
      })
    }

    const customPublishFn: CachePublishFn = (topic, payload, opts) => {
      ;(
        baseBroker as unknown as {
          publish: (t: string, p: unknown, o?: unknown) => void | Promise<void>
        }
      ).publish(topic, payload, opts)
    }

    const customHandler = createCacheHandlerF6({
      cache: sharedAdapter,
      publishFn: customPublishFn,
      httpHandler: httpDelegate,
      ...(brokerConfigBase.cache?.scopeProvider !== undefined && {
        scopeProvider: brokerConfigBase.cache.scopeProvider,
      }),
      ...(brokerConfigBase.runtime !== undefined &&
        (brokerConfigBase.runtime as { tap?: unknown })?.tap !== undefined && {
          tap: (brokerConfigBase.runtime as { tap?: never }).tap,
        }),
    })

    publishFn = (topic, payload, options) => {
      const cacheRoute = cacheRoutesMap.get(topic)
      if (cacheRoute === undefined) {
        return (
          baseBroker as unknown as {
            publish: (t: string, p: unknown, o?: unknown) => void | Promise<void>
          }
        ).publish(topic, payload, options)
      }
      const safeOpts = (options ?? {}) as { source?: BrokerEvent['source']; id?: string }
      const event = {
        id: safeOpts.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        topic,
        payload,
        timestamp: Date.now(),
        source: safeOpts.source ?? { type: 'system', id: 'cache-harness' },
      } as BrokerEvent
      return customHandler.execute(event, cacheRoute).then(() => undefined)
    }
  } else {
    publishFn = (topic, payload, options) => {
      return (
        baseBroker as unknown as {
          publish: (t: string, p: unknown, o?: unknown) => void | Promise<void>
        }
      ).publish(topic, payload, options)
    }
  }

  return {
    broker: baseBroker,
    adapter: sharedAdapter,
    events,
    reset() {
      events.length = 0
    },
    async flushAsync(ms = 0): Promise<void> {
      await Promise.resolve()
      if (ms > 0) {
        await new Promise<void>((res) => setTimeout(res, ms))
      } else {
        await new Promise<void>((res) => setTimeout(res, 0))
      }
    },
    publish(topic, payload, options) {
      return publishFn(topic, payload, options)
    },
  }
}
