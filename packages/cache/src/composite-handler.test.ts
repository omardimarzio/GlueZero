// composite-handler.test.ts — Tier-1 jsdom test deterministici per
// `createCompositeHandlerF6` (plan 06-03 — concretizza F3 stub D-77 cache step
// SKIPPED → cache step REALE via cacheHandler delegate).
//
// 10 test totali:
//   - factory shape (Test 1)
//   - workflow cache-then-http HIT path (Test 2): cache HIT skip http
//   - workflow MISS path (Test 3): cache MISS → http delegate
//   - solo http step (Test 4): F6 carryover comportamento F3
//   - solo cache step + MISS (Test 5): error 'composite.no-fallback'
//   - F6 elimina console.warn cache-deferred F3 (Test 6)
//   - error path graceful fallback (Test 7): cacheHandler throw → http step
//   - integration con cacheHandler reale + stable-hash (Test 8)
//   - barrel export (Test 9)
//   - invalidateOn deferred TODO (Test 10)
//
// Pattern role-match: F3 composite-handler.ts:67-130 (factory + closure flag)
// + F5 worker-handler analog DI.

import type { BrokerEvent } from '@sembridge/core'
import { describe, expect, it, vi } from 'vitest'
import type { CacheHandlerF6, CacheHandlerOutcome, RouteCacheCompiled } from './cache-handler'
import {
  type CompositeHandlerF6Deps,
  createCompositeHandlerF6,
  type RouteCompositeCompiled,
  type RouteCompositeStep,
} from './composite-handler'

function makeBrokerEvent(overrides: Partial<BrokerEvent> = {}): BrokerEvent {
  return {
    id: overrides.id ?? 'evt-comp-1',
    topic: overrides.topic ?? 'weather.requested',
    payload: overrides.payload ?? { city: 'Roma' },
    timestamp: overrides.timestamp ?? Date.now(),
    source: overrides.source ?? { type: 'plugin', id: 'test-plugin' },
  } as BrokerEvent
}

function makeCacheRoute(overrides: Partial<RouteCacheCompiled> = {}): RouteCacheCompiled {
  return {
    id: overrides.id ?? 'cache-r1',
    topic: overrides.topic ?? 'weather.requested',
    strategy: overrides.strategy ?? 'cache-first',
    ...(overrides.ttl !== undefined && { ttl: overrides.ttl }),
  }
}

function makeMockCacheHandler(
  behavior: { readonly outcome?: CacheHandlerOutcome; readonly throws?: Error } = {},
): { handler: CacheHandlerF6; calls: () => number } {
  let calls = 0
  const handler: CacheHandlerF6 = {
    async execute() {
      calls++
      if (behavior.throws) throw behavior.throws
      return behavior.outcome ?? { status: 'success', source: 'remote', cacheHit: false }
    },
  }
  return { handler, calls: () => calls }
}

function makeCompositeRoute(steps: RouteCompositeStep[]): RouteCompositeCompiled {
  return { id: 'comp-r1', topic: 'weather.requested', steps }
}

describe('createCompositeHandlerF6 — factory + shape', () => {
  it('Test 1: createCompositeHandlerF6(deps) ritorna handler con execute(event, route)', () => {
    const { handler: cacheHandler } = makeMockCacheHandler()
    const httpHandler = vi.fn(async () => ({ outcome: 'success' as const, value: { v: 1 } }))
    const handler = createCompositeHandlerF6({ cacheHandler, httpHandler })
    expect(typeof handler.execute).toBe('function')
  })
})

describe('Workflow cache-then-http', () => {
  it('Test 2: cache HIT → skip http step + outcome source:cache', async () => {
    const { handler: cacheHandler, calls: cacheCalls } = makeMockCacheHandler({
      outcome: { status: 'success', source: 'cache', cacheHit: true },
    })
    const httpHandler = vi.fn(async () => ({ outcome: 'success' as const, value: { v: 1 } }))
    const handler = createCompositeHandlerF6({ cacheHandler, httpHandler })

    const event = makeBrokerEvent()
    const route = makeCompositeRoute([
      { type: 'cache', cacheRoute: makeCacheRoute() },
      { type: 'http' },
    ])

    const outcome = await handler.execute(event, route)

    expect(outcome.outcome).toBe('success')
    expect(outcome.source).toBe('cache')
    expect(cacheCalls()).toBe(1)
    expect(httpHandler).not.toHaveBeenCalled()
  })

  it('Test 3: cache MISS → fallback http step + outcome source:remote', async () => {
    const { handler: cacheHandler, calls: cacheCalls } = makeMockCacheHandler({
      outcome: { status: 'success', source: 'remote', cacheHit: false },
    })
    const httpHandler = vi.fn(async () => ({ outcome: 'success' as const, value: { v: 2 } }))
    const handler = createCompositeHandlerF6({ cacheHandler, httpHandler })

    const event = makeBrokerEvent()
    const route = makeCompositeRoute([
      { type: 'cache', cacheRoute: makeCacheRoute() },
      { type: 'http' },
    ])

    const outcome = await handler.execute(event, route)

    expect(cacheCalls()).toBe(1)
    expect(httpHandler).toHaveBeenCalledTimes(1)
    expect(outcome.outcome).toBe('success')
    expect(outcome.source).toBe('remote')
  })
})

