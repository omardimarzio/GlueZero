/**
 * F12 W3 Task 1 — Tier-1 unit suite per `enforcement-points.ts` (OQ-1).
 *
 * Coverage:
 *
 * - `wrapServiceWithCompat` — marker idempotent `__compatServicePatched`,
 *   audit-grep clean (non-enumerable + non-writable + non-configurable),
 *   monkey-patch 3 metodi register/load/mount con throw PRIMA dell'invocazione
 *   `originalFn` (OQ-1 resolution carryover F11 D-V2-F11-22 strict pattern).
 *
 * Pattern carryover F11 enforcement-points.test.ts (5 test idempotent + 3
 * test wrap behavior) — F12 estende a 3 metodi vs 4 F11 con scope esteso
 * (register + load + mount), e include `phase` parameter discriminator per
 * `enforceCompatPolicy`.
 *
 * @see plan 12-03 Task 1
 * @see packages/permissions/src/__tier1__/enforcement-points.test.ts (TEMPLATE F11)
 * @see prd_2.0.0.md §20.6 — 5 policy + 3 phase dispatch
 */
import type { Broker } from '@gluezero/core'
import { createBroker } from '@gluezero/core'
import {
  type MicroFrontendDescriptor,
  type MicroFrontendsService,
  microfrontendModule,
} from '@gluezero/microfrontends'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCheckEngine } from '../check-engine'
import { wrapServiceWithCompat } from '../enforcement-points'
import { createSemverChecker } from '../semver-checker'
import type { CompatibilityPolicy } from '../types/policy'
import { createVersionRegistry } from '../version-registry'

beforeEach(() => {
  vi.restoreAllMocks()
})
afterEach(() => {
  vi.restoreAllMocks()
})

function setup(policy: CompatibilityPolicy = 'block-mount'): {
  broker: Broker
  mfService: MicroFrontendsService
  engine: ReturnType<typeof createCheckEngine>
  registry: ReturnType<typeof createVersionRegistry>
} {
  const broker = createBroker({ modules: [microfrontendModule()] })
  const mfService = broker.getService<MicroFrontendsService>('microfrontends')
  if (!mfService) throw new Error('mfService missing')
  const registry = createVersionRegistry(broker)
  const checker = createSemverChecker()
  const engine = createCheckEngine(mfService, registry, checker, broker, policy)
  wrapServiceWithCompat(mfService, engine, broker, policy)
  return { broker, mfService, engine, registry }
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

describe('wrapServiceWithCompat — marker idempotent (OQ-1 carryover F11)', () => {
  it('Test 1: prima invocazione setta marker __compatServicePatched true', () => {
    const { mfService } = setup()
    expect((mfService as unknown as Record<string, unknown>).__compatServicePatched).toBe(true)
  })

  it('Test 2: idempotent — chiamata 2x non re-wrap (stessa ref)', () => {
    const { mfService, engine, broker } = setup()
    const firstRegister = (mfService as unknown as Record<string, unknown>).register
    wrapServiceWithCompat(mfService, engine, broker, 'block-mount')
    const secondRegister = (mfService as unknown as Record<string, unknown>).register
    expect(firstRegister).toBe(secondRegister)
  })

  it('Test 3: marker non-writable + non-enumerable + non-configurable', () => {
    const { mfService } = setup()
    const desc = Object.getOwnPropertyDescriptor(mfService, '__compatServicePatched')
    expect(desc?.writable).toBe(false)
    expect(desc?.enumerable).toBe(false)
    expect(desc?.configurable).toBe(false)
    expect(Object.keys(mfService as unknown as Record<string, unknown>)).not.toContain(
      '__compatServicePatched',
    )
  })

  it('Test 12: 2 marker coesistono — F11 + F12 disjoint (audit-grep separation)', () => {
    const { mfService } = setup()
    // Simula F11 marker (non installato realmente in questo test, ma applichiamo
    // direttamente il marker per simulare lo stato post-install F11 + F12).
    Object.defineProperty(mfService, '__permissionsServicePatched', {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    })
    expect((mfService as unknown as Record<string, unknown>).__permissionsServicePatched).toBe(
      true,
    )
    expect((mfService as unknown as Record<string, unknown>).__compatServicePatched).toBe(true)
  })
})

describe('wrapServiceWithCompat — phase=registration (D-12-03 sync throw)', () => {
  it('Test 4: register(descWithCompat) policy=block-registration + report fail → throw COMPAT_INCOMPATIBLE phase=registration', async () => {
    const { mfService } = setup('block-registration')
    await expect(
      mfService.register(
        makeMfDescriptor({
          id: 'mf-fail',
          compatibility: { gluezero: '^999.0.0' },
        }),
      ),
    ).rejects.toMatchObject({
      code: 'COMPAT_INCOMPATIBLE',
      details: { phase: 'registration' },
    })
  })

  it('Test 7: register(descWithoutCompat) → skip check, chiama originalRegister', async () => {
    const { mfService } = setup('block-registration')
    await expect(
      mfService.register(makeMfDescriptor({ id: 'mf-ok' })),
    ).resolves.toBeUndefined()
    expect(mfService.get('mf-ok')?.descriptor.id).toBe('mf-ok')
  })

  it('Test 8: register policy=warn + report fail → NO throw + chiama originalRegister', async () => {
    const { mfService, broker } = setup('warn')
    const failedHandler = vi.fn()
    broker.subscribe('microfrontend.compatibility.failed', failedHandler)
    // Mock console.warn per evitare output rumoroso nei test
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(
      mfService.register(
        makeMfDescriptor({
          id: 'mf-warn',
          compatibility: { gluezero: '^999.0.0' },
        }),
      ),
    ).resolves.toBeUndefined()
    expect(mfService.get('mf-warn')).toBeDefined()
    // emit failed PRIMA del no-throw (D-12-05 emit telemetry)
    expect(failedHandler).toHaveBeenCalled()
  })
})

describe('wrapServiceWithCompat — phase=load (OQ-3 funzionale F12)', () => {
  it('Test 5: load(mfId) policy=block-load + report fail → throw COMPAT_INCOMPATIBLE phase=load', async () => {
    // Setup: registra MF con policy off, poi switch + re-wrap (test isolation).
    const broker = createBroker({ modules: [microfrontendModule()] })
    const mfService = broker.getService<MicroFrontendsService>('microfrontends')
    if (!mfService) throw new Error('mfService missing')
    // Register PRIMA del wrap (skip check in register).
    await mfService.register(
      makeMfDescriptor({
        id: 'mf-load-fail',
        compatibility: { gluezero: '^999.0.0' },
      }),
    )
    // Ora applica wrap con policy block-load.
    const registry = createVersionRegistry(broker)
    const checker = createSemverChecker()
    const engine = createCheckEngine(mfService, registry, checker, broker, 'block-load')
    wrapServiceWithCompat(mfService, engine, broker, 'block-load')

    await expect(mfService.load('mf-load-fail')).rejects.toMatchObject({
      code: 'COMPAT_INCOMPATIBLE',
      details: { phase: 'load' },
    })
  })

  it('Test 9: load/mount: arg[0]=mfId → wrapper lookup mfService.get(mfId).descriptor.compatibility', async () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const mfService = broker.getService<MicroFrontendsService>('microfrontends')
    if (!mfService) throw new Error('mfService missing')
    // Register MF SENZA compatibility (skip check path).
    await mfService.register(makeMfDescriptor({ id: 'mf-no-compat' }))
    const registry = createVersionRegistry(broker)
    const checker = createSemverChecker()
    const engine = createCheckEngine(mfService, registry, checker, broker, 'block-load')
    const spyGet = vi.spyOn(mfService, 'get')
    wrapServiceWithCompat(mfService, engine, broker, 'block-load')

    // load lookup descriptor via mfService.get(mfId) — descriptor senza compatibility → no check.
    // Promise può rifiutarsi per altri motivi (loader missing) ma NON per COMPAT_INCOMPATIBLE.
    await mfService.load('mf-no-compat').catch(() => {
      /* loader missing acceptable here, we only test the wrapper path */
    })
    expect(spyGet).toHaveBeenCalledWith('mf-no-compat')
  })
})

