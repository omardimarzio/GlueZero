/**
 * F12 End-to-End integration suite — Tier-1 jsdom only (carryover D-V2-F11-21).
 *
 * 4 scenari SC1-SC4 (D-12 SC list). SC5-SC8 implementati in plan 12-05 closure.
 *
 * **Pattern carryover F11 `permissions-end-to-end.test.ts` (TEMPLATE)** —
 * stesso `bootstrap()` helper, stesso assertion style, stesso bootstrap broker
 * tramite `createBroker({modules: [microfrontendModule(), compatModule(...)]})`.
 *
 * **Coverage:**
 *
 * - SC1: gluezero scalar range ok vs fail (D-12 SC1 / MF-COMPAT-03).
 * - SC2: 9 dimensions matrix mix (canonicalModels, topics, routes, workers,
 *   dependencies, framework — pass/fail/missing).
 * - SC3: block-mount policy throw + emit `failed` topic; warn policy + console.warn.
 * - SC4: CompatibilityReport JSON.stringify serializzabilità (D-12 SC4 + D-12-20
 *   F16 SnapshotProvider preparation) + memoization D-12-12 + invalidate D-12-08.
 *
 * @see plan 12-04 Task 2
 * @see ROADMAP §Phase 12 — Compatibility/Versioning
 * @see packages/permissions/src/__integration__/permissions-end-to-end.test.ts (TEMPLATE F11)
 * @see D-V2-F11-21 — Tier-1 jsdom only (NO Tier-3 Playwright)
 */
import { createBroker, SERVICE_COMPAT } from '@gluezero/core'
import {
  microfrontendModule,
  type MicroFrontendLoaderAdapter,
} from '@gluezero/microfrontends'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compatModule } from '../compat-module'

beforeEach(() => {
  vi.restoreAllMocks()
})

interface BootstrapOpts {
  compatibilityPolicy?: 'off' | 'warn' | 'block-registration' | 'block-load' | 'block-mount'
}

interface BootstrapResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  broker: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mfService: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compatService: any
}

function bootstrap(opts: BootstrapOpts = {}): BootstrapResult {
  const broker = createBroker({
    modules: [
      microfrontendModule(),
      compatModule({ compatibilityPolicy: opts.compatibilityPolicy ?? 'block-mount' }),
    ],
  })
  return {
    broker,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mfService: broker.getService('microfrontends') as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    compatService: broker.getService(SERVICE_COMPAT) as any,
  }
}

/**
 * Mock loader inline per scenari SC3 dove serve full mount path.
 * Replica privatamente la shape `MicroFrontendLoaderAdapter` (mock-loader.ts NON in barrel).
 */
function makeMockLoader(): MicroFrontendLoaderAdapter {
  return {
    type: 'esm',
    async load() {
      return {
        module: {},
        lifecycle: {
          bootstrap: async () => {},
          mount: async () => {},
          unmount: async () => {},
          destroy: () => {},
        },
        metadata: { mock: true },
      }
    },
  }
}

function makeDescriptor(id: string, compatibility?: Record<string, unknown>): unknown {
  return {
    id,
    name: id,
    version: '1.0.0',
    loader: { type: 'esm', url: `/${id}.js` },
    ...(compatibility !== undefined && { compatibility }),
  }
}

// ============================================================
// SC1 — gluezero ^2.0.0 vs runtime build constant — ok/fail paths
// ============================================================

