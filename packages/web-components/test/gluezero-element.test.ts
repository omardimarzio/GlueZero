/**
 * Test Tier-1 jsdom per `GlueZeroElement` base class.
 *
 * Coverage:
 * - Istanziazione HTMLElement subclass
 * - AbortController inizializzato non-aborted in constructor
 * - Setter property `glueZeroBroker` + `glueZeroContext`
 * - Ready Promise resolution rules (broker-only vs broker+context)
 * - `onContextReady` hook overridable
 */

import { describe, expect, it } from 'vitest'
import { createBroker } from '@gluezero/core'
import { GlueZeroElement } from '../src/gluezero-element.js'

// Counter per nomi custom-element univoci per test isolation
let elCounter = 0
function defineTestElement(): string {
  const name = `gz-test-el-${++elCounter}`
  class TestEl extends GlueZeroElement {}
  customElements.define(name, TestEl)
  return name
}

describe('GlueZeroElement (base class)', () => {
  it('istanzia HTMLElement subclass senza errori', () => {
    const name = defineTestElement()
    const el = document.createElement(name) as GlueZeroElement
    expect(el).toBeInstanceOf(HTMLElement)
    expect(el).toBeInstanceOf(GlueZeroElement)
  })

  it('_abortController istanziato non-aborted in constructor', () => {
    const name = defineTestElement()
    const el = document.createElement(name) as GlueZeroElement & {
      _abortController: AbortController
    }
    expect(el._abortController).toBeInstanceOf(AbortController)
    expect(el._abortController.signal.aborted).toBe(false)
  })

  it('setter glueZeroBroker preserva value via getter (identità)', () => {
    const broker = createBroker({})
    const name = defineTestElement()
    const el = document.createElement(name) as GlueZeroElement
    el.glueZeroBroker = broker
    expect(el.glueZeroBroker).toBe(broker)
  })

  it('setter glueZeroContext preserva value via getter (identità)', () => {
    const ctx = { id: 'mf-1' } as never
    const name = defineTestElement()
    const el = document.createElement(name) as GlueZeroElement
    el.glueZeroContext = ctx
    expect(el.glueZeroContext).toBe(ctx)
  })

  it('ready risolve quando solo broker set (no context expected)', async () => {
    const broker = createBroker({})
    const name = defineTestElement()
    const el = document.createElement(name) as GlueZeroElement
    let resolved = false
    void el.ready.then(() => {
      resolved = true
    })
    await new Promise((r) => setTimeout(r, 0))
    expect(resolved).toBe(false)
    el.glueZeroBroker = broker
    await el.ready
    expect(resolved).toBe(true)
  })

  it('ready aspetta ENTRAMBI quando glueZeroContext set per primo', async () => {
    const broker = createBroker({})
    const ctx = { id: 'mf-1' } as never
    const name = defineTestElement()
    const el = document.createElement(name) as GlueZeroElement
    let resolved = false
    void el.ready.then(() => {
      resolved = true
    })
    el.glueZeroContext = ctx
    await new Promise((r) => setTimeout(r, 0))
    expect(resolved).toBe(false) // broker non ancora set → ready ancora pending
    el.glueZeroBroker = broker
    await el.ready
    expect(resolved).toBe(true)
  })

  it('onContextReady hook overridabile invocato dopo entrambi set', async () => {
    const broker = createBroker({})
    const ctx = { id: 'mf-1' } as never
    const hookName = `gz-hook-test-${++elCounter}`
    let hookCalled = 0
    class TestEl extends GlueZeroElement {
      override onContextReady(): void {
        hookCalled++
      }
    }
    customElements.define(hookName, TestEl)
    const el = document.createElement(hookName) as TestEl
    el.glueZeroBroker = broker
    el.glueZeroContext = ctx
    await el.ready
    expect(hookCalled).toBe(1)
  })

  it('onContextReady invocato UNA SOLA volta anche con setter ripetuti (idempotency)', async () => {
    const broker1 = createBroker({})
    const broker2 = createBroker({})
    const ctx = { id: 'mf-1' } as never
    const hookName = `gz-idem-test-${++elCounter}`
    let hookCalled = 0
    class TestEl extends GlueZeroElement {
      override onContextReady(): void {
        hookCalled++
      }
    }
    customElements.define(hookName, TestEl)
    const el = document.createElement(hookName) as TestEl
    el.glueZeroBroker = broker1
    el.glueZeroContext = ctx
    await el.ready
    expect(hookCalled).toBe(1)
    // Re-set non deve riinvocare hook
    el.glueZeroBroker = broker2
    el.glueZeroContext = ctx
    await new Promise((r) => setTimeout(r, 0))
    expect(hookCalled).toBe(1)
  })
})
