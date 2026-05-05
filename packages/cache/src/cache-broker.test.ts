// cache-broker.test.ts — Tier-1 jsdom test deterministici per `CacheBroker`
// (plan 06-08a — composition wrapper Opzione B + cascade D-126 ext F6 LIFE-02 +
// tap forwarding D-161 readiness).
//
// 12+ test totali:
//   - composition delegate (subscribe / registerRoute / publish non-cache topic): 3
//   - Opzione B intercept (cache route topic): 2
//   - cascade unregisterPlugin invalidate by ownerId: 2
//   - cache stats expose: 2
//   - DI override adapter: 1
//   - edge cases (publish prima di registerCacheRoute, double unregister): 2
//
// Pattern carryover ESATTO da `packages/worker/src/worker-broker.test.ts` (analog F5
// Strategy F3 dispatch + DI publishFn + cascade D-126).

import type { EventTap, PipelineSnapshot } from '@sembridge/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CacheBroker } from './cache-broker'
import { createMemoryCacheAdapter } from './memory-cache-adapter'
import type { CacheAdapter } from './types/cache-adapter'

// ============================================================================
// Test utilities
// ============================================================================

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

// ============================================================================
// Test cases
// ============================================================================

describe('CacheBroker — composition wrapper Opzione B (D-83 / D-121)', () => {
  let broker: CacheBroker

  afterEach(() => {
    // Niente cleanup globale — ogni test crea un broker fresco (D-30 anti-singleton).
  })

  // --------------------------------------------------------------------------
  // Composition delegate (3 test)
  // --------------------------------------------------------------------------

  describe('composition delegate', () => {
    it('subscribe → topic non-cache delegato a inner.publish (pipeline F3 normale)', async () => {
      broker = new CacheBroker({})
      const received: unknown[] = []
      broker.subscribe('plain.topic', (ev) => {
        received.push(ev.payload)
      })
      broker.publish('plain.topic', { hello: 'world' }, {
        source: { type: 'plugin', id: 'test' },
      })
      await flushMicrotasks()
      expect(received).toEqual([{ hello: 'world' }])
    })

    it('registerRoute → delegate a inner.registerRoute (F3)', () => {
      broker = new CacheBroker({})
      const reg = broker.registerRoute({
        id: 'local-1',
        type: 'local',
        topic: 'foo.bar',
      })
      expect(reg).toBeDefined()
      expect(reg.id).toBe('local-1')
    })

    it('unregisterRoute → delegate a inner.unregisterRoute (F3)', () => {
      broker = new CacheBroker({})
      broker.registerRoute({ id: 'r-x', type: 'local', topic: 'x.y' })
      const removed = broker.unregisterRoute('r-x')
      expect(removed).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Opzione B intercept (2 test)
  // --------------------------------------------------------------------------

  describe('Opzione B intercept (cache route topic)', () => {
    it('publish topic con cacheRoute → handler.execute pre-delegate (HIT su cache pre-popolata)', async () => {
      const adapter = createMemoryCacheAdapter({ maxEntries: 100 })
      adapter.set('weather.requested::*', { temp: 20 }, 60_000)

      broker = new CacheBroker({
        cache: {
          adapter,
          // Forzare la stessa key usata in adapter pre-set: scope undefined → 'weather.requested::*' fallback.
        },
        cacheRoutes: [
          {
            id: 'r-cache-1',
            type: 'cache',
            topic: 'weather.requested',
            strategy: 'cache-first',
            // Custom key per match esatto al pre-set
            key: () => 'weather.requested::*',
          },
        ],
      })

      const received: { topic: string; payload: unknown }[] = []
      broker.subscribe('weather.loaded', (ev) => {
        received.push({ topic: ev.topic, payload: ev.payload })
      })

      await broker.publish('weather.requested', { city: 'Roma' }, {
        source: { type: 'plugin', id: 'app' },
      })
      await flushMicrotasks()

      expect(received).toHaveLength(1)
      expect(received[0].topic).toBe('weather.loaded')
      expect(received[0].payload).toEqual({ temp: 20 })
    })

    it('publish topic NON-cache → delegate diretto a inner.publish (pipeline F3 normale, no handler)', async () => {
      broker = new CacheBroker({
        cacheRoutes: [
          {
            id: 'r-cache-2',
            type: 'cache',
            topic: 'cached.topic',
            strategy: 'cache-first',
          },
        ],
      })
      const received: unknown[] = []
      broker.subscribe('other.topic', (ev) => {
        received.push(ev.payload)
      })
      broker.publish('other.topic', { x: 1 }, {
        source: { type: 'plugin', id: 'app' },
      })
      await flushMicrotasks()
      expect(received).toEqual([{ x: 1 }])
    })
  })

  // --------------------------------------------------------------------------
  // Cascade unregisterPlugin invalidate by ownerId (2 test)
  // --------------------------------------------------------------------------

  describe('cascade D-126 ext F6 LIFE-02', () => {
    it('unregisterPlugin → adapter.invalidate({ prefix: ownerId+:: }) chiamato', async () => {
      const adapter = createMemoryCacheAdapter()
      const invalidateSpy = vi.spyOn(adapter, 'invalidate')

      broker = new CacheBroker({ cache: { adapter } })
      await broker.registerPlugin({
        id: 'plugin-A',
        subscriptions: [],
      })
      adapter.set('plugin-A::weather::*', { v: 1 })
      adapter.set('plugin-A::orders::*', { v: 2 })
      adapter.set('plugin-B::other::*', { v: 3 })

      await broker.unregisterPlugin('plugin-A')

      expect(invalidateSpy).toHaveBeenCalledWith({ prefix: 'plugin-A::' })
      // L'altro tenant deve restare integro
      expect(adapter.get('plugin-B::other::*')).toBeDefined()
    })

    it('unregisterPlugin idempotente — double call NON throw', async () => {
      const adapter = createMemoryCacheAdapter()
      broker = new CacheBroker({ cache: { adapter } })
      await broker.registerPlugin({ id: 'plugin-X', subscriptions: [] })
      await expect(broker.unregisterPlugin('plugin-X')).resolves.not.toThrow()
      await expect(broker.unregisterPlugin('plugin-X')).resolves.not.toThrow()
    })
  })

  // --------------------------------------------------------------------------
  // Cache stats expose (2 test)
  // --------------------------------------------------------------------------

  describe('getCacheStats', () => {
    it('getCacheStats expone hits/misses/evictions/entries dal adapter', () => {
      const adapter = createMemoryCacheAdapter()
      broker = new CacheBroker({ cache: { adapter } })
      adapter.set('k1', { v: 1 })
      adapter.get('k1')
      adapter.get('non-existent')
      const stats = broker.getCacheStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.entries).toBe(1)
    })

    it('getCacheStats su broker fresh → zero contatori', () => {
      broker = new CacheBroker({})
      const stats = broker.getCacheStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.evictions).toBe(0)
      expect(stats.entries).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // DI override adapter (1 test)
  // --------------------------------------------------------------------------

  describe('DI override adapter', () => {
    it('config.cache.adapter override usa l\'adapter fornito (no MemoryCacheAdapter default)', () => {
      const customAdapter: CacheAdapter = {
        get: vi.fn().mockReturnValue(undefined),
        set: vi.fn(),
        delete: vi.fn().mockReturnValue(false),
        invalidate: vi.fn().mockReturnValue(0),
        size: vi.fn().mockReturnValue(0),
        clear: vi.fn(),
        stats: vi.fn().mockReturnValue({ hits: 7, misses: 3, evictions: 0, entries: 0 }),
      }
      broker = new CacheBroker({ cache: { adapter: customAdapter } })
      const stats = broker.getCacheStats()
      expect(stats.hits).toBe(7)
      expect(customAdapter.stats).toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // Edge cases (2 test)
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('publish prima di qualsiasi cache route → delegate inner senza errori', async () => {
      broker = new CacheBroker({})
      const received: unknown[] = []
      broker.subscribe('any.topic', (ev) => {
        received.push(ev.payload)
      })
      broker.publish('any.topic', { z: 1 }, {
        source: { type: 'plugin', id: 'app' },
      })
      await flushMicrotasks()
      expect(received).toEqual([{ z: 1 }])
    })

    it('costruttore con maxEntries override → MemoryCacheAdapter creato con cap', () => {
      broker = new CacheBroker({ cache: { maxEntries: 5 } })
      // Non possiamo introspettare adapter privato; verifichiamo che getCacheStats funzioni.
      const stats = broker.getCacheStats()
      expect(stats.entries).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // Tap forwarding D-161 readiness (1 test extra)
  // --------------------------------------------------------------------------

  describe('tap forwarding D-161', () => {
    it('config.runtime.tap forward a CacheHandler → eventi cache.lookup/hit emessi', async () => {
      const tapSteps: string[] = []
      const tap: EventTap = {
        onPipelineStep: (_step, snap: PipelineSnapshot) => {
          tapSteps.push(snap.step as string)
        },
      } as EventTap

      const adapter = createMemoryCacheAdapter()
      adapter.set('cache-key-fixed', { hit: true }, 60_000)

      broker = new CacheBroker({
        runtime: { tap },
        cache: { adapter },
        cacheRoutes: [
          {
            id: 'r-tap',
            type: 'cache',
            topic: 'tap.requested',
            strategy: 'cache-first',
            key: () => 'cache-key-fixed',
          },
        ],
      })

      await broker.publish('tap.requested', {}, {
        source: { type: 'plugin', id: 'app' },
      })
      await flushMicrotasks()

      // Almeno cache.lookup + cache.hit emessi (D-161)
      expect(tapSteps.some((s) => s === 'event.cache.lookup')).toBe(true)
      expect(tapSteps.some((s) => s === 'event.cache.hit')).toBe(true)
    })
  })
})
