/**
 * F12 W3 Task 2 — Tier-1 unit suite per `lifecycle-hooks.ts`.
 *
 * Coverage:
 *
 * - subscribe ai 4 topic F8+F12: `microfrontend.bootstrapped` (mount phase) +
 *   `microfrontend.loaded` (load phase, OQ-2 dual subscribe carryover F11) +
 *   `microfrontend.compatibility.version.changed` (cache invalidation D-12-08) +
 *   `microfrontend.unregistered` (cleanup cascade D-V2-16).
 *
 * - emit topic + runtime trigger handler runCheck con phase corretto.
 *
 * - Defensive: race condition MF unregistered tra emit e handler; descriptor
 *   senza compatibility caps → skip silenzioso no throw.
 *
 * @see plan 12-03 Task 2
 * @see packages/permissions/src/__tier1__/lifecycle-hooks.test.ts (TEMPLATE F11)
 */
import { createBroker } from '@gluezero/core'
import {
  type MicroFrontendDescriptor,
  type MicroFrontendsService,
  microfrontendModule,
} from '@gluezero/microfrontends'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCheckEngine } from '../check-engine'
import { wireLifecycleHooks } from '../lifecycle-hooks'
import { createSemverChecker } from '../semver-checker'
import type { CompatibilityPolicy } from '../types/policy'
import { createVersionRegistry } from '../version-registry'

let warnSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

function setup(installPolicy: CompatibilityPolicy = 'warn'): {
  broker: ReturnType<typeof createBroker>
  mfService: MicroFrontendsService
  engine: ReturnType<typeof createCheckEngine>
  registry: ReturnType<typeof createVersionRegistry>
  subscribeSpy: ReturnType<typeof vi.spyOn>
} {
  const broker = createBroker({ modules: [microfrontendModule()] })
  const mfService = broker.getService<MicroFrontendsService>('microfrontends')
  if (!mfService) throw new Error('mfService missing')
  const registry = createVersionRegistry(broker)
  const checker = createSemverChecker()
  const engine = createCheckEngine(mfService, registry, checker, broker, installPolicy)
  const subscribeSpy = vi.spyOn(broker, 'subscribe')
  wireLifecycleHooks(broker, mfService, engine, registry, installPolicy)
  return { broker, mfService, engine, registry, subscribeSpy }
}

function makeMfDescriptor(opts: {
  id: string
  compatibility?: { gluezero?: string; canonicalModels?: Record<string, string> }
}): MicroFrontendDescriptor {
  return {
    id: opts.id,
    name: opts.id,
    version: '1.0.0',
    loader: { type: 'esm', url: '/x.js' },
    ...(opts.compatibility !== undefined && { compatibility: opts.compatibility }),
  } as unknown as MicroFrontendDescriptor
}

function publishLifecycle(
  broker: ReturnType<typeof createBroker>,
  topic: string,
  payload: Record<string, unknown>,
): void {
  broker.publish(topic, payload, {
    source: { type: 'plugin' as const, id: 'test', name: 'test' },
    deliveryMode: 'sync' as const,
  } as never)
}

describe('wireLifecycleHooks — 4 topic subscribe registration', () => {
  it('Test 1: subscribe microfrontend.bootstrapped registered', () => {
    const { subscribeSpy } = setup('warn')
    expect(subscribeSpy).toHaveBeenCalledWith(
      'microfrontend.bootstrapped',
      expect.any(Function),
    )
  })

  it('Test 2: subscribe microfrontend.loaded registered (OQ-2 dual subscribe carryover F11)', () => {
    const { subscribeSpy } = setup('warn')
    expect(subscribeSpy).toHaveBeenCalledWith('microfrontend.loaded', expect.any(Function))
  })

  it('Test 3: subscribe microfrontend.compatibility.version.changed registered (invalidation hook)', () => {
    const { subscribeSpy } = setup('warn')
    expect(subscribeSpy).toHaveBeenCalledWith(
      'microfrontend.compatibility.version.changed',
      expect.any(Function),
    )
  })

  it('Test 4: subscribe microfrontend.unregistered registered (cleanup cascade D-V2-16)', () => {
    const { subscribeSpy } = setup('warn')
    expect(subscribeSpy).toHaveBeenCalledWith(
      'microfrontend.unregistered',
      expect.any(Function),
    )
  })
})

