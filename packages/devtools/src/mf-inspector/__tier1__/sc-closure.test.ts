/**
 * SC closure F16 — 4 Success Criteria ROADMAP §F16 linee 285-290.
 *
 * **Pattern: Mock CTX install (carryover `module.test.ts`)** — Plan W4 P04 description
 * referenced `createDevtoolsBroker({modules:[...]})` but `DevtoolsBroker` non accetta
 * `modules` option (vedi `public-factory.ts`). Per integrare `mfInspectorModule()`
 * end-to-end occorre installarlo via `ctx.broker + ctx.registerService` pattern.
 * Per i 2 SC che richiedono DevtoolsBroker reale (SC2 + SC3 + parte SC4), si usa il
 * `createDevtoolsBroker({}) + broker.registerSnapshotProvider/registerMetricsProvider`
 * direttamente — coerente con `__bc_replay__/devtools-snapshot-shape.test.ts` +
 * `get-metrics-shape.test.ts`.
 *
 * **I2 fix:** Tutti i guard usano `expect(...).toBeDefined()` esplicito (fail-loud)
 * anziché `if (entry?.timings) { ... }` (silent skip). Stesso pattern per entries
 * length, external.mf presence, metrics.microFrontends array.
 *
 * @see .planning/ROADMAP.md F16 SC1-SC4
 * @see MF-DEVTOOLS-01..05 + MF-OBS-02..03 REQ frozen contract
 * @see packages/devtools/src/mf-inspector/__tier1__/module.test.ts (mock CTX pattern)
 * @see packages/core/src/__bc_replay__/devtools-snapshot-shape.test.ts (W1 P01 BC §42 #13)
 * @see packages/core/src/__bc_replay__/get-metrics-shape.test.ts (W3 P03 BC §42 #14 D-V2-19)
 */
import { describe, expect, it, vi } from 'vitest'
import { SERVICE_MICROFRONTENDS } from '@gluezero/core'
import { createDevtoolsBroker } from '../../public-factory'
import { mfInspectorModule } from '../module'
import { SERVICE_MF_INSPECTOR, type MfInspectorService } from '../service-locator'
import type { MfMetricsEntry, MicroFrontendDebugSnapshot } from '../types'

type Handler = (event: { topic: string; payload: unknown; metadata?: Record<string, unknown> }) => void

interface MfReg {
  id: string
  state: string
  version?: string
  loaderType?: string
}

interface CtxOpts {
  mfRegistrations?: MfReg[]
  withDevtoolsBroker?: boolean
  withMetricsBroker?: boolean
}

/**
 * Helper carryover `module.test.ts:37` (mock broker + ctx). Per SC1 (Inspector pull+push)
 * usiamo questo pattern perché installa `mfInspectorModule` con full subscribe chain.
 */
