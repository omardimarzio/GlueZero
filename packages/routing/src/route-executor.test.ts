// route-executor.test.ts — Test per RouteExecutor (D-65, ROUTE-02..05, ROUTE-13).
//
// Behavior coperti (8 test):
// - Test 1: execute(localRoute) ritorna RouteOutcome.ok del localHandler
// - Test 2: execute(cacheRoute) ritorna RouteOutcome.error 'cache.not-implemented'
// - Test 3: execute(httpRoute) con httpHandler mock → ritorna outcome del mock
// - Test 4: execute(compositeRoute) workflow → delega a httpHandler con sub-route
// - Test 5: abortInFlight(eventId) → controller.signal.aborted === true
// - Test 6: abortInFlightByOwner('plugin-A') aborta solo route con ownerId === 'plugin-A'
// - Test 7: emette tap step `event.route.executed` via callback (verifica via spy)
// - Test 8: route.type sconosciuto → RouteOutcome.error 'route.type.unknown'

import type { BrokerEvent, EventTap, PipelineSnapshot, PipelineStep } from '@gluezero/core'
import { describe, expect, it, vi } from 'vitest'
import { RouteExecutor } from './route-executor'
import type { CompiledRoute } from './route-resolver'
import type {
  RouteCacheDefinition,
  RouteCompositeDefinition,
  RouteHttpDefinition,
  RouteLocalDefinition,
} from './types/route-definition'
import type { RouteOutcome } from './types/route-outcome'

function makeEvent(id: string, topic: string, payload: unknown): BrokerEvent {
  return {
    id,
    topic,
    timestamp: Date.now(),
    source: { type: 'plugin', id: 'test' },
    payload: payload as never,
  }
}

function makeRoute(
  id: string,
  topic: string,
  type: 'local' | 'http' | 'cache' | 'composite',
  ownerId?: string,
  steps?: RouteCompositeDefinition['steps'],
): CompiledRoute {
  let definition:
    | RouteLocalDefinition
    | RouteHttpDefinition
    | RouteCacheDefinition
    | RouteCompositeDefinition
  if (type === 'local') {
    definition = { id, type: 'local', topic }
  } else if (type === 'http') {
    definition = {
      id,
      type: 'http',
      topic,
      request: { method: 'GET', url: '/api/test' },
      response: { canonical: 'test' },
    }
  } else if (type === 'cache') {
    definition = { id, type: 'cache', topic, strategy: 'cache-first' }
  } else {
    definition = {
      id,
      type: 'composite',
      topic,
      steps: steps ?? [{ type: 'http', route: 'sub-http' }],
    }
  }
  return { id, definition, ownerId, priority: 0 }
}

