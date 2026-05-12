/**
 * Tier-1 jsdom test suite — `enforcement-points.ts` (OQ-1 + OQ-3).
 *
 * Coverage:
 *
 * - `wrapContextWithPermissions` — immutabilità, raw broker passthrough,
 *   allow/deny flow per publish/subscribe, OQ-1 verification (broker.publish raw bypass).
 * - `wrapServiceWithPermissions` — marker idempotent, audit-grep clean,
 *   tampering-resistant.
 *
 * @see prd_2.0.0.md §19.5
 * @see D-V2-F11-02 amendment A1 (facade-only)
 * @see D-V2-F11-XX amendment A3 (service monkey-patch idempotent)
 */
import type { Broker } from '@gluezero/core'
import { createBroker } from '@gluezero/core'
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import { microfrontendModule } from '@gluezero/microfrontends'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { wrapContextWithPermissions, wrapServiceWithPermissions } from '../enforcement-points'
import { lruClearAll } from '../lru-cache'
import { createPermissionEngine, type PermissionMode } from '../permission-engine'

beforeEach(() => {
  lruClearAll()
  vi.restoreAllMocks()
})

function setup(mode: PermissionMode = 'enforce') {
  const broker = createBroker({ modules: [microfrontendModule()] })
  const mfService = broker.getService<MicroFrontendsService>('microfrontends') as MicroFrontendsService
  const engine = createPermissionEngine(broker, mfService, mode)
  return { broker, mfService, engine }
}

function makeBaseCtx(broker: Broker, id = 'mf1'): {
  ctx: any
  publishSpy: ReturnType<typeof vi.fn>
  subscribeSpy: ReturnType<typeof vi.fn>
} {
  const publishSpy = vi.fn()
  const subscribeSpy = vi.fn(() => ({ unsubscribe() {} }))
  const ctx = {
    id,
    descriptor: { id, name: id, version: '1.0.0', kind: 'iframe', url: 'about:blank' },
    broker,
    publish: publishSpy,
    subscribe: subscribeSpy,
  }
  return { ctx, publishSpy, subscribeSpy }
}

describe('wrapContextWithPermissions (OQ-1 facade composition esterna)', () => {
  it('ritorna NEW oggetto, NON muta baseCtx', () => {
    const { broker, engine } = setup()
    const { ctx } = makeBaseCtx(broker)
    const wrapped = wrapContextWithPermissions(ctx, engine)
    expect(wrapped).not.toBe(ctx)
    expect(wrapped.id).toBe('mf1')
  })

  it('preserva ctx.broker raw passthrough (SC4 ROADMAP linea 290 + P-13)', () => {
    const { broker, engine } = setup()
    const { ctx } = makeBaseCtx(broker)
    const wrapped = wrapContextWithPermissions(ctx, engine)
    expect(wrapped.broker).toBe(broker)
  })

  it('preserva ctx.descriptor + altri field via spread', () => {
    const { broker, engine } = setup()
    const { ctx } = makeBaseCtx(broker, 'mf-special')
    const wrapped = wrapContextWithPermissions(ctx, engine)
    expect(wrapped.id).toBe('mf-special')
    expect((wrapped as any).descriptor).toBe(ctx.descriptor)
  })

  it('ctx.publish allowed → invoca baseCtx.publish con args originali', () => {
    const { broker, mfService, engine } = setup('enforce')
    mfService.register({
      id: 'mf1',
      name: 'mf1',
      version: '1.0.0',
      kind: 'iframe',
      url: 'about:blank',
      permissions: { publish: ['customer.*'] },
    } as never)
    const { ctx, publishSpy } = makeBaseCtx(broker)
    const wrapped = wrapContextWithPermissions(ctx, engine)
    wrapped.publish('customer.order.created', { foo: 'bar' })
    expect(publishSpy).toHaveBeenCalledWith('customer.order.created', { foo: 'bar' }, undefined)
  })

  it('ctx.publish denied mode enforce → throw PermissionError + NON invoca baseCtx.publish', () => {
    const { broker, mfService, engine } = setup('enforce')
    mfService.register({
      id: 'mf1',
      name: 'mf1',
      version: '1.0.0',
      kind: 'iframe',
      url: 'about:blank',
      permissions: { publish: ['customer.*', '!customer.pii.*'] },
    } as never)
    const { ctx, publishSpy } = makeBaseCtx(broker)
    const wrapped = wrapContextWithPermissions(ctx, engine)
    expect(() => wrapped.publish('customer.pii.email', {} as never)).toThrow(
      /PERMISSION_DENIED|denied/i,
    )
    expect(publishSpy).not.toHaveBeenCalled()
  })

  it('ctx.subscribe denied mode enforce → throw + NON registra subscription', () => {
    const { broker, mfService, engine } = setup('enforce')
    mfService.register({
      id: 'mf1',
      name: 'mf1',
      version: '1.0.0',
      kind: 'iframe',
      url: 'about:blank',
      permissions: { subscribe: ['public.*'] },
    } as never)
    const { ctx, subscribeSpy } = makeBaseCtx(broker)
    const wrapped = wrapContextWithPermissions(ctx, engine)
    expect(() => wrapped.subscribe('private.secret', () => {})).toThrow(/PERMISSION_DENIED|denied/i)
    expect(subscribeSpy).not.toHaveBeenCalled()
  })

  it('ctx.publish denied mode warn → emit topic + console.warn + INVOCA baseCtx.publish', () => {
    // D-V2-F11-15 warn mode telemetry: NO throw, MA il `engine.enforce` in warn
    // mode NON throw, quindi la call delegate procede regolarmente.
    const { broker, mfService, engine } = setup('warn')
    mfService.register({
      id: 'mf1',
      name: 'mf1',
      version: '1.0.0',
      kind: 'iframe',
      url: 'about:blank',
      permissions: { publish: ['customer.*'] },
    } as never)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { ctx, publishSpy } = makeBaseCtx(broker)
    const wrapped = wrapContextWithPermissions(ctx, engine)
    expect(() => wrapped.publish('private.secret', {} as never)).not.toThrow()
    expect(warnSpy).toHaveBeenCalled()
    expect(publishSpy).toHaveBeenCalled()
  })

  it('OQ-1 verification: raw broker.publish BYPASSA check (SC4 + P-13)', () => {
    const { broker } = setup('enforce')
    // Nessuna registrazione MF, nessun wrap. Raw broker.publish → no throw
    // (governance not crypto sandbox — P-13 README W3 P06).
    expect(() =>
      broker.publish('anything.unrestricted', { foo: 1 }, {
        source: { type: 'plugin', id: 'test', name: 'test' },
        deliveryMode: 'sync',
      } as never),
    ).not.toThrow()
  })
})

