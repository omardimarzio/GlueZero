// http-gateway.test.ts — verifica HttpGateway class (D-71/D-72/D-77/D-99 + Pitfall 7).
//
// 10 test (Behavior 1-10 plan 03-08 Task 2). msw 2.13.6 setupServer Node mode per
// fetch deterministico (no network reale). RouterBroker plan 03-12 fornirà strategy
// concrete (qui usiamo mock minimal — la classe è agnostica all'impl strategy).

import type { BrokerEvent } from '@sembridge/core'
import { isBrokerError } from '@sembridge/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { HttpGateway, type HttpGatewayStrategies } from './http-gateway'
import { createHttpGateway } from './public-factory'
import type { HttpRequestSpec } from './types/http-strategies'

// ---------- msw setup (Node mode, deterministic) ----------

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// ---------- Test fixtures ----------

function makeEvent(overrides: Partial<BrokerEvent> = {}): BrokerEvent {
  return {
    id: 'e-1',
    topic: 't.requested',
    timestamp: 0,
    payload: {},
    source: { type: 'plugin', id: 'p1' },
    metadata: {},
    ...overrides,
  } as BrokerEvent
}

function makeRequest(url: string, method: HttpRequestSpec['method'] = 'GET'): HttpRequestSpec {
  return { method, url, headers: {} }
}

const minimalStrategies: HttpGatewayStrategies = {}

