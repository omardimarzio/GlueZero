/**
 * F12 W3 Task 3 — Tier-1 unit suite per `compat-module.ts` factory.
 *
 * Coverage:
 *
 * - BrokerModule shape (id + version + install function) — D-V2-F11-01 scaffolding.
 * - Anti-singleton D-30 → ogni call ritorna nuovo BrokerModule.
 * - Default policy `'warn'` (D-12-02 — minimal single option D-12-11).
 * - Override policy via opts.
 * - Throw esplicito se `@gluezero/microfrontends` NON installato PRIMA (install-time guard).
 * - Register `SERVICE_COMPAT` con API completa: 10 metodi (4 PRD + 4 D-12-10 + 1 theme) + read-only policy getter.
 * - `getCompatibilityReport()` no-arg → ReadonlyMap (D-12-17).
 * - OQ-1 service-wrap post-install → marker `__compatServicePatched=true`.
 * - OQ-2 lifecycle-hooks wire → 4 subscribe handler installati.
 * - REVISIONE WARNING 1: `registerThemeVersion('tokens', '1.0.0')` callable senza throw (peer optional).
 *
 * @see plan 12-03 Task 3
 * @see packages/permissions/src/__tier1__/permissions-module.test.ts (TEMPLATE F11)
 */
import { createBroker, SERVICE_COMPAT } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compatModule } from '../compat-module'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('compatModule (D-12-11 minimal single-option factory)', () => {
  it('Test 1: BrokerModule shape (id=compat + version + install function)', () => {
    const m = compatModule()
    expect(m.id).toBe('compat')
    expect(m.version).toBe('2.0.0-alpha.0')
    expect(typeof m.install).toBe('function')
  })

  it('Test 2: D-30 anti-singleton — ogni call ritorna nuovo BrokerModule', () => {
    const m1 = compatModule()
    const m2 = compatModule()
    expect(m1).not.toBe(m2)
    expect(m1.id).toBe('compat')
    expect(m2.id).toBe('compat')
  })

  it('Test 3: default policy "warn" (D-12-02 + D-12-11 minimal)', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), compatModule()],
    })
    const svc = broker.getService(SERVICE_COMPAT) as any
    expect(svc.compatibilityPolicy).toBe('warn')
  })

  it('Test 4: custom policy block-mount via options', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), compatModule({ compatibilityPolicy: 'block-mount' })],
    })
    const svc = broker.getService(SERVICE_COMPAT) as any
    expect(svc.compatibilityPolicy).toBe('block-mount')
  })

  it('Test 5: throw chiaro se microfrontendModule NON installato PRIMA', () => {
    // `createBroker` wrappa errori install in BrokerError con `cause` originale.
    let captured: unknown
    try {
      createBroker({ modules: [compatModule()] })
    } catch (err) {
      captured = err
    }
    expect(captured).toBeDefined()
    // Cerca messaggio chiaro nella catena (top-level + cause).
    const messages: string[] = []
    let cur: any = captured
    while (cur) {
      if (cur.message) messages.push(String(cur.message))
      if (cur.details?.cause?.message) messages.push(String(cur.details.cause.message))
      cur = cur.cause
    }
    const joined = messages.join(' | ')
    expect(joined).toMatch(/@gluezero\/compat requires @gluezero\/microfrontends|install failed/i)
  })

  it('Test 6: createBroker → getService(SERVICE_COMPAT) ritorna service object non-null', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), compatModule()],
    })
    const svc = broker.getService(SERVICE_COMPAT)
    expect(svc).toBeDefined()
    expect(typeof svc).toBe('object')
  })

  it('Test 7: service espone 10 metodi PRD §20.4 + D-12-10 + theme peer-conditional (REVISIONE WARNING 1)', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), compatModule()],
    })
    const svc = broker.getService(SERVICE_COMPAT) as any
    // 5 PRD §20.4 standard API:
    expect(typeof svc.checkMicroFrontendCompatibility).toBe('function')
    expect(typeof svc.getCompatibilityReport).toBe('function')
    expect(typeof svc.registerCanonicalModelVersion).toBe('function')
    expect(typeof svc.registerTopicVersion).toBe('function')
    expect(typeof svc.registerRouteVersion).toBe('function')
    // 4 D-12-10 additive non-breaking:
    expect(typeof svc.registerWorkerVersion).toBe('function')
    expect(typeof svc.registerLoaderVersion).toBe('function')
    expect(typeof svc.registerFrameworkVersion).toBe('function')
    expect(typeof svc.registerDependencyVersion).toBe('function')
    // 1 D-12-10 theme peer-conditional (REVISIONE WARNING 1):
    expect(typeof svc.registerThemeVersion).toBe('function')
    // Read-only introspection getter:
    expect(typeof svc.compatibilityPolicy).toBe('string')
  })

  it('Test 8: getCompatibilityReport() no-arg ritorna ReadonlyMap (D-12-17)', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), compatModule()],
    })
    const svc = broker.getService(SERVICE_COMPAT) as any
    const result = svc.getCompatibilityReport()
    expect(result).toBeInstanceOf(Map)
  })

  it('Test 9: getCompatibilityReport(id) con id non registrato ritorna report ok-empty (race-safe)', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), compatModule()],
    })
    const svc = broker.getService(SERVICE_COMPAT) as any
    const result = svc.getCompatibilityReport('mf-unknown')
    // check() ritorna report ok-empty per MF non registrato (race-safe defensive).
    expect(result).toBeDefined()
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('Test 10: checkMicroFrontendCompatibility(id) compute on-demand + memoize', async () => {
    const broker = createBroker({
      modules: [microfrontendModule(), compatModule()],
    })
    const mfService = broker.getService('microfrontends') as any
    await mfService.register({
      id: 'mf-check',
      name: 'mf-check',
      version: '1.0.0',
      loader: { type: 'esm', url: '/x.js' },
      compatibility: { gluezero: '^2.0.0' },
    })
    const svc = broker.getService(SERVICE_COMPAT) as any
    const report = svc.checkMicroFrontendCompatibility('mf-check')
    expect(report).toBeDefined()
    expect(report.microFrontendId).toBe('mf-check')
    // Memoize: secondo call ritorna stessa entry tramite getCompatibilityReport(id).
    const memo = svc.getCompatibilityReport('mf-check')
    expect(memo).toBeDefined()
    expect(memo.microFrontendId).toBe('mf-check')
  })

  it('Test 11: install applica service-wrap → marker __compatServicePatched=true (OQ-1)', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), compatModule()],
    })
    const mfService = broker.getService('microfrontends') as any
    expect(mfService.__compatServicePatched).toBe(true)
  })

  it('Test 12: install wira lifecycle-hooks → version.changed emit triggera invalidate cache (verifica behavior post-install)', async () => {
    const broker = createBroker({
      modules: [microfrontendModule(), compatModule()],
    })
    const svc = broker.getService(SERVICE_COMPAT) as any
    const mfService = broker.getService('microfrontends') as any
    // Register MF + memoize report.
    await mfService.register({
      id: 'mf-cache',
      name: 'mf-cache',
      version: '1.0.0',
      loader: { type: 'esm', url: '/x.js' },
      compatibility: { canonicalModels: { customer: '^1.0.0' } },
    })
    svc.checkMicroFrontendCompatibility('mf-cache') // populate memoization
    const beforeMap = svc.getCompatibilityReport()
    expect(beforeMap.size).toBeGreaterThan(0)
    // Emit version.changed via register*Version (broker.publish nel registry).
    svc.registerCanonicalModelVersion('customer', '1.0.0') // first set, NO emit (no oldValue)
    svc.registerCanonicalModelVersion('customer', '1.5.0') // emit version.changed
    // Post-emit: il subscribe handler in lifecycle-hooks ha invocato invalidateReportCache.
    const afterMap = svc.getCompatibilityReport()
    expect(afterMap.size).toBe(0)
  })

  it('Test 13 (REVISIONE WARNING 1): registerThemeVersion(tokens, ...) callable senza throw (peer optional)', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), compatModule()],
    })
    const svc = broker.getService(SERVICE_COMPAT) as any
    expect(() => svc.registerThemeVersion('tokens', '1.0.0')).not.toThrow()
    expect(() => svc.registerThemeVersion('roles', '1.5.0')).not.toThrow()
    // Idempotency: re-register identico = no-op.
    expect(() => svc.registerThemeVersion('tokens', '1.0.0')).not.toThrow()
  })
})

