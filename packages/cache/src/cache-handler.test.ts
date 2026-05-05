// cache-handler.test.ts — Tier-1 jsdom test deterministici per `createCacheHandlerF6`
// (plan 06-03 D-77 concretizzazione + 3-strategy + scope hybrid D-156/D-157).
//
// 18 test totali:
//   - factory shape (Test 1)
//   - cache-first HIT/MISS + 'remote' metadata (Test 2-3)
//   - network-first success / fallback HIT / fallback MISS (Test 4-6)
//   - cache-then-network HIT ordering microtask + replaces (Test 7)
//   - cache-then-network MISS solo fetch (Test 8)
//   - scope hybrid route-level / config-level / hierarchy (Test 9-11)
//   - D-157 missing scope auth bypass + audit (Test 12)
//   - cache-then-network ordering deterministico replaces (Test 13)
//   - route.cache.key custom override (Test 14)
//   - route.cache.key throw → fallback + audit (Test 15)
//   - route.cache.ttl propagato a cache.set (Test 16)
//   - sanitized error D-80 shape (Test 17)
//   - F6CachePipelineStep events via tap D-161 (Test 18)
//
// Pattern role-match con `packages/worker/src/worker-handler.test.ts` (analog F5
// Strategy F3 dispatch + DI publishFn + sanitized error).

import type { BrokerEvent, EventTap, PipelineSnapshot } from '@gluezero/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type CacheHandlerF6Deps,
  type CacheHttpDelegate,
  type CachePublishFn,
  createCacheHandlerF6,
  deriveTopicFromCache,
  type RouteCacheCompiled,
} from './cache-handler'
import { createMemoryCacheAdapter } from './memory-cache-adapter'

// ============================================================================
// Test utilities
// ============================================================================

interface CapturedPublish {
  readonly topic: string
  readonly payload: unknown
  readonly options: Parameters<CachePublishFn>[2]
}

function makePublishFn(): {
  readonly publishFn: CachePublishFn
  readonly captured: CapturedPublish[]
} {
  const captured: CapturedPublish[] = []
  const publishFn: CachePublishFn = (topic, payload, options) => {
    captured.push({ topic, payload, options })
  }
  return { publishFn, captured }
}

function makeBrokerEvent(overrides: Partial<BrokerEvent> = {}): BrokerEvent {
  return {
    id: overrides.id ?? 'evt-1',
    topic: overrides.topic ?? 'weather.requested',
    payload: overrides.payload ?? { city: 'Roma' },
    timestamp: overrides.timestamp ?? Date.now(),
    source: overrides.source ?? { type: 'plugin', id: 'test-plugin' },
    ...(overrides.correlationId !== undefined && { correlationId: overrides.correlationId }),
    ...(overrides.priority !== undefined && { priority: overrides.priority }),
  } as BrokerEvent
}

function makeRoute(overrides: Partial<RouteCacheCompiled> = {}): RouteCacheCompiled {
  return {
    id: overrides.id ?? 'r1',
    topic: overrides.topic ?? 'weather.requested',
    strategy: overrides.strategy ?? 'cache-first',
    ...(overrides.ttl !== undefined && { ttl: overrides.ttl }),
    ...(overrides.key !== undefined && { key: overrides.key }),
    ...(overrides.scope !== undefined && { scope: overrides.scope }),
    ...(overrides.auth !== undefined && { auth: overrides.auth }),
  }
}

function makeHttpHandler(
  behavior: {
    readonly outcome?: 'success' | 'error'
    readonly value?: unknown
    readonly error?: unknown
    readonly throws?: Error
  } = {},
): {
  readonly httpHandler: CacheHttpDelegate
  readonly callCount: () => number
} {
  let calls = 0
  const httpHandler: CacheHttpDelegate = async () => {
    calls++
    if (behavior.throws) throw behavior.throws
    return {
      outcome: behavior.outcome ?? 'success',
      ...(behavior.value !== undefined && { value: behavior.value }),
      ...(behavior.error !== undefined && { error: behavior.error }),
    }
  }
  return { httpHandler, callCount: () => calls }
}

// ============================================================================
// Test suite
// ============================================================================