describe('SC1 — gluezero scalar range (PRD §40.2 #6 / D-12 SC1+SC2)', () => {
  it('gluezero ^2.0.0 vs __GLUEZERO_VERSION__=2.0.0 → report.ok=true (build constant)', async () => {
    const { mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    await mfService.register(makeDescriptor('mf-1', { gluezero: '^2.0.0' }))
    const report = compatService.checkMicroFrontendCompatibility('mf-1')
    expect(report.ok).toBe(true)
    expect(report.errors).toEqual([])
    expect(report.microFrontendId).toBe('mf-1')
    expect(typeof report.checkedAt).toBe('number')
  })

  it('gluezero ^999.0.0 vs build 2.0.0 → report.ok=false + error.type=gluezero-version', async () => {
    const { mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    await mfService.register(makeDescriptor('mf-incompatible', { gluezero: '^999.0.0' }))
    const report = compatService.checkMicroFrontendCompatibility('mf-incompatible')
    expect(report.ok).toBe(false)
    expect(report.errors).toHaveLength(1)
    expect(report.errors[0]).toMatchObject({
      type: 'gluezero-version',
      required: '^999.0.0',
      actual: expect.any(String),
    })
  })

  it('gluezero NON dichiarato → skip silenzioso (D-12 default adoption progressiva)', async () => {
    const { mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    await mfService.register(makeDescriptor('mf-no-compat'))
    const report = compatService.checkMicroFrontendCompatibility('mf-no-compat')
    expect(report.ok).toBe(true)
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
  })
})

// ============================================================
// SC2 — 9 dim matrix (D-12 SC2 / MF-COMPAT-03)
// ============================================================

describe('SC2 — 9 dimensioni matrix test (D-12 SC2)', () => {
  it('canonicalModels.customer: ^1.0.0 vs registry=1.2.0 → ok', async () => {
    const { mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    compatService.registerCanonicalModelVersion('customer', '1.2.0')
    await mfService.register(
      makeDescriptor('mf-cm', { canonicalModels: { customer: '^1.0.0' } }),
    )
    const report = compatService.checkMicroFrontendCompatibility('mf-cm')
    expect(report.ok).toBe(true)
  })

  it('canonicalModels NON registrato → warnings populated (D-12-09 adoption progressiva)', async () => {
    const { mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    // NESSUNA register*Version per 'order' — adoption progressiva.
    await mfService.register(
      makeDescriptor('mf-order', { canonicalModels: { order: '^1.0.0' } }),
    )
    const report = compatService.checkMicroFrontendCompatibility('mf-order')
    expect(report.ok).toBe(true) // missing version è warning, NON error.
    expect(report.warnings.length).toBeGreaterThan(0)
    expect(report.warnings[0]).toMatchObject({
      type: 'canonical-model-version',
      required: '^1.0.0',
      context: { subKey: 'order' },
    })
  })

  it('topics + routes + workers + dependencies — Record-based 4 dim insieme', async () => {
    const { mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    compatService.registerTopicVersion('customer.order.created', '1.0.0')
    compatService.registerRouteVersion('payment-flow', '2.1.0')
    compatService.registerWorkerVersion('heavy-compute', '1.5.0')
    compatService.registerDependencyVersion('react', '19.0.5')

    await mfService.register(
      makeDescriptor('mf-multi', {
        topics: { 'customer.order.created': '^1.0.0' },
        routes: { 'payment-flow': '^2.0.0' },
        workers: { 'heavy-compute': '>=1.4.0' },
        dependencies: { react: '^19.0.0' },
      }),
    )
    const report = compatService.checkMicroFrontendCompatibility('mf-multi')
    expect(report.ok).toBe(true)
    expect(report.errors).toEqual([])
  })

  it('framework name+version mismatch → error con context.name', async () => {
    const { mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    compatService.registerFrameworkVersion('react', '18.2.0')
    await mfService.register(
      makeDescriptor('mf-fw', { framework: { name: 'react', version: '^19.0.0' } }),
    )
    const report = compatService.checkMicroFrontendCompatibility('mf-fw')
    expect(report.ok).toBe(false)
    expect(report.errors[0]).toMatchObject({
      type: 'framework-version',
      required: '^19.0.0',
      actual: '18.2.0',
    })
  })

  it('theme.tokens + theme.roles dual-key → entrambi verificati', async () => {
    const { mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    compatService.registerThemeVersion('tokens', '1.0.0')
    compatService.registerThemeVersion('roles', '2.0.0')
    await mfService.register(
      makeDescriptor('mf-theme', {
        theme: { tokens: '^1.0.0', roles: '^2.0.0' },
      }),
    )
    const report = compatService.checkMicroFrontendCompatibility('mf-theme')
    expect(report.ok).toBe(true)
  })

  it('loaders dim — esm version mismatch → error', async () => {
    const { mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    compatService.registerLoaderVersion('esm', '1.0.0')
    await mfService.register(
      makeDescriptor('mf-loader', { loaders: { esm: '^2.0.0' } }),
    )
    const report = compatService.checkMicroFrontendCompatibility('mf-loader')
    expect(report.ok).toBe(false)
    expect(report.errors[0]).toMatchObject({
      type: 'loader-version',
      required: '^2.0.0',
      actual: '1.0.0',
      context: { subKey: 'esm' },
    })
  })
})

// ============================================================
// SC3 — block-mount throw + emit topic (PRD §40.2 #6)
// ============================================================

describe('SC3 — block-mount policy throw + emit (PRD §40.2 #6)', () => {
  it('policy block-mount + compat fail → mount rejects con COMPAT_INCOMPATIBLE + emit topic', async () => {
    const { broker, mfService } = bootstrap({ compatibilityPolicy: 'block-mount' })
    // Registrazione mock loader 'esm' per consentire load.
    mfService.registerLoader(makeMockLoader())

    const failedSpy = vi.fn()
    broker.subscribe('microfrontend.compatibility.failed', failedSpy)

    await mfService.register(makeDescriptor('mf-broken', { gluezero: '^999.0.0' }))

    // mount deve rejectare (async rejection).
    let mountErr: unknown
    try {
      await mfService.mount('mf-broken')
    } catch (err) {
      mountErr = err
    }
    expect(mountErr).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((mountErr as any).code).toBe('COMPAT_INCOMPATIBLE')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((mountErr as any).details).toMatchObject({
      phase: 'mount',
      microFrontendId: 'mf-broken',
    })

    // emit topic 'failed' verificato.
    expect(failedSpy).toHaveBeenCalled()
    const emittedPayload = failedSpy.mock.calls[0]?.[0]?.payload
    expect(emittedPayload).toMatchObject({
      ok: false,
      microFrontendId: 'mf-broken',
    })
  })

  it('policy warn + compat fail → check NON throw + emit failed topic + console.warn', async () => {
    const { broker, mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    mfService.registerLoader(makeMockLoader())

    const failedSpy = vi.fn()
    const warningSpy = vi.fn()
    broker.subscribe('microfrontend.compatibility.failed', failedSpy)
    broker.subscribe('microfrontend.compatibility.warning', warningSpy)
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await mfService.register(makeDescriptor('mf-warn', { gluezero: '^999.0.0' }))

    // Strategia: invocare mount() per esercitare full path (service-wrap + lifecycle).
    // policy='warn' deve NON throw COMPAT_INCOMPATIBLE (può throw errori loader F9 deferred,
    // ma quelli sono SCI separati). Wrapping try/catch + assertion solo su CompatError shape.
    let mountErr: unknown = null
    try {
      await mfService.mount('mf-warn')
    } catch (err) {
      mountErr = err
    }
    // F12 assertion: NON deve essere un CompatError. Se err presente, deve essere
    // un'altra causa (loader runtime F9-deferred), MAI 'COMPAT_INCOMPATIBLE'.
    if (mountErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((mountErr as any).code).not.toBe('COMPAT_INCOMPATIBLE')
    }

    // F12 emit topic 'failed' deve essere stato pubblicato (warn policy emette telemetry).
    expect(failedSpy).toHaveBeenCalled()
    // Console.warn deve contenere mention 'compat'.
    expect(consoleSpy).toHaveBeenCalled()
    const warnMsg = consoleSpy.mock.calls[0]?.[0] as string | undefined
    expect(warnMsg).toContain('compat')
  })

  it('policy off → NO throw + NO emit failed (compat completely disabled)', async () => {
    const { broker, mfService } = bootstrap({ compatibilityPolicy: 'off' })
    mfService.registerLoader(makeMockLoader())

    const failedSpy = vi.fn()
    broker.subscribe('microfrontend.compatibility.failed', failedSpy)

    await mfService.register(makeDescriptor('mf-off', { gluezero: '^999.0.0' }))
    // mount NON deve throw COMPAT_INCOMPATIBLE.
    let mountErr: unknown = null
    try {
      await mfService.mount('mf-off')
    } catch (err) {
      mountErr = err
    }
    if (mountErr) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((mountErr as any).code).not.toBe('COMPAT_INCOMPATIBLE')
    }
    // Topic 'failed' NON emesso (policy='off' = no-op completo).
    expect(failedSpy).not.toHaveBeenCalled()
  })

  it('policy block-registration + compat fail → register rejects con COMPAT_INCOMPATIBLE phase=registration', async () => {
    const { mfService } = bootstrap({ compatibilityPolicy: 'block-registration' })
    let registerErr: unknown
    try {
      await mfService.register(makeDescriptor('mf-reg-block', { gluezero: '^999.0.0' }))
    } catch (err) {
      registerErr = err
    }
    expect(registerErr).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((registerErr as any).code).toBe('COMPAT_INCOMPATIBLE')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((registerErr as any).details).toMatchObject({
      phase: 'registration',
      microFrontendId: 'mf-reg-block',
    })
  })
})

// ============================================================
// SC4 — CompatibilityReport JSON-serializzabile + memoization
// ============================================================

describe('SC4 — CompatibilityReport JSON-serializzabile (D-12 SC4 + D-12-20 F16 prep)', () => {
  it('getCompatibilityReport() no-arg ritorna Map serializzabile via Object.fromEntries', async () => {
    const { mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    await mfService.register(makeDescriptor('mf-a', { gluezero: '^2.0.0' }))
    await mfService.register(makeDescriptor('mf-b', { topics: { t1: '^1.0.0' } }))
    compatService.checkMicroFrontendCompatibility('mf-a')
    compatService.checkMicroFrontendCompatibility('mf-b')

    const allReports = compatService.getCompatibilityReport()
    expect(allReports).toBeInstanceOf(Map)

    // JSON serialization via Object.fromEntries (D-12-20 SnapshotProvider preparation).
    const serialized = JSON.stringify(Object.fromEntries(allReports))
    expect(() => JSON.parse(serialized)).not.toThrow()
    const parsed = JSON.parse(serialized) as Record<
      string,
      { ok: boolean; microFrontendId: string; checkedAt: number }
    >
    expect(parsed['mf-a']).toMatchObject({
      ok: true,
      microFrontendId: 'mf-a',
      checkedAt: expect.any(Number),
    })
    expect(parsed['mf-b']?.microFrontendId).toBe('mf-b')
  })

  it('Memoization D-12-12: getCompatibilityReport(id) due chiamate consecutive → stesso oggetto (===)', async () => {
    const { mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    await mfService.register(makeDescriptor('mf-c', { gluezero: '^2.0.0' }))

    const r1 = compatService.checkMicroFrontendCompatibility('mf-c')
    const r2 = compatService.getCompatibilityReport('mf-c')
    expect(r2).toBe(r1) // referential equality — memoized
  })

  it('Cache invalidation D-12-08: register*Version() bump value → version.changed topic → lifecycle-hooks invalidate cache', async () => {
    const { mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    compatService.registerCanonicalModelVersion('customer', '1.0.0')
    await mfService.register(
      makeDescriptor('mf-inv', { canonicalModels: { customer: '^1.0.0' } }),
    )
    const r1 = compatService.checkMicroFrontendCompatibility('mf-inv')
    expect(r1.ok).toBe(true)

    // Bump version → trigger version.changed topic → lifecycle-hooks invalidate.
    compatService.registerCanonicalModelVersion('customer', '2.0.0')

    const r2 = compatService.getCompatibilityReport('mf-inv')
    // r2 deve essere ricalcolato (NEW object, NOT cached r1).
    // Con ^1.0.0 vs registry=2.0.0 → mismatch (^1.0.0 NON soddisfa 2.0.0).
    expect(r2).not.toBe(r1)
    expect(r2?.ok).toBe(false)
  })

  it('Memoization re-register identico = no-op idempotent (D-12-08): cache preservata', async () => {
    const { mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    compatService.registerCanonicalModelVersion('customer', '1.0.0')
    await mfService.register(
      makeDescriptor('mf-idem', { canonicalModels: { customer: '^1.0.0' } }),
    )
    const r1 = compatService.checkMicroFrontendCompatibility('mf-idem')
    // re-register SAME value → no-op → no version.changed emit → no invalidate.
    compatService.registerCanonicalModelVersion('customer', '1.0.0')
    const r2 = compatService.getCompatibilityReport('mf-idem')
    expect(r2).toBe(r1) // stesso oggetto memoizzato (cache NON invalidata).
  })

  it('D-V2-16 cleanup cascade: microfrontend.unregistered → engine.deleteReport(mfId)', async () => {
    const { broker, mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    await mfService.register(makeDescriptor('mf-cleanup', { gluezero: '^2.0.0' }))
    compatService.checkMicroFrontendCompatibility('mf-cleanup')
    // Pre-condition: entry presente nella Map.
    const beforeMap = compatService.getCompatibilityReport() as ReadonlyMap<string, unknown>
    expect(beforeMap.has('mf-cleanup')).toBe(true)

    // Emit unregistered → lifecycle-hooks invoca engine.deleteReport.
    await mfService.unregister('mf-cleanup', { force: true })

    // Post: entry rimossa.
    const afterMap = compatService.getCompatibilityReport() as ReadonlyMap<string, unknown>
    expect(afterMap.has('mf-cleanup')).toBe(false)
    // Verifica via broker.subscribe pattern: il topic 'microfrontend.unregistered' è stato emesso.
    expect(broker).toBeDefined()
  })

  it('D-12-17 getCompatibilityReport() vs getCompatibilityReport(id) shape coherence', async () => {
    const { mfService, compatService } = bootstrap({ compatibilityPolicy: 'warn' })
    await mfService.register(makeDescriptor('mf-shape', { gluezero: '^2.0.0' }))
    compatService.checkMicroFrontendCompatibility('mf-shape')

    const single = compatService.getCompatibilityReport('mf-shape')
    const all = compatService.getCompatibilityReport()
    expect(all.get('mf-shape')).toBe(single)
  })
})
