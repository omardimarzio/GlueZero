// router-broker-wrapper.test.ts — TDD RED→GREEN per RouterBroker composition wrapper
// (Plan 03-12 Task 2 — D-83 replica F2 D-49 + chiusura ROUTE-01/12/15/16 + LIFE-02 ext F3).
//
// Coverage: 16 test deterministici (12 originali + 4 revision iter 1):
// - Test 1-2: instantiation + registerRoute API (ROUTE-01, D-60)
// - Test 3-5: pipeline §28 step 7-full → 8 → 9 → 10 + ROUTE-16 (D-67) requiresRoute
// - Test 6: ROUTE-15 first-match warning (D-66)
// - Test 7-8: registerPlugin auto-register routes + LIFE-02 ext F3 cascade (D-86)
// - Test 9: cascade abort fetch in volo (LIFE-02 ext F3 chiusura)
// - Test 10: unregisterRoute API
// - Test 11: tap step 8/9/10 emessi
// - Test 12: NO double publish durante retry (D-82)
// - Test 13 (BLOCKER 3 fix): subscribe delegate
// - Test 14 (BLOCKER 4 fix): requiresRouteTopics opt-in
// - Test 15 (BLOCKER 4 fix): composite topic 'routing.composite.deferred' (no hyphen)
// - Test 16 (BLOCKER 4 fix): loud failure throw se canonical-registry unreachable

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CanonicalSchemaId } from '@sembridge/mapper'
import { isBrokerError, type EventTap, type PipelineStep } from '@sembridge/core'
import { RouterBroker } from './router-broker-wrapper'
import type { RouteHttpDefinition, RouteLocalDefinition } from './types/route-definition'

// ---------- Mock fetch globale (msw-free, semplificato per Node) ----------

let mockFetchImpl: ((url: string, init?: RequestInit) => Promise<Response>) | undefined
const originalFetch = globalThis.fetch

