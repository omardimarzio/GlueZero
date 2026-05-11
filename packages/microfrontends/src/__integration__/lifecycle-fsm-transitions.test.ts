/**
 * Tier-1 jsdom integration test — sequenza pre-mount completa MF-INT-LIFE-01.
 *
 * Verifica end-to-end (con MOCK loader inline) della sequenza:
 *   register -> load -> bootstrap -> mount -> unmount -> destroy
 *
 * Auto-bootstrap D-V2-07: `mount(id)` su `state === 'loaded'` chiama `bootstrap`
 * implicito; override `options.skipBootstrap: true` rispettato.
 *
 * Idempotency P-04: chiamate concorrenti stesso op = stessa Promise strict identity;
 * op diverso concorrente = throw `MF_LIFECYCLE_IN_FLIGHT`.
 *
 * Cascade D-V2-16: `destroy` chiama `broker.unsubscribeByOwner(mf:${id})` in finally.
 *
 * @see RESEARCH §3.4, §6.4 + MF-INT-LIFE-01 + D-V2-07 + D-V2-16
 */
import { createBroker, SERVICE_MICROFRONTENDS } from '@gluezero/core'
import { describe, expect, it, vi } from 'vitest'
import type { MicroFrontendLoaderAdapter } from '../loader-registry'
import { microfrontendModule } from '../microfrontend-module'
import type { MicroFrontendsService } from '../registry'
import type { MicroFrontendDescriptor } from '../types/descriptor'

function makeHarness() {
  const broker = createBroker({ modules: [microfrontendModule()] })
  const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
  if (!service) throw new Error('SERVICE_MICROFRONTENDS not registered')

  // MOCK loader inline (preview di W5-P11 mock-loader.ts).
  const bootstrapSpy = vi.fn()
  const mountSpy = vi.fn()
  const unmountSpy = vi.fn()
  const destroySpy = vi.fn()
  const mockLoader: MicroFrontendLoaderAdapter = {
    type: 'mock',
    async load(definition) {
      return {
        module: { mockId: definition.url ?? 'mock' },
        lifecycle: {
          bootstrap: bootstrapSpy,
          mount: mountSpy,
          unmount: unmountSpy,
          destroy: destroySpy,
        },
      }
    },
  }
  service.registerLoader(mockLoader)

  return { broker, service, spies: { bootstrapSpy, mountSpy, unmountSpy, destroySpy } }
}

const validDescriptor: MicroFrontendDescriptor = {
  id: 'test-mf',
  name: 'Test MF',
  version: '1.0.0',
  loader: { type: 'mock', url: 'inline' },
}

