/**
 * Test events emission — lifecycle + error topics + payload shape verification.
 *
 * Verifica:
 * - register publica 'microfrontend.registered' con descriptor inline (P-15)
 * - load sequence publica resolving + loading + loaded
 * - mount sequence publica bootstrapping + bootstrapped + mounting + mounted (auto-bootstrap D-V2-07)
 * - unregister publica 'microfrontend.unregistered'
 * - failure publica 'microfrontend.failed' + phase-specific error topic
 * - error event payload include phase + error.message + recoverable
 *
 * Pattern: tutte le subscribe usano `deliveryMode: 'sync'` per garantire delivery
 * sincrono — i test verificano lo stato handler IMMEDIATAMENTE dopo l'op (no microtask wait).
 *
 * @see PRD §31.4 + §31.5 + MF-EVT-01 + MF-EVT-02 + MF-EVT-04 + MF-EVT-05
 */
import { createBroker, SERVICE_MICROFRONTENDS } from '@gluezero/core'
import { describe, expect, it, vi } from 'vitest'
import type { MicroFrontendLoaderAdapter } from './loader-registry'
import { microfrontendModule } from './microfrontend-module'
import type { MicroFrontendsService } from './registry'
import type { MicroFrontendDescriptor } from './types/descriptor'
import type {
  MicroFrontendErrorEventPayload,
  MicroFrontendLifecycleEventPayload,
} from './types/events'

function makeHarness() {
  const broker = createBroker({ modules: [microfrontendModule()] })
  const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
  if (!service) throw new Error('SERVICE_MICROFRONTENDS not registered')
  const mockLoader: MicroFrontendLoaderAdapter = {
    type: 'mock',
    async load() {
      return {
        module: {},
        lifecycle: {
          bootstrap: async () => {},
          mount: async () => {},
          unmount: async () => {},
          destroy: () => {},
        },
      }
    },
  }
  service.registerLoader(mockLoader)
  return { broker, service }
}

const validDescriptor: MicroFrontendDescriptor = {
  id: 'event-test',
  name: 'Event Test MF',
  version: '1.0.0',
  loader: { type: 'mock' },
}

describe('Events emission — lifecycle topics (MF-EVT-01 + MF-EVT-04)', () => {
  it('register publica "microfrontend.registered" con shape valida + descriptor inline', async () => {
    const { broker, service } = makeHarness()
    const handler = vi.fn()
    broker.subscribe('microfrontend.registered', handler, { deliveryMode: 'sync' })
    await service.register(validDescriptor)

    expect(handler).toHaveBeenCalledOnce()
    const event = handler.mock.calls[0]?.[0] as { payload: MicroFrontendLifecycleEventPayload }
    const payload = event.payload
    expect(payload.id).toBe('event-test')
    expect(payload.name).toBe('Event Test MF')
    expect(payload.version).toBe('1.0.0')
    expect(payload.state).toBe('registered')
    expect(payload.timestamp).toBeGreaterThan(0)
    expect(payload.descriptor).toBeDefined() // solo registered (P-15)
    expect(payload.descriptor?.id).toBe('event-test')
  })

  it('load publica resolving + loading + loaded in sequenza', async () => {
    const { broker, service } = makeHarness()
    const resolvingSpy = vi.fn()
    const loadingSpy = vi.fn()
    const loadedSpy = vi.fn()
    broker.subscribe('microfrontend.resolving', resolvingSpy, { deliveryMode: 'sync' })
    broker.subscribe('microfrontend.loading', loadingSpy, { deliveryMode: 'sync' })
    broker.subscribe('microfrontend.loaded', loadedSpy, { deliveryMode: 'sync' })

    await service.register(validDescriptor)
    await service.load('event-test')

    expect(resolvingSpy).toHaveBeenCalledOnce()
    expect(loadingSpy).toHaveBeenCalledOnce()
    expect(loadedSpy).toHaveBeenCalledOnce()
  })

  it('mount auto-bootstrap publica bootstrapping + bootstrapped + mounting + mounted (D-V2-07)', async () => {
    const { broker, service } = makeHarness()
    const events: string[] = []
    for (const t of [
      'microfrontend.bootstrapping',
      'microfrontend.bootstrapped',
      'microfrontend.mounting',
      'microfrontend.mounted',
    ]) {
      broker.subscribe(
        t,
        () => {
          events.push(t)
        },
        { deliveryMode: 'sync' },
      )
    }

    await service.register(validDescriptor)
    await service.load('event-test')
    await service.mount('event-test')

    expect(events).toEqual([
      'microfrontend.bootstrapping',
      'microfrontend.bootstrapped',
      'microfrontend.mounting',
      'microfrontend.mounted',
    ])
  })

  it('lifecycle payload include previousState quando state transitions', async () => {
    const { broker, service } = makeHarness()
    const handler = vi.fn()
    broker.subscribe('microfrontend.loaded', handler, { deliveryMode: 'sync' })

    await service.register(validDescriptor)
    await service.load('event-test')

    const event = handler.mock.calls[0]?.[0] as { payload: MicroFrontendLifecycleEventPayload }
    expect(event.payload.previousState).toBe('loading')
    expect(event.payload.state).toBe('loaded')
  })

  it('unregister publica "microfrontend.unregistered" + cleanup', async () => {
    const { broker, service } = makeHarness()
    const handler = vi.fn()
    broker.subscribe('microfrontend.unregistered', handler, { deliveryMode: 'sync' })

    await service.register(validDescriptor)
    await service.unregister('event-test')

    expect(handler).toHaveBeenCalledOnce()
    expect(service.get('event-test')).toBeUndefined()
    const event = handler.mock.calls[0]?.[0] as { payload: MicroFrontendLifecycleEventPayload }
    expect(event.payload.id).toBe('event-test')
    expect(event.payload.state).toBe('destroyed')
  })

  it('descriptor field popolato SOLO per registered (P-15 retention mitigation)', async () => {
    const { broker, service } = makeHarness()
    const loadedHandler = vi.fn()
    broker.subscribe('microfrontend.loaded', loadedHandler, { deliveryMode: 'sync' })

    await service.register(validDescriptor)
    await service.load('event-test')

    const event = loadedHandler.mock.calls[0]?.[0] as {
      payload: MicroFrontendLifecycleEventPayload
    }
    expect(event.payload.descriptor).toBeUndefined() // NON popolato per loaded
  })

  it('destroy sequence publica destroying + destroyed', async () => {
    const { broker, service } = makeHarness()
    const destroyingSpy = vi.fn()
    const destroyedSpy = vi.fn()
    broker.subscribe('microfrontend.destroying', destroyingSpy, { deliveryMode: 'sync' })
    broker.subscribe('microfrontend.destroyed', destroyedSpy, { deliveryMode: 'sync' })

    await service.register(validDescriptor)
    await service.load('event-test')
    await service.mount('event-test')
    await service.destroy('event-test')

    expect(destroyingSpy).toHaveBeenCalledOnce()
    expect(destroyedSpy).toHaveBeenCalledOnce()
  })
})

