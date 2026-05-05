// cache-then-network.test.ts — Tier-1 jsdom integration test ordering microtask
// deterministic + scope D-156 + edge cases.
//
// Plan 06-08a Wave 4a — RESEARCH §15.6 critical: cache HIT publish DEVE arrivare
// PRIMA del network response (queueMicrotask SYNC pattern preservato dal
// CacheHandlerF6 06-03 — composition wrapper NON re-ordina).
//
// Threat coverage:
// - T-06-08a-04 (Logic flaw cache-then-network ordering inverted post composition):
//   verificato dal test ordering deterministic.

import { afterEach, describe, expect, it } from 'vitest'
import { createCacheHarness, type CacheHarness } from '../test-utils/cache-harness'

describe('cache-then-network integration — ordering microtask deterministic', () => {
  let harness: CacheHarness

  afterEach(() => {
    harness?.reset()
  })

  it('cache HIT pubblicato PRIMA della network response (queueMicrotask sync ordering)', async () => {
    harness = createCacheHarness({
      cacheRoutes: [
        {
          type: 'cache',
          id: 'r-ctn',
          topic: 'feed.requested',
          strategy: 'cache-then-network',
          ttl: 60_000,
          key: () => 'fixed-feed-key',
        },
      ],
      httpDelegate: async () => {
        await new Promise((resolve) => setTimeout(resolve, 30))
        return { outcome: 'success', value: { items: ['fresh'] } }
      },
    })

    harness.adapter.set('fixed-feed-key', { items: ['cached'] }, 60_000)

    await harness.publish('feed.requested', {}, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.flushAsync()

    const loadedSoFar = harness.events.filter((e) => e.topic === 'feed.loaded')
    expect(loadedSoFar.length).toBeGreaterThanOrEqual(1)
    expect((loadedSoFar[0].payload as { items: string[] }).items).toEqual(['cached'])

    await harness.flushAsync(50)

    const allLoaded = harness.events.filter((e) => e.topic === 'feed.loaded')
    expect(allLoaded.length).toBe(2)
    expect((allLoaded[1].payload as { items: string[] }).items).toEqual(['fresh'])
  })

  it('cache MISS in cache-then-network → solo fetch (no cache publish)', async () => {
    let fetchCount = 0
    harness = createCacheHarness({
      cacheRoutes: [
        {
          type: 'cache',
          id: 'r-ctn-miss',
          topic: 'feed.requested',
          strategy: 'cache-then-network',
          ttl: 60_000,
        },
      ],
      httpDelegate: async () => {
        fetchCount++
        return { outcome: 'success', value: { items: ['fresh'] } }
      },
    })

    await harness.publish('feed.requested', {}, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.flushAsync()

    expect(fetchCount).toBe(1)
    const loaded = harness.events.filter((e) => e.topic === 'feed.loaded')
    expect(loaded).toHaveLength(1)
    expect((loaded[0].payload as { items: string[] }).items).toEqual(['fresh'])
  })

  it('scope D-156 cache-then-network — userA HIT, userB cold MISS', async () => {
    let fetchCount = 0
    let currentUser = 'userA'
    harness = createCacheHarness({
      cache: {
        scopeProvider: () => currentUser,
      },
      cacheRoutes: [
        {
          type: 'cache',
          id: 'r-ctn-scope',
          topic: 'feed.requested',
          strategy: 'cache-then-network',
          ttl: 60_000,
        },
      ],
      httpDelegate: async () => {
        fetchCount++
        return { outcome: 'success', value: { user: currentUser, gen: fetchCount } }
      },
    })

    currentUser = 'userA'
    await harness.publish('feed.requested', {}, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.flushAsync()
    expect(fetchCount).toBe(1)

    currentUser = 'userB'
    harness.reset()
    await harness.publish('feed.requested', {}, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.flushAsync()
    expect(fetchCount).toBe(2)
    const loaded = harness.events.find((e) => e.topic === 'feed.loaded')
    expect((loaded!.payload as { user: string }).user).toBe('userB')
  })
})
