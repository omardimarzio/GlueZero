// outcome-collector.test.ts — Test per OutcomeCollector (D-80, D-81, D-82, ROUTE-12).
//
// Behavior coperti (8 test):
// - Test 1: outcome.ok → publishFn invocato con `<topic-prefix>.loaded` + canonicalPayload + metadata
// - Test 2: outcome.ok con `route.publishes.success: 'weather.fresh'` → publishFn invocato con override
// - Test 3: outcome.error category='validation' → publishFn invocato con `<topic-prefix>.failed` + payload BrokerError shape D-80
// - Test 4: outcome.error category='network' → DUE publishFn calls: `<topic-prefix>.failed` E `network.error` (D-81)
// - Test 5: due `collect` consecutivi con stesso eventId → solo UNA publishFn call (recursion guard D-82)
// - Test 6: tap.onPipelineStep invocato con `'event.outcome.collected'` PRIMA del publish
// - Test 7: topic prefix resolution per multi-segmento (es. `weather.alert.requested` → loaded `weather.alert.loaded`)
// - Test 8: outcome.error con `originalError` → published payload include shape sanitized SENZA stack/originalError ma CON code/category/message/details

import type { BrokerEvent, EventTap, PipelineSnapshot, PipelineStep } from '@sembridge/core'
import { createBrokerError } from '@sembridge/core'
import { describe, expect, it, vi } from 'vitest'
import { OutcomeCollector } from './outcome-collector'
import type { CompiledRoute } from './route-resolver'
import type { RouteHttpDefinition, RouteLocalDefinition } from './types/route-definition'
import type { RouteOutcome } from './types/route-outcome'

function makeEvent(id: string, topic: string, payload: unknown = {}): BrokerEvent {
  return {
    id,
    topic,
    timestamp: Date.now(),
    source: { type: 'plugin', id: 'test' },
    payload: payload as never,
  }
}

function makeLocalRoute(id: string, topic: string): CompiledRoute {
  const definition: RouteLocalDefinition = { id, type: 'local', topic }
  return { id, definition, ownerId: undefined, priority: 0 }
}

function makeHttpRoute(
  id: string,
  topic: string,
  publishes?: { success?: string; error?: string },
): CompiledRoute {
  const definition: RouteHttpDefinition = {
    id,
    type: 'http',
    topic,
    request: { method: 'GET', url: '/api/test' },
    response: { canonical: 'test' },
    ...(publishes !== undefined && { publishes }),
  }
  return { id, definition, ownerId: undefined, priority: 0 }
}

