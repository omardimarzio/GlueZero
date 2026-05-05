// pause-resume-flow.test.ts — Tier-1 jsdom integration test plan 06-08b Wave 4b.
//
// Verifica end-to-end via createDevtoolsBroker:
// - pauseTopic + 100 publish queued + resumeTopic → replay FIFO order
// - downstream subscriber riceve in order
// - flushQueue audit emit (D-169)
// - critical priority bypass (D-170)

import { describe, expect, it } from 'vitest'
import { createDevtoolsBroker } from '../public-factory'

function flushAsync(): Promise<void> {
  return new Promise((r) => setTimeout(r, 10))
}

describe('pause-resume-flow integration — D-168/D-169/D-170 queue + replay + audit', () => {
  it('Test 1: pauseTopic + 5 publish + resumeTopic → replay FIFO order', async () => {
    const broker = createDevtoolsBroker({})
    const received: number[] = []
    broker.subscribe('q.topic', (ev: { payload: unknown }) => {
      received.push((ev.payload as { v: number }).v)
    })
    broker.pauseTopic('q.topic')
    for (let i = 0; i < 5; i++) {
      broker.publish('q.topic', { v: i }, {
        source: { type: 'plugin', id: 'app' },
      } as never)
    }
    await flushAsync()
    // Niente è stato delivered durante pausa
    expect(received).toEqual([])

    broker.resumeTopic('q.topic')
    await flushAsync()

    expect(received).toEqual([0, 1, 2, 3, 4])
  })

  it('Test 2: flushQueue → ritorna FlushQueueResult + audit system.queue.flushed emesso', async () => {
    const broker = createDevtoolsBroker({})
    const auditEvents: unknown[] = []
    broker.subscribe('system.queue.flushed', (ev: { payload: unknown }) => {
      auditEvents.push(ev.payload)
    })
    broker.pauseTopic('flush.topic')
    broker.publish('flush.topic', { v: 1 }, {
      source: { type: 'plugin', id: 'app' },
    } as never)
    broker.publish('flush.topic', { v: 2 }, {
      source: { type: 'plugin', id: 'app' },
    } as never)

    const result = broker.flushQueue('flush.topic')
    await flushAsync()

    expect(result).toHaveLength(1)
    expect(result[0]?.droppedCount).toBe(2)
    expect(result[0]?.topic).toBe('flush.topic')
    // Audit emesso via inner.publish (publishFn injected)
    expect(auditEvents.length).toBeGreaterThan(0)
  })

  it('Test 3: critical priority bypass D-170 — pauseTopic + publish critical → pass-through', async () => {
    const broker = createDevtoolsBroker({})
    const received: unknown[] = []
    broker.subscribe('crit.topic', (ev: { payload: unknown }) => received.push(ev.payload))
    broker.pauseTopic('crit.topic')
    broker.publish('crit.topic', { important: true }, {
      source: { type: 'plugin', id: 'app' },
      priority: 'critical',
    } as never)
    await flushAsync()

    // Critical bypass — l'evento è delivered nonostante topic in pausa
    expect(received).toEqual([{ important: true }])
  })
})
