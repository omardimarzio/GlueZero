/**
 * Tier-1 jsdom test per `createMfRuntimeContext` (MF-LIFE-03 + MF-OBS-01 + D-V2-16).
 *
 * @see runtime-context-factory.ts + RESEARCH §8 + PATTERNS §37
 */
import { createBroker } from '@gluezero/core'
import { describe, expect, it, vi } from 'vitest'
import { microfrontendModule } from './microfrontend-module'
import { createMfRuntimeContext } from './runtime-context-factory'
import type { MicroFrontendRegistration } from './types/descriptor'
import type { MicroFrontendState } from './types/lifecycle'

function makeReg(state: MicroFrontendState = 'mounted'): MicroFrontendRegistration {
  return {
    descriptor: {
      id: 'test-mf',
      name: 'Test MF',
      version: '1.0.0',
    },
    state,
  }
}

describe('createMfRuntimeContext — facade publish (MF-OBS-01)', () => {
  it('arricchisce metadata con microFrontendId/Version/lifecycleState', () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const publishSpy = vi.spyOn(broker, 'publish')
    const reg = makeReg()
    const ctx = createMfRuntimeContext(broker, reg)

    ctx.publish('test.topic', { hello: 'world' })

    expect(publishSpy).toHaveBeenCalledOnce()
    const args = publishSpy.mock.calls[0]
    const options = args?.[2] as { metadata?: Record<string, unknown> }
    expect(options?.metadata?.microFrontendId).toBe('test-mf')
    expect(options?.metadata?.microFrontendVersion).toBe('1.0.0')
    expect(options?.metadata?.lifecycleState).toBe('mounted')
  })

  it('source default = {type: plugin, id, name} (D-83 picklist constraint)', () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const publishSpy = vi.spyOn(broker, 'publish')
    const ctx = createMfRuntimeContext(broker, makeReg())
    ctx.publish('test.topic', {})
    const options = publishSpy.mock.calls[0]?.[2] as {
      source?: { type: string; id: string; name?: string }
    }
    // Core event-validator picklist: ['plugin', 'component', 'server', 'worker', 'system'].
    // D-83 vieta modifica core, dunque MF source.type usa 'plugin' (convenzione 08-10).
    expect(options?.source).toEqual({
      type: 'plugin',
      id: 'test-mf',
      name: 'Test MF',
    })
  })

  it('preserva metadata consumer-provided durante merge', () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const publishSpy = vi.spyOn(broker, 'publish')
    const ctx = createMfRuntimeContext(broker, makeReg())
    ctx.publish('test', {}, { metadata: { customKey: 'customValue' } })
    const options = publishSpy.mock.calls[0]?.[2] as {
      metadata: Record<string, unknown>
    }
    expect(options.metadata.customKey).toBe('customValue')
    expect(options.metadata.microFrontendId).toBe('test-mf')
  })

  it('lifecycleState aggiornato eventually-consistent (read at call-time)', () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const publishSpy = vi.spyOn(broker, 'publish')
    const reg = makeReg('loading')
    const ctx = createMfRuntimeContext(broker, reg)
    reg.state = 'mounted' // mutate post-context creation
    ctx.publish('test', {})
    const options = publishSpy.mock.calls[0]?.[2] as {
      metadata: Record<string, unknown>
    }
    // F8 read at call-time → mounted (eventually consistent)
    expect(options.metadata.lifecycleState).toBe('mounted')
  })

  it('consumer-provided source PREVALE sul default', () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const publishSpy = vi.spyOn(broker, 'publish')
    const ctx = createMfRuntimeContext(broker, makeReg())
    // Usa un valore valido della picklist core ('component') per testare override.
    ctx.publish('test', {}, {
      source: { type: 'component', id: 'custom-id' },
    })
    const options = publishSpy.mock.calls[0]?.[2] as {
      source?: { type: string; id: string }
    }
    expect(options?.source).toEqual({ type: 'component', id: 'custom-id' })
  })
})

describe('createMfRuntimeContext — facade subscribe (D-V2-16)', () => {
  it('subscribe auto-tag ownerId="mf:${id}"', () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const subscribeSpy = vi.spyOn(broker, 'subscribe')
    const ctx = createMfRuntimeContext(broker, makeReg())
    ctx.subscribe('test.topic', () => {})
    const options = subscribeSpy.mock.calls[0]?.[2] as { ownerId?: string }
    expect(options?.ownerId).toBe('mf:test-mf')
  })

  it('subscribe propaga signal opzionale dal context', () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const subscribeSpy = vi.spyOn(broker, 'subscribe')
    const ctrl = new AbortController()
    const ctx = createMfRuntimeContext(broker, makeReg(), ctrl.signal)
    ctx.subscribe('test.topic', () => {})
    const options = subscribeSpy.mock.calls[0]?.[2] as { signal?: AbortSignal }
    expect(options?.signal).toBe(ctrl.signal)
  })

  it('subscribe consumer-provided signal PREVALE sul context signal', () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const subscribeSpy = vi.spyOn(broker, 'subscribe')
    const ctxSignal = new AbortController().signal
    const subSignal = new AbortController().signal
    const ctx = createMfRuntimeContext(broker, makeReg(), ctxSignal)
    ctx.subscribe('test.topic', () => {}, { signal: subSignal })
    const options = subscribeSpy.mock.calls[0]?.[2] as { signal?: AbortSignal }
    expect(options?.signal).toBe(subSignal) // consumer prevale
  })
})

describe('createMfRuntimeContext — explicit object NOT Proxy (RESEARCH §8.2)', () => {
  it('context is plain object con publish/subscribe come function', () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const ctx = createMfRuntimeContext(broker, makeReg())
    expect(typeof ctx.publish).toBe('function')
    expect(typeof ctx.subscribe).toBe('function')
    expect(ctx.id).toBe('test-mf')
    expect(ctx.descriptor.name).toBe('Test MF')
    // Object.keys functional su plain object
    expect(Object.keys(ctx).length).toBeGreaterThan(0)
  })

  it('signal field undefined se non passato', () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const ctx = createMfRuntimeContext(broker, makeReg())
    expect(ctx.signal).toBeUndefined()
  })

  it('signal field popolato se passato', () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const ctrl = new AbortController()
    const ctx = createMfRuntimeContext(broker, makeReg(), ctrl.signal)
    expect(ctx.signal).toBe(ctrl.signal)
  })

  it('descriptor reference preservato (no clone)', () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const reg = makeReg()
    const ctx = createMfRuntimeContext(broker, reg)
    expect(ctx.descriptor).toBe(reg.descriptor) // strict identity
  })
})

describe('createMfRuntimeContext — integration con broker reale (end-to-end metadata)', () => {
  it('subscribe via context riceve evento publish via context con metadata enriched', async () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const ctx = createMfRuntimeContext(broker, makeReg())
    const received: unknown[] = []

    ctx.subscribe('greet.*', (event) => {
      received.push(event)
    })

    ctx.publish('greet.hello', { name: 'World' })

    // Default deliveryMode 'async' via queueMicrotask (D-01) — flush microtask queue.
    await new Promise<void>((resolve) => {
      queueMicrotask(resolve)
    })

    expect(received).toHaveLength(1)
    const event = received[0] as {
      metadata: Record<string, unknown>
      source: { type: string; id: string }
    }
    expect(event.metadata.microFrontendId).toBe('test-mf')
    expect(event.metadata.microFrontendVersion).toBe('1.0.0')
    expect(event.source).toEqual({
      type: 'plugin',
      id: 'test-mf',
      name: 'Test MF',
    })
  })
})
