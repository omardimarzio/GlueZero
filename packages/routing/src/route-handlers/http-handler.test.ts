// http-handler.test.ts — Test deterministici per createHttpHandler (Task 3 plan 03-08).
//
// 7 behavior coperti (uno per success criterion del plan):
// - Test 1: createHttpHandler ritorna un handler async function
// - Test 2: handler costruisce HttpRequestSpec via mapper.mapToShape (queryMap)
// - Test 3: gateway.execute success 200 → mapper.mapToCanonical applicato
//           + valibotAdapter.validate ok → RouteOutcome.ok con metadata
//           {httpStatus:200, attemptCount:1, origin:'remote'}
// - Test 4: gateway.execute 500 → RouteOutcome.error code='gateway.5xx' category='network'
// - Test 5: gateway throws 'gateway.url.forbidden' → RouteOutcome.error
//           code='gateway.url.forbidden' category='config'
// - Test 6: response validation fail → RouteOutcome.error code='response.validation.failed'
//           category='validation' con dettagli issues (VAL-05)
// - Test 7: gateway throws con AbortError signal aborted → RouteOutcome.error
//           code='gateway.aborted'
//
// I dependencies sono mockati: gateway, mapper, validator sono interface strutturali
// (la concreta implementazione è wired dal RouterBroker plan 03-12).
//
// Vincolo D-83: ZERO modifiche packages/core/ + packages/mapper/ runtime.

import type { BrokerEvent } from '@sembridge/core'
import { createBrokerError } from '@sembridge/core'
import { describe, expect, it, vi } from 'vitest'
import type { CompiledRoute } from '../route-resolver'
import type { RouteHttpDefinition } from '../types/route-definition'
import { createHttpHandler, type HttpHandlerDeps } from './http-handler'

// ---------- Test fixtures ----------

function makeEvent(overrides: Partial<BrokerEvent> = {}): BrokerEvent {
  return {
    id: 'evt-1',
    topic: 'weather.requested',
    timestamp: 0,
    payload: { location: 'Roma', forecast_date: '2026-04-30' },
    source: { type: 'plugin', id: 'p1' },
    metadata: {},
    ...overrides,
  } as BrokerEvent
}

function makeHttpRoute(): CompiledRoute {
  const def: RouteHttpDefinition = {
    id: 'weather-http',
    type: 'http',
    topic: 'weather.requested',
    request: {
      method: 'GET',
      url: 'https://api.example.com/v1/weather',
      queryMap: {} as never,
    },
    response: { canonical: 'weather' },
  }
  return { id: def.id, definition: def, ownerId: undefined, priority: 0 }
}

function makeMockGateway(executeImpl: HttpHandlerDeps['gateway']['execute']): HttpHandlerDeps['gateway'] {
  return {
    execute: executeImpl,
  }
}

const noopMapper: HttpHandlerDeps['mapper'] = {
  mapToShape: vi.fn().mockReturnValue({ city: 'Roma', date: '2026-04-30' }),
  mapToCanonical: vi.fn().mockReturnValue({ location: 'Roma', temperature: 22 }),
}

const noopValidatorOk: NonNullable<HttpHandlerDeps['validator']> = {
  validate: vi.fn().mockReturnValue({ ok: true }),
}

const minimalStrategies: HttpHandlerDeps['strategies'] = {}

