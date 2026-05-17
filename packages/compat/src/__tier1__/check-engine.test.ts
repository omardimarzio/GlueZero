/**
 * F12 W2 Task 2 — Tier-1 unit suite per `check-engine.ts` (MF-COMPAT-01 + MF-COMPAT-03).
 *
 * Coverage:
 * - Algoritmo 9 dim (PRD §20.3) — scalar gluezero + 6 Record + theme + framework.
 * - D-12-09: missing version = warning (NON error).
 * - D-12-17: getReport overload (id? optional → singolo o Map).
 * - D-12-12: memoization Map (computeReport → set lastReports).
 * - D-12-18: checkedAt = Date.now().
 * - Race-safe: mfService.get undefined → ok-empty report.
 *
 * @see plan 12-02 Task 2 behavior — 22 test cases
 */
import { createBroker } from '@gluezero/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCheckEngine } from '../check-engine'
import { createSemverChecker } from '../semver-checker'
import type { CompatAwareMfDescriptor } from '../types/descriptor-augment'
import { createVersionRegistry } from '../version-registry'

beforeEach(() => {
  vi.restoreAllMocks()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function setup() {
  const broker = createBroker({})
  const checker = createSemverChecker()
  const registry = createVersionRegistry(broker)
  const mfMap = new Map<string, { descriptor: CompatAwareMfDescriptor; state: 'registered' }>()
  const mfService = {
    get: (id: string) => mfMap.get(id),
  }
  const engine = createCheckEngine(
    mfService as Parameters<typeof createCheckEngine>[0],
    registry,
    checker,
    broker,
    'warn',
  )
  function addMf(id: string, compatibility?: CompatAwareMfDescriptor['compatibility']) {
    const desc: CompatAwareMfDescriptor = {
      id,
      version: '1.0.0',
      source: { type: 'esm', url: 'data:text/javascript,export const bootstrap=()=>{}' },
      compatibility,
    } as CompatAwareMfDescriptor
    mfMap.set(id, { descriptor: desc, state: 'registered' })
  }
  return { broker, engine, registry, mfService, addMf }
}

describe('createCheckEngine — algoritmo 9 dim PRD §20.3', () => {
  it('Test 1: gluezero range satisfied → ok true', () => {
    const { engine } = setup()
    const report = engine.computeReport('mf-1', { gluezero: '^2.0.0' })
    expect(report.ok).toBe(true)
    expect(report.errors).toHaveLength(0)
    expect(report.warnings).toHaveLength(0)
  })

  it('Test 2: gluezero range NOT satisfied → ok false + error gluezero-version', () => {
    const { engine } = setup()
    const report = engine.computeReport('mf-1', { gluezero: '^99.0.0' })
    expect(report.ok).toBe(false)
    expect(report.errors).toHaveLength(1)
    expect(report.errors[0]!.type).toBe('gluezero-version')
    expect(report.errors[0]!.required).toBe('^99.0.0')
    expect(report.errors[0]!.actual).toBe('2.0.0')
  })

  it('Test 3: canonicalModels registered + satisfies → ok', () => {
    const { engine, registry } = setup()
    registry.registerCanonicalModelVersion('customer', '1.2.0')
    const report = engine.computeReport('mf-1', { canonicalModels: { customer: '^1.0.0' } })
    expect(report.ok).toBe(true)
    expect(report.errors).toHaveLength(0)
  })

  it('Test 4: canonicalModels NOT registered → warning (D-12-09 missing version = warning)', () => {
    const { engine } = setup()
    const report = engine.computeReport('mf-1', { canonicalModels: { customer: '^1.0.0' } })
    expect(report.ok).toBe(true) // warning NON blocca
    expect(report.warnings).toHaveLength(1)
    expect(report.warnings[0]!.type).toBe('canonical-model-version')
    expect((report.warnings[0]!.context as { subKey: string }).subKey).toBe('customer')
  })

  it('Test 5: canonicalModels mismatch → error', () => {
    const { engine, registry } = setup()
    registry.registerCanonicalModelVersion('customer', '2.0.0')
    const report = engine.computeReport('mf-1', { canonicalModels: { customer: '^1.0.0' } })
    expect(report.ok).toBe(false)
    expect(report.errors).toHaveLength(1)
    expect(report.errors[0]!.type).toBe('canonical-model-version')
    expect((report.errors[0]!.context as { subKey: string }).subKey).toBe('customer')
  })

  it('Test 6: topics dim — 2 entries, ognuna issue separata con context.subKey', () => {
    const { engine } = setup()
    const report = engine.computeReport('mf-1', { topics: { a: '^1', b: '^2' } })
    expect(report.warnings).toHaveLength(2)
    const subKeys = report.warnings.map((w) => (w.context as { subKey: string }).subKey).sort()
    expect(subKeys).toEqual(['a', 'b'])
    expect(report.warnings.every((w) => w.type === 'topic-version')).toBe(true)
  })

  it('Test 7-12: routes/workers/loaders/dependencies (Record-based) — stesso pattern', () => {
    const { engine, registry } = setup()
    registry.registerRouteVersion('r1', '1.0.0')
    registry.registerWorkerVersion('w1', '1.0.0')
    registry.registerLoaderVersion('esm', '1.0.0')
    registry.registerDependencyVersion('lodash', '4.17.0')
    const report = engine.computeReport('mf-1', {
      routes: { r1: '^1.0.0' },
      workers: { w1: '^1.0.0' },
      loaders: { esm: '^1.0.0' },
      dependencies: { lodash: '^4.0.0' },
    })
    expect(report.ok).toBe(true)
    expect(report.errors).toHaveLength(0)
  })

  it('Test 13: theme — tokens ok, roles mismatch → 1 error roles + tokens silent', () => {
    const { engine, registry } = setup()
    registry.registerThemeVersion('tokens', '1.0.0')
    registry.registerThemeVersion('roles', '2.0.0')
    const report = engine.computeReport('mf-1', {
      theme: { tokens: '^1.0.0', roles: '^1.0.0' },
    })
    expect(report.errors).toHaveLength(1)
    expect(report.errors[0]!.type).toBe('theme-version')
    expect((report.errors[0]!.context as { subKey: string }).subKey).toBe('roles')
  })

  it('Test 14: framework installed + version satisfies → ok', () => {
    const { engine, registry } = setup()
    registry.registerFrameworkVersion('react', '19.1.0')
    const report = engine.computeReport('mf-1', {
      framework: { name: 'react', version: '^19.0.0' },
    })
    expect(report.ok).toBe(true)
  })

  it('Test 15: framework NOT installed → warning framework-version', () => {
    const { engine } = setup()
    const report = engine.computeReport('mf-1', {
      framework: { name: 'react', version: '^19.0.0' },
    })
    expect(report.warnings).toHaveLength(1)
    expect(report.warnings[0]!.type).toBe('framework-version')
    expect((report.warnings[0]!.context as { name: string }).name).toBe('react')
  })

  it('Test 16: report.checkedAt = Date.now() (D-12-18, fake timers)', () => {
    const { engine } = setup()
    vi.useFakeTimers()
    vi.setSystemTime(1700000000000)
    const report = engine.computeReport('mf-1', {})
    expect(report.checkedAt).toBe(1700000000000)
  })

  it('Test 17: 9 dim contemporaneamente — mix errors + warnings cumulativi', () => {
    const { engine, registry } = setup()
    registry.registerCanonicalModelVersion('customer', '2.0.0') // mismatch
    registry.registerThemeVersion('tokens', '1.0.0') // ok
    const report = engine.computeReport('mf-1', {
      gluezero: '^99.0.0', // error
      canonicalModels: { customer: '^1.0.0' }, // error
      topics: { unknown: '^1.0.0' }, // warning (missing)
      theme: { tokens: '^1.0.0', roles: '^1.0.0' }, // tokens ok, roles missing → warning
      framework: { name: 'angular', version: '^17.0.0' }, // warning (missing)
    })
    expect(report.ok).toBe(false)
    expect(report.errors.length).toBeGreaterThanOrEqual(2) // gluezero + canonicalModels
    expect(report.warnings.length).toBeGreaterThanOrEqual(3) // topics + theme.roles + framework
  })

  it('Test 18: empty caps {} → ok true, errors=[], warnings=[]', () => {
    const { engine } = setup()
    const report = engine.computeReport('mf-1', {})
    expect(report.ok).toBe(true)
    expect(report.errors).toHaveLength(0)
    expect(report.warnings).toHaveLength(0)
  })

  it('Test 19: getReport(id) ritorna lastReports memo o compute on-demand', () => {
    const { engine, addMf } = setup()
    addMf('mf-1', { gluezero: '^2.0.0' })
    const r1 = engine.getReport('mf-1')
    expect(r1).toBeDefined()
    expect(r1!.ok).toBe(true)
    // Seconda call → ritorna memo
    const r2 = engine.getReport('mf-1')
    expect(r2).toBe(r1) // stessa reference (memo hit)
  })

  it('Test 20: getReport() no-arg ritorna ReadonlyMap (D-12-17)', () => {
    const { engine } = setup()
    engine.computeReport('mf-1', { gluezero: '^2.0.0' })
    engine.computeReport('mf-2', {})
    const all = engine.getReport()
    expect(all).toBeInstanceOf(Map)
    expect(all.size).toBe(2)
    expect(all.has('mf-1')).toBe(true)
    expect(all.has('mf-2')).toBe(true)
  })

  it('Test 21: invalidateReportCache() clears all', () => {
    const { engine } = setup()
    engine.computeReport('mf-1', {})
    engine.computeReport('mf-2', {})
    expect(engine.getReport().size).toBe(2)
    engine.invalidateReportCache()
    expect(engine.getReport().size).toBe(0)
  })

  it('Test 22: deleteReport(mfId) deletes single entry', () => {
    const { engine } = setup()
    engine.computeReport('mf-1', {})
    engine.computeReport('mf-2', {})
    const removed = engine.deleteReport('mf-1')
    expect(removed).toBe(true)
    expect(engine.getReport().size).toBe(1)
    expect(engine.getReport().has('mf-2')).toBe(true)
  })

  it('Test 23: check(id) — descriptor con compatibility → compute report', () => {
    const { engine, addMf } = setup()
    addMf('mf-1', { gluezero: '^2.0.0' })
    const report = engine.check('mf-1')
    expect(report.ok).toBe(true)
    expect(report.microFrontendId).toBe('mf-1')
  })

  it('Test 24: check(unknown-id) → race-safe ok-empty report (mfService.get undefined)', () => {
    const { engine } = setup()
    const report = engine.check('missing-mf')
    expect(report.ok).toBe(true)
    expect(report.errors).toHaveLength(0)
    expect(report.warnings).toHaveLength(0)
    expect(report.microFrontendId).toBe('missing-mf')
  })
})
