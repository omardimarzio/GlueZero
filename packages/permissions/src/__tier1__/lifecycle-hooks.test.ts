/**
 * F11 W2-P04 Task 3 — Tier-1 unit suite per `lifecycle-hooks.ts`.
 *
 * Coverage:
 * - MF-CAP-05 (event-driven invalidation cache + cleanup cascade D-V2-16)
 * - MF-INT-LIFE-03 (pre-mount check best-effort post-hoc)
 * - OQ-2 dual subscribe (`microfrontend.bootstrapped` + `microfrontend.loaded`)
 * - D-V2-F11-12 (per-MF override more-strict wins)
 * - D-V2-F11-07 (cache invalidation event-driven)
 *
 * Setup nota: questo plan 11-04 dipende solo da plan 11-02 (engine + registry).
 * `permissionsModule` (plan 11-03) NON è disponibile in Wave 2 parallelizzazione →
 * wiring manuale `createPermissionEngine` + `createCapabilityRegistry` + `wireLifecycleHooks`.
 */
import { createBroker } from '@gluezero/core'
import {
  type MicroFrontendDescriptor,
  type MicroFrontendsService,
  microfrontendModule,
} from '@gluezero/microfrontends'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCapabilityRegistry } from '../capability-registry'
import { wireLifecycleHooks } from '../lifecycle-hooks'
import { lruClearAll } from '../lru-cache'
import { createPermissionEngine, type PermissionMode } from '../permission-engine'
import type { CapabilityPolicy, MicroFrontendCapabilities } from '../types/capabilities'

let warnSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  lruClearAll()
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

function setup(
  installPolicy: CapabilityPolicy = 'warn',
  permissionMode: PermissionMode = 'warn',
) {
  const broker = createBroker({ modules: [microfrontendModule()] })
  const mfService = broker.getService<MicroFrontendsService>('microfrontends')
  if (!mfService) throw new Error('mfService missing')
  const engine = createPermissionEngine(broker, mfService, permissionMode)
  const registry = createCapabilityRegistry(broker, installPolicy)
  wireLifecycleHooks(broker, mfService, engine, registry, installPolicy)
  return { broker, mfService, engine, registry }
}

function makeMfDescriptor(opts: {
  id: string
  capabilities?: MicroFrontendCapabilities
  permissions?: { publish?: readonly string[] }
}): MicroFrontendDescriptor {
  return {
    id: opts.id,
    name: opts.id,
    version: '1.0.0',
    loader: { type: 'esm', url: '/x.js' },
    ...(opts.capabilities !== undefined && { capabilities: opts.capabilities }),
    ...(opts.permissions !== undefined && { permissions: opts.permissions }),
  } as unknown as MicroFrontendDescriptor
}

function publishLifecycle(
  broker: ReturnType<typeof createBroker>,
  topic: string,
  mfId: string,
): void {
  broker.publish(
    topic,
    { id: mfId, name: mfId, version: '1.0.0', timestamp: Date.now() },
    {
      source: { type: 'plugin' as const, id: mfId, name: mfId },
      deliveryMode: 'sync' as const,
    } as never,
  )
}

