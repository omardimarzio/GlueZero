/**
 * Tier-1 jsdom — `ss-loader.ts` singleSpaLoader F8 LoaderAdapter + lifecycle mapping
 * bit-exact (PRD §27.4) + 4 error code paths (D-V2-F15-11/12).
 */
import type { Broker } from '@gluezero/core'
import type {
  LoaderContext,
  MicroFrontendDescriptor,
  MicroFrontendRuntimeContext,
} from '@gluezero/microfrontends'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MfSingleSpaError } from '../errors'
import { __setMountContainerForTests, singleSpaLoader } from '../ss-loader'
import type { SingleSpaApp, SingleSpaLoaderDefinition } from '../types/descriptor'

function makeBroker(): Broker {
  return {
    publish: vi.fn(),
    subscribe: vi.fn(),
  } as unknown as Broker
}

function makeCtx(overrides: Partial<LoaderContext> = {}): LoaderContext {
  const descriptor: MicroFrontendDescriptor = {
    id: 'mf-test',
    name: 'Test',
    version: '1.0.0',
    loader: { type: 'single-spa' },
  } as MicroFrontendDescriptor
  return {
    broker: makeBroker(),
    descriptor,
    ...overrides,
  }
}

function makeRuntimeCtx(
  ctx: LoaderContext,
  overrides: Partial<MicroFrontendRuntimeContext> = {},
): MicroFrontendRuntimeContext {
  return {
    id: ctx.descriptor.id,
    descriptor: ctx.descriptor,
    broker: ctx.broker,
    publish: vi.fn(),
    subscribe: vi.fn(),
    ...overrides,
  } as unknown as MicroFrontendRuntimeContext
}

function makeApp(
  overrides: Partial<SingleSpaApp> = {},
): SingleSpaApp {
  return {
    bootstrap: vi.fn(() => Promise.resolve()),
    mount: vi.fn(() => Promise.resolve()),
    unmount: vi.fn(() => Promise.resolve()),
    ...overrides,
  }
}

function makeDef(
  module: SingleSpaLoaderDefinition['module'],
  overrides: Partial<SingleSpaLoaderDefinition> = {},
): SingleSpaLoaderDefinition {
  return {
    type: 'single-spa',
    module,
    ...overrides,
  }
}