describe('Lifecycle transitions — full sequence MF-INT-LIFE-01', () => {
  it('register -> load -> bootstrap -> mount sequence transitions correctly', async () => {
    const { service } = makeHarness()
    await service.register(validDescriptor)
    expect(service.getState('test-mf')).toBe('registered')

    await service.load('test-mf')
    expect(service.getState('test-mf')).toBe('loaded')

    await service.bootstrap('test-mf')
    expect(service.getState('test-mf')).toBe('bootstrapped')

    await service.mount('test-mf', { skipBootstrap: true })
    expect(service.getState('test-mf')).toBe('mounted')
  })

  it('mount auto-bootstrap on loaded state (D-V2-07)', async () => {
    const { service, spies } = makeHarness()
    await service.register(validDescriptor)
    await service.load('test-mf')

    // Skipping explicit bootstrap — mount dovrebbe auto-bootstrap
    await service.mount('test-mf')
    expect(spies.bootstrapSpy).toHaveBeenCalledOnce()
    expect(spies.mountSpy).toHaveBeenCalledOnce()
    expect(service.getState('test-mf')).toBe('mounted')
  })

  it('mount with skipBootstrap=true does NOT call bootstrap', async () => {
    const { service, spies } = makeHarness()
    await service.register(validDescriptor)
    await service.load('test-mf')
    await service.bootstrap('test-mf') // explicit bootstrap

    await service.mount('test-mf', { skipBootstrap: true })
    expect(spies.bootstrapSpy).toHaveBeenCalledOnce() // only the explicit call
    expect(spies.mountSpy).toHaveBeenCalledOnce()
  })

  it('unmount + destroy sequence transitions correctly', async () => {
    const { service, spies } = makeHarness()
    await service.register(validDescriptor)
    await service.load('test-mf')
    await service.mount('test-mf')

    await service.unmount('test-mf')
    expect(service.getState('test-mf')).toBe('unmounted')
    expect(spies.unmountSpy).toHaveBeenCalledOnce()

    await service.destroy('test-mf')
    expect(service.getState('test-mf')).toBe('destroyed')
    expect(spies.destroySpy).toHaveBeenCalledOnce()
  })

  it('mount op idempotent — second call is no-op (MF-LIFE-07)', async () => {
    const { service, spies } = makeHarness()
    await service.register(validDescriptor)
    await service.load('test-mf')
    await service.mount('test-mf')
    await service.mount('test-mf') // second call no-op
    expect(spies.mountSpy).toHaveBeenCalledOnce() // only called once
  })

  it('load failure -> transition to failed with phase=load', async () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
    if (!service) throw new Error('SERVICE_MICROFRONTENDS not registered')
    const failingLoader: MicroFrontendLoaderAdapter = {
      type: 'mock-fail',
      async load() {
        throw new Error('mock load failure')
      },
    }
    service.registerLoader(failingLoader)
    await service.register({
      id: 'fail-mf',
      name: 'Fail',
      version: '1.0.0',
      loader: { type: 'mock-fail' },
    })

    await expect(service.load('fail-mf')).rejects.toThrow('mock load failure')
    const snap = service.getSnapshot('fail-mf')
    expect(snap?.state).toBe('failed')
    expect(snap?.failureReason?.phase).toBe('load')
  })

  it('destroy cascade unsubscribeByOwner (D-V2-16)', async () => {
    const { broker, service } = makeHarness()
    await service.register(validDescriptor)
    await service.load('test-mf')
    await service.mount('test-mf')
    const spy = vi.spyOn(broker, 'unsubscribeByOwner')

    await service.destroy('test-mf')

    // Cascade verificata: spy chiamato con `mf:test-mf` durante destroy.
    expect(spy).toHaveBeenCalledWith('mf:test-mf')
    spy.mockRestore()
  })

  it('load loader not found -> throw MF_LOADER_NOT_FOUND + transition failed', async () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
    if (!service) throw new Error('SERVICE_MICROFRONTENDS not registered')
    await service.register({
      id: 'no-loader',
      name: 'X',
      version: '1.0.0',
      loader: { type: 'esm-unregistered' },
    })

    await expect(service.load('no-loader')).rejects.toMatchObject({
      code: 'MF_LOADER_NOT_FOUND',
    })
    expect(service.getState('no-loader')).toBe('failed')
  })

  it('concurrent same-op mount -> returns same Promise (P-04 strict identity)', async () => {
    const { service } = makeHarness()
    await service.register(validDescriptor)
    await service.load('test-mf')

    const p1 = service.mount('test-mf')
    const p2 = service.mount('test-mf')
    expect(p1).toBe(p2) // strict identity (P-04)
    await Promise.all([p1, p2])
    expect(service.getState('test-mf')).toBe('mounted')
  })

  it('concurrent different-op mount + unmount -> throws MF_LIFECYCLE_IN_FLIGHT', async () => {
    const { service } = makeHarness()
    // Slow mount hook per garantire op in-flight quando arriva la chiamata diversa.
    const broker = createBroker({ modules: [microfrontendModule()] })
    const svc = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
    if (!svc) throw new Error('SERVICE_MICROFRONTENDS not registered')
    const slowLoader: MicroFrontendLoaderAdapter = {
      type: 'mock-slow',
      async load() {
        return {
          module: {},
          lifecycle: {
            bootstrap: async () => {},
            mount: async () => {
              await new Promise((r) => setTimeout(r, 20))
            },
            unmount: async () => {},
            destroy: () => {},
          },
        }
      },
    }
    svc.registerLoader(slowLoader)
    await svc.register({
      id: 'slow-mf',
      name: 'Slow',
      version: '1.0.0',
      loader: { type: 'mock-slow' },
    })
    await svc.load('slow-mf')

    // Start mount (slow because async hook)
    const pMount = svc.mount('slow-mf')
    // Concurrent unmount while mount in-flight.
    // `runOp` throw SINCRONOUSLY (sync throw, non Promise.reject) per disambiguare
    // il flow di errori — wrappiamo in try/catch invece di .rejects matcher.
    let caught: unknown
    try {
      svc.unmount('slow-mf')
      expect.fail('should have thrown MF_LIFECYCLE_IN_FLIGHT')
    } catch (err) {
      caught = err
    }
    expect((caught as { code: string }).code).toBe('MF_LIFECYCLE_IN_FLIGHT')
    expect((caught as { details: { currentOp: string; requestedOp: string } }).details).toMatchObject({
      currentOp: 'mount',
      requestedOp: 'unmount',
    })
    await pMount // cleanup
    expect(svc.getState('slow-mf')).toBe('mounted')
    // Reference per silenziare unused harness
    void service
  })
})