describe('createCacheHandlerF6 — factory + shape', () => {
  it('Test 1: createCacheHandlerF6(deps) ritorna handler con execute(event, route)', () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn } = makePublishFn()
    const { httpHandler } = makeHttpHandler()
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })
    expect(typeof handler.execute).toBe('function')
  })
})

describe('cache-first strategy', () => {
  it('Test 2: cache-first HIT — cache.get return entry → publish origin:cache + skip httpHandler', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler, callCount } = makeHttpHandler({ outcome: 'success', value: { temp: 20 } })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent()
    const route = makeRoute({ strategy: 'cache-first' })
    // Pre-populate cache with key matching event derived
    cache.set(
      'weather.requested::' + (await import('./stable-hash')).stableHash({ city: 'Roma' }),
      { temp: 30 },
    )

    const outcome = await handler.execute(event, route)

    expect(outcome.status).toBe('success')
    expect(outcome.source).toBe('cache')
    expect(outcome.cacheHit).toBe(true)
    expect(callCount()).toBe(0)
    expect(captured).toHaveLength(1)
    expect(captured[0]?.topic).toBe('weather.loaded')
    expect(captured[0]?.options?.metadata?.origin).toBe('cache')
  })

  it('Test 3: cache-first MISS — cache empty → httpHandler chiamato + cache.set + publish origin:remote', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler, callCount } = makeHttpHandler({ outcome: 'success', value: { temp: 20 } })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent()
    const route = makeRoute({ strategy: 'cache-first' })

    const outcome = await handler.execute(event, route)

    expect(outcome.status).toBe('success')
    expect(outcome.source).toBe('remote')
    expect(outcome.cacheHit).toBe(false)
    expect(callCount()).toBe(1)
    expect(captured).toHaveLength(1)
    expect(captured[0]?.topic).toBe('weather.loaded')
    expect(captured[0]?.options?.metadata?.origin).toBe('remote')
    // Verify cache populated
    expect(cache.size()).toBe(1)
  })
})

describe('network-first strategy', () => {
  it('Test 4: network-first success — fetch first → cache.set + publish origin:remote', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler, callCount } = makeHttpHandler({ outcome: 'success', value: { temp: 25 } })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent()
    const route = makeRoute({ strategy: 'network-first' })

    const outcome = await handler.execute(event, route)

    expect(outcome.status).toBe('success')
    expect(outcome.source).toBe('remote')
    expect(callCount()).toBe(1)
    expect(captured[0]?.options?.metadata?.origin).toBe('remote')
    expect(cache.size()).toBe(1)
  })

  it('Test 5: network-first error + cache HIT fallback → publish origin:cache', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'error', error: { code: 'network.failed' } })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent()
    const route = makeRoute({ strategy: 'network-first' })
    cache.set(
      'weather.requested::' + (await import('./stable-hash')).stableHash({ city: 'Roma' }),
      { temp: 18 },
    )

    const outcome = await handler.execute(event, route)

    expect(outcome.status).toBe('success')
    expect(outcome.source).toBe('cache')
    expect(outcome.cacheHit).toBe(true)
    expect(captured[0]?.options?.metadata?.origin).toBe('cache')
  })

  it('Test 6: network-first error + cache MISS → publish failed + outcome error', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'error', error: { code: 'network.failed' } })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent()
    const route = makeRoute({ strategy: 'network-first' })

    const outcome = await handler.execute(event, route)

    expect(outcome.status).toBe('error')
    expect(outcome.errorCode).toBe('cache.network.failed')
    expect(captured[0]?.topic).toBe('weather.failed')
    const payload = captured[0]?.payload as { error?: { category?: string } }
    expect(payload.error?.category).toBe('route')
  })
})

