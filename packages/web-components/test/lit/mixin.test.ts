/**
 * Test Tier-1 jsdom per `GlueZeroLitMixin` (subpath `/lit` D-V2-F17-07 tier 2).
 *
 * Coverage:
 * - Mixin ritorna class extends Base con property `gluezero` (GlueZeroController istance)
 * - Constructor auto-inietta controller via `new GlueZeroController(this)`
 * - Property `glueZeroBroker` + `glueZeroContext` initial null
 * - Setter propagano a controller (via getter forward)
 * - this.gluezero.publish + .subscribe shortcut funzionante
 *
 * Mock LitElement-like base (no peer install `lit`).
 */

import { describe, expect, it } from 'vitest'
import { createBroker } from '@gluezero/core'
import { GlueZeroController } from '../../src/lit/controller.js'
import { GlueZeroLitMixin } from '../../src/lit/mixin.js'

/** Mock LitElement-like base: implementa subset di ReactiveControllerHost senza peer Lit. */
class MockLitBase {
  controllers: Array<{ hostConnected?: () => void; hostDisconnected?: () => void }> = []
  addController(c: { hostConnected?: () => void; hostDisconnected?: () => void }): void {
    this.controllers.push(c)
  }
  requestUpdate(): void {
    /* no-op */
  }
}

describe('GlueZeroLitMixin (subpath /lit class mixin)', () => {
  it('istanza ha property `gluezero` di tipo GlueZeroController', () => {
    const Mixed = GlueZeroLitMixin(MockLitBase as unknown as new (...args: any[]) => InstanceType<typeof MockLitBase>)
    const instance = new Mixed() as unknown as { gluezero: GlueZeroController }
    expect(instance.gluezero).toBeInstanceOf(GlueZeroController)
  })

  it('inietta controller via base.addController in constructor', () => {
    const Mixed = GlueZeroLitMixin(MockLitBase as unknown as new (...args: any[]) => InstanceType<typeof MockLitBase>)
    const instance = new Mixed() as unknown as {
      gluezero: GlueZeroController
      controllers: unknown[]
    }
    expect(instance.controllers).toContain(instance.gluezero)
  })

  it('property glueZeroBroker + glueZeroContext default null', () => {
    const Mixed = GlueZeroLitMixin(MockLitBase as unknown as new (...args: any[]) => InstanceType<typeof MockLitBase>)
    const instance = new Mixed() as unknown as {
      glueZeroBroker: unknown
      glueZeroContext: unknown
    }
    expect(instance.glueZeroBroker).toBeNull()
    expect(instance.glueZeroContext).toBeNull()
  })

  it('setter glueZeroBroker propagano a controller via getter forward', () => {
    const broker = createBroker({})
    const Mixed = GlueZeroLitMixin(MockLitBase as unknown as new (...args: any[]) => InstanceType<typeof MockLitBase>)
    const instance = new Mixed() as unknown as {
      glueZeroBroker: unknown
      glueZeroContext: unknown
      gluezero: GlueZeroController
    }
    instance.glueZeroBroker = broker
    instance.glueZeroContext = { id: 'mf-x' }
    expect(instance.gluezero.broker).toBe(broker)
    expect((instance.gluezero.context as { id: string } | null)?.id).toBe('mf-x')
  })

  it('publish + subscribe via this.gluezero shortcut funziona', () => {
    const broker = createBroker({})
    const received: unknown[] = []
    broker.subscribe('topic.lit', (e) => {
      received.push(e)
    })
    const Mixed = GlueZeroLitMixin(MockLitBase as unknown as new (...args: any[]) => InstanceType<typeof MockLitBase>)
    const instance = new Mixed() as unknown as {
      glueZeroBroker: unknown
      gluezero: GlueZeroController
    }
    instance.glueZeroBroker = broker
    instance.gluezero.publish('topic.lit', { hello: 'world' }, { deliveryMode: 'sync' })
    expect(received).toHaveLength(1)
    expect((received[0] as { payload: unknown }).payload).toEqual({ hello: 'world' })
  })
})