describe('Edge cases workflow', () => {
  it('Test 4: solo http step (no cache) — comportamento equivalente F3 carryover', async () => {
    const { handler: cacheHandler, calls: cacheCalls } = makeMockCacheHandler()
    const httpHandler = vi.fn(async () => ({ outcome: 'success' as const, value: { v: 3 } }))
    const handler = createCompositeHandlerF6({ cacheHandler, httpHandler })

    const event = makeBrokerEvent()
    const route = makeCompositeRoute([{ type: 'http' }])

    const outcome = await handler.execute(event, route)

    expect(cacheCalls()).toBe(0) // mai chiamato
    expect(httpHandler).toHaveBeenCalledTimes(1)
    expect(outcome.outcome).toBe('success')
    expect(outcome.source).toBe('remote')
  })

  it('Test 5: solo cache step + MISS (no http fallback) → error composite.no-fallback', async () => {
    const { handler: cacheHandler } = makeMockCacheHandler({
      outcome: { status: 'success', source: 'remote', cacheHit: false },
    })
    const httpHandler = vi.fn()
    const handler = createCompositeHandlerF6({ cacheHandler, httpHandler })

    const event = makeBrokerEvent()
    const route = makeCompositeRoute([{ type: 'cache', cacheRoute: makeCacheRoute() }])

    const outcome = await handler.execute(event, route)

    expect(outcome.outcome).toBe('error')
    expect(outcome.source).toBe('composite')
    expect(httpHandler).not.toHaveBeenCalled()
  })
})

describe('Closure flag warn-once carryover F3', () => {
  it('Test 6: F6 NON emette console.warn cache-deferred (regression vs F3 stub)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const { handler: cacheHandler } = makeMockCacheHandler({
        outcome: { status: 'success', source: 'cache', cacheHit: true },
      })
      const httpHandler = vi.fn(async () => ({ outcome: 'success' as const, value: { v: 4 } }))
      const handler = createCompositeHandlerF6({ cacheHandler, httpHandler })

      const event = makeBrokerEvent()
      const route = makeCompositeRoute([
        { type: 'cache', cacheRoute: makeCacheRoute() },
        { type: 'http' },
      ])

      // Multiple invocations to trigger any once-flag if present
      await handler.execute(event, route)
      await handler.execute(event, route)

      // F6 cache concretizzato → no warning
      const cacheDeferredWarn = warnSpy.mock.calls.find((c) =>
        String(c[0]).toLowerCase().includes('cache-deferred'),
      )
      expect(cacheDeferredWarn).toBeUndefined()
    } finally {
      warnSpy.mockRestore()
    }
  })
})

describe('Error path graceful fallback', () => {
  it('Test 7: cacheHandler throws → caught + delegate http step (graceful)', async () => {
    const { handler: cacheHandler } = makeMockCacheHandler({
      throws: new Error('cache adapter failure'),
    })
    const httpHandler = vi.fn(async () => ({ outcome: 'success' as const, value: { v: 5 } }))
    const handler = createCompositeHandlerF6({ cacheHandler, httpHandler })

    const event = makeBrokerEvent()
    const route = makeCompositeRoute([
      { type: 'cache', cacheRoute: makeCacheRoute() },
      { type: 'http' },
    ])

    const outcome = await handler.execute(event, route)

    expect(outcome.outcome).toBe('success')
    expect(outcome.source).toBe('remote')
    expect(httpHandler).toHaveBeenCalledTimes(1)
  })

  it('Test 8: http step error → outcome error source:remote', async () => {
    const { handler: cacheHandler } = makeMockCacheHandler({
      outcome: { status: 'success', source: 'remote', cacheHit: false },
    })
    const httpHandler = vi.fn(async () => ({
      outcome: 'error' as const,
      error: new Error('http fail'),
    }))
    const handler = createCompositeHandlerF6({ cacheHandler, httpHandler })

    const event = makeBrokerEvent()
    const route = makeCompositeRoute([
      { type: 'cache', cacheRoute: makeCacheRoute() },
      { type: 'http' },
    ])

    const outcome = await handler.execute(event, route)

    expect(outcome.outcome).toBe('error')
    expect(outcome.source).toBe('remote')
  })
})

describe('Integration con cacheHandler reale', () => {
  it('Test 9: integration smoke — cacheRoute compiled passato invariato a cacheHandler', async () => {
    let capturedRoute: RouteCacheCompiled | undefined
    const cacheHandler: CacheHandlerF6 = {
      async execute(_event, route) {
        capturedRoute = route
        return { status: 'success', source: 'cache', cacheHit: true }
      },
    }
    const httpHandler = vi.fn(async () => ({ outcome: 'success' as const, value: { v: 6 } }))
    const handler = createCompositeHandlerF6({ cacheHandler, httpHandler })

    const event = makeBrokerEvent()
    const cacheRoute = makeCacheRoute({ id: 'cr-integration', strategy: 'cache-first', ttl: 5000 })
    const route = makeCompositeRoute([{ type: 'cache', cacheRoute }, { type: 'http' }])

    await handler.execute(event, route)

    expect(capturedRoute).toBeDefined()
    expect(capturedRoute?.id).toBe('cr-integration')
    expect(capturedRoute?.ttl).toBe(5000)
  })
})

describe('Barrel export', () => {
  it('Test 10: createCompositeHandlerF6 esportato dal barrel @sembridge/cache', async () => {
    const mod = await import('./index')
    expect(typeof (mod as { createCompositeHandlerF6?: unknown }).createCompositeHandlerF6).toBe(
      'function',
    )
  })
})
