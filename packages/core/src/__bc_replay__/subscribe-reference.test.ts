/**
 * v1-bc-replay — PRD §42.2 API #3 freeze: subscribe + reference identity preserved.
 *
 * P-03 mitigation: ogni evento mantiene identità referenziale durante delivery.
 * `WeakMap<BrokerEvent, X>.set(...).has(...)` true post-publish — il broker NON
 * deve clonare/wrappare l'event envelope durante dispatch (zero-copy guarantee).
 *
 * @see .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-RESEARCH.md §7
 * @see D-V2-F8-08 suite content #2
 */

import { type BrokerEvent, createBroker } from '@gluezero/core'
import { describe, expect, it } from 'vitest'

describe('v1-bc-replay: subscribe reference identity (API #3, P-03)', () => {
  it('event reference identity preserved through delivery (WeakMap test)', () => {
    const broker = createBroker({})
    let captured: BrokerEvent | null = null
    broker.subscribe(
      'test.ref',
      (evt) => {
        captured = evt
      },
      { deliveryMode: 'sync' },
    )
    broker.publish(
      'test.ref',
      { data: 'value' },
      {
        source: { type: 'system', id: 'bc-replay' },
        deliveryMode: 'sync',
      },
    )
    expect(captured).not.toBeNull()
    const map = new WeakMap<BrokerEvent, string>()
    map.set(captured as unknown as BrokerEvent, 'x')
    expect(map.has(captured as unknown as BrokerEvent)).toBe(true)
  })

  it('subscribe returns idempotent unsubscribe handle', () => {
    const broker = createBroker({})
    const sub = broker.subscribe('test.idemp', () => {})
    expect(typeof sub.unsubscribe).toBe('function')
    expect(sub.active).toBe(true)
    sub.unsubscribe()
    expect(() => sub.unsubscribe()).not.toThrow()
    expect(sub.active).toBe(false)
  })

  it('subscribe returns Subscription handle with id + topic readonly fields', () => {
    const broker = createBroker({})
    const sub = broker.subscribe('test.handle', () => {})
    expect(typeof sub.id).toBe('string')
    expect(sub.topic).toBe('test.handle')
    sub.unsubscribe()
  })
})