describe('Events emission — error topics (MF-EVT-02 + MF-EVT-05)', () => {
  it('load failure publica "microfrontend.failed" + "microfrontend.load.failed"', async () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
    if (!service) throw new Error('SERVICE_MICROFRONTENDS not registered')
    const failingLoader: MicroFrontendLoaderAdapter = {
      type: 'fail',
      async load() {
        throw new Error('load network timeout')
      },
    }
    service.registerLoader(failingLoader)

    const failedHandler = vi.fn()
    const loadFailedHandler = vi.fn()
    broker.subscribe('microfrontend.failed', failedHandler, { deliveryMode: 'sync' })
    broker.subscribe('microfrontend.load.failed', loadFailedHandler, { deliveryMode: 'sync' })

    await service.register({
      id: 'fail-mf',
      name: 'Fail',
      version: '1.0.0',
      loader: { type: 'fail' },
    })

    await expect(service.load('fail-mf')).rejects.toThrow()

    expect(failedHandler).toHaveBeenCalledOnce()
    expect(loadFailedHandler).toHaveBeenCalledOnce()

    const errorEvent = loadFailedHandler.mock.calls[0]?.[0] as {
      payload: MicroFrontendErrorEventPayload
    }
    expect(errorEvent.payload.phase).toBe('load')
    expect(errorEvent.payload.error.message).toBe('load network timeout')
    expect(errorEvent.payload.recoverable).toBe(false)
    expect(errorEvent.payload.id).toBe('fail-mf')
  })

  it('error event payload include error.message + error.stack safe-serialized', async () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
    if (!service) throw new Error('SERVICE_MICROFRONTENDS not registered')
    service.registerLoader({
      type: 'fail',
      async load() {
        throw new Error('serialize test')
      },
    })
    const handler = vi.fn()
    broker.subscribe('microfrontend.load.failed', handler, { deliveryMode: 'sync' })
    await service.register({
      id: 'x',
      name: 'X',
      version: '1.0.0',
      loader: { type: 'fail' },
    })
    await expect(service.load('x')).rejects.toThrow()
    const payload = (
      handler.mock.calls[0]?.[0] as {
        payload: MicroFrontendErrorEventPayload
      }
    ).payload
    expect(typeof payload.error.message).toBe('string')
    // error.stack opzionale ma se presente è string (safe-serialized, NO Error native)
    if (payload.error.stack !== undefined) {
      expect(typeof payload.error.stack).toBe('string')
    }
  })

  it('loader-not-registered emette "microfrontend.failed" + "microfrontend.load.failed"', async () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
    if (!service) throw new Error('SERVICE_MICROFRONTENDS not registered')

    const failedHandler = vi.fn()
    const loadFailedHandler = vi.fn()
    broker.subscribe('microfrontend.failed', failedHandler, { deliveryMode: 'sync' })
    broker.subscribe('microfrontend.load.failed', loadFailedHandler, { deliveryMode: 'sync' })

    await service.register({
      id: 'no-loader-mf',
      name: 'No Loader',
      version: '1.0.0',
      loader: { type: 'unknown-type' },
    })

    await expect(service.load('no-loader-mf')).rejects.toThrow(/not registered/)

    expect(failedHandler).toHaveBeenCalledOnce()
    expect(loadFailedHandler).toHaveBeenCalledOnce()
    const errorEvent = loadFailedHandler.mock.calls[0]?.[0] as {
      payload: MicroFrontendErrorEventPayload
    }
    expect(errorEvent.payload.phase).toBe('load')
  })
})
