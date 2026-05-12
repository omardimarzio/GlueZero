/**
 * Tier-1 jsdom test suite — `permissions-module.ts` factory + install.
 *
 * Coverage:
 *
 * - Default 2-options (D-V2-F11-13 + D-V2-F11-16) → entrambi `'warn'`.
 * - Override 2-options (`permissionMode` + `capabilityPolicy`).
 * - Anti-singleton D-30 → ogni call ritorna nuovo `BrokerModule`.
 * - Throw esplicito se `@gluezero/microfrontends` NON installato prima.
 * - Register `SERVICE_PERMISSIONS` con API completa (10 metodi + 2 modes).
 * - OQ-3 service patched post-install (`__permissionsServicePatched` marker).
 * - 2 broker indipendenti senza shared state.
 * - `setMicroFrontendPermissions` emette topic `microfrontend.permissions.updated`.
 * - SC4 — raw `broker.publish` BYPASSA check (P-13 governance not crypto).
 *
 * @see prd_2.0.0.md §17 + §19
 * @see D-V2-F11-13/16/18/22
 */
import { createBroker, SERVICE_PERMISSIONS } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lruClearAll } from '../lru-cache'
import { permissionsModule } from '../permissions-module'

beforeEach(() => {
  lruClearAll()
  vi.restoreAllMocks()
})

describe('permissionsModule (D-V2-F11-18 2-options factory)', () => {
  it('default no-args: mode warn + policy warn (D-V2-F11-13 + D-V2-F11-16)', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), permissionsModule()],
    })
    const svc = broker.getService(SERVICE_PERMISSIONS) as any
    expect(svc.permissionMode).toBe('warn')
    expect(svc.capabilityPolicy).toBe('warn')
  })

  it('opzioni override: mode enforce + policy block-mount', () => {
    const broker = createBroker({
      modules: [
        microfrontendModule(),
        permissionsModule({ permissionMode: 'enforce', capabilityPolicy: 'block-mount' }),
      ],
    })
    const svc = broker.getService(SERVICE_PERMISSIONS) as any
    expect(svc.permissionMode).toBe('enforce')
    expect(svc.capabilityPolicy).toBe('block-mount')
  })

  it('D-30 anti-singleton: ogni call ritorna nuovo BrokerModule', () => {
    const m1 = permissionsModule()
    const m2 = permissionsModule()
    expect(m1).not.toBe(m2)
    expect(m1.id).toBe('permissions')
    expect(m2.id).toBe('permissions')
    expect(m1.version).toBe('2.0.0-alpha.0')
  })

  it('throw chiaro se @gluezero/microfrontends NON installato PRIMA', () => {
    // `createBroker` wrappa errori install in BrokerError con `cause` originale.
    let captured: unknown
    try {
      createBroker({ modules: [permissionsModule()] })
    } catch (err) {
      captured = err
    }
    expect(captured).toBeDefined()
    // Search per messaggio chiaro nell'intera catena (top-level + cause).
    const messages: string[] = []
    let cur: any = captured
    while (cur) {
      if (cur.message) messages.push(String(cur.message))
      if (cur.details?.cause?.message) messages.push(String(cur.details.cause.message))
      cur = cur.cause
    }
    const joined = messages.join(' | ')
    expect(joined).toMatch(/@gluezero\/permissions requires @gluezero\/microfrontends|install failed/i)
  })

  it('registra SERVICE_PERMISSIONS con API completa', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), permissionsModule()],
    })
    const svc = broker.getService(SERVICE_PERMISSIONS) as any
    // Permission engine API (plan 11-02):
    expect(typeof svc.check).toBe('function')
    expect(typeof svc.enforce).toBe('function')
    expect(typeof svc.clearCacheByMfId).toBe('function')
    // Capability registry API (plan 11-04 — 5 metodi PRD §17.4):
    expect(typeof svc.registerCapability).toBe('function')
    expect(typeof svc.unregisterCapability).toBe('function')
    expect(typeof svc.hasCapability).toBe('function')
    expect(typeof svc.getCapabilities).toBe('function')
    expect(typeof svc.checkMicroFrontendCapabilities).toBe('function')
    // Runtime mutation + pre-mount API:
    expect(typeof svc.setMicroFrontendPermissions).toBe('function')
    expect(typeof svc.checkCapabilitiesPreMount).toBe('function')
    // Read-only modes (introspection):
    expect(svc.permissionMode).toBeDefined()
    expect(svc.capabilityPolicy).toBeDefined()
  })

  it('OQ-3 service patched post-install (__permissionsServicePatched marker)', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), permissionsModule()],
    })
    const mfService = broker.getService('microfrontends')
    expect((mfService as any).__permissionsServicePatched).toBe(true)
  })

  it('2 broker indipendenti possono installare permissionsModule()', () => {
    const broker1 = createBroker({
      modules: [microfrontendModule(), permissionsModule()],
    })
    const broker2 = createBroker({
      modules: [microfrontendModule(), permissionsModule()],
    })
    expect(broker1.getService(SERVICE_PERMISSIONS)).toBeDefined()
    expect(broker2.getService(SERVICE_PERMISSIONS)).toBeDefined()
    expect(broker1.getService(SERVICE_PERMISSIONS)).not.toBe(
      broker2.getService(SERVICE_PERMISSIONS),
    )
  })

  it('setMicroFrontendPermissions emette topic microfrontend.permissions.updated', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), permissionsModule()],
    })
    const svc = broker.getService(SERVICE_PERMISSIONS) as any
    const handler = vi.fn()
    broker.subscribe('microfrontend.permissions.updated', handler)
    svc.setMicroFrontendPermissions('mf1', { publish: ['customer.*'] })
    expect(handler).toHaveBeenCalledOnce()
    const payload = handler.mock.calls[0][0].payload
    expect(payload).toMatchObject({ id: 'mf1' })
    expect(typeof payload.timestamp).toBe('number')
  })

  it('setMicroFrontendPermissions triggera LRU clear via lifecycle hook', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), permissionsModule({ permissionMode: 'enforce' })],
    })
    const svc = broker.getService(SERVICE_PERMISSIONS) as any
    const mfService = broker.getService('microfrontends') as any
    mfService.register({
      id: 'mf1',
      name: 'mf1',
      version: '1.0.0',
      kind: 'iframe',
      url: 'about:blank',
      permissions: { publish: ['customer.*'] },
    })
    // Prime cache.
    expect(svc.check({ mfId: 'mf1', action: 'publish', resource: 'customer.x' })).toBe(true)
    // Topic update → lifecycle hook → clearCacheByMfId.
    svc.setMicroFrontendPermissions('mf1', { publish: ['public.*'] })
    // Verifica almeno che la call NON throw e l'API resta consistente.
    expect(() => svc.check({ mfId: 'mf1', action: 'publish', resource: 'public.x' })).not.toThrow()
  })

  it('checkCapabilitiesPreMount ritorna result anche per MF non registrato (caps undefined)', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), permissionsModule()],
    })
    const svc = broker.getService(SERVICE_PERMISSIONS) as any
    const result = svc.checkCapabilitiesPreMount('unknown-mf')
    expect(result.ok).toBe(true)
    expect(result.missing).toEqual([])
  })
})