describe('createHttpHandler (Task 3 plan 03-08, ROUTE-03 + ROUTE-06 + VAL-05)', () => {
  it('1. createHttpHandler returns async handler function', () => {
    const gateway = makeMockGateway(vi.fn().mockResolvedValue({ ok: true, status: 200, headers: {}, body: {} }))
    const handler = createHttpHandler({
      gateway,
      mapper: noopMapper,
      validator: noopValidatorOk,
      strategies: minimalStrategies,
    })
    expect(typeof handler).toBe('function')
    expect(handler.constructor.name).toBe('AsyncFunction')
  })

  it('2. handler builds HttpRequestSpec via mapper.mapToShape (queryMap)', async () => {
    const mapToShape = vi.fn().mockReturnValue({ city: 'Roma', date: '2026-04-30' })
    const mapToCanonical = vi.fn().mockReturnValue({ location: 'Roma' })
    const execute = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: {}, body: {} })

    const handler = createHttpHandler({
      gateway: { execute },
      mapper: { mapToShape, mapToCanonical },
      validator: noopValidatorOk,
      strategies: minimalStrategies,
    })
    const event = makeEvent()
    const route = makeHttpRoute()
    await handler(event, route, new AbortController().signal)

    // mapToShape invocato con event.payload + queryMap della route
    expect(mapToShape).toHaveBeenCalledTimes(1)
    expect(mapToShape).toHaveBeenCalledWith(event.payload, expect.anything())

    // gateway.execute invocato con request.url contenente query string
    expect(execute).toHaveBeenCalledTimes(1)
    const httpRequest = execute.mock.calls[0]![0] as { url: string; method: string }
    expect(httpRequest.method).toBe('GET')
    expect(httpRequest.url).toContain('https://api.example.com/v1/weather')
    expect(httpRequest.url).toContain('city=Roma')
    expect(httpRequest.url).toContain('date=2026-04-30')
  })

  it('3. success path: 200 → RouteOutcome.ok with metadata httpStatus/attemptCount/origin', async () => {
    const handler = createHttpHandler({
      gateway: makeMockGateway(
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: { temp_c: 22 },
        }),
      ),
      mapper: {
        mapToShape: vi.fn().mockReturnValue({ city: 'Roma' }),
        mapToCanonical: vi.fn().mockReturnValue({ location: 'Roma', temperature: 22 }),
      },
      validator: noopValidatorOk,
      strategies: minimalStrategies,
    })
    const outcome = await handler(makeEvent(), makeHttpRoute(), new AbortController().signal)

    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.canonicalPayload).toEqual({ location: 'Roma', temperature: 22 })
      expect(outcome.routeId).toBe('weather-http')
      expect(outcome.metadata).toEqual({
        httpStatus: 200,
        attemptCount: 1,
        origin: 'remote',
      })
    }
  })

  it('4. 500 response: RouteOutcome.error code=gateway.5xx category=network', async () => {
    const handler = createHttpHandler({
      gateway: makeMockGateway(
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          headers: {},
          body: { error: 'server-down' },
        }),
      ),
      mapper: noopMapper,
      validator: noopValidatorOk,
      strategies: minimalStrategies,
    })
    const outcome = await handler(makeEvent(), makeHttpRoute(), new AbortController().signal)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('gateway.5xx')
      expect(outcome.error.category).toBe('network')
      expect(outcome.error.details).toMatchObject({ httpStatus: 500 })
    }
  })

  it('5. gateway throws gateway.url.forbidden → RouteOutcome.error preserves code+category', async () => {
    const forbiddenError = createBrokerError({
      code: 'gateway.url.forbidden',
      category: 'config',
      message: 'URL not in allowlist',
    })
    const handler = createHttpHandler({
      gateway: makeMockGateway(vi.fn().mockRejectedValue(forbiddenError)),
      mapper: noopMapper,
      validator: noopValidatorOk,
      strategies: minimalStrategies,
    })
    const outcome = await handler(makeEvent(), makeHttpRoute(), new AbortController().signal)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('gateway.url.forbidden')
      expect(outcome.error.category).toBe('config')
    }
  })

  it('6. response validation fail → RouteOutcome.error code=response.validation.failed (VAL-05)', async () => {
    const validator: NonNullable<HttpHandlerDeps['validator']> = {
      validate: vi.fn().mockReturnValue({
        ok: false,
        issues: [
          { message: 'temperature: invalid type, expected number', path: ['temperature'] },
          { message: 'location: required', path: ['location'] },
        ],
      }),
    }
    const handler = createHttpHandler({
      gateway: makeMockGateway(
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: {},
          body: { temp: 'NaN' },
        }),
      ),
      mapper: noopMapper,
      validator,
      strategies: minimalStrategies,
    })
    const outcome = await handler(makeEvent(), makeHttpRoute(), new AbortController().signal)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('response.validation.failed')
      expect(outcome.error.category).toBe('validation')
      expect(outcome.error.details).toMatchObject({
        schemaId: 'weather',
        issues: expect.any(Array),
      })
    }
  })

  it('7. gateway throws gateway.aborted → RouteOutcome.error preserves code', async () => {
    const abortedError = createBrokerError({
      code: 'gateway.aborted',
      category: 'network',
      message: 'request aborted',
    })
    const handler = createHttpHandler({
      gateway: makeMockGateway(vi.fn().mockRejectedValue(abortedError)),
      mapper: noopMapper,
      validator: noopValidatorOk,
      strategies: minimalStrategies,
    })
    const outcome = await handler(makeEvent(), makeHttpRoute(), new AbortController().signal)

    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error.code).toBe('gateway.aborted')
    }
  })
})
