import { createBroker, SERVICE_MICROFRONTENDS } from '@gluezero/core'
import { describe, expect, it, vi } from 'vitest'
import { microfrontendModule } from './microfrontend-module'
import type { MicroFrontendsService } from './registry'
import type { MicroFrontendDescriptor } from './types/descriptor'

function makeBroker(): {
  broker: ReturnType<typeof createBroker>
  service: MicroFrontendsService
} {
  const broker = createBroker({ modules: [microfrontendModule()] })
  const service = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
  if (!service) throw new Error('SERVICE_MICROFRONTENDS not registered')
  return { broker, service }
}

const validDescriptor: MicroFrontendDescriptor = {
  id: 'test-mf',
  name: 'Test MF',
  version: '1.0.0',
}

describe('MicroFrontendsService — CRUD (MF-REG-01..04)', () => {
  it('register accetta descriptor valido + state diventa "registered"', async () => {
    const { service } = makeBroker()
    await service.register(validDescriptor)
    expect(service.getState('test-mf')).toBe('registered')
    expect(service.get('test-mf')?.descriptor.name).toBe('Test MF')
  })

  it('register throws MF_DESCRIPTOR_INVALID per id regex mismatch', async () => {
    const { service } = makeBroker()
    try {
      await service.register({ id: 'INVALID', name: 'X', version: '1.0.0' })
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as { code: string }).code).toBe('MF_DESCRIPTOR_INVALID')
    }
  })

  it('register throws MF_DESCRIPTOR_INVALID per duplicate id', async () => {
    const { service } = makeBroker()
    await service.register(validDescriptor)
    try {
      await service.register(validDescriptor)
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as { code: string }).code).toBe('MF_DESCRIPTOR_INVALID')
      expect((err as { details: { reason: string } }).details.reason).toBe('duplicate')
    }
  })

  it('list ritorna array di tutti registrati', async () => {
    const { service } = makeBroker()
    await service.register({ ...validDescriptor, id: 'mf-1' })
    await service.register({ ...validDescriptor, id: 'mf-2' })
    expect(service.list().length).toBe(2)
  })

  it('list con filter state ritorna solo matching', async () => {
    const { service } = makeBroker()
    await service.register({ ...validDescriptor, id: 'mf-1' })
    const allRegistered = service.list({ state: 'registered' })
    expect(allRegistered.length).toBe(1)
    expect(service.list({ state: 'mounted' }).length).toBe(0)
  })

  it('list ritorna fresh copy (mutation guard)', async () => {
    const { service } = makeBroker()
    await service.register({ ...validDescriptor, id: 'mf-1' })
    const snap1 = service.list()
    const snap2 = service.list()
    expect(snap1).not.toBe(snap2) // different array instances
    expect(snap1.length).toBe(snap2.length)
  })

  it('unregister rimuove MF e invoca cascade broker.unsubscribeByOwner (D-V2-16)', async () => {
    const { broker, service } = makeBroker()
    await service.register(validDescriptor)
    // Spy su broker.unsubscribeByOwner per verificare cascade D-V2-16.
    // (Test isolato del comportamento del Registry; full end-to-end con
    // subscription reali sarà testato in 08-07 dopo wire-up RuntimeContext.)
    const spy = vi.spyOn(broker, 'unsubscribeByOwner')
    await service.unregister('test-mf')
    expect(service.get('test-mf')).toBeUndefined()
    expect(spy).toHaveBeenCalledWith('mf:test-mf')
    spy.mockRestore()
  })

  it('unregister id sconosciuto = no-op (idempotent)', async () => {
    const { service } = makeBroker()
    await expect(service.unregister('non-existent')).resolves.toBeUndefined()
  })

  it('unregister cascade è chiamato anche se MF non era mounted', async () => {
    const { broker, service } = makeBroker()
    await service.register(validDescriptor)
    const spy = vi.spyOn(broker, 'unsubscribeByOwner')
    await service.unregister('test-mf')
    // Cascade SEMPRE eseguito via finally — anche se nessuna subscription esisteva.
    // W3-P07 wiring: unregister chiama destroy internal (che cascade in finally) + cascade
    // anche in unregister finally → atteso ≥1 chiamata con `mf:test-mf`.
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1)
    expect(spy).toHaveBeenCalledWith('mf:test-mf')
    spy.mockRestore()
  })

  it('getSnapshot per id specifico ritorna shape MicroFrontendDebugSnapshot', async () => {
    const { service } = makeBroker()
    await service.register(validDescriptor)
    const snap = service.getSnapshot('test-mf')
    expect(snap?.id).toBe('test-mf')
    expect(snap?.state).toBe('registered')
    expect(snap?.descriptor.version).toBe('1.0.0')
  })

  it('getSnapshot senza id ritorna primo registrato (F8 stub)', async () => {
    const { service } = makeBroker()
    await service.register(validDescriptor)
    const snap = service.getSnapshot()
    expect(snap?.id).toBe('test-mf')
  })

  it('getSnapshot ritorna undefined se nessun MF registrato', () => {
    const { service } = makeBroker()
    expect(service.getSnapshot()).toBeUndefined()
    expect(service.getSnapshot('absent')).toBeUndefined()
  })

  it('getState id non-registrato ritorna undefined', () => {
    const { service } = makeBroker()
    expect(service.getState('absent')).toBeUndefined()
  })
})