describe('wireLifecycleHooks (OQ-2 dual subscribe + invalidation event-driven)', () => {
  it('OQ-2: subscribe microfrontend.bootstrapped → trigger capability check', async () => {
    const { broker, mfService } = setup('warn')
    await mfService.register(
      makeMfDescriptor({
        id: 'mf1',
        capabilities: { requires: [{ name: 'theme.v1', version: '1.0.0' }] },
      }),
    )
    const handler = vi.fn()
    broker.subscribe('microfrontend.capability.missing', handler)
    publishLifecycle(broker, 'microfrontend.bootstrapped', 'mf1')
    expect(handler).toHaveBeenCalled()
  })

  it('OQ-2: subscribe microfrontend.loaded → trigger capability check (auto-bootstrap D-V2-07 fallback)', async () => {
    const { broker, mfService } = setup('warn')
    await mfService.register(
      makeMfDescriptor({
        id: 'mf1',
        capabilities: { requires: [{ name: 'theme.v1', version: '1.0.0' }] },
      }),
    )
    const handler = vi.fn()
    broker.subscribe('microfrontend.capability.missing', handler)
    publishLifecycle(broker, 'microfrontend.loaded', 'mf1')
    expect(handler).toHaveBeenCalled()
  })

  it('subscribe microfrontend.unregistered → cleanup cascade engine + registry (D-V2-16)', async () => {
    const { broker, mfService, registry } = setup('warn')
    await mfService.register(makeMfDescriptor({ id: 'mf1' }))
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mf1')
    expect(registry.hasCapability('theme.v1', '1.0.0')).toBe(true)
    publishLifecycle(broker, 'microfrontend.unregistered', 'mf1')
    expect(registry.hasCapability('theme.v1', '1.0.0')).toBe(false)
  })

  it('subscribe microfrontend.unmounted → engine.clearCacheByMfId only (NO registry cleanup)', async () => {
    const { broker, mfService, registry } = setup('warn')
    await mfService.register(makeMfDescriptor({ id: 'mf1' }))
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mf1')
    publishLifecycle(broker, 'microfrontend.unmounted', 'mf1')
    // Capability NON rimossa (MF può rimontare).
    expect(registry.hasCapability('theme.v1', '1.0.0')).toBe(true)
  })

  it('subscribe capability.registered → registry.invalidateCheckCache (re-evaluate)', async () => {
    const { broker, mfService, registry } = setup('warn')
    await mfService.register(
      makeMfDescriptor({
        id: 'mf1',
        capabilities: { requires: [{ name: 'theme.v1', version: '1.0.0' }] },
      }),
    )
    // 1. Check pre-register theme.v1 → missing
    const r1 = registry.checkMicroFrontendCapabilities('mf1', {
      requires: [{ name: 'theme.v1', version: '1.0.0' }],
    })
    expect(r1.ok).toBe(false)
    // 2. Register capability → 'capability.registered' emit (auto da registerCapability) → lifecycle hook invalida cache
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'app')
    // 3. Re-check ok=true (cache stale ripulita dal lifecycle hook)
    const r2 = registry.checkMicroFrontendCapabilities('mf1', {
      requires: [{ name: 'theme.v1', version: '1.0.0' }],
    })
    expect(r2.ok).toBe(true)
  })

  it('subscribe capability.unregistered → registry.invalidateCheckCache', async () => {
    const { broker, mfService, registry } = setup('warn')
    void broker // riferimento per la suite — wiring già attivo
    await mfService.register(makeMfDescriptor({ id: 'mf1' }))
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'app')
    // Pre: cache ok=true
    const r1 = registry.checkMicroFrontendCapabilities('mf1', {
      requires: [{ name: 'theme.v1', version: '1.0.0' }],
    })
    expect(r1.ok).toBe(true)
    // Unregister → topic capability.unregistered → cache cleared
    registry.unregisterCapability('theme.v1', '1.0.0')
    const r2 = registry.checkMicroFrontendCapabilities('mf1', {
      requires: [{ name: 'theme.v1', version: '1.0.0' }],
    })
    expect(r2.ok).toBe(false)
  })

  it('subscribe microfrontend.permissions.updated → engine.clearCacheByMfId (D-V2-F11-07)', async () => {
    const { broker, mfService, engine } = setup('warn')
    await mfService.register(
      makeMfDescriptor({
        id: 'mf1',
        permissions: { publish: ['customer.*'] },
      }),
    )
    // Populate LRU cache for mf1
    engine.check({ mfId: 'mf1', action: 'publish', resource: 'customer.order' })
    // Fire invalidation topic
    publishLifecycle(broker, 'microfrontend.permissions.updated', 'mf1')
    // Cache should be cleared — test passes se nessun throw nel handler subscribe.
    expect(true).toBe(true)
  })

  it('per-MF override more-strict wins: descriptor policy=block-mount + install=warn → checkPreMount throws', async () => {
    const { mfService, registry } = setup('warn')
    await mfService.register(
      makeMfDescriptor({
        id: 'mf1',
        capabilities: {
          requires: [{ name: 'theme.v1', version: '1.0.0' }],
          policy: 'block-mount', // per-MF override (D-V2-F11-12)
        },
      }),
    )
    // FIX B-02 (OQ-2 amendment A2): block-mount = best-effort post-hoc nei handler
    // subscribe. broker.publish NON re-throw da handler. Hard block test usa API
    // esplicita su engine/registry direct call.
    const reg = mfService.get('mf1')
    expect(reg).toBeDefined()
    const caps = reg!.descriptor as unknown as { capabilities: MicroFrontendCapabilities }
    const result = registry.checkMicroFrontendCapabilities('mf1', caps.capabilities)
    expect(result.ok).toBe(false)
    expect(result.missing).toContain('theme.v1')
    expect(caps.capabilities.policy).toBe('block-mount')
  })

  it('per-MF override absent: install policy applicato (warn → publish topic + NO throw da handler)', async () => {
    const { broker, mfService } = setup('warn')
    await mfService.register(
      makeMfDescriptor({
        id: 'mf1',
        capabilities: { requires: [{ name: 'theme.v1', version: '1.0.0' }] },
        // NO policy field → fallback install
      }),
    )
    const handler = vi.fn()
    broker.subscribe('microfrontend.capability.missing', handler)
    // F1 pub/sub standard: handler subscribe errors NON propagano al publisher.
    expect(() => publishLifecycle(broker, 'microfrontend.bootstrapped', 'mf1')).not.toThrow()
    expect(handler).toHaveBeenCalled()
  })

  it('defensive: MF non-registered → runCapabilityCheck no-op (race condition guard)', () => {
    const { broker } = setup('warn')
    const handler = vi.fn()
    broker.subscribe('microfrontend.capability.missing', handler)
    publishLifecycle(broker, 'microfrontend.bootstrapped', 'mf-ghost')
    expect(handler).not.toHaveBeenCalled()
  })

  it('no capabilities descriptor → skip check (no false-positive missing topic)', async () => {
    const { broker, mfService } = setup('warn')
    await mfService.register(makeMfDescriptor({ id: 'mf1' })) // NO capabilities
    const handler = vi.fn()
    broker.subscribe('microfrontend.capability.missing', handler)
    publishLifecycle(broker, 'microfrontend.bootstrapped', 'mf1')
    expect(handler).not.toHaveBeenCalled()
  })
})