describe('RouteExecutor.execute', () => {
  it('Test 1: dispatch a local → RouteOutcome.ok del localHandler (passthrough)', async () => {
    const executor = new RouteExecutor({
      httpHandler: vi.fn(),
      resolveSubRoute: vi.fn(),
    })
    const event = makeEvent('e-1', 'weather.loaded', { temp: 22 })
    const route = makeRoute('weather-local', 'weather.loaded', 'local')

    const outcome = await executor.execute(route, event)

    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.canonicalPayload).toEqual({ temp: 22 })
      expect(outcome.routeId).toBe('weather-local')
    }
  })

  it("Test 2: dispatch a cache → RouteOutcome.error code='cache.not-implemented'", async () => {
    const executor = new RouteExecutor({
      httpHandler: vi.fn(),
      resolveSubRoute: vi.fn(),
    })
    const event = makeEvent('e-2', 'weather.requested', {})
    const route = makeRoute('weather-cache', 'weather.requested', 'cache')

    const outcome = await executor.execute(route, event)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('cache.not-implemented')
      expect(outcome.error.category).toBe('config')
    }
  })

  it('Test 3: dispatch a http → invoca httpHandler mock con AbortSignal e ritorna outcome del mock', async () => {
    const httpHandlerMock = vi.fn(
      async (_e: BrokerEvent, _r: CompiledRoute, signal: AbortSignal): Promise<RouteOutcome> => {
        expect(signal).toBeInstanceOf(AbortSignal)
        return { ok: true, canonicalPayload: { ok: 'http' }, routeId: 'weather-http' }
      },
    )
    const executor = new RouteExecutor({
      httpHandler: httpHandlerMock,
      resolveSubRoute: vi.fn(),
    })
    const event = makeEvent('e-3', 'weather.requested', {})
    const route = makeRoute('weather-http', 'weather.requested', 'http')

    const outcome = await executor.execute(route, event)

    expect(httpHandlerMock).toHaveBeenCalledTimes(1)
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.canonicalPayload).toEqual({ ok: 'http' })
    }
  })

  it("Test 4: dispatch a composite → workflow delega all'httpHandler con sub-route", async () => {
    const subRoute = makeRoute('sub-http', 'weather.requested', 'http')
    const httpHandlerMock = vi.fn(
      async (_e: BrokerEvent, r: CompiledRoute): Promise<RouteOutcome> => ({
        ok: true,
        canonicalPayload: { from: r.id },
        routeId: r.id,
      }),
    )
    const resolveSubRoute = vi.fn((id: string) => (id === 'sub-http' ? subRoute : undefined))
    const executor = new RouteExecutor({
      httpHandler: httpHandlerMock,
      resolveSubRoute,
    })
    const event = makeEvent('e-4', 'weather.requested', {})
    const route = makeRoute('weather-composite', 'weather.requested', 'composite', undefined, [
      { type: 'http', route: 'sub-http' },
    ])

    const outcome = await executor.execute(route, event)

    expect(outcome.ok).toBe(true)
    expect(httpHandlerMock).toHaveBeenCalledTimes(1)
    if (outcome.ok) {
      expect(outcome.canonicalPayload).toEqual({ from: 'sub-http' })
    }
  })

  it('Test 5: abortInFlight(eventId) durante execute http → controller.signal.aborted === true', async () => {
    let capturedSignal: AbortSignal | undefined
    let resolveHttp: ((v: RouteOutcome) => void) | undefined
    const httpHandlerMock = vi.fn(
      (_e: BrokerEvent, _r: CompiledRoute, signal: AbortSignal): Promise<RouteOutcome> => {
        capturedSignal = signal
        return new Promise<RouteOutcome>((resolve) => {
          resolveHttp = resolve
        })
      },
    )
    const executor = new RouteExecutor({
      httpHandler: httpHandlerMock,
      resolveSubRoute: vi.fn(),
    })
    const event = makeEvent('e-5', 'weather.requested', {})
    const route = makeRoute('weather-http', 'weather.requested', 'http')

    const promise = executor.execute(route, event)
    // microtask yield così httpHandler captura signal
    await Promise.resolve()
    expect(capturedSignal).toBeInstanceOf(AbortSignal)
    expect(capturedSignal?.aborted).toBe(false)

    const aborted = executor.abortInFlight('e-5', 'gateway.aborted')
    expect(aborted).toBe(true)
    expect(capturedSignal?.aborted).toBe(true)

    // unblock pending promise per evitare leak
    resolveHttp?.({ ok: false, error: new Error('aborted') as never, routeId: route.id })
    await promise
  })

  it("Test 6: abortInFlightByOwner('plugin-A') aborta solo route con ownerId === 'plugin-A'", async () => {
    const signals: { ownerId: string; signal: AbortSignal }[] = []
    let resolveAll: (() => void) | undefined
    const allDone = new Promise<void>((resolve) => {
      resolveAll = resolve
    })
    let countResolved = 0
    const httpHandlerMock = vi.fn(
      (_e: BrokerEvent, r: CompiledRoute, signal: AbortSignal): Promise<RouteOutcome> => {
        signals.push({ ownerId: r.ownerId ?? 'none', signal })
        return new Promise<RouteOutcome>((resolve) => {
          // resolve once aborted o tramite resolveAll
          signal.addEventListener('abort', () => {
            countResolved++
            resolve({ ok: false, error: new Error('aborted') as never, routeId: r.id })
            if (countResolved === 3 && resolveAll) resolveAll()
          })
        })
      },
    )
    const executor = new RouteExecutor({
      httpHandler: httpHandlerMock,
      resolveSubRoute: vi.fn(),
    })

    const routeA1 = makeRoute('r-a-1', 'a.requested', 'http', 'plugin-A')
    const routeA2 = makeRoute('r-a-2', 'a.requested', 'http', 'plugin-A')
    const routeB = makeRoute('r-b', 'b.requested', 'http', 'plugin-B')

    const eventA1 = makeEvent('e-a-1', 'a.requested', {})
    const eventA2 = makeEvent('e-a-2', 'a.requested', {})
    const eventB = makeEvent('e-b', 'b.requested', {})

    const pA1 = executor.execute(routeA1, eventA1)
    const pA2 = executor.execute(routeA2, eventA2)
    const pB = executor.execute(routeB, eventB)
    await Promise.resolve()
    expect(executor.inFlightCount()).toBe(3)

    const count = executor.abortInFlightByOwner('plugin-A', 'plugin.unregistered')
    expect(count).toBe(2)
    // signals aborted: A1 + A2 yes, B no
    expect(signals.find((s) => s.ownerId === 'plugin-A' && s.signal.aborted)).toBeTruthy()
    const aSignals = signals.filter((s) => s.ownerId === 'plugin-A')
    expect(aSignals.every((s) => s.signal.aborted)).toBe(true)
    const bSignal = signals.find((s) => s.ownerId === 'plugin-B')
    expect(bSignal?.signal.aborted).toBe(false)

    // Cleanup: aborto anche B per non leak la promise
    executor.abortInFlightByOwner('plugin-B')
    await allDone
    await pA1
    await pA2
    await pB
  })

  it('Test 7: emette tap step `event.route.executed` con metadata routeId/routeType/ok', async () => {
    const taps: { step: PipelineStep; snapshot: PipelineSnapshot }[] = []
    const tap: EventTap = {
      onPipelineStep(step, snapshot) {
        taps.push({ step, snapshot })
      },
    }
    const executor = new RouteExecutor({
      httpHandler: vi.fn(),
      resolveSubRoute: vi.fn(),
      tap,
    })
    const event = makeEvent('e-7', 'weather.loaded', { temp: 22 })
    const route = makeRoute('weather-local', 'weather.loaded', 'local')

    await executor.execute(route, event)

    expect(taps).toHaveLength(1)
    expect(taps[0]?.step).toBe('event.route.executed')
    expect(taps[0]?.snapshot.eventId).toBe('e-7')
    expect(taps[0]?.snapshot.topic).toBe('weather.loaded')
    expect(taps[0]?.snapshot.metadata).toMatchObject({
      routeId: 'weather-local',
      routeType: 'local',
      ok: true,
    })
  })

  it("Test 8: route.type sconosciuto → RouteOutcome.error code='route.type.unknown'", async () => {
    const executor = new RouteExecutor({
      httpHandler: vi.fn(),
      resolveSubRoute: vi.fn(),
    })
    const event = makeEvent('e-8', 'weather.requested', {})
    // Forziamo un type sconosciuto via cast (test difensivo del default branch)
    const badRoute = {
      id: 'unknown-route',
      definition: {
        id: 'unknown-route',
        topic: 'weather.requested',
        type: 'worker', // future F5 type non implementato in F3
      } as unknown as RouteLocalDefinition,
      ownerId: undefined,
      priority: 0,
    } as unknown as CompiledRoute

    const outcome = await executor.execute(badRoute, event)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('route.type.unknown')
      expect(outcome.error.category).toBe('config')
      expect(outcome.error.message).toMatch(/worker|Unknown/)
    }
  })
})