describe('compatModule barrel surface (Task 3 completion W2)', () => {
  it('Test 14: barrel re-export compatModule factory + types', async () => {
    const barrel = await import('../index')
    expect(typeof (barrel as any).compatModule).toBe('function')
    // Types compatibility (CompatModuleOptions, CompatService): non testabile in runtime,
    // ma verifica indiretta via createBroker call senza errori TS (test compile time).
  })

  it('Test 15: barrel re-export createCheckEngine + createVersionRegistry + createCompatError', async () => {
    const barrel = await import('../index')
    expect(typeof (barrel as any).createCheckEngine).toBe('function')
    expect(typeof (barrel as any).createVersionRegistry).toBe('function')
    expect(typeof (barrel as any).createCompatError).toBe('function')
    expect(typeof (barrel as any).publishCompatTopics).toBe('function')
  })

  it('Test 16: barrel re-export MF_COMPAT_TOPICS + CompatTopic type', async () => {
    const barrel = await import('../index')
    expect(Array.isArray((barrel as any).MF_COMPAT_TOPICS)).toBe(true)
    expect((barrel as any).MF_COMPAT_TOPICS).toContain('microfrontend.compatibility.warning')
    expect((barrel as any).MF_COMPAT_TOPICS).toContain('microfrontend.compatibility.version.changed')
  })

  it('Test 17: barrel NON re-export internal helpers (enforcement-points/lifecycle-hooks/policy-dispatch/semver-checker)', async () => {
    const barrel = await import('../index')
    const keys = Object.keys(barrel)
    expect(keys.some((k) => k === 'wrapServiceWithCompat')).toBe(false)
    expect(keys.some((k) => k === 'wireLifecycleHooks')).toBe(false)
    expect(keys.some((k) => k === 'enforceCompatPolicy')).toBe(false)
    expect(keys.some((k) => k === 'createSemverChecker')).toBe(false)
  })
})
