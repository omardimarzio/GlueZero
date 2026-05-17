/**
 * Tier-1 jsdom — `mf-loader.ts` moduleFederationLoader F8 LoaderAdapter contract +
 * happy path + 5 error code paths (REQ MF-MF-02 + D-V2-F15-09/10).
 *
 * Strategy: mock MF Runtime peer via `__injectMfRuntimeForTests` per evitare real
 * `@module-federation/runtime` peer install + cross-test isolation via
 * `__resetModuleFederationLoaderForTests`.
 */
import type { Broker } from '@gluezero/core'
import type { LoaderContext, MicroFrontendDescriptor } from '@gluezero/microfrontends'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MfModuleFederationError } from '../errors'
import {
  __injectMfRuntimeForTests,
  __resetModuleFederationLoaderForTests,
  moduleFederationLoader,
} from '../mf-loader'
import type { ModuleFederationLoaderDefinition } from '../types/descriptor'

interface MockMfRuntime {
  readonly init: ReturnType<typeof vi.fn>
  readonly loadRemote: ReturnType<typeof vi.fn>
  readonly __VERSION__?: string
}

function makeMockMfRuntime(loadRemoteImpl: (key: string) => Promise<unknown>): MockMfRuntime {
  return {
    init: vi.fn(),
    loadRemote: vi.fn(loadRemoteImpl),
    __VERSION__: '2.4.0',
  }
}

function makeCtx(overrides: Partial<LoaderContext> = {}): LoaderContext {
  const descriptor: MicroFrontendDescriptor = {
    id: 'mf-test',
    name: 'Test MF',
    version: '1.0.0',
    loader: { type: 'module-federation' },
  } as MicroFrontendDescriptor
  return {
    broker: { publish: vi.fn(), subscribe: vi.fn() } as unknown as Broker,
    descriptor,
    ...overrides,
  }
}

function makeDef(
  overrides: Partial<ModuleFederationLoaderDefinition> = {},
): ModuleFederationLoaderDefinition {
  return {
    type: 'module-federation',
    scope: 'customerApp',
    module: './Dashboard',
    url: 'https://cdn.example/remoteEntry.js',
    ...overrides,
  }
}