describe('wireLifecycleHooks — runCheck via bootstrapped/loaded', () => {
  it('Test 5: emit bootstrapped → triggera computeReport(mfId, caps) + emit warning policy=warn', async () => {
    const { broker, mfService, engine } = setup('warn')
    await mfService.register(
      makeMfDescriptor({
        id: 'mf-1',
        compatibility: { gluezero: '^999.0.0' }, // forza fail → errors populated
      }),
    )
    const computeSpy = vi.spyOn(engine, 'computeReport')
    const failedHandler = vi.fn()
    broker.subscribe('microfrontend.compatibility.failed', failedHandler)
    publishLifecycle(broker, 'microfrontend.bootstrapped', { id: 'mf-1' })
    expect(computeSpy).toHaveBeenCalledWith('mf-1', expect.objectContaining({ gluezero: '^999.0.0' }))
    expect(failedHandler).toHaveBeenCalled() // emit topic governance failed (warn dispatch)
  })

  it('Test 6: emit loaded → triggera computeReport(mfId, caps) (OQ-2 auto-bootstrap fallback)', async () => {
    const { broker, mfService, engine } = setup('warn')
    await mfService.register(
      makeMfDescriptor({
        id: 'mf-2',
        compatibility: { gluezero: '^999.0.0' },
      }),
    )
    const computeSpy = vi.spyOn(engine, 'computeReport')
    publishLifecycle(broker, 'microfrontend.loaded', { id: 'mf-2' })
    expect(computeSpy).toHaveBeenCalledWith('mf-2', expect.any(Object))
  })
})

describe('wireLifecycleHooks — cache invalidation + cleanup', () => {
  it('Test 7: emit version.changed → engine.invalidateReportCache() invocato', async () => {
    const { broker, mfService, engine, registry } = setup('warn')
    await mfService.register(
      makeMfDescriptor({
        id: 'mf-3',
        compatibility: { canonicalModels: { customer: '^1.0.0' } },
      }),
    )
    // Memoize una entry.
    engine.check('mf-3')
    expect(engine.getReport('mf-3')).toBeDefined()
    const invalidateSpy = vi.spyOn(engine, 'invalidateReportCache')
    // Trigger emit via registry register*Version (deviazione: emit nel registry usa
    // direttamente broker.publish; il subscribe nel lifecycle-hooks chiama invalidate).
    registry.registerCanonicalModelVersion('customer', '1.5.0')
    expect(invalidateSpy).toHaveBeenCalled()
  })

  it('Test 8: emit unregistered → engine.deleteReport(mfId) invocato', async () => {
    const { broker, mfService, engine } = setup('warn')
    await mfService.register(
      makeMfDescriptor({
        id: 'mf-4',
        compatibility: { gluezero: '^2.0.0' },
      }),
    )
    engine.check('mf-4') // memoize
    expect(engine.getReport('mf-4')).toBeDefined()
    const deleteSpy = vi.spyOn(engine, 'deleteReport')
    publishLifecycle(broker, 'microfrontend.unregistered', { id: 'mf-4' })
    expect(deleteSpy).toHaveBeenCalledWith('mf-4')
  })
})

describe('wireLifecycleHooks — defensive paths', () => {
  it('Test 9: emit bootstrapped per mfId non esistente (race condition) → no throw', () => {
    const { broker } = setup('block-mount')
    // Nessun MF registrato. publish bootstrapped per mfId fantasma → handler ritorna early.
    expect(() => publishLifecycle(broker, 'microfrontend.bootstrapped', { id: 'mf-ghost' })).not.toThrow()
  })

  it('Test 10: emit bootstrapped per MF senza compatibility caps → no throw', async () => {
    const { broker, mfService } = setup('block-mount')
    await mfService.register(makeMfDescriptor({ id: 'mf-no-caps' }))
    expect(() =>
      publishLifecycle(broker, 'microfrontend.bootstrapped', { id: 'mf-no-caps' }),
    ).not.toThrow()
  })

  it('Test 11: block-mount policy + emit bootstrapped + report fail → handler errors SWALLOWED (F1 pub/sub), NO throw via broker.publish', async () => {
    const { broker, mfService } = setup('block-mount')
    await mfService.register(
      makeMfDescriptor({
        id: 'mf-block',
        compatibility: { gluezero: '^999.0.0' },
      }),
    )
    // Subscribe handler throw (enforceCompatPolicy block-mount) — broker swallow l'errore.
    expect(() =>
      publishLifecycle(broker, 'microfrontend.bootstrapped', { id: 'mf-block' }),
    ).not.toThrow()
  })

  it('Test 12: warnSpy used to suppress console.warn noise during tests', () => {
    // sanity: warnSpy declared in beforeEach + restored in afterEach.
    expect(warnSpy).toBeDefined()
  })
})