describe('wrapServiceWithCompat — phase=mount (D-12-04 + OQ-3 alias)', () => {
  it('Test 6: mount(mfId) policy=block-mount + report fail → throw COMPAT_INCOMPATIBLE phase=mount', async () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const mfService = broker.getService<MicroFrontendsService>('microfrontends')
    if (!mfService) throw new Error('mfService missing')
    await mfService.register(
      makeMfDescriptor({
        id: 'mf-mount-fail',
        compatibility: { gluezero: '^999.0.0' },
      }),
    )
    const registry = createVersionRegistry(broker)
    const checker = createSemverChecker()
    const engine = createCheckEngine(mfService, registry, checker, broker, 'block-mount')
    wrapServiceWithCompat(mfService, engine, broker, 'block-mount')

    await expect(mfService.mount('mf-mount-fail')).rejects.toMatchObject({
      code: 'COMPAT_INCOMPATIBLE',
      details: { phase: 'mount' },
    })
  })
})

describe('wrapServiceWithCompat — defensive paths', () => {
  it('Test 9b: mount(mfId) per MF inesistente → mfService.get ritorna undefined → skip check + delega originalMount (che rigetta con MF_NOT_REGISTERED)', async () => {
    const broker = createBroker({ modules: [microfrontendModule()] })
    const mfService = broker.getService<MicroFrontendsService>('microfrontends')
    if (!mfService) throw new Error('mfService missing')
    const registry = createVersionRegistry(broker)
    const checker = createSemverChecker()
    const engine = createCheckEngine(mfService, registry, checker, broker, 'block-mount')
    wrapServiceWithCompat(mfService, engine, broker, 'block-mount')

    // mount per mfId che non esiste: nostro wrap salta il check (descriptor=undefined),
    // delega all'originale che rigetta con MF_NOT_REGISTERED (NOT COMPAT_INCOMPATIBLE).
    await expect(mfService.mount('mf-ghost')).rejects.toMatchObject({
      code: 'MF_NOT_REGISTERED',
    })
  })
})
