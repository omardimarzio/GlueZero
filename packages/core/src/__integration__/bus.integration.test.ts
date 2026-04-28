// Integration test — Pub/sub end-to-end (CORE-01, success criterion #1 ROADMAP Phase 1).
//
// Verifica end-to-end che un publish lato "Plugin A" venga consegnato al subscriber
// lato "Plugin B" attraverso il `Broker` reale (composition root) — chiusura del
// ROADMAP success criterion #1 ("Pub/sub plugin↔plugin via broker").
//
// Coverage:
//   - Plugin A publish → Plugin B subscribe (sync delivery)
//   - Subscription.unsubscribe stop further deliveries (D-27)
//   - Subscription.unsubscribe idempotente (D-27)
//   - Async delivery preserva ordine FIFO (D-01)
//
// Pattern: usa `createPipelineHarness()` dalla fixture condivisa per un broker
// reale + tap-based capture.

import { describe, expect, it, vi } from 'vitest'
import { createPipelineHarness } from '../test-utils/pipeline-harness'
import type { BrokerEvent } from '../types/broker-event'

const flush = (): Promise<void> => new Promise((r) => queueMicrotask(() => r()))

describe('Pub/sub end-to-end (CORE-01, success criterion #1)', () => {
  it('Plugin A publishes, Plugin B subscribes — receives via broker', () => {
    const h = createPipelineHarness()
    const received: unknown[] = []
    h.broker.subscribe('weather.requested', (e: BrokerEvent) => {
      received.push(e.payload)
    })
    h.broker.publish(
      'weather.requested',
      { city: 'Roma' },
      {
        source: { type: 'plugin', id: 'plugin-A' },
        deliveryMode: 'sync',
      },
    )
    expect(received).toEqual([{ city: 'Roma' }])
  })

  it('Subscription.unsubscribe stops further deliveries', () => {
    const h = createPipelineHarness()
    const handler = vi.fn()
    const sub = h.broker.subscribe('a.b', handler)
    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    sub.unsubscribe()
    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('Subscription.unsubscribe is idempotent (D-27)', () => {
    const h = createPipelineHarness()
    const sub = h.broker.subscribe('a.b', () => {})
    sub.unsubscribe()
    expect(() => sub.unsubscribe()).not.toThrow()
  })

  it('Async delivery FIFO order preserved', async () => {
    const h = createPipelineHarness()
    const log: number[] = []
    h.broker.subscribe('a.b', (e: BrokerEvent<{ n: number }>) => {
      log.push(e.payload.n)
    })
    h.broker.publish('a.b', { n: 1 }, { source: { type: 'plugin', id: 'p' } })
    h.broker.publish('a.b', { n: 2 }, { source: { type: 'plugin', id: 'p' } })
    h.broker.publish('a.b', { n: 3 }, { source: { type: 'plugin', id: 'p' } })
    await flush()
    await flush()
    await flush()
    expect(log).toEqual([1, 2, 3])
  })
})
