/**
 * Test Tier-1 jsdom per `this.publish` / `this.subscribe` helper instance methods.
 *
 * Coverage:
 * - publish/subscribe throw se glueZeroBroker non settato (T-17-03-03 mitigation defensive)
 * - publish delega a broker.publish con payload
 * - publish auto-inietta metadata.microFrontendId quando glueZeroContext.id presente (MF-OBS-01)
 * - publish NO inietta metadata.microFrontendId quando context null
 * - publish merge metadata custom + microFrontendId
 * - subscribe registra e riceve event al broker.publish
 */

import { describe, expect, it } from 'vitest'
import { createBroker } from '@gluezero/core'
import { GlueZeroElement } from '../src/gluezero-element.js'

let ctr = 0
function makeEl(): string {
  const name = `gz-ps-el-${++ctr}`
  class T extends GlueZeroElement {}
  customElements.define(name, T)
  return name
}

describe('GlueZeroElement.publish / .subscribe (helper instance methods)', () => {
  it('publish throw se glueZeroBroker non settato', () => {
    const name = makeEl()
    const el = document.createElement(name) as GlueZeroElement
    expect(() => el.publish('topic.x', {})).toThrow(/glueZeroBroker/)
  })

  it('subscribe throw se glueZeroBroker non settato', () => {
    const name = makeEl()
    const el = document.createElement(name) as GlueZeroElement
    expect(() => el.subscribe('topic.x', () => {})).toThrow(/glueZeroBroker/)
  })

  it('publish delega a broker.publish con payload (deliveryMode sync per test)', () => {
    const broker = createBroker({})
    const received: unknown[] = []
    broker.subscribe('topic.x', (e) => {
      received.push(e)
    })
    const name = makeEl()
    const el = document.createElement(name) as GlueZeroElement
    el.glueZeroBroker = broker
    el.publish('topic.x', { a: 1 }, { deliveryMode: 'sync' })
    expect(received).toHaveLength(1)
    expect((received[0] as { payload: unknown }).payload).toEqual({ a: 1 })
  })

  it('publish auto-inietta metadata.microFrontendId quando context.id presente (MF-OBS-01)', () => {
    const broker = createBroker({})
    const received: unknown[] = []
    broker.subscribe('topic.x', (e) => {
      received.push(e)
    })
    const name = makeEl()
    const el = document.createElement(name) as GlueZeroElement
    el.glueZeroBroker = broker
    el.glueZeroContext = { id: 'mf-cart' } as never
    el.publish('topic.x', {}, { deliveryMode: 'sync' })
    expect((received[0] as { metadata?: { microFrontendId?: string } }).metadata?.microFrontendId).toBe(
      'mf-cart',
    )
  })

  it('publish NO inietta metadata.microFrontendId quando context null', () => {
    const broker = createBroker({})
    const received: unknown[] = []
    broker.subscribe('topic.x', (e) => {
      received.push(e)
    })
    const name = makeEl()
    const el = document.createElement(name) as GlueZeroElement
    el.glueZeroBroker = broker
    el.publish('topic.x', {}, { deliveryMode: 'sync' })
    expect(
      (received[0] as { metadata?: { microFrontendId?: string } }).metadata?.microFrontendId,
    ).toBeUndefined()
  })

  it('publish merge metadata custom + microFrontendId (no overwrite custom keys)', () => {
    const broker = createBroker({})
    const received: unknown[] = []
    broker.subscribe('topic.x', (e) => {
      received.push(e)
    })
    const name = makeEl()
    const el = document.createElement(name) as GlueZeroElement
    el.glueZeroBroker = broker
    el.glueZeroContext = { id: 'mf-x' } as never
    el.publish('topic.x', {}, { metadata: { custom: 'v' }, deliveryMode: 'sync' })
    const meta = (received[0] as { metadata?: { microFrontendId?: string; custom?: string } }).metadata
    expect(meta?.microFrontendId).toBe('mf-x')
    expect(meta?.custom).toBe('v')
  })

  it('publish auto-iniezione source { type: "component", id: <mfId|"wc"> } se assente', () => {
    const broker = createBroker({})
    const received: unknown[] = []
    broker.subscribe('topic.x', (e) => {
      received.push(e)
    })
    const name = makeEl()
    const el = document.createElement(name) as GlueZeroElement
    el.glueZeroBroker = broker
    el.glueZeroContext = { id: 'mf-source' } as never
    el.publish('topic.x', {}, { deliveryMode: 'sync' })
    const src = (received[0] as { source: { type: string; id: string } }).source
    expect(src.type).toBe('component')
    expect(src.id).toBe('mf-source')
  })

  it('publish preserva source esplicito se passato in options', () => {
    const broker = createBroker({})
    const received: unknown[] = []
    broker.subscribe('topic.x', (e) => {
      received.push(e)
    })
    const name = makeEl()
    const el = document.createElement(name) as GlueZeroElement
    el.glueZeroBroker = broker
    el.publish(
      'topic.x',
      {},
      { source: { type: 'plugin', id: 'override' }, deliveryMode: 'sync' },
    )
    const src = (received[0] as { source: { type: string; id: string } }).source
    expect(src.type).toBe('plugin')
    expect(src.id).toBe('override')
  })

  it('subscribe registra handler e riceve event broker.publish (sync delivery)', () => {
    const broker = createBroker({})
    const received: unknown[] = []
    const name = makeEl()
    const el = document.createElement(name) as GlueZeroElement
    el.glueZeroBroker = broker
    el.subscribe('topic.x', (e) => {
      received.push(e)
    })
    broker.publish(
      'topic.x',
      { y: 2 },
      { source: { type: 'plugin', id: 't' }, deliveryMode: 'sync' },
    )
    expect(received).toHaveLength(1)
    expect((received[0] as { payload: unknown }).payload).toEqual({ y: 2 })
  })
})
