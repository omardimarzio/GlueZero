/**
 * Test Tier-1 jsdom per property-mode context wiring (D-V2-F17-06).
 *
 * Verifica:
 * - NO observed attributes (broker non serializzabile → property-only)
 * - Setter accetta null (clear)
 * - Setter order broker-then-context indipendente da context-then-broker
 */

import { describe, expect, it } from 'vitest'
import { createBroker } from '@gluezero/core'
import { GlueZeroElement } from '../src/gluezero-element.js'

let ctr = 0
function makeEl(): string {
  const name = `gz-wire-el-${++ctr}`
  class T extends GlueZeroElement {}
  customElements.define(name, T)
  return name
}

describe('Context wiring property-mode (D-V2-F17-06)', () => {
  it('NO observed attributes — property-only (broker non serializzabile)', () => {
    const name = makeEl()
    const Cls = customElements.get(name) as unknown as { observedAttributes?: string[] }
    expect(Cls.observedAttributes ?? []).toEqual([])
  })

  it('setter glueZeroBroker accetta null (clear)', () => {
    const broker = createBroker({})
    const name = makeEl()
    const el = document.createElement(name) as GlueZeroElement
    el.glueZeroBroker = broker
    expect(el.glueZeroBroker).toBe(broker)
    el.glueZeroBroker = null
    expect(el.glueZeroBroker).toBeNull()
  })

  it('setter order broker-then-context indipendente da context-then-broker', async () => {
    const broker1 = createBroker({})
    const broker2 = createBroker({})
    const ctx = { id: 'mf-a' } as never

    const name = makeEl()
    const elA = document.createElement(name) as GlueZeroElement
    elA.glueZeroBroker = broker1
    elA.glueZeroContext = ctx
    await elA.ready

    const elB = document.createElement(name) as GlueZeroElement
    elB.glueZeroContext = ctx
    elB.glueZeroBroker = broker2
    await elB.ready

    expect(elA.glueZeroBroker).toBe(broker1)
    expect(elB.glueZeroBroker).toBe(broker2)
  })
})
