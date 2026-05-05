// chain-completa-flow.test.ts — Tier-1 jsdom integration test plan 06-08b Wave 4b.
//
// Verifica end-to-end createSemBridge default chain F1+F2+F3+F4+F5+F6 attiva:
// - publish event → mapper attivo (canonical pass-through) + routing attivo +
//   devtools tap registra evento (Inspector buffer popolato)
// - subscribe + publish round-trip funziona con chain completa default
// - getDebugSnapshot expose snapshot post-publish (devtools OUTERMOST)

import { describe, expect, it } from 'vitest'
import { createSemBridge } from '../sem-bridge'

function flushAsync(): Promise<void> {
  return new Promise((r) => setTimeout(r, 10))
}

interface DevtoolsLikeBroker {
  publish: (topic: string, payload: unknown, options?: unknown) => void | Promise<void>
  subscribe: (topic: string, handler: (ev: { payload: unknown }) => void) => unknown
  getDebugSnapshot?: () => {
    readonly recentEvents: readonly unknown[]
    readonly enabled: boolean
  }
}

describe('chain-completa-flow integration — createSemBridge default F1+F2+F3+F4+F5+F6', () => {
  it('Test 1: default features → publish + subscribe round-trip funziona', async () => {
    const broker = createSemBridge({}) as DevtoolsLikeBroker
    const received: unknown[] = []
    broker.subscribe('e2e.topic', (ev) => received.push(ev.payload))
    broker.publish('e2e.topic', { hello: 'F6' }, {
      source: { type: 'plugin', id: 'app' },
    })
    await flushAsync()

    expect(received).toEqual([{ hello: 'F6' }])
  })

  it('Test 2: default features → devtools OUTERMOST → getDebugSnapshot popolato', async () => {
    const broker = createSemBridge({}) as DevtoolsLikeBroker
    broker.subscribe('debug.topic', () => {})
    broker.publish('debug.topic', { v: 1 }, {
      source: { type: 'plugin', id: 'app' },
    })
    await flushAsync()

    expect(typeof broker.getDebugSnapshot).toBe('function')
    const snap = broker.getDebugSnapshot!()
    expect(snap.recentEvents.length).toBeGreaterThan(0)
    // NODE_ENV !== 'production' in test → enabled = true
    expect(snap.enabled).toBe(true)
  })

  it('Test 3: chain completa — multiple publish in sequence, tutti delivered', async () => {
    const broker = createSemBridge({}) as DevtoolsLikeBroker
    const received: number[] = []
    broker.subscribe('seq.topic', (ev) => {
      received.push((ev.payload as { v: number }).v)
    })
    for (let i = 0; i < 10; i++) {
      broker.publish('seq.topic', { v: i }, {
        source: { type: 'plugin', id: 'app' },
      })
    }
    await flushAsync()

    expect(received).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
})