describe('OutcomeCollector.collect', () => {
  it('Test 1: outcome.ok → publishFn invocato con `<topic-prefix>.loaded` + canonicalPayload + metadata', () => {
    const publishFn = vi.fn()
    const collector = new OutcomeCollector({ publishFn })
    const event = makeEvent('e-1', 'weather.requested')
    const route = makeHttpRoute('weather-http', 'weather.requested')
    const outcome: RouteOutcome = {
      ok: true,
      canonicalPayload: { location: 'Roma', temperature_celsius: 22 },
      routeId: 'weather-http',
      metadata: { origin: 'remote', httpStatus: 200, attemptCount: 1 },
    }

    collector.collect(outcome, route, event)

    expect(publishFn).toHaveBeenCalledTimes(1)
    expect(publishFn).toHaveBeenCalledWith(
      'weather.loaded',
      expect.objectContaining({
        location: 'Roma',
        temperature_celsius: 22,
        metadata: { origin: 'remote', httpStatus: 200, attemptCount: 1 },
      }),
      expect.objectContaining({
        source: { type: 'system', id: 'router' },
        correlationId: 'e-1',
      }),
    )
  })

  it("Test 2: outcome.ok con `route.publishes.success: 'weather.fresh'` → publishFn invocato con override", () => {
    const publishFn = vi.fn()
    const collector = new OutcomeCollector({ publishFn })
    const event = makeEvent('e-2', 'weather.requested')
    const route = makeHttpRoute('weather-http', 'weather.requested', {
      success: 'weather.fresh',
      error: 'weather.broken',
    })
    const outcome: RouteOutcome = {
      ok: true,
      canonicalPayload: { temp: 22 },
      routeId: 'weather-http',
    }

    collector.collect(outcome, route, event)

    expect(publishFn).toHaveBeenCalledTimes(1)
    expect(publishFn.mock.calls[0]?.[0]).toBe('weather.fresh')
  })

  it("Test 3: outcome.error category='validation' → publishFn invocato con `<topic-prefix>.failed` + payload BrokerError shape D-80", () => {
    const publishFn = vi.fn()
    const collector = new OutcomeCollector({ publishFn })
    const event = makeEvent('e-3', 'weather.requested')
    const route = makeHttpRoute('weather-http', 'weather.requested')
    const error = createBrokerError({
      code: 'response.validation.failed',
      category: 'validation',
      message: 'Response shape mismatch',
      routeId: 'weather-http',
      topic: 'weather.requested',
      eventId: 'e-3',
      details: { field: 'temp' },
    })
    const outcome: RouteOutcome = { ok: false, error, routeId: 'weather-http' }

    collector.collect(outcome, route, event)

    expect(publishFn).toHaveBeenCalledTimes(1)
    const [topic, payload, options] = publishFn.mock.calls[0]!
    expect(topic).toBe('weather.failed')
    expect(payload).toMatchObject({
      error: {
        code: 'response.validation.failed',
        category: 'validation',
        message: 'Response shape mismatch',
        routeId: 'weather-http',
        topic: 'weather.requested',
        eventId: 'e-3',
        details: { field: 'temp' },
      },
      sourceEvent: { topic: 'weather.requested', eventId: 'e-3' },
      routeId: 'weather-http',
    })
    expect(options).toMatchObject({
      source: { type: 'system', id: 'router' },
      correlationId: 'e-3',
    })
  })

  it("Test 4: outcome.error category='network' → DUE publishFn calls: `<topic-prefix>.failed` E `network.error` (D-81)", () => {
    const publishFn = vi.fn()
    const collector = new OutcomeCollector({ publishFn })
    const event = makeEvent('e-4', 'weather.requested')
    const route = makeHttpRoute('weather-http', 'weather.requested')
    const error = createBrokerError({
      code: 'gateway.network',
      category: 'network',
      message: 'Network error: offline',
      routeId: 'weather-http',
      topic: 'weather.requested',
      eventId: 'e-4',
    })
    const outcome: RouteOutcome = { ok: false, error, routeId: 'weather-http' }

    collector.collect(outcome, route, event)

    expect(publishFn).toHaveBeenCalledTimes(2)
    expect(publishFn.mock.calls[0]?.[0]).toBe('weather.failed')
    expect(publishFn.mock.calls[1]?.[0]).toBe('network.error')
    expect(publishFn.mock.calls[1]?.[1]).toMatchObject({
      error: { code: 'gateway.network', category: 'network' },
      sourceEvent: { topic: 'weather.requested', eventId: 'e-4' },
      routeId: 'weather-http',
    })
  })

  it('Test 5: due `collect` consecutivi con stesso eventId → solo UNA publishFn call (recursion guard D-82)', () => {
    const publishFn = vi.fn()
    let reentrantCalled = false
    // Quando publishFn viene invocato la prima volta, simuliamo un re-entry sincrono
    // sullo stesso outcome (loop pubblicazione → handler → collect di nuovo).
    publishFn.mockImplementation(() => {
      if (!reentrantCalled) {
        reentrantCalled = true
        collector.collect(outcome, route, event)
      }
    })
    const collector = new OutcomeCollector({ publishFn })
    const event = makeEvent('e-5', 'weather.requested')
    const route = makeHttpRoute('weather-http', 'weather.requested')
    const outcome: RouteOutcome = {
      ok: true,
      canonicalPayload: { temp: 22 },
      routeId: 'weather-http',
    }

    collector.collect(outcome, route, event)

    // Recursion guard: la chiamata reentrante deve essere bloccata.
    expect(publishFn).toHaveBeenCalledTimes(1)
    expect(reentrantCalled).toBe(true)
  })

  it("Test 6: tap.onPipelineStep invocato con `'event.outcome.collected'` PRIMA del publish", () => {
    const callOrder: string[] = []
    const tap: EventTap = {
      onPipelineStep(step: PipelineStep, _snapshot: PipelineSnapshot) {
        callOrder.push(`tap:${step}`)
      },
    }
    const publishFn = vi.fn(() => {
      callOrder.push('publish')
    })
    const collector = new OutcomeCollector({ publishFn, tap })
    const event = makeEvent('e-6', 'weather.requested')
    const route = makeHttpRoute('weather-http', 'weather.requested')
    const outcome: RouteOutcome = {
      ok: true,
      canonicalPayload: { temp: 22 },
      routeId: 'weather-http',
    }

    collector.collect(outcome, route, event)

    expect(callOrder).toEqual(['tap:event.outcome.collected', 'publish'])
  })

  it('Test 7: topic prefix resolution per multi-segmento (`weather.alert.requested` → `weather.alert.loaded`/`weather.alert.failed`)', () => {
    const publishFn = vi.fn()
    const collector = new OutcomeCollector({ publishFn })
    const event = makeEvent('e-7', 'weather.alert.requested')
    const route = makeLocalRoute('weather-alert', 'weather.alert.requested')

    // Success
    collector.collect(
      { ok: true, canonicalPayload: { alert: 'storm' }, routeId: 'weather-alert' },
      route,
      event,
    )
    expect(publishFn.mock.calls[0]?.[0]).toBe('weather.alert.loaded')

    // Error
    const event2 = makeEvent('e-7b', 'weather.alert.requested')
    const error = createBrokerError({
      code: 'gateway.5xx',
      category: 'network',
      message: 'Server error',
    })
    collector.collect({ ok: false, error, routeId: 'weather-alert' }, route, event2)
    // Error genera 2 publish (failed + network.error perché category='network')
    expect(publishFn.mock.calls[1]?.[0]).toBe('weather.alert.failed')
    expect(publishFn.mock.calls[2]?.[0]).toBe('network.error')
  })

  it('Test 8: outcome.error con `originalError` → payload sanitized SENZA stack/originalError ma CON code/category/message/details', () => {
    const publishFn = vi.fn()
    const collector = new OutcomeCollector({ publishFn })
    const event = makeEvent('e-8', 'weather.requested')
    const route = makeHttpRoute('weather-http', 'weather.requested')
    const cause = new Error('underlying cause with stack')
    const error = createBrokerError({
      code: 'gateway.5xx',
      category: 'validation',
      message: 'Server returned 500',
      details: { httpStatus: 500 },
      originalError: cause,
      routeId: 'weather-http',
      topic: 'weather.requested',
      eventId: 'e-8',
    })
    const outcome: RouteOutcome = { ok: false, error, routeId: 'weather-http' }

    collector.collect(outcome, route, event)

    expect(publishFn).toHaveBeenCalledTimes(1)
    const payload = publishFn.mock.calls[0]?.[1] as { error: Record<string, unknown> }
    // Shape sanitized DEVE contenere code/category/message/details + ids
    expect(payload.error).toMatchObject({
      code: 'gateway.5xx',
      category: 'validation',
      message: 'Server returned 500',
      details: { httpStatus: 500 },
      routeId: 'weather-http',
      topic: 'weather.requested',
      eventId: 'e-8',
    })
    // Shape sanitized NON DEVE contenere originalError, cause, o stack
    expect(payload.error).not.toHaveProperty('originalError')
    expect(payload.error).not.toHaveProperty('cause')
    expect(payload.error).not.toHaveProperty('stack')
  })
})