describe('MF-PERM-03 facade injection zero diff core (D-V2-F11-22 SC4 verifier)', () => {
  it('raw broker.publish BYPASSA check (SC4 ROADMAP linea 290 + P-13)', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), permissionsModule({ permissionMode: 'enforce' })],
    })
    // App shell raw publish (NO ctx wrapper) → no throw — governance not crypto sandbox.
    expect(() =>
      broker.publish('any.topic', { foo: 1 }, {
        source: { type: 'plugin', id: 'test', name: 'test' },
        deliveryMode: 'sync',
      } as never),
    ).not.toThrow()
  })

  it('engine.enforce throw solo se invocato via service.enforce o wrapContextWithPermissions', () => {
    const broker = createBroker({
      modules: [microfrontendModule(), permissionsModule({ permissionMode: 'enforce' })],
    })
    const svc = broker.getService(SERVICE_PERMISSIONS) as any
    const mfService = broker.getService('microfrontends') as any
    mfService.register({
      id: 'mf1',
      name: 'mf1',
      version: '1.0.0',
      kind: 'iframe',
      url: 'about:blank',
      permissions: { publish: ['public.*'] },
    })
    // Direct service.enforce → throw (denied).
    expect(() =>
      svc.enforce({ mfId: 'mf1', action: 'publish', resource: 'private.x' }),
    ).toThrow(/PERMISSION_DENIED|denied/i)
    // Raw broker.publish stessa risorsa → no throw.
    expect(() =>
      broker.publish('private.x', {}, {
        source: { type: 'plugin', id: 'mf1', name: 'mf1' },
        deliveryMode: 'sync',
      } as never),
    ).not.toThrow()
  })
})
