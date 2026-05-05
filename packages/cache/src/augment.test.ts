// augment.test.ts — verifica TS declaration merging F6 Cache layer (D-155, D-156,
// D-158, Pattern S1).
//
// Test prevalentemente compile-time: se `augment.ts` non esegue correttamente
// il declaration merging, il typecheck di questo file fallisce (TS error 2339
// "Property X does not exist on type Y" o 2322 "Type X is not assignable to Y").
//
// Test runtime minimal: `__augmentCacheLoaded` const verifica che il
// side-effect import non venga tree-shaken e non lanci errori a load time
// (T-06-01-01 mitigation).
//
// Pattern role-match con `packages/worker/src/augment.test.ts` (analog F5)
// replicato (vedi 06-PATTERNS.md §"augment.test.ts").

import type { BrokerConfig, BrokerEvent } from '@gluezero/core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { __augmentCacheLoaded, type F6CachePipelineStep } from './augment'
import type { CacheAdapter, CacheConfig, CacheEntry, CacheStats } from './types'

describe('augment.ts (F6 TS declaration merging — plan 06-01)', () => {
  it('Test 1: __augmentCacheLoaded const true exported (Pattern S1 anti tree-shake — T-06-01-01)', () => {
    expect(__augmentCacheLoaded).toBe(true)
  })

  it('Test 2: F6CachePipelineStep literal union has 4 exact members (D-161 lifecycle events)', () => {
    const steps: readonly F6CachePipelineStep[] = [
      'event.cache.lookup',
      'event.cache.hit',
      'event.cache.miss',
      'event.cache.evicted',
    ] as const
    expect(steps).toHaveLength(4)
    expect(steps[0]).toBe('event.cache.lookup')
    expect(steps[3]).toBe('event.cache.evicted')
  })

  it('Test 3: BrokerConfig.cache field accepts CacheConfig shape (D-155/D-158)', () => {
    expectTypeOf<BrokerConfig>().toHaveProperty('cache')
    expectTypeOf<BrokerConfig['cache']>().toMatchTypeOf<CacheConfig | undefined>()

    const config: BrokerConfig = {
      cache: {
        maxEntries: 500,
      },
    }
    expect(config.cache?.maxEntries).toBe(500)
  })

  it('Test 4: BrokerConfig.cache.adapter accetta CacheAdapter custom (D-158 swap)', () => {
    const stubAdapter: CacheAdapter = {
      get: () => undefined,
      set: () => undefined,
      delete: () => false,
      invalidate: () => 0,
      size: () => 0,
      clear: () => undefined,
      stats: (): CacheStats => ({ hits: 0, misses: 0, evictions: 0, entries: 0 }),
    }

    const config: BrokerConfig = {
      cache: {
        adapter: stubAdapter,
      },
    }
    expect(config.cache?.adapter).toBe(stubAdapter)
    expect(config.cache?.adapter?.size()).toBe(0)
  })

  it('Test 5: BrokerConfig.cache.scopeProvider accetta callback (event) => string | null | undefined (D-156)', () => {
    const config: BrokerConfig = {
      cache: {
        scopeProvider: (event: BrokerEvent) =>
          (event.metadata?.['userId'] as string | undefined) ?? null,
      },
    }

    const fakeEvent = {
      id: 'e1',
      topic: 't',
      payload: undefined,
      metadata: { userId: 'u-42' },
    } as unknown as BrokerEvent

    expect(config.cache?.scopeProvider?.(fakeEvent)).toBe('u-42')
  })

  it('Test 6: Coexistence con F2/F3/F4/F5 augmentations (cumulative decl merging — T-06-01-03)', () => {
    // Type-level test — se compila, il decl merging F2/F3/F4/F5/F6 coesiste in
    // BrokerConfig su FIELD DISGIUNTI (canonicalModel/aliasRegistry/transforms F2
    // + routes/routing/gateway F3 + realtime F4 + workers F5 + cache F6).
    const config: BrokerConfig = {
      cache: { maxEntries: 1000 },
      workers: { assertSerializable: 'off' },
      realtime: { channels: [] },
      gateway: { auth: { getToken: async () => 'tok' } },
      canonicalModel: { schemas: [] },
      routes: [],
    }
    expect(config.cache?.maxEntries).toBe(1000)
    expect(config.workers?.assertSerializable).toBe('off')
    expect(config.realtime?.channels).toEqual([])
    expect(config.gateway?.auth).toBeDefined()
  })

  it('Test 7: CacheEntry shape readonly value/expiresAt/setAt (D-158)', () => {
    const entry: CacheEntry<{ rows: number }> = {
      value: { rows: 42 },
      expiresAt: Number.POSITIVE_INFINITY,
      setAt: Date.now(),
    }
    expect(entry.value.rows).toBe(42)
    expect(entry.expiresAt).toBe(Number.POSITIVE_INFINITY)
    expect(entry.setAt).toBeGreaterThan(0)
  })

  it('Test 8: CacheStats shape readonly cumulative counters (D-164 cumulative-only)', () => {
    const stats: CacheStats = {
      hits: 100,
      misses: 25,
      evictions: 3,
      entries: 72,
    }
    expect(stats.hits).toBe(100)
    expect(stats.misses).toBe(25)
    expect(stats.evictions).toBe(3)
    expect(stats.entries).toBe(72)
    expectTypeOf<CacheStats>().toMatchTypeOf<{
      readonly hits: number
      readonly misses: number
      readonly evictions: number
      readonly entries: number
    }>()
  })
})
