/**
 * Tier-1 unit test — Permission engine sync + 10 actions + 3 mode dispatch.
 *
 * Copertura: D-V2-F11-03 single engine 10 actions, D-V2-F11-14 fail-secure
 * deny-all default, D-V2-F11-15 3 modes dispatch (off/warn/enforce), MF-PERM-06
 * LRU cache hit/invalidation.
 *
 * @see packages/permissions/src/permission-engine.ts
 */
import { createBroker } from '@gluezero/core'
import { microfrontendModule, type MicroFrontendsService } from '@gluezero/microfrontends'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lruClearAll } from '../lru-cache'
import { createPermissionEngine } from '../permission-engine'

async function setup(mode: 'off' | 'warn' | 'enforce' = 'enforce') {
  const broker = createBroker({ modules: [microfrontendModule()] })
  const mfService = broker.getService('microfrontends') as MicroFrontendsService
  const engine = createPermissionEngine(broker, mfService, mode)
  return { broker, mfService, engine }
}

beforeEach(() => {
  lruClearAll()
  vi.restoreAllMocks()
})

describe('createPermissionEngine — check (sync + LRU cache MF-PERM-06)', () => {
  it('allow simple: publish customer.* matcha customer.order', async () => {
    const { mfService, engine } = await setup('enforce')
    await mfService.register({
      id: 'mf1',
      name: 'MF 1',
      version: '1.0.0',
      loader: { type: 'mock' },
      permissions: { publish: ['customer.*'] },
    } as never)
    expect(engine.check({ mfId: 'mf1', action: 'publish', resource: 'customer.order' })).toBe(true)
  })

  it('deny-wins: publish !customer.pii.* prevale su allow customer.*', async () => {
    const { mfService, engine } = await setup('enforce')
    await mfService.register({
      id: 'mf1',
      name: 'MF 1',
      version: '1.0.0',
      loader: { type: 'mock' },
      permissions: { publish: ['customer.*', '!customer.pii.*'] },
    } as never)
    expect(
      engine.check({ mfId: 'mf1', action: 'publish', resource: 'customer.pii.email' }),
    ).toBe(false)
  })

  it('MF senza permissions → fail-secure deny-all (D-V2-F11-14)', async () => {
    const { mfService, engine } = await setup('enforce')
    await mfService.register({
      id: 'mf1',
      name: 'MF 1',
      version: '1.0.0',
      loader: { type: 'mock' },
    } as never)
    expect(engine.check({ mfId: 'mf1', action: 'publish', resource: 'anything' })).toBe(false)
  })

  it('cache hit: secondo call ritorna senza re-evaluate', async () => {
    const { mfService, engine } = await setup('enforce')
    await mfService.register({
      id: 'mf1',
      name: 'MF 1',
      version: '1.0.0',
      loader: { type: 'mock' },
      permissions: { publish: ['customer.*'] },
    } as never)
    const r1 = engine.check({ mfId: 'mf1', action: 'publish', resource: 'customer.order' })
    const spy = vi.spyOn(mfService, 'get')
    const r2 = engine.check({ mfId: 'mf1', action: 'publish', resource: 'customer.order' })
    expect(r1).toBe(r2)
    expect(spy).not.toHaveBeenCalled() // cache hit → NO mfService.get
  })

  it('cache invalidation: clearCacheByMfId rimuove entries mf1', async () => {
    const { mfService, engine } = await setup('enforce')
    await mfService.register({
      id: 'mf1',
      name: 'MF 1',
      version: '1.0.0',
      loader: { type: 'mock' },
      permissions: { publish: ['customer.*'] },
    } as never)
    engine.check({ mfId: 'mf1', action: 'publish', resource: 'X' })
    const removed = engine.clearCacheByMfId('mf1')
    expect(removed).toBeGreaterThan(0)
  })

  it('10 actions discriminator: tutte categorie accettate', async () => {
    const { mfService, engine } = await setup('enforce')
    await mfService.register({
      id: 'mf1',
      name: 'MF 1',
      version: '1.0.0',
      loader: { type: 'mock' },
      permissions: {
        publish: ['*'],
        subscribe: ['*'],
        route: ['*'],
        gateway: ['*'],
        worker: ['*'],
        context: ['*'],
        storage: ['*'],
        theme: ['*'],
        devtools: ['*'],
      },
    } as never)
    const actions = [
      'publish',
      'subscribe',
      'route',
      'gateway',
      'worker',
      'context.read',
      'context.write',
      'storage.read',
      'storage.write',
      'theme',
      'devtools',
    ] as const
    for (const a of actions) {
      expect(engine.check({ mfId: 'mf1', action: a, resource: 'X' })).toBe(true)
    }
  })

  it('context.read/context.write collapsano a category context', async () => {
    const { mfService, engine } = await setup('enforce')
    await mfService.register({
      id: 'mf1',
      name: 'MF 1',
      version: '1.0.0',
      loader: { type: 'mock' },
      permissions: { context: ['user.profile.*'] },
    } as never)
    expect(
      engine.check({ mfId: 'mf1', action: 'context.read', resource: 'user.profile.name' }),
    ).toBe(true)
    expect(
      engine.check({ mfId: 'mf1', action: 'context.write', resource: 'user.profile.email' }),
    ).toBe(true)
    expect(engine.check({ mfId: 'mf1', action: 'context.read', resource: 'system.config' })).toBe(
      false,
    )
  })

  it('storage.read/storage.write collapsano a category storage', async () => {
    const { mfService, engine } = await setup('enforce')
    await mfService.register({
      id: 'mf1',
      name: 'MF 1',
      version: '1.0.0',
      loader: { type: 'mock' },
      permissions: { storage: ['cache.*'] },
    } as never)
    expect(engine.check({ mfId: 'mf1', action: 'storage.read', resource: 'cache.users' })).toBe(
      true,
    )
    expect(
      engine.check({ mfId: 'mf1', action: 'storage.write', resource: 'cache.orders' }),
    ).toBe(true)
    expect(engine.check({ mfId: 'mf1', action: 'storage.read', resource: 'db.secrets' })).toBe(
      false,
    )
  })
})