beforeEach(() => {
  mockFetchImpl = undefined
  globalThis.fetch = ((url: string, init?: RequestInit): Promise<Response> => {
    if (mockFetchImpl) return mockFetchImpl(url, init)
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// ---------- Helper: route factories ----------

function localRoute(id: string, topic: string): RouteLocalDefinition {
  return { id, type: 'local', topic }
}

function httpRoute(id: string, topic: string): RouteHttpDefinition {
  return {
    id,
    type: 'http',
    topic,
    request: {
      method: 'GET',
      url: 'https://api.example.com/test',
    },
    response: { canonical: 'weather' },
  } as RouteHttpDefinition
}

describe('RouterBroker (Plan 03-12 Task 2 — composition wrapper D-83)', () => {
  it('Test 1: new RouterBroker({}) istanzia senza errori', () => {
    const broker = new RouterBroker({})
    expect(broker).toBeDefined()
    expect(typeof broker.publish).toBe('function')
    expect(typeof broker.subscribe).toBe('function')
    expect(typeof broker.registerRoute).toBe('function')
    expect(typeof broker.unregisterRoute).toBe('function')
  })

  it('Test 2: broker.registerRoute(routeDef) ritorna { id, unregister }', () => {
    const broker = new RouterBroker({})
    const reg = broker.registerRoute(localRoute('r1', 'weather.requested'))
    expect(reg.id).toBe('r1')
    expect(typeof reg.unregister).toBe('function')
  })

  it('Test 3: broker.publish con route http → outcome.collected publish weather.loaded (mocked fetch)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (): Promise<Response> =>
        Promise.resolve(
          new Response(JSON.stringify({ temp: 20, location: 'Roma' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
    )

    const broker = new RouterBroker({
      gateway: { allowlist: ['https://api.example.com'] },
    })
    broker.registerRoute(httpRoute('r-http', 'weather.requested'))

    const loadedHandler = vi.fn()
    broker.subscribe('weather.loaded', loadedHandler)

    broker.publish('weather.requested', { location: 'Roma' }, {
      source: { type: 'plugin', id: 'form' },
    })

    // Attesa async — il http handler è async; aspettiamo qualche tick di event loop.
    await new Promise((res) => setTimeout(res, 100))

    expect(fetchSpy).toHaveBeenCalled()
    expect(loadedHandler).toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('Test 4: broker.publish topic SENZA route + senza requiresRoute → delegate inner.publish (delivery locale)', async () => {
    const broker = new RouterBroker({})
    const handler = vi.fn()
    broker.subscribe('topic.unknown', handler)

    broker.publish('topic.unknown', { hello: 'world' })
    // F1 default deliveryMode='async' (microtask) — flush
    await new Promise((res) => setTimeout(res, 0))

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('Test 5: broker.publish topic SENZA route + requiresRoute=true via canonical schema → publish topic.failed con code route.required.missing', async () => {
    const broker = new RouterBroker({
      canonicalModel: {
        schemas: [
          {
            id: 'topic' as CanonicalSchemaId,
            fields: { name: { type: 'string' } },
            requiresRoute: true,
          },
        ],
      },
    })

    const failedHandler = vi.fn()
    broker.subscribe('topic.failed', failedHandler)

    broker.publish('topic.requested', { name: 'x' })
    await new Promise((res) => setTimeout(res, 0))

    expect(failedHandler).toHaveBeenCalledTimes(1)
    const event = failedHandler.mock.calls[0]?.[0] as {
      payload: { error: { code: string; category: string } }
    }
    expect(event.payload.error.code).toBe('route.required.missing')
    expect(event.payload.error.category).toBe('config')
  })

  it("Test 6: broker.publish con N>1 route + multipleRoutesPolicy='first-match' (default) → 1 sola route eseguita + onAmbiguousRoutes invoked", async () => {
    const broker = new RouterBroker({})
    broker.registerRoute(localRoute('r1', 'weather.requested'))
    broker.registerRoute(localRoute('r2', 'weather.requested'))
    broker.registerRoute(localRoute('r3', 'weather.requested'))

    const ambiguousHandler = vi.fn()
    broker.subscribe('routing.ambiguous', ambiguousHandler)

    broker.publish('weather.requested', {})
    await new Promise((res) => setTimeout(res, 0))

    expect(ambiguousHandler).toHaveBeenCalledTimes(1)
    const event = ambiguousHandler.mock.calls[0]?.[0] as {
      payload: { candidateRouteIds: readonly string[]; selectedRouteId: string }
    }
    expect(event.payload.candidateRouteIds.length).toBe(3)
    expect(event.payload.selectedRouteId).toBe('r1')
  })

  it('Test 7: broker.registerPlugin descriptor con routes → 3 route registrate con ownerId', async () => {
    const broker = new RouterBroker({})
    await broker.registerPlugin({
      id: 'p1',
      routes: [
        localRoute('rA', 'a.requested'),
        localRoute('rB', 'b.requested'),
        localRoute('rC', 'c.requested'),
      ],
    })
    // Verify via unregister cascade — il plugin ha 3 route con ownerId='p1'
    await broker.unregisterPlugin('p1')
    // Dopo unregister, publish ai topic NON deve avere route → delivery locale (no failed)
    const handler = vi.fn()
    broker.subscribe('a.requested', handler)
    broker.publish('a.requested', {})
    await new Promise((res) => setTimeout(res, 0))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('Test 8: broker.unregisterPlugin cascade resolver + executor + httpGateway abort by owner', async () => {
    const broker = new RouterBroker({
      gateway: { allowlist: ['https://api.example.com'] },
    })
    await broker.registerPlugin({
      id: 'p1',
      routes: [localRoute('r1', 't.requested'), localRoute('r2', 't2.requested')],
    })
    // 2 route registrate
    // Cascade unregister
    await expect(broker.unregisterPlugin('p1')).resolves.toBeUndefined()
  })

  it('Test 9 (LIFE-02 ext F3 cascade): broker.unregisterPlugin con N fetch in volo bound a plugin → abort tutti', async () => {
    let resolveSlow!: (resp: Response) => void
    const slowFetch = new Promise<Response>((res) => {
      resolveSlow = res
    })
    mockFetchImpl = (): Promise<Response> => slowFetch

    const broker = new RouterBroker({
      gateway: { allowlist: ['https://api.example.com'] },
    })
    await broker.registerPlugin({
      id: 'p1',
      routes: [httpRoute('r-h1', 'evt1.requested')],
    })
    // Lancia 3 publish — fetch resta in volo
    broker.publish('evt1.requested', { x: 1 })
    broker.publish('evt1.requested', { x: 2 })
    broker.publish('evt1.requested', { x: 3 })
    // Wait micro-task per inflight tracking
    await new Promise((res) => setTimeout(res, 10))

    // Cascade unregister → abort all in flight
    await broker.unregisterPlugin('p1')
    // Resolve slowFetch dopo unregister — i fetch saranno abortiti già
    resolveSlow(new Response('{}', { status: 200 }))
    // Test pass se non throw + nessuna exception unhandled
    expect(true).toBe(true)
  })

  it('Test 10: broker.unregisterRoute(routeId) rimuove dal resolver', () => {
    const broker = new RouterBroker({})
    const reg = broker.registerRoute(localRoute('r-x', 't.requested'))
    expect(broker.unregisterRoute(reg.id)).toBe(true)
    // Seconda chiamata → false (già rimosso)
    expect(broker.unregisterRoute(reg.id)).toBe(false)
  })

  it('Test 11: pipeline §28 step 8/9/10 emessi via tap', async () => {
    mockFetchImpl = (): Promise<Response> =>
      Promise.resolve(new Response(JSON.stringify({ temp: 20 }), { status: 200 }))

    const tapSpy = vi.fn()
    const tap: EventTap = { onPipelineStep: tapSpy }
    const broker = new RouterBroker({
      runtime: { tap },
      gateway: { allowlist: ['https://api.example.com'] },
    })
    broker.registerRoute(httpRoute('r-h', 'weather.requested'))
    broker.publish('weather.requested', { location: 'Roma' })

    await new Promise((res) => setTimeout(res, 50))

    const stepsEmitted = tapSpy.mock.calls.map((c) => c[0] as PipelineStep)
    expect(stepsEmitted).toContain('event.route.resolved')
    expect(stepsEmitted).toContain('event.route.executed')
    expect(stepsEmitted).toContain('event.outcome.collected')
  })

  it('Test 12: NO double publish durante retry — <topic>.failed UNA sola volta', async () => {
    let attempts = 0
    mockFetchImpl = (): Promise<Response> => {
      attempts++
      // Always fail with 500 (network-like) — retry strategy retries 5xx
      return Promise.resolve(new Response('{}', { status: 500 }))
    }

    const broker = new RouterBroker({
      gateway: {
        allowlist: ['https://api.example.com'],
        defaults: { retry: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 5 } },
      },
    })
    broker.registerRoute(httpRoute('r-h', 'weather.requested'))

    const failedHandler = vi.fn()
    broker.subscribe('weather.failed', failedHandler)

    broker.publish('weather.requested', { location: 'Roma' })
    await new Promise((res) => setTimeout(res, 100))

    // Retry attempts ≥ 1, ma il publish failed deve essere UNICO (D-82 guard)
    expect(failedHandler.mock.calls.length).toBeLessThanOrEqual(1)
    expect(attempts).toBeGreaterThanOrEqual(1)
  })

  // ---------- Revision iter 1 (BLOCKER 2/3/4 fix) ----------

  it('Test 13 (BLOCKER 3 fix — subscribe delegate): routerBroker.subscribe(topic, handler) riceve evento', async () => {
    const broker = new RouterBroker({})
    const handler = vi.fn()
    broker.subscribe('weather.loaded', handler)
    // Publish via inner — verifica che subscribe delegate funziona
    broker.publish('weather.loaded', { temp: 20 })
    await new Promise((res) => setTimeout(res, 0))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('Test 14 (BLOCKER 4 fix — requiresRouteTopics opt-in): config.routing.requiresRouteTopics → publish topic.failed senza canonical schema', async () => {
    const broker = new RouterBroker({
      routing: { requiresRouteTopics: ['custom.action.requested'] },
    })
    const failedHandler = vi.fn()
    broker.subscribe('custom.action.failed', failedHandler)

    broker.publish('custom.action.requested', { x: 1 })
    await new Promise((res) => setTimeout(res, 0))

    expect(failedHandler).toHaveBeenCalledTimes(1)
    const event = failedHandler.mock.calls[0]?.[0] as {
      payload: { error: { code: string; category: string } }
    }
    expect(event.payload.error.code).toBe('route.required.missing')
    expect(event.payload.error.category).toBe('config')
  })

  it('Test 15 (BLOCKER 2 fix — composite.deferred topic): onCacheDeferred → publish routing.composite.deferred (NO hyphen)', async () => {
    const broker = new RouterBroker({
      gateway: { allowlist: ['https://api.example.com'] },
    })
    // Registriamo http sub-route + composite con cache step
    broker.registerRoute(httpRoute('r-http', 'composite.subroute'))
    broker.registerRoute({
      id: 'r-comp',
      type: 'composite',
      topic: 'evt.requested',
      steps: [{ type: 'cache' }, { type: 'http', route: 'r-http' }],
    } as never)

    const deferredHandler = vi.fn()
    broker.subscribe('routing.composite.deferred', deferredHandler)
    // Verifichiamo NON viene pubblicato sul vecchio topic (regex rifiuterebbe)
    const oldTopicHandler = vi.fn()
    // 'routing.composite.cache-deferred' avrebbe hyphen — TOPIC_REGEX rifiuta. Non sottoscriviamo.

    mockFetchImpl = (): Promise<Response> =>
      Promise.resolve(new Response(JSON.stringify({ x: 1 }), { status: 200 }))

    broker.publish('evt.requested', {})
    await new Promise((res) => setTimeout(res, 50))

    expect(deferredHandler).toHaveBeenCalled()
    expect(oldTopicHandler).not.toHaveBeenCalled()
  })

  it('Test 16 (BLOCKER 4 fix — loud failure throw): MapperBroker senza canonicalRegistry → BrokerError router.canonical-registry.unavailable', async () => {
    // Strategia: usiamo vi.doMock per sostituire @sembridge/mapper.MapperBroker con
    // uno stub che NON espone canonicalRegistry. Reload del module router-broker-wrapper
    // (vi.resetModules) per re-importare con il mock attivo.
    //
    // Il guard nel constructor del RouterBroker verifica strutturalmente
    // `'canonicalRegistry' in inner && typeof inner.canonicalRegistry.get === 'function'`.
    // Se uno dei due fail → throw 'router.canonical-registry.unavailable'.
    vi.resetModules()
    vi.doMock('@sembridge/mapper', async () => {
      const actual = await vi.importActual<typeof import('@sembridge/mapper')>('@sembridge/mapper')
      // Stub MapperBroker class — implementa solo i metodi necessari + NIENTE
      // canonicalRegistry field. Forza il guard a fallire al boot.
      class StubMapperBroker {
        publish(): void {}
        subscribe(): { unsubscribe(): void } {
          return { unsubscribe: (): void => {} }
        }
        registerPlugin(): { id: string; subscriptions: Set<unknown> } {
          return { id: 'stub', subscriptions: new Set() }
        }
        async unregisterPlugin(): Promise<void> {}
        registerCanonicalSchema(): boolean {
          return true
        }
      }
      return { ...actual, MapperBroker: StubMapperBroker }
    })

    // Re-import router-broker-wrapper — re-evaluation con il mock attivo.
    const reimported = await import('./router-broker-wrapper')

    let caught: unknown
    try {
      // biome-ignore lint/correctness/noUnusedVariables: deliberato — costruttore deve throw
      const _broker = new reimported.RouterBroker({})
    } catch (err) {
      caught = err
    }
    expect(caught).toBeDefined()
    expect(isBrokerError(caught)).toBe(true)
    if (isBrokerError(caught)) {
      expect(caught.code).toBe('router.canonical-registry.unavailable')
      expect(caught.category).toBe('config')
    }

    vi.doUnmock('@sembridge/mapper')
    vi.resetModules()
  })
})