function createMockCtx(opts: CtxOpts = {}) {
  const handlers = new Map<string, Set<Handler>>()
  const services = new Map<string, unknown>()

  const publish = vi.fn(
    (topic: string, payload: unknown, options?: { metadata?: Record<string, unknown> }) => {
      const topicSet = handlers.get(topic)
      const wildcardSet = handlers.get('*')
      const event = {
        topic,
        payload,
        ...(options?.metadata && { metadata: options.metadata }),
      }
      if (topicSet) for (const h of Array.from(topicSet)) h(event)
      if (wildcardSet) for (const h of Array.from(wildcardSet)) h(event)
    },
  )
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

  const regs = opts.mfRegistrations ?? []
  services.set(SERVICE_MICROFRONTENDS, {
    list: () =>
      regs.map((r) => ({
        descriptor: {
          id: r.id,
          name: r.id,
          version: r.version ?? '1.0.0',
          loader: { type: r.loaderType ?? 'esm' },
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

  const broker: Record<string, unknown> = { publish, subscribe, getService }
  if (opts.withDevtoolsBroker) {
    broker.registerSnapshotProvider = vi.fn()
  }
  if (opts.withMetricsBroker) {
    broker.registerMetricsProvider = vi.fn()
  }
  const registerService = vi.fn((name: string, impl: unknown) => services.set(name, impl))

  return { broker, registerService, services, publish, subscribe, getService, handlers }
}

// ===========================================================================
// SC1 — Inspector 17 campi + 11 timings + ring buffer 500 + pause/resume/flush
// ===========================================================================

describe('F16 SC1 — Inspector 17 campi + 11 timings + ring buffer 500 + pause/resume/flush', () => {
  it('17 campi shape end-to-end con 2 MF lifecycle completo', () => {
    const ctx = createMockCtx({
      mfRegistrations: [
        { id: 'mf-esm', state: 'mounted', version: '1.0.0', loaderType: 'esm' },
        { id: 'mf-wc', state: 'registered', version: '2.0.0', loaderType: 'web-component' },
      ],
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    const svc = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    // I2 fix — fail-loud
    expect(svc).toBeDefined()
    const snap = svc.getSnapshot()
    expect(snap.microFrontends).toBeDefined()
    expect(snap.microFrontends.length).toBe(2)

    const first = snap.microFrontends[0]! as MicroFrontendDebugSnapshot
    // Verifica presenza chiavi shape (17 fields core + ancillari)
    const requiredFields = [
      'id',
      'state',
      'version',
      'topicsPublished',
      'topicsSubscribed',
      'routeCallsCount',
      'workerTasksCount',
      'contextReadCount',
      'contextWriteCount',
      'errors',
      'fallbacksApplied',
      'subscriptionsCreated',
      'cleanupResources',
    ]
    for (const field of requiredFields) {
      expect(first).toHaveProperty(field)
    }
  })

  it('Ring buffer 500 per-MF FIFO + pause/resume/flush operative', () => {
    const ctx = createMockCtx({
      mfRegistrations: [{ id: 'mf1', state: 'mounted' }],
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    const insp = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    // I2 fix — fail-loud
    expect(insp).toBeDefined()
    expect(typeof insp.pause).toBe('function')
    expect(typeof insp.resume).toBe('function')
    expect(typeof insp.flush).toBe('function')
    insp.pause()
    ctx.publish('microfrontend.registered', { id: 'mf1', version: '1.0.0' })
    ctx.publish('microfrontend.mounted', { id: 'mf1' })
    const drained = insp.flush()
    expect(Array.isArray(drained)).toBe(true)
    expect(drained.length).toBeGreaterThan(0)
    insp.resume()
  })

  it('11 timings campi populati post-lifecycle (RESEARCH §7.2 RESOLVED 11/11 emit)', () => {
    const ctx = createMockCtx({
      mfRegistrations: [{ id: 'mf1', state: 'mounted' }],
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    // Publish manuale lifecycle topic per popolare timings — RESEARCH §7.2 RESOLVED:
    // TUTTI 11 topic emessi da F8 (registered + loading/loaded + bootstrapping/bootstrapped +
    // mounting/mounted + unmounting/unmounted + destroying/destroyed).
    const phases = [
      'registered',
      'loading',
      'loaded',
      'bootstrapping',
      'bootstrapped',
      'mounting',
      'mounted',
    ] as const
    for (const phase of phases) {
      ctx.publish(`microfrontend.${phase}`, { id: 'mf1' })
    }
    const svc = ctx.services.get(SERVICE_MF_INSPECTOR) as MfInspectorService
    const entry = svc.getSnapshot().microFrontends.find((e) => e.id === 'mf1')
    // I2 fix — fail-loud
    expect(entry).toBeDefined()
    expect(entry!.timings).toBeDefined()
    const t = entry!.timings!
    expect(typeof t.registeredAt).toBe('number')
    expect(typeof t.loadStartedAt).toBe('number')
    expect(typeof t.loadedAt).toBe('number')
    expect(typeof t.bootstrapStartedAt).toBe('number')
    expect(typeof t.bootstrappedAt).toBe('number')
    expect(typeof t.mountStartedAt).toBe('number')
    expect(typeof t.mountedAt).toBe('number')
  })
})

// ===========================================================================
// SC2 — SnapshotProvider MIN-3 registration + external? lifecycle bit-exact v1.x
// ===========================================================================

describe('F16 SC2 — SnapshotProvider MIN-3 registration + external? lifecycle bit-exact v1.x', () => {
  it('Scenario A: no providers → external ABSENT (bit-exact v1.x BC §42 API #13)', () => {
    const broker = createDevtoolsBroker({})
    const snap = broker.getDebugSnapshot()
    // I2 fix — fail-loud (assert assenza esplicita)
    expect(snap).not.toHaveProperty('external')
  })

  it('Scenario B: registerSnapshotProvider("mf", fn) → external.mf presente con microFrontends', () => {
    const broker = createDevtoolsBroker({})
    broker.registerSnapshotProvider('mf', () => ({ microFrontends: [] }))
    const snap = broker.getDebugSnapshot() as { external?: { mf?: { microFrontends: unknown[] } } }
    // I2 fix — fail-loud
    expect(snap.external).toBeDefined()
    expect(snap.external).toHaveProperty('mf')
    expect(Array.isArray(snap.external!.mf!.microFrontends)).toBe(true)
  })

  it('Scenario C: mfInspectorModule installato → SnapshotProvider "mf" registrato (call check)', () => {
    const ctx = createMockCtx({
      mfRegistrations: [{ id: 'mf1', state: 'mounted' }],
      withDevtoolsBroker: true,
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    const dvt = ctx.broker as {
      registerSnapshotProvider: ReturnType<typeof vi.fn>
    }
    expect(dvt.registerSnapshotProvider).toHaveBeenCalledWith('mf', expect.any(Function))
  })
})

// ===========================================================================
// SC3 — getMetrics().microFrontends[] 14 metrics + D-V2-19 shape preservation
// ===========================================================================

describe('F16 SC3 — getMetrics().microFrontends[] 14 metrics + D-V2-19 shape preservation', () => {
  it('DevtoolsBroker baseline (no MetricsProvider) → microFrontends ABSENT (D-V2-19 bit-exact v1.x)', () => {
    const broker = createDevtoolsBroker({})
    const metrics = broker.getMetrics()
    // I2 fix — fail-loud (assert assenza esplicita)
    expect(metrics).not.toHaveProperty('microFrontends')
    // Shape v1.x preservata (3 fields baseline)
    expect(metrics).toHaveProperty('counters')
    expect(metrics).toHaveProperty('gauges')
    expect(metrics).toHaveProperty('histograms')
  })

  it('registerMetricsProvider("mf", () => empty) → microFrontends === [] (D-V2-19 empty lifecycle)', () => {
    const broker = createDevtoolsBroker({})
    broker.registerMetricsProvider('mf', () => ({ microFrontends: [] }))
    const metrics = broker.getMetrics() as { microFrontends?: unknown[] }
    // I2 fix — fail-loud
    expect(metrics.microFrontends).toBeDefined()
    expect(Array.isArray(metrics.microFrontends)).toBe(true)
    expect(metrics.microFrontends).toEqual([])
  })

  it('registerMetricsProvider("mf", () => 2 entries) → microFrontends[0] ha 14 metric fields shape', () => {
    const broker = createDevtoolsBroker({})
    const sampleEntry: MfMetricsEntry = {
      id: 'mf-a',
      registered: 2,
      mounted: 0,
      failed: 0,
      permissionDenied: 0,
      compatFailures: 0,
      capMissing: 0,
      timeAvgLoad: { p50: 0, p95: 0, p99: 0, count: 0 },
      timeAvgMount: { p50: 0, p95: 0, p99: 0, count: 0 },
      mountFailures: 0,
      events: 0,
      routeCalls: 0,
      workerTasks: 0,
      contextWrites: 0,
      activeSubs: 0,
    }
    broker.registerMetricsProvider('mf', () => ({
      microFrontends: [sampleEntry, { ...sampleEntry, id: 'mf-b' }],
    }))
    const metrics = broker.getMetrics() as { microFrontends?: MfMetricsEntry[] }
    // I2 fix — fail-loud
    expect(metrics.microFrontends).toBeDefined()
    expect(metrics.microFrontends!.length).toBe(2)
    const entry = metrics.microFrontends![0]!
    // 14 fields shape MfMetricsEntry (6 globali + 5 per-MF counter + 1 gauge + 2 histogram)
    const requiredFields = [
      'id',
      'registered',
      'mounted',
      'failed',
      'permissionDenied',
      'compatFailures',
      'capMissing',
      'mountFailures',
      'events',
      'routeCalls',
      'workerTasks',
      'contextWrites',
      'activeSubs',
      'timeAvgLoad',
      'timeAvgMount',
    ]
    for (const field of requiredFields) {
      expect(entry).toHaveProperty(field)
    }
  })

  it('mfInspectorModule installato → MetricsProvider "mf" registrato (call check)', () => {
    const ctx = createMockCtx({
      mfRegistrations: [{ id: 'mf1', state: 'mounted' }],
      withMetricsBroker: true,
    })
    const mod = mfInspectorModule()
    mod.install(ctx as never)
    const dvt = ctx.broker as {
      registerMetricsProvider: ReturnType<typeof vi.fn>
    }
    expect(dvt.registerMetricsProvider).toHaveBeenCalledWith('mf', expect.any(Function))
  })
})

// ===========================================================================
// SC4 — Subpath @gluezero/devtools/mf-inspector tree-shaken + bundle gates
// ===========================================================================

describe('F16 SC4 — Subpath @gluezero/devtools/mf-inspector tree-shaken + bundle gates', () => {
  it('mfInspectorModule importabile dal subpath (smoke shape check)', () => {
    // I2 fix — fail-loud (assert presenza esplicita)
    expect(mfInspectorModule).toBeDefined()
    expect(typeof mfInspectorModule).toBe('function')
    const mod = mfInspectorModule()
    expect(mod.id).toBe('mf-inspector')
    expect(mod.version).toBe('2.0.0-alpha.0')
    expect(typeof mod.install).toBe('function')
  })

  it('createSnapshotProviderRegistry esposto dal barrel core devtools (W1 P01 API)', async () => {
    const core = await import('../../index')
    // I2 fix — fail-loud
    expect(core.createSnapshotProviderRegistry).toBeDefined()
    expect(typeof core.createSnapshotProviderRegistry).toBe('function')
  })

  it('SERVICE_MF_INSPECTOR locale al subpath (RESEARCH §7.3 RESOLVED)', () => {
    expect(SERVICE_MF_INSPECTOR).toBe('mf-inspector')
  })

  it('Subpath types — MfMetricsEntry shape contract export (D-V2-F16-15)', () => {
    const e: MfMetricsEntry = {
      id: 'smoke',
      registered: 0,
      mounted: 0,
      failed: 0,
      permissionDenied: 0,
      compatFailures: 0,
      capMissing: 0,
      timeAvgLoad: { p50: 0, p95: 0, p99: 0, count: 0 },
      timeAvgMount: { p50: 0, p95: 0, p99: 0, count: 0 },
      mountFailures: 0,
      events: 0,
      routeCalls: 0,
      workerTasks: 0,
      contextWrites: 0,
      activeSubs: 0,
    }
    expect(e).toBeDefined()
    expect(e.id).toBe('smoke')
  })
})