describe('createPermissionEngine — enforce mode dispatch (MF-PERM-05)', () => {
  it('mode off: enforce() no-op (NO topic, NO throw, NO warn)', async () => {
    const { broker, mfService, engine } = await setup('off')
    await mfService.register({
      id: 'mf1',
      name: 'MF 1',
      version: '1.0.0',
      loader: { type: 'mock' },
    } as never)
    const handler = vi.fn()
    broker.subscribe('permission.denied', handler)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() =>
      engine.enforce({ mfId: 'mf1', action: 'publish', resource: 'X' }),
    ).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('mode warn denied: 2 topics + console.warn + NO throw (D-V2-F11-15)', async () => {
    const { broker, mfService, engine } = await setup('warn')
    await mfService.register({
      id: 'mf1',
      name: 'MF 1',
      version: '1.0.0',
      loader: { type: 'mock' },
    } as never)
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    broker.subscribe('permission.denied', handler1)
    broker.subscribe('microfrontend.permission.denied', handler2)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() =>
      engine.enforce({ mfId: 'mf1', action: 'publish', resource: 'X' }),
    ).not.toThrow()
    expect(handler1).toHaveBeenCalledOnce()
    expect(handler2).toHaveBeenCalledOnce()
    expect(warnSpy).toHaveBeenCalled()
  })

  it('mode enforce denied: 2 topics + THROW PermissionError', async () => {
    const { broker, mfService, engine } = await setup('enforce')
    await mfService.register({
      id: 'mf1',
      name: 'MF 1',
      version: '1.0.0',
      loader: { type: 'mock' },
    } as never)
    const handler = vi.fn()
    broker.subscribe('permission.denied', handler)
    let thrown: unknown
    try {
      engine.enforce({ mfId: 'mf1', action: 'publish', resource: 'X' })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeDefined()
    const err = thrown as { code: string; category: string; details: unknown }
    expect(err.code).toBe('PERMISSION_DENIED')
    expect(err.category).toBe('microfrontend')
    expect(err.details).toMatchObject({
      microFrontendId: 'mf1',
      action: 'publish',
      resource: 'X',
    })
    expect(handler).toHaveBeenCalledOnce() // topic publish PRIMA del throw
  })

  it('mode enforce allowed: silent (NO topic, NO throw)', async () => {
    const { broker, mfService, engine } = await setup('enforce')
    await mfService.register({
      id: 'mf1',
      name: 'MF 1',
      version: '1.0.0',
      loader: { type: 'mock' },
      permissions: { publish: ['*'] },
    } as never)
    const handler = vi.fn()
    broker.subscribe('permission.denied', handler)
    expect(() =>
      engine.enforce({ mfId: 'mf1', action: 'publish', resource: 'X' }),
    ).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })
})
