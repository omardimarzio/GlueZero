// cache-flow.test.ts — Tier-1 jsdom integration test cache-first HIT/MISS +
// scope D-156 user isolation + invalidate API.
//
// Plan 06-08a Wave 4a — D-151 carryover F5: integration test 3-tier strategy
// pattern. Esercita la pipeline §28 step 9 (dispatch cache) PIENA via
// CacheHarness wildcard subscribe multi-depth (W-3 closure F4).
//
// Threat coverage:
// - T-06-08a-02 (Information Disclosure cache cross-tenant via missing scope):
//   verificato dal test scope isolation user A vs user B.

import { afterEach, describe, expect, it } from 'vitest'
import { createCacheHarness, type CacheHarness } from '../test-utils/cache-harness'

describe('cache-flow integration — cache-first HIT/MISS + scope + invalidate', () => {
  let harness: CacheHarness

  afterEach(() => {
    harness?.reset()
  })

  it('cache-first MISS → httpDelegate fetch + cache.set + publish loaded(remote)', async () => {
    let fetchCount = 0
    harness = createCacheHarness({
      cacheRoutes: [
        {
          type: 'cache',
          id: 'r-1',
          topic: 'weather.requested',
          strategy: 'cache-first',
          ttl: 60_000,
        },
      ],
      httpDelegate: async () => {
        fetchCount++
        return { outcome: 'success', value: { temp: 20, source: 'api' } }
      },
    })

    await harness.publish('weather.requested', { city: 'Roma' }, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.flushAsync()

    const loaded = harness.events.find((e) => e.topic === 'weather.loaded')
    expect(loaded).toBeDefined()
    expect(loaded!.payload).toEqual({ temp: 20, source: 'api' })
    expect(fetchCount).toBe(1)
  })

  it('cache-first HIT (second call) → no fetch + publish loaded(cache)', async () => {
    let fetchCount = 0
    harness = createCacheHarness({
      cacheRoutes: [
        {
          type: 'cache',
          id: 'r-1',
          topic: 'weather.requested',
          strategy: 'cache-first',
          ttl: 60_000,
        },
      ],
      httpDelegate: async () => {
        fetchCount++
        return { outcome: 'success', value: { temp: 22 } }
      },
    })

    await harness.publish('weather.requested', { city: 'Roma' }, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.flushAsync()
    expect(fetchCount).toBe(1)

    harness.reset()

    await harness.publish('weather.requested', { city: 'Roma' }, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.flushAsync()

    expect(fetchCount).toBe(1)
    const loaded = harness.events.find((e) => e.topic === 'weather.loaded')
    expect(loaded).toBeDefined()
    expect(loaded!.payload).toEqual({ temp: 22 })
  })

  it('scope D-156 user isolation — userA HIT NON visibile a userB (cold MISS)', async () => {
    let fetchCount = 0
    let currentUser = 'userA'
    harness = createCacheHarness({
      cache: {
        scopeProvider: () => currentUser,
      },
      cacheRoutes: [
        {
          type: 'cache',
          id: 'r-multi',
          topic: 'orders.requested',
          strategy: 'cache-first',
          ttl: 60_000,
        },
      ],
      httpDelegate: async () => {
        fetchCount++
        return { outcome: 'success', value: { user: currentUser, count: fetchCount } }
      },
    })

    currentUser = 'userA'
    await harness.publish('orders.requested', {}, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.flushAsync()
    expect(fetchCount).toBe(1)

    currentUser = 'userB'
    harness.reset()
    await harness.publish('orders.requested', {}, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.flushAsync()
    expect(fetchCount).toBe(2)
    const loaded = harness.events.find((e) => e.topic === 'orders.loaded')
    expect((loaded!.payload as { user: string }).user).toBe('userB')
  })

  it('invalidate via adapter prefix → next request MISS (re-fetch)', async () => {
    let fetchCount = 0
    harness = createCacheHarness({
      cache: {
        scopeProvider: () => 'tenantX',
      },
      cacheRoutes: [
        {
          type: 'cache',
          id: 'r-inv',
          topic: 'data.requested',
          strategy: 'cache-first',
          ttl: 60_000,
        },
      ],
      httpDelegate: async () => {
        fetchCount++
        return { outcome: 'success', value: { gen: fetchCount } }
      },
    })

    await harness.publish('data.requested', {}, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.flushAsync()
    expect(fetchCount).toBe(1)

    const removed = harness.adapter.invalidate({ prefix: 'tenantX::' })
    expect(removed).toBeGreaterThan(0)

    harness.reset()
    await harness.publish('data.requested', {}, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.flushAsync()
    expect(fetchCount).toBe(2)
  })
})