describe('wrapServiceWithPermissions (OQ-3 monkey-patch idempotent)', () => {
  it('marker __permissionsServicePatched applicato post-call', () => {
    const { mfService, engine } = setup()
    wrapServiceWithPermissions(mfService, engine)
    expect((mfService as any).__permissionsServicePatched).toBe(true)
  })

  it('idempotente: chiamata 2x NON re-patcha (stessa ref wrapper)', () => {
    const { mfService, engine } = setup()
    const originalBootstrap = (mfService as any).bootstrap
    wrapServiceWithPermissions(mfService, engine)
    const firstPatch = (mfService as any).bootstrap
    wrapServiceWithPermissions(mfService, engine)
    const secondPatch = (mfService as any).bootstrap
    expect(firstPatch).toBe(secondPatch) // stesso ref → no re-patch
    expect(firstPatch).not.toBe(originalBootstrap) // patched once
  })

  it('marker NON enumerable (audit-grep + JSON.stringify clean)', () => {
    const { mfService, engine } = setup()
    wrapServiceWithPermissions(mfService, engine)
    expect(Object.keys(mfService as any)).not.toContain('__permissionsServicePatched')
    const descriptor = Object.getOwnPropertyDescriptor(mfService, '__permissionsServicePatched')
    expect(descriptor?.enumerable).toBe(false)
    expect(descriptor?.writable).toBe(false)
    expect(descriptor?.configurable).toBe(false)
  })

  it('marker tampering-resistant (delete throws strict, no-op non-strict)', () => {
    const { mfService, engine } = setup()
    wrapServiceWithPermissions(mfService, engine)
    // configurable:false → delete è no-op (strict mode → throw, non-strict → silent fail).
    // Verifichiamo solo che il marker resta presente dopo tentativo delete.
    try {
      delete (mfService as any).__permissionsServicePatched
    } catch {
      /* TypeError in strict mode — atteso */
    }
    expect((mfService as any).__permissionsServicePatched).toBe(true)
  })

  it('lifecycle methods (bootstrap/mount/unmount/destroy) wrappati con preserve signature', () => {
    const { mfService, engine } = setup()
    const orig = {
      bootstrap: (mfService as any).bootstrap,
      mount: (mfService as any).mount,
      unmount: (mfService as any).unmount,
      destroy: (mfService as any).destroy,
    }
    wrapServiceWithPermissions(mfService, engine)
    // Tutti i 4 wrapper sono function diverse dagli originali.
    expect((mfService as any).bootstrap).not.toBe(orig.bootstrap)
    expect((mfService as any).mount).not.toBe(orig.mount)
    expect((mfService as any).unmount).not.toBe(orig.unmount)
    expect((mfService as any).destroy).not.toBe(orig.destroy)
    // Tutti i wrapper sono function (signature preserved).
    expect(typeof (mfService as any).bootstrap).toBe('function')
    expect(typeof (mfService as any).mount).toBe('function')
    expect(typeof (mfService as any).unmount).toBe('function')
    expect(typeof (mfService as any).destroy).toBe('function')
  })
})

describe('Audit-grep — NO EventTap / publishInterceptors usage in enforcement-points (OQ-1)', () => {
  it('source file NON referenzia EventTap né publishInterceptors', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    // Vitest sotto jsdom risolve `import.meta.url` come `vite-node:...` (NON `file:`).
    // Calcoliamo il path assoluto del modulo source tramite `process.cwd()` +
    // path repo-relative noto (workspace pnpm filter già cwd nel package).
    const cwd = process.cwd()
    // cwd può essere root monorepo o packages/permissions a seconda del runner.
    const candidates = [
      path.resolve(cwd, 'src/enforcement-points.ts'),
      path.resolve(cwd, 'packages/permissions/src/enforcement-points.ts'),
    ]
    let src = ''
    for (const p of candidates) {
      try {
        src = await fs.readFile(p, 'utf8')
        break
      } catch {
        /* try next */
      }
    }
    expect(src.length).toBeGreaterThan(0)
    // Permettiamo il match in JSDoc comment (riferimento storico). Cerchiamo
    // l'assenza nel code body — proxy: nessuna invocation pattern.
    expect(src).not.toMatch(/broker\.publishInterceptors|registerInterceptor|EventTap\(/)
  })
})
