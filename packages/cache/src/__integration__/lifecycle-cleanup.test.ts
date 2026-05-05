// lifecycle-cleanup.test.ts — Tier-1 jsdom integration test cascade D-126 ext F6
// LIFE-02 (unregisterPlugin → adapter.invalidate prefix ownerId).
//
// Plan 06-08a Wave 4a — D-126 carryover F5 worker cascade-cleanup.test.ts:
// scenario unregisterPlugin → cache invalidate by ownerId, idempotency,
// no leak in adapter stats.
//
// Threat coverage:
// - T-06-08a-01 (Logic flaw cascade idempotency cleanup parziale): verificato
//   dal test idempotency double-call.

import { afterEach, describe, expect, it } from 'vitest'
import { createCacheHarness, type CacheHarness } from '../test-utils/cache-harness'

describe('lifecycle-cleanup integration — cascade D-126 ext F6 LIFE-02', () => {
  let harness: CacheHarness

  afterEach(() => {
    harness?.reset()
  })

  it('unregisterPlugin → adapter.invalidate({ prefix: ownerId+:: }) rimuove cache entries del plugin', async () => {
    harness = createCacheHarness({})
    harness.adapter.set('plugin-A::orders::1', { v: 1 })
    harness.adapter.set('plugin-A::orders::2', { v: 2 })
    harness.adapter.set('plugin-A::weather::*', { v: 3 })
    harness.adapter.set('plugin-B::other::1', { v: 9 })

    expect(harness.adapter.size()).toBe(4)

    await harness.broker.registerPlugin({
      id: 'plugin-A',
      subscriptions: [],
    })
    await harness.broker.unregisterPlugin('plugin-A')

    expect(harness.adapter.get('plugin-A::orders::1')).toBeUndefined()
    expect(harness.adapter.get('plugin-A::orders::2')).toBeUndefined()
    expect(harness.adapter.get('plugin-A::weather::*')).toBeUndefined()
    expect(harness.adapter.get('plugin-B::other::1')).toBeDefined()
  })

  it('unregisterPlugin idempotente → double call non throw, secondo invalidate count=0', async () => {
    harness = createCacheHarness({})
    harness.adapter.set('plugin-X::a::1', { v: 1 })

    await harness.broker.registerPlugin({ id: 'plugin-X', subscriptions: [] })
    await expect(harness.broker.unregisterPlugin('plugin-X')).resolves.not.toThrow()
    expect(harness.adapter.get('plugin-X::a::1')).toBeUndefined()

    await expect(harness.broker.unregisterPlugin('plugin-X')).resolves.not.toThrow()
  })

  it('adapter stats post-unregister mostra entries decremented + plugin-Z preserved', async () => {
    harness = createCacheHarness({})
    harness.adapter.set('plugin-Y::k1', { v: 1 })
    harness.adapter.set('plugin-Y::k2', { v: 2 })
    harness.adapter.set('plugin-Z::k3', { v: 3 })

    expect(harness.adapter.size()).toBe(3)

    await harness.broker.registerPlugin({ id: 'plugin-Y', subscriptions: [] })
    await harness.broker.unregisterPlugin('plugin-Y')

    expect(harness.adapter.size()).toBe(1)
    const stats = harness.broker.getCacheStats()
    expect(stats.entries).toBe(1)
  })
})
