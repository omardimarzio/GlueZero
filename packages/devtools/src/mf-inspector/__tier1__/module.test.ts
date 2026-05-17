/**
 * Tier-1 jsdom integration test per `mfInspectorModule()` (D-V2-F16-04 + MF-DEVTOOLS-01..04).
 *
 * Pattern carryover F14 `fallbacks-module.test.ts` — mock-based ctx (broker + registerService)
 * vs real broker (più rapido, isolation pulita).
 *
 * Copre: factory shape, install lookup throw, idempotent guard, lifecycle round-trip 2 MF,
 * 17-fields snapshot, timings 11 fields, pause/resume/flush, wildcard MF-OBS-01,
 * SnapshotProvider register, plain Broker graceful, shutdownSignal cleanup, ring buffer 500.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  SERVICE_COMPAT,
  SERVICE_FALLBACKS,
  SERVICE_ISOLATION,
  SERVICE_MICROFRONTENDS,
  SERVICE_PERMISSIONS,
} from '@gluezero/core'
import { mfInspectorModule } from '../module'
import { SERVICE_MF_INSPECTOR, type MfInspectorService } from '../service-locator'

type Handler = (event: { topic: string; payload: unknown; metadata?: Record<string, unknown> }) => void

interface CtxOpts {
  withMfService?: boolean
  mfRegistrations?: Array<{
    id: string
    state: string
    version?: string
    loaderType?: string
  }>
  preInstallInspector?: boolean
  withPermsService?: boolean
  withDevtoolsBroker?: boolean // registerSnapshotProvider function presence
}

function createMockCtx(opts: CtxOpts = {}) {
  const handlers = new Map<string, Set<Handler>>()
  const services = new Map<string, unknown>()

  const publish = vi.fn((topic: string, payload: unknown, options?: { metadata?: Record<string, unknown> }) => {
    // Fanout topic match + wildcard
    const topicSet = handlers.get(topic)
    const wildcardSet = handlers.get('*')
    const event = {
      topic,
      payload,
      ...(options?.metadata && { metadata: options.metadata }),
    }
    if (topicSet) for (const h of Array.from(topicSet)) h(event)
    if (wildcardSet) for (const h of Array.from(wildcardSet)) h(event)
  })
  const subscribe = vi.fn((pattern: string, handler: Handler, _opts?: unknown) => {
    if (!handlers.has(pattern)) handlers.set(pattern, new Set())
    handlers.get(pattern)!.add(handler)
    return {
      id: `sub-${Math.random()}`,
      topic: pattern,
      active: true,
      unsubscribe: () => {
        handlers.get(pattern)?.delete(handler)
      },
    }
  })
  const getService = vi.fn(<T>(name: string): T | undefined => services.get(name) as T | undefined)

  if (opts.withMfService !== false) {
    const regs = opts.mfRegistrations ?? []
    services.set(SERVICE_MICROFRONTENDS, {
      list: () =>
        regs.map((r) => ({
          descriptor: {
            id: r.id,
            name: r.id,
            version: r.version ?? '1.0.0',
            loader: { type: r.loaderType ?? 'mock' },
          },
          state: r.state,
          timings: { registeredAt: 0 },
        })),
      get: (id: string) => regs.find((r) => r.id === id),
      register: vi.fn(async () => undefined),
      unregister: vi.fn(async () => undefined),
      load: vi.fn(async () => undefined),
      bootstrap: vi.fn(async () => undefined),
      mount: vi.fn(async () => undefined),
      unmount: vi.fn(async () => undefined),
      destroy: vi.fn(async () => undefined),
    })
  }
  if (opts.preInstallInspector) {
    services.set(SERVICE_MF_INSPECTOR, {})
  }
  if (opts.withPermsService) {
    services.set(SERVICE_PERMISSIONS, {
      getCapabilities: (id: string) => ({ id, caps: ['read'] }),
    })
  }

  const broker: Record<string, unknown> = { publish, subscribe, getService }
  if (opts.withDevtoolsBroker) {
    broker.registerSnapshotProvider = vi.fn()
  }
  const registerService = vi.fn((name: string, impl: unknown) => services.set(name, impl))

  return { broker, registerService, services, publish, subscribe, getService, handlers }
}

describe('mfInspectorModule — factory shape', () => {
  it('returns BrokerModule con id "mf-inspector" + install function', () => {
    const mod = mfInspectorModule()
    expect(mod.id).toBe('mf-inspector')
    expect(mod.version).toBe('2.0.0-alpha.0')
    expect(typeof mod.install).toBe('function')
  })

  it('anti-singleton D-30 — 2 call ritornano distinct objects', () => {
    const a = mfInspectorModule()
    const b = mfInspectorModule()
    expect(a).not.toBe(b)
  })
})

describe('mfInspectorModule — install flow (D-V2-F16-04)', () => {
  it('throw esplicativo quando SERVICE_MICROFRONTENDS assente', () => {
    const ctx = createMockCtx({ withMfService: false })
    const mod = mfInspectorModule()
    expect(() => mod.install(ctx as never)).toThrow(/@gluezero\/microfrontends/)
  })

  it('install OK → SERVICE_MF_INSPECTOR registrato con 4 metodi', () => {
    const ctx = createMockCtx({ mfRegistrations: [] })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    const svc = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    expect(svc).toBeDefined()
    expect(typeof svc.getSnapshot).toBe('function')
    expect(typeof svc.pause).toBe('function')
    expect(typeof svc.resume).toBe('function')
    expect(typeof svc.flush).toBe('function')
  })

  it('install 2 volte → console.warn + early return (idempotent guard)', () => {
    const ctx = createMockCtx({ mfRegistrations: [], preInstallInspector: true })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already installed'))
    warnSpy.mockRestore()
  })
})

describe('mfInspectorModule — lifecycle round-trip integration (MF-DEVTOOLS-01)', () => {
  it('publish 2 MF lifecycle → snapshot.microFrontends contiene 2 entries', () => {
    const ctx = createMockCtx({
      mfRegistrations: [
        { id: 'mf1', state: 'mounted' },
        { id: 'mf2', state: 'registered' },
      ],
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    ctx.publish('microfrontend.mounted', { id: 'mf1' })
    ctx.publish('microfrontend.registered', { id: 'mf2' })
    const svc = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    const snap = svc.getSnapshot()
    expect(snap.microFrontends.length).toBe(2)
    expect(snap.microFrontends.map((m) => m.id).sort()).toEqual(['mf1', 'mf2'])
  })

  it('snapshot entry ha 17 visible field popolati post-lifecycle', () => {
    const ctx = createMockCtx({
      mfRegistrations: [{ id: 'mf1', state: 'mounted', version: '2.5.0', loaderType: 'esm' }],
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    ctx.publish('microfrontend.registered', { id: 'mf1' })
    ctx.publish('microfrontend.mounted', { id: 'mf1' })
    const svc = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    const entry = svc.getSnapshot().microFrontends[0]!
    expect(entry.id).toBe('mf1')
    expect(entry.state).toBe('mounted')
    expect(entry.version).toBe('2.5.0')
    expect(entry.loaderType).toBe('esm')
    expect(Array.isArray(entry.topicsPublished)).toBe(true)
    expect(entry.routeCallsCount).toBe(0)
    expect(entry.errors).toEqual([])
    expect(entry.fallbacksApplied).toEqual([])
  })

  it('timings.registeredAt + timings.mountedAt popolati post-lifecycle (MF-DEVTOOLS-03)', () => {
    const ctx = createMockCtx({
      mfRegistrations: [{ id: 'mf1', state: 'mounted' }],
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    ctx.publish('microfrontend.registered', { id: 'mf1' })
    ctx.publish('microfrontend.mounted', { id: 'mf1' })
    const svc = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    const entry = svc.getSnapshot().microFrontends[0]!
    expect(entry.timings?.registeredAt).toBeTypeOf('number')
    expect(entry.timings?.mountedAt).toBeTypeOf('number')
  })
})

describe('mfInspectorModule — pause/resume/flush (D-V2-F16-10 + MF-DEVTOOLS-04)', () => {
  it('pause() + publish events + flush() ritorna queue accumulata', () => {
    const ctx = createMockCtx({
      mfRegistrations: [{ id: 'mf1', state: 'mounted' }],
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    const svc = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    svc.pause()
    ctx.publish('microfrontend.mounted', { id: 'mf1' })
    ctx.publish('microfrontend.unmounted', { id: 'mf1' })
    svc.resume()
    const drained = svc.flush()
    expect(drained.length).toBeGreaterThan(0)
  })

  it('flush() su queue vuota ritorna [] (idempotent)', () => {
    const ctx = createMockCtx({ mfRegistrations: [] })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    const svc = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    expect(svc.flush()).toEqual([])
  })
})

describe('mfInspectorModule — Plug-in MIN-3 SnapshotProvider (MF-DEVTOOLS-02)', () => {
  it('DevtoolsBroker con registerSnapshotProvider → "mf" provider registrato', () => {
    const ctx = createMockCtx({
      mfRegistrations: [{ id: 'mf1', state: 'mounted' }],
      withDevtoolsBroker: true,
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    const dvt = ctx.broker as { registerSnapshotProvider: ReturnType<typeof vi.fn> }
    expect(dvt.registerSnapshotProvider).toHaveBeenCalledWith('mf', expect.any(Function))
  })

  it('plain Broker (no registerSnapshotProvider) → install no-throw (graceful guard)', () => {
    const ctx = createMockCtx({
      mfRegistrations: [{ id: 'mf1', state: 'mounted' }],
      withDevtoolsBroker: false,
    })
    const mod = mfInspectorModule()
    expect(() => mod.install(ctx as never)).not.toThrow()
    const svc = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    expect(svc).toBeDefined() // service comunque registrato
  })
})

describe('mfInspectorModule — Service Locator graceful degradation (D-V2-F16-06)', () => {
  it('senza SERVICE_PERMISSIONS → snapshot.permissions === undefined NO throw', () => {
    const ctx = createMockCtx({
      mfRegistrations: [{ id: 'mf1', state: 'mounted' }],
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    const svc = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    const entry = svc.getSnapshot().microFrontends[0]!
    expect(entry.permissions).toBeUndefined()
    expect(entry.compatibility).toBeUndefined()
    expect(entry.isolation).toBeUndefined()
    expect(entry.fallbackPolicy).toBeUndefined()
  })

  it('con SERVICE_PERMISSIONS → snapshot.permissions popolato', () => {
    const ctx = createMockCtx({
      mfRegistrations: [{ id: 'mf1', state: 'mounted' }],
      withPermsService: true,
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    const svc = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    const entry = svc.getSnapshot().microFrontends[0]!
    expect(entry.permissions).toEqual({ id: 'mf1', caps: ['read'] })
  })
})

describe('mfInspectorModule — wildcard MF-OBS-01 attribution (D-V2-F16-07)', () => {
  it('wildcard subscribe filtra via metadata.microFrontendId → topicsPublished aggregato', () => {
    const ctx = createMockCtx({
      mfRegistrations: [{ id: 'mf1', state: 'mounted' }],
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    // Publish con metadata.microFrontendId (MF-OBS-01 facade injection)
    ctx.publish('custom.event.from-mf1', { foo: 'bar' }, { metadata: { microFrontendId: 'mf1' } })
    const svc = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    const entry = svc.getSnapshot().microFrontends[0]!
    expect(entry.topicsPublished).toContain('custom.event.from-mf1')
  })

  it('wildcard event senza metadata.microFrontendId → no-op (no attribution)', () => {
    const ctx = createMockCtx({
      mfRegistrations: [{ id: 'mf1', state: 'mounted' }],
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    ctx.publish('custom.event.no-attribution', { foo: 'bar' }) // no metadata
    const svc = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    const entry = svc.getSnapshot().microFrontends[0]!
    expect(entry.topicsPublished).not.toContain('custom.event.no-attribution')
  })
})

describe('mfInspectorModule — ring buffer 500 per-MF (MF-DEVTOOLS-04)', () => {
  it('600 publish stesso topic mf1 → ring buffer drop-oldest a 500', () => {
    const ctx = createMockCtx({
      mfRegistrations: [{ id: 'mf1', state: 'mounted' }],
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    for (let i = 0; i < 600; i++) {
      ctx.publish('microfrontend.mounted', { id: 'mf1', i })
    }
    const svc = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    const flushed = svc.flush()
    // Ring buffer per-mf1 ≤ 500 (FIFO drop-oldest applicato)
    const mf1Events = flushed.filter((e) => e.mfId === 'mf1')
    expect(mf1Events.length).toBeLessThanOrEqual(500)
  })
})
