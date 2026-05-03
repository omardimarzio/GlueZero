// handlers.test.ts — Test deterministici per i 3 route handler F3 (local/cache/composite).
//
// Behavior coperti (5 test):
// - Test 1: localHandler ritorna RouteOutcome.ok passthrough (D-60, ROUTE-02)
// - Test 2: cacheHandler stub F6 ritorna RouteOutcome.error code='cache.not-implemented'
//           (ROUTE-04, deferred F6)
// - Test 3: compositeHandler con steps [{cache},{http,route:'weather-http'}] skipa cache,
//           invoca httpHandler con sub-route, ritorna outcome del http-handler
//           (Open Question Q3 RESEARCH: opzione b — skip cache + warning una volta)
// - Test 4: compositeHandler senza step http → RouteOutcome.error code='route.composite.no-http'
// - Test 5: compositeHandler emette callback `cache-deferred` UNA volta (verifica via spy)
//
// Vincolo D-83: NESSUNA modifica a packages/core/ né packages/mapper/ runtime.

import type { BrokerEvent } from '@sembridge/core'
import { describe, expect, it, vi } from 'vitest'
import type { CompiledRoute } from '../route-resolver'
import type {
  RouteCompositeDefinition,
  RouteHttpDefinition,
  RouteLocalDefinition,
} from '../types/route-definition'
import type { RouteOutcome } from '../types/route-outcome'
import { cacheHandler } from './cache-handler'
import { createCompositeHandler } from './composite-handler'
import { localHandler } from './local-handler'

function makeEvent(topic: string, payload: unknown): BrokerEvent {
  return {
    id: `evt-${topic}-${Math.random().toString(36).slice(2, 8)}`,
    topic,
    timestamp: Date.now(),
    source: { type: 'plugin', id: 'test-plugin' },
    payload: payload as never,
  }
}

function makeLocalRoute(id: string, topic: string): CompiledRoute {
  const def: RouteLocalDefinition = { id, type: 'local', topic }
  return { id, definition: def, ownerId: undefined, priority: 0 }
}

function makeHttpRoute(id: string, topic: string): CompiledRoute {
  const def: RouteHttpDefinition = {
    id,
    type: 'http',
    topic,
    request: { method: 'GET', url: '/api/test' },
    response: { canonical: 'test' },
  }
  return { id, definition: def, ownerId: undefined, priority: 0 }
}

function makeCompositeRoute(
  id: string,
  topic: string,
  steps: RouteCompositeDefinition['steps'],
): CompiledRoute {
  const def: RouteCompositeDefinition = { id, type: 'composite', topic, steps }
  return { id, definition: def, ownerId: undefined, priority: 0 }
}

describe('localHandler', () => {
  it('ritorna RouteOutcome.ok passthrough con canonicalPayload === event.payload', () => {
    const event = makeEvent('weather.loaded', { temp: 22 })
    const route = makeLocalRoute('weather-local', 'weather.loaded')

    const outcome = localHandler(event, route)

    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.canonicalPayload).toEqual({ temp: 22 })
      expect(outcome.canonicalPayload).toBe(event.payload)
      expect(outcome.routeId).toBe('weather-local')
    }
  })
})

describe('cacheHandler', () => {
  it('stub F3: ritorna RouteOutcome.error code=cache.not-implemented category=config (ROUTE-04)', () => {
    const event = makeEvent('weather.requested', { location: 'Roma' })
    const route: CompiledRoute = {
      id: 'weather-cache',
      definition: {
        id: 'weather-cache',
        type: 'cache',
        topic: 'weather.requested',
        strategy: 'cache-first',
      },
      ownerId: undefined,
      priority: 0,
    }

    const outcome = cacheHandler(event, route)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('cache.not-implemented')
      expect(outcome.error.category).toBe('config')
      expect(outcome.error.message).toMatch(/Phase 6|F6/)
      expect(outcome.routeId).toBe('weather-cache')
      // D-80 shape: routeId + topic + eventId
      expect(outcome.error.routeId).toBe('weather-cache')
      expect(outcome.error.topic).toBe('weather.requested')
      expect(outcome.error.eventId).toBe(event.id)
    }
  })
})

describe('compositeHandler', () => {
  it('skipa cache + invoca httpHandler con sub-route + ritorna outcome del http-handler (Q3 opzione b)', async () => {
    const event = makeEvent('weather.requested', { location: 'Roma' })
    const compositeRoute = makeCompositeRoute('weather-composite', 'weather.requested', [
      { type: 'cache' },
      { type: 'http', route: 'weather-http' },
    ])
    const subHttpRoute = makeHttpRoute('weather-http', 'weather.requested')

    const httpHandlerMock = vi.fn(
      async (_e: BrokerEvent, _r: CompiledRoute): Promise<RouteOutcome> => ({
        ok: true,
        canonicalPayload: { location: 'Roma', temp: 22 },
        routeId: 'weather-http',
      }),
    )
    const resolveSubRouteMock = vi.fn((id: string) =>
      id === 'weather-http' ? subHttpRoute : undefined,
    )

    const handler = createCompositeHandler({
      httpHandler: httpHandlerMock,
      resolveSubRoute: resolveSubRouteMock,
    })

    const outcome = await handler(event, compositeRoute)

    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.canonicalPayload).toEqual({ location: 'Roma', temp: 22 })
      expect(outcome.routeId).toBe('weather-http')
    }
    // httpHandler invocato con il sub-route corretto
    expect(httpHandlerMock).toHaveBeenCalledTimes(1)
    expect(httpHandlerMock).toHaveBeenCalledWith(event, subHttpRoute)
    // resolveSubRoute invocato con 'weather-http'
    expect(resolveSubRouteMock).toHaveBeenCalledWith('weather-http')
  })

  it('senza step http → RouteOutcome.error code=route.composite.no-http', async () => {
    const event = makeEvent('weather.requested', { location: 'Roma' })
    const compositeRoute = makeCompositeRoute('only-cache', 'weather.requested', [
      { type: 'cache' },
      { type: 'publish' },
    ])

    const handler = createCompositeHandler({
      httpHandler: vi.fn(),
      resolveSubRoute: vi.fn(),
    })

    const outcome = await handler(event, compositeRoute)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('route.composite.no-http')
      expect(outcome.error.category).toBe('config')
      expect(outcome.routeId).toBe('only-cache')
    }
  })

  it('emette callback cache-deferred UNA SOLA volta anche su invocazioni multiple', async () => {
    const event1 = makeEvent('weather.requested', { location: 'Roma' })
    const event2 = makeEvent('weather.requested', { location: 'Milano' })
    const compositeRoute = makeCompositeRoute('weather-composite', 'weather.requested', [
      { type: 'cache' },
      { type: 'http', route: 'weather-http' },
    ])
    const subHttpRoute = makeHttpRoute('weather-http', 'weather.requested')

    const onCacheDeferredSpy = vi.fn()
    const handler = createCompositeHandler({
      httpHandler: async () => ({
        ok: true,
        canonicalPayload: {},
        routeId: 'weather-http',
      }),
      resolveSubRoute: () => subHttpRoute,
      onCacheDeferred: onCacheDeferredSpy,
    })

    await handler(event1, compositeRoute)
    await handler(event2, compositeRoute)
    await handler(event1, compositeRoute)

    expect(onCacheDeferredSpy).toHaveBeenCalledTimes(1)
    expect(onCacheDeferredSpy).toHaveBeenCalledWith({
      topic: 'weather.requested',
      routeId: 'weather-composite',
    })
  })
})
