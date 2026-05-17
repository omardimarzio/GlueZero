/**
 * Test Tier-1 jsdom per cleanup AbortController pattern (D-V2-F17-05).
 *
 * Coverage:
 * - disconnectedCallback() → _abortController.abort() (signal aborted)
 * - post-disconnect: subscription NON più riceve delivery
 * - multiple subscriptions: tutte unsubscribed in single abort
 * - subscribe DOPO disconnect: signal aborted → broker NO consegna (native signal handling F1)
 */

import { describe, expect, it } from 'vitest'
import { createBroker } from '@gluezero/core'
import { GlueZeroElement } from '../src/gluezero-element.js'

let ctr = 0
function makeEl(): string {
  const name = `gz-cleanup-el-${++ctr}`
  class T extends GlueZeroElement {}
  customElements.define(name, T)
  return name
}

describe('GlueZeroElement cleanup AbortController (D-V2-F17-05)', () => {
  it('disconnectedCallback → _abortController.abort() → signal aborted', () => {
    const broker = createBroker({})
    const name = makeEl()
    const el = document.createElement(name) as GlueZeroElement & {
      _abortController: AbortController
    }
    el.glueZeroBroker = broker
    expect(el._abortController.signal.aborted).toBe(false)
    document.body.appendChild(el)
    document.body.removeChild(el) // → disconnectedCallback
    expect(el._abortController.signal.aborted).toBe(true)
  })

  it('post-disconnect: subscription NO più riceve delivery', () => {
    const broker = createBroker({})
    const received: unknown[] = []
    const name = makeEl()
    const el = document.createElement(name) as GlueZeroElement
    el.glueZeroBroker = broker
    document.body.appendChild(el)
    el.subscribe('topic.x', (e) => {
      received.push(e)
    })
    broker.publish(
      'topic.x',
      { a: 1 },
      { source: { type: 'plugin', id: 't' }, deliveryMode: 'sync' },
    )
    expect(received).toHaveLength(1)
    document.body.removeChild(el) // → disconnectedCallback → abort()
    broker.publish(
      'topic.x',
      { a: 2 },
      { source: { type: 'plugin', id: 't' }, deliveryMode: 'sync' },
    )
    expect(received).toHaveLength(1) // STILL 1 (cleanup invocato)
  })

  it('multiple subscriptions: tutte unsubscribed in single abort', () => {
    const broker = createBroker({})
    const a: unknown[] = []
    const b: unknown[] = []
    const c: unknown[] = []
    const name = makeEl()
    const el = document.createElement(name) as GlueZeroElement
    el.glueZeroBroker = broker
    document.body.appendChild(el)
    el.subscribe('topic.a', (e) => {
      a.push(e)
    })
    el.subscribe('topic.b', (e) => {
      b.push(e)
    })
    el.subscribe('topic.c', (e) => {
      c.push(e)
    })
    broker.publish(
      'topic.a',
      {},
      { source: { type: 'plugin', id: 't' }, deliveryMode: 'sync' },
    )
    broker.publish(
      'topic.b',
      {},
      { source: { type: 'plugin', id: 't' }, deliveryMode: 'sync' },
    )
    broker.publish(
      'topic.c',
      {},
      { source: { type: 'plugin', id: 't' }, deliveryMode: 'sync' },
    )
    expect(a.length + b.length + c.length).toBe(3)
    document.body.removeChild(el)
    broker.publish(
      'topic.a',
      {},
      { source: { type: 'plugin', id: 't' }, deliveryMode: 'sync' },
    )
    broker.publish(
      'topic.b',
      {},
      { source: { type: 'plugin', id: 't' }, deliveryMode: 'sync' },
    )
    broker.publish(
      'topic.c',
      {},
      { source: { type: 'plugin', id: 't' }, deliveryMode: 'sync' },
    )
    expect(a.length + b.length + c.length).toBe(3) // nessun nuovo evento
  })

  it('subscribe DOPO disconnect: signal già aborted → no-op subscription handle (Rule 2 defensive)', () => {
    const broker = createBroker({})
    const received: unknown[] = []
    const name = makeEl()
    const el = document.createElement(name) as GlueZeroElement
    el.glueZeroBroker = broker
    document.body.appendChild(el)
    document.body.removeChild(el) // abort()
    // GlueZeroElement.subscribe defensive: signal.aborted → ritorna no-op handle
    // (broker F1 'abort' listener attached dopo abort non re-fires — defensive layer
    // previene memory leak silenzioso). Subscription handle è inactive + topic preservato.
    const sub = el.subscribe('topic.x', (e) => {
      received.push(e)
    })
    expect(sub.active).toBe(false)
    expect(sub.topic).toBe('topic.x')
    broker.publish(
      'topic.x',
      {},
      { source: { type: 'plugin', id: 't' }, deliveryMode: 'sync' },
    )
    expect(received).toHaveLength(0)
    // sub.unsubscribe è no-op idempotent
    sub.unsubscribe()
    expect(received).toHaveLength(0)
  })
})