describe('HttpGateway (D-71/D-72/D-77/D-99 + Pitfall 7)', () => {
  it('1. createHttpGateway returns HttpGateway instance with valid config', () => {
    const gw = createHttpGateway({
      allowlist: [/^https:\/\/api\.example\.com\//],
      auth: { getToken: async () => 'tok' },
    })
    expect(gw).toBeInstanceOf(HttpGateway)
  })

  it('2. createHttpGateway throws on invalid config (Valibot fail)', () => {
    expect(() =>
      createHttpGateway({ allowlist: 'invalid' as unknown as undefined }),
    ).toThrow(/Invalid GatewayConfig/)
  })

  it('3. execute injects Authorization Bearer header from auth.getToken', async () => {
    let capturedAuth: string | null = null
    server.use(
      http.get('https://api.example.com/v1/x', ({ request }) => {
        capturedAuth = request.headers.get('Authorization')
        return HttpResponse.json({ ok: true })
      }),
    )
    const gw = new HttpGateway({
      allowlist: ['https://api.example.com/'],
    })
    const strategies: HttpGatewayStrategies = {
      auth: {
        getToken: async () => 'tok',
        isInflightRefresh: () => false,
      },
    }
    const response = await gw.execute(
      makeRequest('https://api.example.com/v1/x'),
      { id: 'r-1' },
      makeEvent(),
      undefined,
      strategies,
    )
    expect(response.ok).toBe(true)
    expect(capturedAuth).toBe('Bearer tok')
  })

  it('4. execute throws gateway.url.forbidden BEFORE fetch on URL outside allowlist', async () => {
    let fetchCalled = false
    server.use(
      http.get('https://evil.com/exfil', () => {
        fetchCalled = true
        return HttpResponse.json({ ok: false })
      }),
    )
    const gw = new HttpGateway({ allowlist: ['https://api.example.com/'] })
    let caught: unknown
    try {
      await gw.execute(
        makeRequest('https://evil.com/exfil'),
        { id: 'r-1' },
        makeEvent(),
        undefined,
        minimalStrategies,
      )
    } catch (err) {
      caught = err
    }
    expect(isBrokerError(caught)).toBe(true)
    if (isBrokerError(caught)) expect(caught.code).toBe('gateway.url.forbidden')
    expect(fetchCalled).toBe(false)
  })

  it('5. execute returns ok=true with parsed JSON on 200 response', async () => {
    server.use(
      http.get('https://api.example.com/v1/data', () =>
        HttpResponse.json({ city: 'Roma', temp: 22 }),
      ),
    )
    const gw = new HttpGateway({ allowlist: ['https://api.example.com/'] })
    const response = await gw.execute(
      makeRequest('https://api.example.com/v1/data'),
      { id: 'r-1' },
      makeEvent(),
      undefined,
      minimalStrategies,
    )
    expect(response.ok).toBe(true)
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ city: 'Roma', temp: 22 })
  })

  it('6. execute returns ok=false httpStatus=500 (no automatic throw)', async () => {
    server.use(
      http.get('https://api.example.com/v1/err', () =>
        HttpResponse.json({ error: 'server-down' }, { status: 500 }),
      ),
    )
    const gw = new HttpGateway({ allowlist: ['https://api.example.com/'] })
    const response = await gw.execute(
      makeRequest('https://api.example.com/v1/err'),
      { id: 'r-1' },
      makeEvent(),
      undefined,
      minimalStrategies,
    )
    expect(response.ok).toBe(false)
    expect(response.status).toBe(500)
  })

  it('7. execute throws gateway.timeout on AbortSignal abort with timeout reason', async () => {
    server.use(
      http.get('https://api.example.com/v1/slow', async () => {
        await new Promise<void>((res) => setTimeout(res, 1000))
        return HttpResponse.json({ ok: true })
      }),
    )
    const gw = new HttpGateway({ allowlist: ['https://api.example.com/'] })
    // Use external abort signal to simulate timeout
    const externalCtrl = new AbortController()
    const promise = gw.execute(
      makeRequest('https://api.example.com/v1/slow'),
      { id: 'r-1' },
      makeEvent(),
      externalCtrl.signal,
      minimalStrategies,
    )
    // Aborto subito dopo init
    setTimeout(() => externalCtrl.abort('gateway.timeout'), 10)
    let caught: unknown
    try {
      await promise
    } catch (err) {
      caught = err
    }
    expect(isBrokerError(caught)).toBe(true)
    if (isBrokerError(caught)) {
      expect(caught.code).toBe('gateway.timeout')
      expect(caught.category).toBe('network')
    }
  })

  it('8. abortInFlight aborts AbortController for given eventId', async () => {
    server.use(
      http.get('https://api.example.com/v1/slow', async () => {
        await new Promise<void>((res) => setTimeout(res, 500))
        return HttpResponse.json({ ok: true })
      }),
    )
    const gw = new HttpGateway({ allowlist: ['https://api.example.com/'] })
    const event = makeEvent({ id: 'evt-abort' })
    const promise = gw.execute(
      makeRequest('https://api.example.com/v1/slow'),
      { id: 'r-1' },
      event,
      undefined,
      minimalStrategies,
    )
    // Aspetta tick per registrare nel inFlight
    await new Promise<void>((res) => setTimeout(res, 5))
    expect(gw.inFlightCount()).toBe(1)
    const aborted = gw.abortInFlight('evt-abort', 'user-cancel')
    expect(aborted).toBe(true)
    let caught: unknown
    try {
      await promise
    } catch (err) {
      caught = err
    }
    expect(caught).toBeDefined()
    expect(gw.inFlightCount()).toBe(0)
  })

  it('9. abortInFlightByOwner cascade aborts all controllers for ownerId', async () => {
    server.use(
      http.get('https://api.example.com/v1/slow', async () => {
        await new Promise<void>((res) => setTimeout(res, 500))
        return HttpResponse.json({ ok: true })
      }),
    )
    const gw = new HttpGateway({ allowlist: ['https://api.example.com/'] })
    const promises = [
      gw.execute(
        makeRequest('https://api.example.com/v1/slow'),
        { id: 'r-1', ownerId: 'plugin-A' },
        makeEvent({ id: 'e-1' }),
        undefined,
        minimalStrategies,
      ),
      gw.execute(
        makeRequest('https://api.example.com/v1/slow'),
        { id: 'r-2', ownerId: 'plugin-A' },
        makeEvent({ id: 'e-2' }),
        undefined,
        minimalStrategies,
      ),
      gw.execute(
        makeRequest('https://api.example.com/v1/slow'),
        { id: 'r-3', ownerId: 'plugin-B' },
        makeEvent({ id: 'e-3' }),
        undefined,
        minimalStrategies,
      ),
    ]
    await new Promise<void>((res) => setTimeout(res, 10))
    expect(gw.inFlightCount()).toBe(3)
    const count = gw.abortInFlightByOwner('plugin-A', 'plugin.unregistered')
    expect(count).toBe(2)
    // settle all promises (catch errors)
    await Promise.allSettled(promises)
    // plugin-B still completed normally; plugin-A two aborted
  })

  it('10. execute re-validates Location header against allowlist on 3xx (Pitfall 7)', async () => {
    server.use(
      http.get('https://api.example.com/v1/redirect', () =>
        HttpResponse.json(null, { status: 302, headers: { Location: 'https://evil.com/exfil' } }),
      ),
      http.get('https://evil.com/exfil', () => HttpResponse.json({ leaked: true })),
    )
    const gw = new HttpGateway({ allowlist: ['https://api.example.com/'] })
    let caught: unknown
    try {
      await gw.execute(
        makeRequest('https://api.example.com/v1/redirect'),
        { id: 'r-1' },
        makeEvent(),
        undefined,
        minimalStrategies,
      )
    } catch (err) {
      caught = err
    }
    expect(isBrokerError(caught)).toBe(true)
    if (isBrokerError(caught)) {
      expect(caught.code).toBe('gateway.url.forbidden')
    }
  })
})