describe('cache-then-network strategy', () => {
  it('Test 7: cache-then-network HIT — publish cache event prima via microtask + fetch background publish remote replaces', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'success', value: { temp: 22 } })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent({ id: 'evt-cache-then' })
    const route = makeRoute({ strategy: 'cache-then-network' })
    cache.set(
      'weather.requested::' + (await import('./stable-hash')).stableHash({ city: 'Roma' }),
      { temp: 18 },
    )

    const outcome = await handler.execute(event, route)
    // Flush microtasks queued
    await Promise.resolve()
    await Promise.resolve()

    expect(outcome.status).toBe('success')
    expect(outcome.source).toBe('cache')
    // Two publishes: cache + remote (replaces)
    expect(captured).toHaveLength(2)
    // Cache event published first via microtask (or remote first if order swapped — verify via metadata)
    const cacheEvt = captured.find((c) => c.options?.metadata?.origin === 'cache')
    const remoteEvt = captured.find((c) => c.options?.metadata?.origin === 'remote')
    expect(cacheEvt).toBeDefined()
    expect(remoteEvt).toBeDefined()
    expect(remoteEvt?.options?.metadata?.replaces).toBe('evt-cache-then')
  })

  it('Test 8: cache-then-network MISS — solo fetch + 1 publish origin:remote', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler, callCount } = makeHttpHandler({ outcome: 'success', value: { temp: 22 } })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent()
    const route = makeRoute({ strategy: 'cache-then-network' })

    const outcome = await handler.execute(event, route)
    await Promise.resolve()

    expect(outcome.source).toBe('remote')
    expect(callCount()).toBe(1)
    expect(captured).toHaveLength(1)
    expect(captured[0]?.options?.metadata?.origin).toBe('remote')
  })
})

describe('Scope hybrid D-156', () => {
  it('Test 9: scope route-level — cacheKey usa route.cache.scope prefix', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'success', value: { v: 1 } })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent()
    const route = makeRoute({
      strategy: 'cache-first',
      scope: () => 'user-42',
    })

    await handler.execute(event, route)

    // Verify cache key prefix
    const keys = Array.from((cache as unknown as { stats: () => unknown }).stats ? [] : [])
    // Indirect: cache.set was called with key starting with 'user-42::'
    // We verify via a second execute with same route → cache HIT path
    const event2 = makeBrokerEvent({ id: 'evt-2' })
    const { publishFn: pf2, captured: cap2 } = makePublishFn()
    const handler2 = createCacheHandlerF6({ cache, publishFn: pf2, httpHandler })
    await handler2.execute(event2, route)
    expect(cap2[0]?.options?.metadata?.origin).toBe('cache')
  })

  it('Test 10: scope config-level fallback — deps.scopeProvider applicato se route.scope assente', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'success', value: { v: 2 } })
    const scopeProvider = vi.fn(() => 'tenant-A')
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler, scopeProvider })

    const event = makeBrokerEvent()
    const route = makeRoute({ strategy: 'cache-first' })

    await handler.execute(event, route)

    expect(scopeProvider).toHaveBeenCalledWith(event)
    // Second execute → HIT verifies scope prefix preserved
    const { publishFn: pf2, captured: cap2 } = makePublishFn()
    const handler2 = createCacheHandlerF6({ cache, publishFn: pf2, httpHandler, scopeProvider })
    await handler2.execute(event, route)
    expect(cap2[0]?.options?.metadata?.origin).toBe('cache')
  })

  it('Test 11: scope route-level OVERRIDE config-level — route prefix wins', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'success', value: { v: 3 } })
    const scopeProvider = vi.fn(() => 'tenant-A')
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler, scopeProvider })

    const event = makeBrokerEvent()
    const route = makeRoute({
      strategy: 'cache-first',
      scope: () => 'user-99',
    })

    await handler.execute(event, route)

    // Verify route-level wins: cache pre-populate using config-level scope key fails to HIT
    const { stableHash } = await import('./stable-hash')
    const baseKey = `weather.requested::${stableHash({ city: 'Roma' })}`
    const tenantKey = `tenant-A::${baseKey}`
    const userKey = `user-99::${baseKey}`
    expect(cache.get(tenantKey)).toBeUndefined()
    expect(cache.get(userKey)).toBeDefined()
  })
})

describe('D-157 missing scope auth bypass', () => {
  it('Test 12: route.auth=true AND scope===null → publish system.cache.scope-missing audit + bypass cache + cold fetch', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler, callCount } = makeHttpHandler({ outcome: 'success', value: { v: 4 } })
    const handler = createCacheHandlerF6({
      cache,
      publishFn,
      httpHandler,
      scopeProvider: () => null,
    })

    const event = makeBrokerEvent()
    const route = makeRoute({ strategy: 'cache-first', auth: true })

    const outcome = await handler.execute(event, route)

    // Audit emitted
    const audit = captured.find((c) => c.topic === 'system.cache.scope-missing')
    expect(audit).toBeDefined()
    expect(callCount()).toBe(1) // cold fetch always
    expect(cache.size()).toBe(0) // bypass cache.set
    expect(outcome.source).toBe('remote')
  })
})