describe('MicroFrontendsService — Lifecycle ops W3-P07 wiring (MF-NOT-REGISTERED guard)', () => {
  it('load throws MF_NOT_REGISTERED con details.op per id non registrato', async () => {
    const { service } = makeBroker()
    try {
      await service.load('absent-mf')
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as { code: string }).code).toBe('MF_NOT_REGISTERED')
      expect((err as { details: { op: string } }).details.op).toBe('load')
    }
  })

  it('bootstrap/mount/unmount/destroy tutti throw MF_NOT_REGISTERED per id non registrato', async () => {
    const { service } = makeBroker()
    for (const op of ['bootstrap', 'mount', 'unmount', 'destroy'] as const) {
      try {
        await service[op]('any-id')
        expect.fail(`${op} should have thrown`)
      } catch (err) {
        expect((err as { code: string }).code).toBe('MF_NOT_REGISTERED')
        expect((err as { details: { op: string } }).details.op).toBe(op)
      }
    }
  })
})

describe('MicroFrontendsService — Loader Registry (MF-LOADER-REG-01..02)', () => {
  it('registerLoader storage e getLoader lookup per type', () => {
    const { service } = makeBroker()
    const adapter = {
      type: 'mock',
      load: vi.fn(),
    }
    service.registerLoader(adapter as never)
    expect(service.getLoader('mock')).toBe(adapter)
  })

  it('registerLoader throws MF_LOADER_TYPE_DUPLICATE per duplicate type', () => {
    const { service } = makeBroker()
    service.registerLoader({ type: 'mock', load: vi.fn() } as never)
    try {
      service.registerLoader({ type: 'mock', load: vi.fn() } as never)
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as { code: string }).code).toBe('MF_LOADER_TYPE_DUPLICATE')
    }
  })

  it('getLoaders ritorna lista snapshot di tutti i loader', () => {
    const { service } = makeBroker()
    service.registerLoader({ type: 'mock', load: vi.fn() } as never)
    service.registerLoader({ type: 'esm', load: vi.fn() } as never)
    expect(service.getLoaders().length).toBe(2)
  })

  it('unregisterLoader rimuove type + idempotent', () => {
    const { service } = makeBroker()
    service.registerLoader({ type: 'mock', load: vi.fn() } as never)
    expect(service.unregisterLoader('mock')).toBe(true)
    expect(service.unregisterLoader('mock')).toBe(false) // already removed
  })

  it('getLoader ritorna undefined per type non registrato', () => {
    const { service } = makeBroker()
    expect(service.getLoader('absent')).toBeUndefined()
  })
})

describe('MicroFrontendsService — Pattern S1 augment (D-V2-01)', () => {
  it('broker.registerMicroFrontend è patchato (monkey-patch sugar)', async () => {
    const { broker } = makeBroker()
    const b = broker as unknown as {
      registerMicroFrontend?: (d: MicroFrontendDescriptor) => Promise<void>
      getMicroFrontend?: (id: string) => unknown
    }
    expect(typeof b.registerMicroFrontend).toBe('function')
    await b.registerMicroFrontend?.(validDescriptor)
    expect(b.getMicroFrontend?.('test-mf')).toBeDefined()
  })

  it('tutti i 10 metodi sugar sono presenti su broker post-install', () => {
    const { broker } = makeBroker()
    const b = broker as unknown as Record<string, unknown>
    const expected = [
      'registerMicroFrontend',
      'unregisterMicroFrontend',
      'getMicroFrontend',
      'getMicroFrontends',
      'getMicroFrontendState',
      'getMicroFrontendSnapshot',
      'loadMicroFrontend',
      'mountMicroFrontend',
      'unmountMicroFrontend',
      'destroyMicroFrontend',
    ] as const
    for (const m of expected) {
      expect(typeof b[m]).toBe('function')
    }
  })

  it('broker v1.x SENZA modules NON ha metodi MF (T-F8-01 scope)', () => {
    const brokerNoMf = createBroker({})
    const b = brokerNoMf as unknown as Record<string, unknown>
    expect(b.registerMicroFrontend).toBeUndefined()
    expect(b.getMicroFrontend).toBeUndefined()
  })
})
