// tap-events.test.ts — Tier-1 jsdom integration test tap lifecycle events
// cache.lookup/hit/miss (D-161 step 14 readiness — DevtoolsBroker 06-08b consumer).
//
// Plan 06-08a Wave 4a — verifica che il tap forwarding optional via
// `config.runtime.tap` propaghi gli eventi lifecycle del CacheHandlerF6 al
// consumer (in V1 il DevtoolsBroker 06-08b wires il MultiplexTap su questo
// hook).

import type { EventTap, PipelineSnapshot } from '@sembridge/core'
import { afterEach, describe, expect, it } from 'vitest'
import { createCacheHarness, type CacheHarness } from '../test-utils/cache-harness'

function makeRecorderTap(): { tap: EventTap; steps: string[] } {
  const steps: string[] = []
  const tap: EventTap = {
    onPipelineStep: (_step, snap: PipelineSnapshot) => {
      steps.push(snap.step as string)
    },
  } as EventTap
  return { tap, steps }
}

describe('tap-events integration — D-161 lifecycle events forwarding', () => {
  let harness: CacheHarness

  afterEach(() => {
    harness?.reset()
  })

  it('cache HIT → tap riceve event.cache.lookup + event.cache.hit', async () => {
    const { tap, steps } = makeRecorderTap()
    harness = createCacheHarness({
      runtime: { tap },
      cacheRoutes: [
        {
          type: 'cache',
          id: 'r-tap-hit',
          topic: 'data.requested',
          strategy: 'cache-first',
          ttl: 60_000,
          key: () => 'fixed-cache-key',
        },
      ],
      httpDelegate: async () => ({ outcome: 'success', value: { fresh: true } }),
    })

    harness.adapter.set('fixed-cache-key', { cached: true }, 60_000)

    await harness.publish('data.requested', {}, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.flushAsync()

    expect(steps).toContain('event.cache.lookup')
    expect(steps).toContain('event.cache.hit')
  })

  it('cache MISS → tap riceve event.cache.lookup + event.cache.miss', async () => {
    const { tap, steps } = makeRecorderTap()
    harness = createCacheHarness({
      runtime: { tap },
      cacheRoutes: [
        {
          type: 'cache',
          id: 'r-tap-miss',
          topic: 'data.requested',
          strategy: 'cache-first',
          ttl: 60_000,
          key: () => 'cold-cache-key',
        },
      ],
      httpDelegate: async () => ({ outcome: 'success', value: { fresh: true } }),
    })

    await harness.publish('data.requested', {}, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.flushAsync()

    expect(steps).toContain('event.cache.lookup')
    expect(steps).toContain('event.cache.miss')
    expect(steps).not.toContain('event.cache.hit')
  })

  it('multiple publish → multipli eventi tap (D-161 cumulative readiness)', async () => {
    const { tap, steps } = makeRecorderTap()
    harness = createCacheHarness({
      runtime: { tap },
      cacheRoutes: [
        {
          type: 'cache',
          id: 'r-tap-multi',
          topic: 'multi.requested',
          strategy: 'cache-first',
          ttl: 60_000,
          key: (ev) => `multi::${(ev.payload as { id: number }).id}`,
        },
      ],
      httpDelegate: async () => ({ outcome: 'success', value: { v: 1 } }),
    })

    await harness.publish('multi.requested', { id: 1 }, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.publish('multi.requested', { id: 2 }, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.publish('multi.requested', { id: 1 }, {
      source: { type: 'plugin', id: 'app' },
    })
    await harness.flushAsync()

    const lookupCount = steps.filter((s) => s === 'event.cache.lookup').length
    expect(lookupCount).toBe(3)
    const missCount = steps.filter((s) => s === 'event.cache.miss').length
    const hitCount = steps.filter((s) => s === 'event.cache.hit').length
    expect(missCount).toBe(2)
    expect(hitCount).toBe(1)
  })
})
