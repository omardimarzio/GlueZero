/**
 * Test Tier-1 jsdom per `GlueZeroController` (subpath `/lit` D-V2-F17-07 tier 1).
 *
 * Coverage:
 * - Costruttore registra controller via host.addController
 * - hostDisconnected → abort signal
 * - hostConnected ricrea AbortController su re-mount cycle
 * - publish delega broker + auto-iniezione metadata.microFrontendId
 * - subscribe throw se host.glueZeroBroker null
 * - cleanup: subscribe + hostDisconnected → no more delivery
 *
 * Mock LitElement-like host (no peer install `lit` per Tier-1 jsdom test rapidi).
 */

import { describe, expect, it } from 'vitest'
import { createBroker } from '@gluezero/core'
import { GlueZeroController } from '../../src/lit/controller.js'

/**
 * Mock LitElement-like host: implementa `GlueZeroControllerHost` interface
 * (subset di `ReactiveControllerHost` Lit) senza dipendere staticamente da `lit`.
 */
class MockLitHost {
  controllers: Array<{ hostConnected?: () => void; hostDisconnected?: () => void }> = []
  glueZeroBroker: unknown = null
  glueZeroContext: unknown = null
  addController(c: { hostConnected?: () => void; hostDisconnected?: () => void }): void {
    this.controllers.push(c)
  }
  requestUpdate(): void {
    /* no-op */
  }
}

describe('GlueZeroController (subpath /lit)', () => {
  it('costruttore registra controller via host.addController', () => {
    const host = new MockLitHost()
    const c = new GlueZeroController(host as never)
    expect(host.controllers).toContain(c)
  })

  it('hostDisconnected → abort signal', () => {
    const host = new MockLitHost()
    const c = new GlueZeroController(host as never) as unknown as {
      _abortController: AbortController
      hostDisconnected: () => void
    }
    expect(c._abortController.signal.aborted).toBe(false)
    c.hostDisconnected()
    expect(c._abortController.signal.aborted).toBe(true)
  })

  it('hostConnected ricrea AbortController dopo disconnect (re-mount cycle)', () => {
    const host = new MockLitHost()
    const c = new GlueZeroController(host as never) as unknown as {
      _abortController: AbortController
      hostConnected: () => void
      hostDisconnected: () => void
    }
    c.hostDisconnected()
    expect(c._abortController.signal.aborted).toBe(true)
    c.hostConnected()
    expect(c._abortController.signal.aborted).toBe(false)
  })

  it('publish delega broker + auto-iniezione metadata.microFrontendId (MF-OBS-01)', () => {
    const broker = createBroker({})
    const received: unknown[] = []
    broker.subscribe('topic.x', (e) => {
      received.push(e)
    })
    const host = new MockLitHost()
    host.glueZeroBroker = broker
    host.glueZeroContext = { id: 'mf-lit' }
    const c = new GlueZeroController(host as never)
    c.publish('topic.x', { v: 1 }, { deliveryMode: 'sync' })
    expect((received[0] as { metadata?: { microFrontendId?: string } }).metadata?.microFrontendId).toBe(
      'mf-lit',
    )
    expect((received[0] as { payload: unknown }).payload).toEqual({ v: 1 })
  })

  it('publish throw se host.glueZeroBroker null', () => {
    const host = new MockLitHost()
    const c = new GlueZeroController(host as never)
    expect(() => c.publish('topic.x', {})).toThrow(/glueZeroBroker/)
  })

  it('subscribe throw se host.glueZeroBroker null', () => {
    const host = new MockLitHost()
    const c = new GlueZeroController(host as never)
    expect(() => c.subscribe('topic.x', () => {})).toThrow(/glueZeroBroker/)
  })

  it('cleanup: subscribe + hostDisconnected → no more delivery', () => {
    const broker = createBroker({})
    const received: unknown[] = []
    const host = new MockLitHost()
    host.glueZeroBroker = broker
    const c = new GlueZeroController(host as never) as unknown as GlueZeroController & {
      hostDisconnected: () => void
    }
    c.subscribe('topic.x', (e) => {
      received.push(e)
    })
    broker.publish(
      'topic.x',
      {},
      { source: { type: 'plugin', id: 't' }, deliveryMode: 'sync' },
    )
    expect(received).toHaveLength(1)
    c.hostDisconnected()
    broker.publish(
      'topic.x',
      {},
      { source: { type: 'plugin', id: 't' }, deliveryMode: 'sync' },
    )
    expect(received).toHaveLength(1) // cleanup OK
  })

  it('context getter ritorna host.glueZeroContext (null se non settato)', () => {
    const host = new MockLitHost()
    const c = new GlueZeroController(host as never)
    expect(c.context).toBeNull()
    host.glueZeroContext = { id: 'mf-ctx' }
    expect((c.context as { id: string } | null)?.id).toBe('mf-ctx')
  })
})
