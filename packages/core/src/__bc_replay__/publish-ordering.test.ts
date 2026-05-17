/**
 * v1-bc-replay — PRD §42.2 API #2 freeze: publish FIFO sync ordering 1000 events.
 *
 * P-23 mitigation (BC break detection cross-fase F8-F17): post-MIN-1/MIN-2 (W1-P03)
 * il publish fast-path `if (publishInterceptors.length === 0)` non deve introdurre
 * regressione sull'ordering. Il test usa `deliveryMode: 'sync'` per asserire
 * deterministicamente l'ordine FIFO (default è 'async' via queueMicrotask — D-01).
 *
 * @see .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-RESEARCH.md §7
 * @see D-V2-F8-08 suite content #1
 */

import { createBroker } from '@gluezero/core'
import { describe, expect, it } from 'vitest'

describe('v1-bc-replay: publish FIFO sync ordering (API #2)', () => {
  it('preserves FIFO order for 1000 sync events on single topic', () => {
    const broker = createBroker({})
    const received: number[] = []
    broker.subscribe(
      'test.ordering',
      (evt) => {
        received.push((evt.payload as { seq: number }).seq)
      },
      { deliveryMode: 'sync' },
    )

    for (let i = 0; i < 1000; i++) {
      broker.publish(
        'test.ordering',
        { seq: i },
        {
          source: { type: 'system', id: 'bc-replay' },
          deliveryMode: 'sync',
        },
      )
    }

    expect(received.length).toBe(1000)
    expect(received).toEqual([...Array(1000).keys()])
  })

  it('preserves FIFO order with multiple subscribers (priority normal default)', () => {
    const broker = createBroker({})
    const orderA: number[] = []
    const orderB: number[] = []
    broker.subscribe('test.multi', (evt) => orderA.push((evt.payload as { n: number }).n), {
      deliveryMode: 'sync',
    })
    broker.subscribe('test.multi', (evt) => orderB.push((evt.payload as { n: number }).n), {
      deliveryMode: 'sync',
    })

    for (let i = 0; i < 100; i++) {
      broker.publish(
        'test.multi',
        { n: i },
        { source: { type: 'system', id: 'bc-replay' }, deliveryMode: 'sync' },
      )
    }
    expect(orderA).toEqual([...Array(100).keys()])
    expect(orderB).toEqual([...Array(100).keys()])
  })
})