describe('moduleFederationLoader — D-V2-F15-09 + REQ MF-MF-02', () => {
  beforeEach(() => {
    __resetModuleFederationLoaderForTests()
  })

  afterEach(() => {
    __resetModuleFederationLoaderForTests()
    vi.restoreAllMocks()
  })

  it('moduleFederationLoader.type === "module-federation"', () => {
    expect(moduleFederationLoader.type).toBe('module-federation')
    expect(typeof moduleFederationLoader.load).toBe('function')
  })

  it('happy path — init + loadRemote + factory normalize (default export)', async () => {
    const factory = {
      default: {
        mount: vi.fn(() => Promise.resolve()),
        unmount: vi.fn(() => Promise.resolve()),
      },
    }
    __injectMfRuntimeForTests(makeMockMfRuntime(async () => factory))
    const result = await moduleFederationLoader.load(makeDef(), makeCtx())
    expect(result.module).toBe(factory)
    expect(typeof result.lifecycle.mount).toBe('function')
    expect(typeof result.lifecycle.unmount).toBe('function')
    expect(result.metadata).toMatchObject({
      scope: 'customerApp',
      module: './Dashboard',
      url: 'https://cdn.example/remoteEntry.js',
      remoteKey: 'customerApp/./Dashboard',
      mfRuntimeVersion: '2.4.0',
    })
  })

  it('init() idempotent — re-call stesso scope/url evita double-init', async () => {
    const factory = { default: { mount: () => Promise.resolve() } }
    const mock = makeMockMfRuntime(async () => factory)
    __injectMfRuntimeForTests(mock)
    await moduleFederationLoader.load(makeDef(), makeCtx())
    await moduleFederationLoader.load(makeDef(), makeCtx())
    // 2 loadRemote ma init() chiamato solo 1× (initializedScopes cache)
    expect(mock.init).toHaveBeenCalledTimes(1)
    expect(mock.loadRemote).toHaveBeenCalledTimes(2)
  })

  it('scope missing — throw MF_REMOTE_ENTRY_LOAD_FAILED', async () => {
    await expect(
      moduleFederationLoader.load(makeDef({ scope: '' as string }), makeCtx()),
    ).rejects.toThrow(MfModuleFederationError)
    try {
      await moduleFederationLoader.load(makeDef({ scope: '' as string }), makeCtx())
    } catch (err) {
      expect((err as MfModuleFederationError).code).toBe('MF_REMOTE_ENTRY_LOAD_FAILED')
    }
  })

  it('module missing — throw MF_REMOTE_ENTRY_LOAD_FAILED', async () => {
    try {
      await moduleFederationLoader.load(makeDef({ module: '' as string }), makeCtx())
    } catch (err) {
      expect((err as MfModuleFederationError).code).toBe('MF_REMOTE_ENTRY_LOAD_FAILED')
    }
  })

  it('url missing — throw MF_REMOTE_ENTRY_LOAD_FAILED', async () => {
    try {
      await moduleFederationLoader.load(makeDef({ url: '' as string }), makeCtx())
    } catch (err) {
      expect((err as MfModuleFederationError).code).toBe('MF_REMOTE_ENTRY_LOAD_FAILED')
    }
  })

  it('init() throw — throw MF_REMOTE_ENTRY_LOAD_FAILED + originalError preservato', async () => {
    const initErr = new Error('remoteEntry.js 404')
    __injectMfRuntimeForTests({
      init: vi.fn(() => {
        throw initErr
      }),
      loadRemote: vi.fn(),
      __VERSION__: '2.4.0',
    })
    try {
      await moduleFederationLoader.load(makeDef(), makeCtx())
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(MfModuleFederationError)
      expect((err as MfModuleFederationError).code).toBe('MF_REMOTE_ENTRY_LOAD_FAILED')
      expect((err as MfModuleFederationError).originalError).toBe(initErr)
    }
  })

  it('loadRemote scope-not-found — mapping MF_REMOTE_SCOPE_NOT_FOUND', async () => {
    __injectMfRuntimeForTests({
      init: vi.fn(),
      loadRemote: vi.fn(() => Promise.reject(new Error('scope unknownScope not found'))),
      __VERSION__: '2.4.0',
    })
    try {
      await moduleFederationLoader.load(makeDef({ scope: 'unknownScope' }), makeCtx())
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as MfModuleFederationError).code).toBe('MF_REMOTE_SCOPE_NOT_FOUND')
    }
  })

  it('loadRemote module-not-found — mapping MF_REMOTE_MODULE_NOT_FOUND', async () => {
    __injectMfRuntimeForTests({
      init: vi.fn(),
      loadRemote: vi.fn(() => Promise.reject(new Error('module ./Unknown not found'))),
      __VERSION__: '2.4.0',
    })
    try {
      await moduleFederationLoader.load(makeDef({ module: './Unknown' }), makeCtx())
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as MfModuleFederationError).code).toBe('MF_REMOTE_MODULE_NOT_FOUND')
    }
  })

  it('loadRemote returns null — throw MF_REMOTE_MODULE_NOT_FOUND', async () => {
    __injectMfRuntimeForTests({
      init: vi.fn(),
      loadRemote: vi.fn(async () => null),
      __VERSION__: '2.4.0',
    })
    try {
      await moduleFederationLoader.load(makeDef(), makeCtx())
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as MfModuleFederationError).code).toBe('MF_REMOTE_MODULE_NOT_FOUND')
    }
  })

  it('factory result invalid (no mount) — throw MF_REMOTE_FACTORY_FAILED', async () => {
    __injectMfRuntimeForTests({
      init: vi.fn(),
      loadRemote: vi.fn(async () => ({ someUnrelated: 1 })),
      __VERSION__: '2.4.0',
    })
    try {
      await moduleFederationLoader.load(makeDef(), makeCtx())
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as MfModuleFederationError).code).toBe('MF_REMOTE_FACTORY_FAILED')
    }
  })

  it('share scope passed to init() + compareShareScopes invoked (no throw)', async () => {
    const factory = { default: { mount: () => Promise.resolve() } }
    const mock = makeMockMfRuntime(async () => factory)
    __injectMfRuntimeForTests(mock)
    const def = makeDef({ shared: { react: { requiredVersion: '^18.2.0', singleton: true } } })
    await moduleFederationLoader.load(def, makeCtx())
    expect(mock.init).toHaveBeenCalledWith(
      expect.objectContaining({
        shared: { react: { requiredVersion: '^18.2.0', singleton: true } },
      }),
    )
  })

  it('timeoutMs override propagato + metadata contiene timeoutMs effective', async () => {
    const factory = { default: { mount: () => Promise.resolve() } }
    __injectMfRuntimeForTests(makeMockMfRuntime(async () => factory))
    const result = await moduleFederationLoader.load(makeDef({ timeoutMs: 5000 }), makeCtx())
    expect(result.metadata?.['timeoutMs']).toBe(5000)
  })

  it('exportName explicit propagato a normalize + metadata', async () => {
    const factory = {
      lifecycle: { mount: () => Promise.resolve() },
      default: { other: () => 1 },
    }
    __injectMfRuntimeForTests(makeMockMfRuntime(async () => factory))
    const result = await moduleFederationLoader.load(
      makeDef({ exportName: 'lifecycle' }),
      makeCtx(),
    )
    expect(typeof result.lifecycle.mount).toBe('function')
    expect(result.metadata?.['exportName']).toBe('lifecycle')
  })
})