describe('singleSpaLoader — D-V2-F15-11 + REQ MF-SS-01', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('singleSpaLoader.type === "single-spa"', () => {
    expect(singleSpaLoader.type).toBe('single-spa')
    expect(typeof singleSpaLoader.load).toBe('function')
  })

  it('happy path — module callable + lifecycle mapping bit-exact', async () => {
    const app = makeApp()
    const def = makeDef(() => Promise.resolve(app), { appName: 'navbar' })
    const ctx = makeCtx()
    const result = await singleSpaLoader.load(def, ctx)
    expect(result.module).toBe(app)
    expect(typeof result.lifecycle.bootstrap).toBe('function')
    expect(typeof result.lifecycle.mount).toBe('function')
    expect(typeof result.lifecycle.unmount).toBe('function')
    expect(result.metadata).toMatchObject({
      appName: 'navbar',
      hasUpdate: false,
    })
  })

  it('happy path — module inline object (no callable)', async () => {
    const app = makeApp()
    const def = makeDef(app)
    const ctx = makeCtx()
    const result = await singleSpaLoader.load(def, ctx)
    expect(result.module).toBe(app)
  })

  it('bootstrap mapping + topic emit pre/post bootstrap (governance)', async () => {
    const app = makeApp()
    const def = makeDef(() => Promise.resolve(app), { appName: 'navbar' })
    const ctx = makeCtx()
    const result = await singleSpaLoader.load(def, ctx)
    const runtimeCtx = makeRuntimeCtx(ctx)
    await result.lifecycle.bootstrap!(runtimeCtx)
    expect(app.bootstrap).toHaveBeenCalledOnce()
    expect(ctx.broker.publish).toHaveBeenCalledWith(
      'microfrontend.lifecycle.bootstrap.started',
      expect.objectContaining({ mfId: 'mf-test', appName: 'navbar' }),
    )
    expect(ctx.broker.publish).toHaveBeenCalledWith(
      'microfrontend.lifecycle.bootstrap.completed',
      expect.objectContaining({ mfId: 'mf-test', appName: 'navbar' }),
    )
  })

  it('mount mapping + container propagato via ssProps.domElement', async () => {
    const mountFn = vi.fn((props: Record<string, unknown>) => {
      // Verify ssProps shape
      expect(props['domElement']).toBeInstanceOf(HTMLElement)
      expect(props['name']).toBeDefined()
      expect(props['customProps']).toEqual({})
      // singleSpa + mountParcel intenzionalmente esclusi
      expect(props['singleSpa']).toBeUndefined()
      expect(props['mountParcel']).toBeUndefined()
      return Promise.resolve()
    })
    const app = makeApp({ mount: mountFn })
    const def = makeDef(app, { appName: 'navbar' })
    const ctx = makeCtx()
    const result = await singleSpaLoader.load(def, ctx)
    const runtimeCtx = makeRuntimeCtx(ctx)
    const container = document.createElement('div')
    __setMountContainerForTests(runtimeCtx, container)
    await result.lifecycle.mount!(runtimeCtx)
    expect(mountFn).toHaveBeenCalledOnce()
    expect(mountFn.mock.calls[0]?.[0]?.['domElement']).toBe(container)
    expect(mountFn.mock.calls[0]?.[0]?.['name']).toBe('navbar')
  })

  it('unmount mapping + topic emit + cleanup container', async () => {
    const app = makeApp()
    const def = makeDef(app, { appName: 'navbar' })
    const ctx = makeCtx()
    const result = await singleSpaLoader.load(def, ctx)
    const runtimeCtx = makeRuntimeCtx(ctx)
    await result.lifecycle.unmount!(runtimeCtx)
    expect(app.unmount).toHaveBeenCalledOnce()
    expect(ctx.broker.publish).toHaveBeenCalledWith(
      'microfrontend.lifecycle.unmount.started',
      expect.any(Object),
    )
    expect(ctx.broker.publish).toHaveBeenCalledWith(
      'microfrontend.lifecycle.unmount.completed',
      expect.any(Object),
    )
  })

  it('bootstrap throw — wrap MF_SS_BOOTSTRAP_FAILED + originalError + topic failed', async () => {
    const original = new Error('user bootstrap rejected')
    const app = makeApp({ bootstrap: () => Promise.reject(original) })
    const def = makeDef(app, { appName: 'navbar' })
    const ctx = makeCtx()
    const result = await singleSpaLoader.load(def, ctx)
    const runtimeCtx = makeRuntimeCtx(ctx)
    try {
      await result.lifecycle.bootstrap!(runtimeCtx)
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MfSingleSpaError)
      const e = err as MfSingleSpaError
      expect(e.code).toBe('MF_SS_BOOTSTRAP_FAILED')
      expect(e.originalError).toBe(original)
    }
    expect(ctx.broker.publish).toHaveBeenCalledWith(
      'microfrontend.lifecycle.bootstrap.failed',
      expect.any(Object),
    )
  })

  it('mount throw — wrap MF_SS_MOUNT_FAILED', async () => {
    const original = new Error('user mount rejected')
    const app = makeApp({ mount: () => Promise.reject(original) })
    const def = makeDef(app)
    const ctx = makeCtx()
    const result = await singleSpaLoader.load(def, ctx)
    const runtimeCtx = makeRuntimeCtx(ctx)
    try {
      await result.lifecycle.mount!(runtimeCtx)
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as MfSingleSpaError).code).toBe('MF_SS_MOUNT_FAILED')
    }
  })

  it('unmount throw — wrap MF_SS_UNMOUNT_FAILED', async () => {
    const original = new Error('user unmount rejected')
    const app = makeApp({ unmount: () => Promise.reject(original) })
    const def = makeDef(app)
    const ctx = makeCtx()
    const result = await singleSpaLoader.load(def, ctx)
    const runtimeCtx = makeRuntimeCtx(ctx)
    try {
      await result.lifecycle.unmount!(runtimeCtx)
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as MfSingleSpaError).code).toBe('MF_SS_UNMOUNT_FAILED')
    }
  })

  it('lifecycle array of functions — Promise.all parallel exec (single-spa 5.9+)', async () => {
    const fn1 = vi.fn(() => Promise.resolve())
    const fn2 = vi.fn(() => Promise.resolve())
    const app: SingleSpaApp = {
      bootstrap: vi.fn(() => Promise.resolve()),
      mount: [fn1, fn2],
      unmount: vi.fn(() => Promise.resolve()),
    }
    const def = makeDef(app)
    const ctx = makeCtx()
    const result = await singleSpaLoader.load(def, ctx)
    const runtimeCtx = makeRuntimeCtx(ctx)
    await result.lifecycle.mount!(runtimeCtx)
    expect(fn1).toHaveBeenCalledOnce()
    expect(fn2).toHaveBeenCalledOnce()
  })

  it('lifecycle invalid (no mount) — throw MF_SS_LIFECYCLE_INVALID', async () => {
    const invalid = { bootstrap: () => Promise.resolve(), unmount: () => Promise.resolve() }
    const def = makeDef(() => Promise.resolve(invalid))
    try {
      await singleSpaLoader.load(def, makeCtx())
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as MfSingleSpaError).code).toBe('MF_SS_LIFECYCLE_INVALID')
      expect((err as MfSingleSpaError).details).toMatchObject({
        hasLifecycle: { bootstrap: true, mount: false, unmount: true },
      })
    }
  })

  it('lifecycle field non-function non-array — throw MF_SS_LIFECYCLE_INVALID', async () => {
    const invalid = {
      bootstrap: () => Promise.resolve(),
      mount: 'not-a-function',
      unmount: () => Promise.resolve(),
    }
    const def = makeDef(() => Promise.resolve(invalid))
    try {
      await singleSpaLoader.load(def, makeCtx())
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as MfSingleSpaError).code).toBe('MF_SS_LIFECYCLE_INVALID')
    }
  })

  it('module() rejection — throw MF_SS_LIFECYCLE_INVALID con originalError', async () => {
    const original = new Error('network failure dynamic import')
    const def = makeDef(() => Promise.reject(original))
    try {
      await singleSpaLoader.load(def, makeCtx())
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as MfSingleSpaError).code).toBe('MF_SS_LIFECYCLE_INVALID')
      expect((err as MfSingleSpaError).originalError).toBe(original)
    }
  })

  it('module field undefined/null/primitive — throw MF_SS_LIFECYCLE_INVALID', async () => {
    const def = makeDef(null as unknown as () => Promise<unknown>)
    try {
      await singleSpaLoader.load(def, makeCtx())
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as MfSingleSpaError).code).toBe('MF_SS_LIFECYCLE_INVALID')
    }
  })

  it('appName default fallback su ctx.descriptor.id quando omesso', async () => {
    const app = makeApp()
    const def = makeDef(app) // NO appName
    const ctx = makeCtx()
    const result = await singleSpaLoader.load(def, ctx)
    const runtimeCtx = makeRuntimeCtx(ctx)
    await result.lifecycle.bootstrap!(runtimeCtx)
    expect(app.bootstrap).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'mf-test' }), // fallback descriptor.id
    )
  })

  it('NO router replacement enforcement (REQ MF-SS-01) — ssProps NON include singleSpa', async () => {
    const mountFn = vi.fn((props: Record<string, unknown>) => {
      expect(props['singleSpa']).toBeUndefined()
      expect(props['mountParcel']).toBeUndefined()
      return Promise.resolve()
    })
    const app = makeApp({ mount: mountFn })
    const def = makeDef(app)
    const ctx = makeCtx()
    const result = await singleSpaLoader.load(def, ctx)
    await result.lifecycle.mount!(makeRuntimeCtx(ctx))
    expect(mountFn).toHaveBeenCalled()
  })

  it('LoadedModule shape compliance — module + lifecycle + metadata', async () => {
    const app = makeApp({ update: vi.fn(() => Promise.resolve()) })
    const def = makeDef(app, { appName: 'foo' })
    const result = await singleSpaLoader.load(def, makeCtx())
    expect(result).toHaveProperty('module')
    expect(result).toHaveProperty('lifecycle')
    expect(result).toHaveProperty('metadata')
    expect(result.metadata).toMatchObject({
      appName: 'foo',
      hasUpdate: true,
      lifecycleArrayBootstrap: false,
      lifecycleArrayMount: false,
      lifecycleArrayUnmount: false,
    })
  })
})