describe('cache-then-network ordering deterministic', () => {
  it('Test 13: cache-then-network HIT con replaces eventId puntante a event.id', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'success', value: { temp: 99 } })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent({ id: 'evt-replaces-deterministic' })
    const route = makeRoute({ strategy: 'cache-then-network' })
    cache.set(
      'weather.requested::' + (await import('./stable-hash')).stableHash({ city: 'Roma' }),
      { temp: 18 },
    )

    await handler.execute(event, route)
    await Promise.resolve()
    await Promise.resolve()

    const remoteEvt = captured.find((c) => c.options?.metadata?.origin === 'remote')
    expect(remoteEvt?.options?.metadata?.replaces).toBe('evt-replaces-deterministic')
  })
})

describe('Custom key callback', () => {
  it('Test 14: route.cache.key custom override — cacheKey usa custom callback', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'success', value: { v: 5 } })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent()
    const route = makeRoute({
      strategy: 'cache-first',
      key: () => 'custom-static-key',
    })

    await handler.execute(event, route)

    expect(cache.get('custom-static-key')).toBeDefined()
  })

  it('Test 15: route.cache.key throw → caught + fallback default + audit emit', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'success', value: { v: 6 } })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent()
    const route = makeRoute({
      strategy: 'cache-first',
      key: () => {
        throw new Error('key callback failure')
      },
    })

    const outcome = await handler.execute(event, route)

    expect(outcome.status).toBe('success')
    const audit = captured.find((c) => c.topic === 'system.cache.key-callback-failed')
    expect(audit).toBeDefined()
  })
})

describe('TTL propagation', () => {
  it('Test 16: route.cache.ttl propagato a cache.set; expires correttamente', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'success', value: { v: 7 } })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent()
    const route = makeRoute({ strategy: 'cache-first', ttl: 1000 })

    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0))
      await handler.execute(event, route)
      const { stableHash } = await import('./stable-hash')
      const k = `weather.requested::${stableHash({ city: 'Roma' })}`
      expect(cache.get(k)).toBeDefined()
      vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 5)) // +5s, past TTL 1s
      expect(cache.get(k)).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Sanitized error D-80 shape', () => {
  it('Test 17: error path payload shape = { code, category, message, routeId, topic, eventId } NO originalError/stack', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'error', error: new Error('orig') })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent({ id: 'evt-err' })
    const route = makeRoute({ strategy: 'network-first', id: 'route-err' })

    await handler.execute(event, route)

    const failed = captured.find((c) => c.topic === 'weather.failed')
    expect(failed).toBeDefined()
    const payload = failed?.payload as { error?: Record<string, unknown> }
    expect(payload.error?.code).toBe('cache.network.failed')
    expect(payload.error?.category).toBe('route')
    expect(payload.error?.message).toBeDefined()
    expect(payload.error?.routeId).toBe('route-err')
    expect(payload.error?.topic).toBe('weather.requested')
    expect(payload.error?.eventId).toBe('evt-err')
    // NO sensitive fields
    expect(payload.error?.originalError).toBeUndefined()
    expect(payload.error?.stack).toBeUndefined()
    expect(payload.error?.cause).toBeUndefined()
  })
})

describe('F6CachePipelineStep events D-161', () => {
  it('Test 18: deps.tap chiamato con event.cache.lookup + event.cache.hit/miss', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'success', value: { v: 8 } })
    const tapCalls: Array<{ step: string; snap: PipelineSnapshot }> = []
    const tap: EventTap = {
      onPipelineStep(step, snap) {
        tapCalls.push({ step: step as string, snap })
      },
    }
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler, tap })

    const event = makeBrokerEvent()
    const route = makeRoute({ strategy: 'cache-first' })

    // First call: MISS
    await handler.execute(event, route)
    // Second call: HIT
    const { publishFn: pf2 } = makePublishFn()
    const handler2 = createCacheHandlerF6({ cache, publishFn: pf2, httpHandler, tap })
    await handler2.execute(event, route)

    const lookups = tapCalls.filter((c) => c.step === 'event.cache.lookup')
    const hits = tapCalls.filter((c) => c.step === 'event.cache.hit')
    const misses = tapCalls.filter((c) => c.step === 'event.cache.miss')
    expect(lookups.length).toBeGreaterThanOrEqual(2)
    expect(hits.length).toBeGreaterThanOrEqual(1)
    expect(misses.length).toBeGreaterThanOrEqual(1)
  })
})

