// router-engine.test.ts — TDD RED→GREEN per RouterEngine glue (Plan 03-12 Task 1).
//
// Coverage: 7 test deterministici per la composition dei 5 sub-componenti F3
// (RouteResolver + RouteExecutor + HttpGateway + OutcomeCollector + 6/7 default Strategy
// instantiate). Verifica che il glue oggetto sia immutabile e che le strategy siano
// config-derived (default + opt-in auth/circuitBreaker).

import { HttpGateway } from '@gluezero/gateway/http'
import { describe, expect, it, vi } from 'vitest'
import { OutcomeCollector } from './outcome-collector'
import { RouteExecutor } from './route-executor'
import { RouteResolver } from './route-resolver'
import { RouterEngine } from './router-engine'

// Mock mapper minimale (solo i 2 metodi consumati dal http-handler).
const mockMapper = {
  mapToShape: (canonical: unknown, _outputMap: unknown): unknown => canonical,
  mapToCanonical: (shape: unknown, _schemaId: string): unknown => shape,
}

const noopPublishFn = (_topic: string, _payload: unknown, _options?: unknown): void => {}

describe('RouterEngine (Plan 03-12 Task 1 — glue resolver+executor+gateway+strategies+collector)', () => {
  it('Test 1: new RouterEngine({ mapper, publishFn }) instantia tutti i sub-componenti senza errore', () => {
    const engine = new RouterEngine({
      mapper: mockMapper,
      publishFn: noopPublishFn,
    })
    expect(engine).toBeDefined()
    expect(engine.resolver).toBeInstanceOf(RouteResolver)
    expect(engine.executor).toBeInstanceOf(RouteExecutor)
    expect(engine.httpGateway).toBeInstanceOf(HttpGateway)
    expect(engine.collector).toBeInstanceOf(OutcomeCollector)
    expect(engine.strategies).toBeDefined()
  })

  it('Test 2: engine.resolver esposto per registerRoute via wrapper', () => {
    const engine = new RouterEngine({ mapper: mockMapper, publishFn: noopPublishFn })
    const reg = engine.resolver.register({
      id: 'r-test',
      type: 'local',
      topic: 'weather.requested',
    })
    expect(reg.id).toBe('r-test')
    expect(engine.resolver.list().length).toBe(1)
  })

  it('Test 3: engine.executor esposto per cascade abort by owner', () => {
    const engine = new RouterEngine({ mapper: mockMapper, publishFn: noopPublishFn })
    expect(typeof engine.executor.abortInFlightByOwner).toBe('function')
    // Nessuna route in volo → cascade ritorna 0
    expect(engine.executor.abortInFlightByOwner('owner-x')).toBe(0)
  })

  it('Test 4: engine.collector esposto per outcome publish (mocked publishFn invocato)', () => {
    const publishSpy = vi.fn()
    const engine = new RouterEngine({ mapper: mockMapper, publishFn: publishSpy })
    expect(engine.collector).toBeInstanceOf(OutcomeCollector)
    // Outcome success → publishLoaded triggers publishFn
    engine.collector.collect(
      {
        ok: true,
        canonicalPayload: { temp: 20 },
        routeId: 'r-test',
        metadata: { httpStatus: 200, attemptCount: 1, origin: 'remote' as const },
      },
      {
        id: 'r-test',
        definition: {
          id: 'r-test',
          type: 'local',
          topic: 'weather.requested',
        },
        ownerId: undefined,
        priority: 0,
      },
      {
        id: 'evt-1',
        topic: 'weather.requested',
        payload: { location: 'Roma' },
        timestamp: Date.now(),
        source: { type: 'plugin', id: 'form' },
      },
    )
    expect(publishSpy).toHaveBeenCalledTimes(1)
  })

  it('Test 5: engine.httpGateway esposto per cascade abort by owner', () => {
    const engine = new RouterEngine({ mapper: mockMapper, publishFn: noopPublishFn })
    expect(typeof engine.httpGateway.abortInFlightByOwner).toBe('function')
    expect(engine.httpGateway.abortInFlightByOwner('owner-x')).toBe(0)
  })

  it('Test 6: engine.strategies esposto come HttpGatewayStrategies con default = config-derived (no auth, no circuit)', () => {
    const engine = new RouterEngine({ mapper: mockMapper, publishFn: noopPublishFn })
    expect(engine.strategies.retry).toBeDefined()
    expect(engine.strategies.timeout).toBeDefined()
    expect(engine.strategies.idempotency).toBeDefined()
    expect(engine.strategies.dedupe).toBeDefined()
    expect(engine.strategies.backpressure).toBeDefined()
    // No auth config → strategy auth undefined
    expect(engine.strategies.auth).toBeUndefined()
    // No circuitBreaker config → strategy circuitBreaker undefined
    expect(engine.strategies.circuitBreaker).toBeUndefined()
  })

  it('Test 7: gateway.config con auth → strategy auth instanziata; con circuitBreaker → strategy circuitBreaker instanziata', () => {
    const engine = new RouterEngine({
      mapper: mockMapper,
      publishFn: noopPublishFn,
      gatewayConfig: {
        auth: { getToken: async () => 'tok' },
        circuitBreaker: { threshold: 3, cooldownMs: 1000 },
      },
    })
    expect(engine.strategies.auth).toBeDefined()
    expect(engine.strategies.circuitBreaker).toBeDefined()
  })
})
