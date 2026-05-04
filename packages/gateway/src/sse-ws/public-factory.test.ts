// public-factory.test.ts — unit test del factory pubblico `createRealtimeBroker`
// (D-30 + Valibot validation, pattern identico a `createRouterBroker` / `createHttpGateway`).

import { describe, expect, it } from 'vitest'
import { createRealtimeBroker } from './public-factory'

describe('createRealtimeBroker (D-30 + Valibot validation)', () => {
  it('Test 1: config vuota → ritorna RealtimeBroker valido', () => {
    const broker = createRealtimeBroker()
    expect(broker).toBeDefined()
    // Verifica behavior: pubblicazione locale funziona (composition F1→F2→F3 attiva).
    let received: unknown = null
    broker.subscribe('smoke.topic', (ev: { payload: unknown }) => {
      received = ev.payload
    })
    broker.publish('smoke.topic', { ok: true }, { source: { type: 'plugin', id: 'unit' } })
    expect(received).toEqual({ ok: true })
  })

  it('Test 2: config con realtime.channels valid → bootstrap', () => {
    const broker = createRealtimeBroker({
      realtime: { channels: [{ name: 'a', mode: 'sse', url: 'https://x' }] },
    })
    expect(broker).toBeDefined()
    // Bootstrap fire-and-forget: il canale può fallire (no MockEventSource patch qui),
    // ma l'istanza deve essere creata. Verifica via getDebugSnapshot non-throw.
    const snap = broker.getDebugSnapshot()
    expect(snap).toHaveProperty('realtime')
  })

  it('Test 3: invalid config (channel.name non string) → throw "Invalid RealtimeBrokerConfig"', () => {
    expect(() =>
      createRealtimeBroker({
        realtime: { channels: [{ name: 42 } as never] },
      }),
    ).toThrowError(/Invalid RealtimeBrokerConfig/)
  })

  it('Test 4: invalid mode literal → throw "Invalid RealtimeBrokerConfig"', () => {
    expect(() =>
      createRealtimeBroker({
        realtime: { channels: [{ name: 'x', mode: 'invalid-mode' as never }] },
      }),
    ).toThrowError(/Invalid RealtimeBrokerConfig/)
  })

  it('Test 5 (D-30): no singleton — 2 chiamate ritornano istanze diverse', () => {
    const a = createRealtimeBroker()
    const b = createRealtimeBroker()
    expect(a).not.toBe(b)
  })

  it('Test 6: looseObject preserve sezioni F3 (gateway, routes, ...) inherit', () => {
    const broker = createRealtimeBroker({
      gateway: { defaults: { timeoutMs: 5000 } } as never,
      realtime: { channels: [] },
    })
    expect(broker).toBeDefined()
  })
})