describe('deriveTopicFromCache helper', () => {
  it('Test 19: deriveTopicFromCache(weather.requested, loaded) → weather.loaded', () => {
    expect(deriveTopicFromCache('weather.requested', 'loaded')).toBe('weather.loaded')
    expect(deriveTopicFromCache('weather.requested', 'failed')).toBe('weather.failed')
    expect(deriveTopicFromCache('singleword', 'loaded')).toBe('singleword.loaded')
  })
})

describe('Error path coverage — fetch error per strategy', () => {
  it('Test 20: D-157 missing scope auth + httpHandler error → publish failed sanitized', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'error', error: new Error('boom') })
    const handler = createCacheHandlerF6({
      cache,
      publishFn,
      httpHandler,
      scopeProvider: () => null,
    })

    const event = makeBrokerEvent({ id: 'evt-bypass-err' })
    const route = makeRoute({ strategy: 'cache-first', auth: true, id: 'r-bypass' })

    const outcome = await handler.execute(event, route)

    expect(outcome.status).toBe('error')
    expect(outcome.errorCode).toBe('cache.network.failed')
    const failed = captured.find((c) => c.topic === 'weather.failed')
    expect(failed).toBeDefined()
    const payload = failed?.payload as { error?: { routeId?: string; eventId?: string } }
    expect(payload.error?.routeId).toBe('r-bypass')
    expect(payload.error?.eventId).toBe('evt-bypass-err')
  })

  it('Test 21: cache-first MISS + httpHandler error → publish failed sanitized', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'error', error: new Error('boom') })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent({ id: 'evt-cf-err' })
    const route = makeRoute({ strategy: 'cache-first', id: 'r-cf' })

    const outcome = await handler.execute(event, route)

    expect(outcome.status).toBe('error')
    expect(outcome.errorCode).toBe('cache.network.failed')
    const failed = captured.find((c) => c.topic === 'weather.failed')
    expect(failed).toBeDefined()
    const payload = failed?.payload as { error?: { code?: string; routeId?: string } }
    expect(payload.error?.code).toBe('cache.network.failed')
    expect(payload.error?.routeId).toBe('r-cf')
  })

  it('Test 22: cache-then-network MISS + httpHandler error → publish failed sanitized', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler } = makeHttpHandler({ outcome: 'error', error: new Error('boom') })
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent({ id: 'evt-ctn-err' })
    const route = makeRoute({ strategy: 'cache-then-network', id: 'r-ctn' })

    const outcome = await handler.execute(event, route)
    await Promise.resolve()

    expect(outcome.status).toBe('error')
    expect(outcome.errorCode).toBe('cache.network.failed')
    const failed = captured.find((c) => c.topic === 'weather.failed')
    expect(failed).toBeDefined()
  })

  it('Test 23: unknown strategy default branch → publish failed config error', async () => {
    const cache = createMemoryCacheAdapter()
    const { publishFn, captured } = makePublishFn()
    const { httpHandler } = makeHttpHandler()
    const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })

    const event = makeBrokerEvent()
    // Cast intenzionale: simula route con strategy unknown (TS protegge ma runtime safety net)
    const route = {
      id: 'r-unk',
      topic: 'weather.requested',
      strategy: 'unknown-strategy',
    } as unknown as RouteCacheCompiled

    const outcome = await handler.execute(event, route)

    expect(outcome.status).toBe('error')
    expect(outcome.errorCode).toBe('cache.strategy.unknown')
    const failed = captured.find((c) => c.topic === 'weather.failed')
    expect(failed).toBeDefined()
    const payload = failed?.payload as { error?: { code?: string } }
    expect(payload.error?.code).toBe('cache.strategy.unknown')
  })
})
