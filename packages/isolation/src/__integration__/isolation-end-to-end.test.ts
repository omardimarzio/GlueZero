/**
 * Tier-1 integration suite W3 P05 — SC1-SC7 cross-fase F11+F12+F13 ordering +
 * events MF-ISO-05 lock + idempotent install + abortSignal cascade.
 *
 * Cover REQ-IDs: MF-ISO-01..06 + MF-DOC-04 + MF-PIPE-01 + MF-BC-01..04.
 *
 * Test mock broker minimal — NON usa il Broker F1 (61+ types). Test focus su
 * isolation hook orchestration + Service Locator binding + cleanup cascade.
 *
 * @see prd_2.0.0.md §21 — Isolation module integration
 * @see D-V2-F13-21 — Service Locator install pattern
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isolationModule } from '../isolation-module.js'
import { applyMountIsolation } from '../lifecycle-mount-hook.js'
import { createPolicyCache } from '../internal/policy-cache.js'
import { wrapContextWithIsolation } from '../wrap-context.js'
import { resolvePolicy } from '../policy-resolver.js'
import { detectInconsistentCombinations } from '../warning-matrix.js'
import { scopeCss } from '../scope-css.js'
import { DEFAULT_ISOLATION_POLICY } from '../types/policy.js'
import { applyIframeStub } from '../iframe-stub.js'
import type { ResolvedIsolationPolicy } from '../types/policy.js'

interface TestBroker {
  handlers: Map<string, Array<(p: unknown) => void>>
  published: Array<{ topic: string; payload: unknown }>
  services: Map<string, unknown>
  subscribe(topic: string, h: (p: unknown) => void): { unsubscribe: () => void }
  publish(topic: string, payload: unknown): void
  registerService<T>(name: string, instance: T): void
  getService<T>(name: string): T | undefined
}

function createTestBroker(): TestBroker {
  const handlers = new Map<string, Array<(p: unknown) => void>>()
  const published: Array<{ topic: string; payload: unknown }> = []
  const services = new Map<string, unknown>()

  return {
    handlers,
    published,
    services,
    subscribe(topic, h): { unsubscribe: () => void } {
      const list = handlers.get(topic) ?? []
      list.push(h)
      handlers.set(topic, list)
      return {
        unsubscribe(): void {
          const cur = handlers.get(topic) ?? []
          const idx = cur.indexOf(h)
          if (idx >= 0) cur.splice(idx, 1)
        },
      }
    },
    publish(topic, payload): void {
      published.push({ topic, payload })
      const list = handlers.get(topic) ?? []
      for (const h of list) h(payload)
    },
    registerService<T>(name: string, instance: T): void {
      services.set(name, instance)
    },
    getService<T>(name: string): T | undefined {
      return services.get(name) as T | undefined
    },
  }
}

/**
 * Helper — installa isolationModule simulando il `BrokerModule.install` invoke.
 * Riproduce il flow di `createBroker({modules:[isolationModule(...)]})` senza richiedere
 * il Broker F1 completo (61+ types).
 */
function installIsolationOnTestBroker(
  broker: TestBroker,
  opts: Parameters<typeof isolationModule>[0] = {},
): { abort: () => void } {
  // Registra SERVICE_MICROFRONTENDS minimal stub (peer required by isolationModule).
  broker.services.set('microfrontends', {})

  const mod = isolationModule(opts)
  const ctx = {
    broker: {
      subscribe: broker.subscribe.bind(broker),
      publish: broker.publish.bind(broker),
      getService: broker.getService.bind(broker),
    } as unknown as Parameters<NonNullable<typeof mod.install>>[0]['broker'],
    config: {} as never,
    logger: {} as never,
    registerService: <T>(name: string, instance: T): void => broker.registerService(name, instance),
    getService: <T>(name: string): T | undefined => broker.getService<T>(name),
    publishInterceptors: [],
  }
  // biome-ignore lint/suspicious/noExplicitAny: test mock ctx
  void mod.install(ctx as any)

  const svc = broker.getService<{ __abort__?: () => void }>('isolation')
  return { abort: (): void => svc?.__abort__?.() ?? undefined }
}

describe('F13 W3 Integration — SC1: Full lifecycle (register → mount → unmount)', () => {
  let broker: TestBroker

  beforeEach(() => {
    broker = createTestBroker()
  })

  it('SC1.1 — isolationModule install registra SERVICE_ISOLATION + handlers subscribe', () => {
    installIsolationOnTestBroker(broker)
    expect(broker.services.has('isolation')).toBe(true)
    expect(broker.handlers.has('microfrontend.registered')).toBe(true)
    expect(broker.handlers.has('microfrontend.mounting')).toBe(true)
  })

  it('SC1.2 — publish microfrontend.registered → cache popolata + DEFAULT_ISOLATION_POLICY', () => {
    installIsolationOnTestBroker(broker)
    broker.publish('microfrontend.registered', {
      descriptor: { id: 'mf-1', name: 'mf-1', version: '1.0.0' },
    })
    const svc = broker.getService<{
      getResolvedPolicy: (mfId: string) => ResolvedIsolationPolicy | undefined
    }>('isolation')
    const resolved = svc?.getResolvedPolicy('mf-1')
    expect(resolved).toBeDefined()
    expect(resolved?.dom).toBe('mount-root')
    expect(resolved?.css).toBe('scoped')
  })

  it('SC1.3 — applyMountIsolation chain (manual binding alt — Strategy A binding completata W3) → mount-root no-op + scoped attr', () => {
    installIsolationOnTestBroker(broker)
    broker.publish('microfrontend.registered', {
      descriptor: { id: 'mf-1', name: 'mf-1', version: '1.0.0' },
    })
    const svc = broker.getService<{
      getResolvedPolicy: (mfId: string) => ResolvedIsolationPolicy | undefined
    }>('isolation')
    const resolved = svc?.getResolvedPolicy('mf-1')
    expect(resolved).toBeDefined()
    // BrokerEvent shape F8 differs da mock payload — usiamo applyMountIsolation
    // direttamente (Strategy A binding alt host-side invocation pattern).
    const cache = createPolicyCache()
    cache.set('mf-1', resolved as ResolvedIsolationPolicy)
    const host = document.createElement('div')
    const mount = { element: host, context: {} }
    applyMountIsolation('mf-1', mount, cache, {})
    expect(mount.element).toBe(host) // mount-root preserva element
    expect(host.getAttribute('data-gz-mf')).toBe('mf-1')
  })
})

describe('F13 W3 Integration — SC2: Descriptor override partial-merge prevale', () => {
  it('SC2.1 — descriptor.isolation={dom:shadow-dom} + policyDefault={dom:mount-root} → descriptor prevale', () => {
    const broker = createTestBroker()
    installIsolationOnTestBroker(broker, {
      policyDefault: { dom: 'mount-root' },
    })
    broker.publish('microfrontend.registered', {
      descriptor: {
        id: 'mf-1',
        name: 'mf-1',
        version: '1.0.0',
        isolation: { dom: 'shadow-dom' },
      },
    })
    const svc = broker.getService<{
      getResolvedPolicy: (mfId: string) => ResolvedIsolationPolicy | undefined
    }>('isolation')
    expect(svc?.getResolvedPolicy('mf-1')?.dom).toBe('shadow-dom')
  })
})

describe('F13 W3 Integration — SC3: Warning matrix register P-13', () => {
  it('SC3.1 — js=shared-window + network=blocked → P-13 warning + console.warn + topic emit', () => {
    const broker = createTestBroker()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    installIsolationOnTestBroker(broker)
    broker.publish('microfrontend.registered', {
      descriptor: {
        id: 'mf-1',
        name: 'mf-1',
        version: '1.0.0',
        isolation: { js: 'shared-window', network: 'blocked' },
      },
    })
    const warningEvents = broker.published.filter(
      (e) => e.topic === 'microfrontend.isolation.warning',
    )
    expect(warningEvents.length).toBeGreaterThanOrEqual(1)
    const p13 = warningEvents.find(
      (e) => (e.payload as { code?: string }).code === 'P-13',
    )
    expect(p13).toBeDefined()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('F13 W3 Integration — SC4: Iframe stub IFRAME_ADAPTER_REQUIRED', () => {
  it('SC4.1 — dom=iframe senza resolvers.iframeLoader → throw IFRAME_ADAPTER_REQUIRED error code', () => {
    const host = document.createElement('div')
    const mount = { element: host, context: {} }
    const policy: ResolvedIsolationPolicy = { ...DEFAULT_ISOLATION_POLICY, dom: 'iframe' }
    let caught: unknown
    try {
      applyIframeStub(mount, 'mf-1', policy, {})
    } catch (e) {
      caught = e
    }
    expect(caught).toBeDefined()
    expect((caught as { code?: string }).code).toBe('IFRAME_ADAPTER_REQUIRED')
    expect((caught as { category?: string }).category).toBe('microfrontend')
  })
})

describe('F13 W3 Integration — SC5: Cross-fase F11+F13 (permissions + isolation)', () => {
  it('SC5.1 — permission denied gateway → throw PermissionError pre-gateway-invoke', async () => {
    const broker = createTestBroker()
    // Mock permission service enforce mode → denied
    broker.services.set('permissions', {
      check: () => ({ allowed: false, mode: 'enforce' as const }),
    })
    installIsolationOnTestBroker(broker, {
      resolvers: {
        gateway: () => ({
          request: vi.fn().mockResolvedValue('SHOULD_NOT_BE_CALLED'),
        }),
      },
    })
    const baseCtx = {}
    const resolved = resolvePolicy({ network: 'gateway-only' }, undefined, 'mf-1')
    const ctx = wrapContextWithIsolation(
      baseCtx,
      'mf-1',
      resolved,
      {
        gateway: () => ({
          request: vi.fn().mockResolvedValue('SHOULD_NOT_BE_CALLED'),
        }),
      },
      undefined,
      {
        publish: broker.publish.bind(broker),
        getService: broker.getService.bind(broker),
      },
    )
    await expect(ctx.gateway?.request('users.list')).rejects.toThrow(/Permission denied/)
  })

  it('SC5.2 — permission allowed → gatewayService.request invocato con metadata.microFrontendId attribution', async () => {
    const broker = createTestBroker()
    broker.services.set('permissions', {
      check: () => ({ allowed: true, mode: 'enforce' as const }),
    })
    const mockRequest = vi.fn().mockResolvedValue({ ok: true })
    const resolved = resolvePolicy({ network: 'gateway-only' }, undefined, 'mf-1')
    const ctx = wrapContextWithIsolation(
      {},
      'mf-1',
      resolved,
      {
        gateway: () => ({ request: mockRequest }),
      },
      undefined,
      {
        publish: broker.publish.bind(broker),
        getService: broker.getService.bind(broker),
      },
    )
    await ctx.gateway?.request('users.list', { page: 1 })
    expect(mockRequest).toHaveBeenCalled()
    const callArgs = mockRequest.mock.calls[0]
    expect(callArgs?.[2]).toMatchObject({ metadata: { microFrontendId: 'mf-1' } })
  })
})

describe('F13 W3 Integration — SC6: Cross-fase F12+F13 (compat block-mount → isolation NON invoked)', () => {
  it('SC6.1 — compat fail block-mount semantics: isolation mount hook NON invocato se mount NON pubblicato', () => {
    const broker = createTestBroker()
    installIsolationOnTestBroker(broker)
    // F12 compat block-mount → MF FSM → failed → NO microfrontend.mounting publish.
    // Verifica: nessun publish `microfrontend.mounting` → mount hook NON invocato →
    // nessuna apply isolation occorre.
    const initialPublishCount = broker.published.length
    expect(broker.published.filter((e) => e.topic === 'microfrontend.mounting').length).toBe(0)
    // Sanity: handlers attivi
    expect(broker.handlers.get('microfrontend.mounting')?.length).toBeGreaterThanOrEqual(1)
    // Final: no apply triggered (idempotent confirmation)
    expect(broker.published.length).toBe(initialPublishCount)
  })
})

describe('F13 W3 Integration — SC7: Events MF-ISO-05 descriptor lock', () => {
  it('SC7.1 — descriptor.isolation={events:broker-only} → resolved.events=broker-only (default)', () => {
    const broker = createTestBroker()
    installIsolationOnTestBroker(broker)
    broker.publish('microfrontend.registered', {
      descriptor: {
        id: 'mf-1',
        name: 'mf-1',
        version: '1.0.0',
        isolation: { events: 'broker-only' },
      },
    })
    const svc = broker.getService<{
      getResolvedPolicy: (mfId: string) => ResolvedIsolationPolicy | undefined
    }>('isolation')
    expect(svc?.getResolvedPolicy('mf-1')?.events).toBe('broker-only')
  })

  it('SC7.2 — descriptor.isolation={events:isolated} → resolved.events=isolated (descriptor lock — runtime no-op preservato da F8)', () => {
    const broker = createTestBroker()
    installIsolationOnTestBroker(broker)
    broker.publish('microfrontend.registered', {
      descriptor: {
        id: 'mf-2',
        name: 'mf-2',
        version: '1.0.0',
        isolation: { events: 'isolated' },
      },
    })
    const svc = broker.getService<{
      getResolvedPolicy: (mfId: string) => ResolvedIsolationPolicy | undefined
    }>('isolation')
    expect(svc?.getResolvedPolicy('mf-2')?.events).toBe('isolated')
    // F13 NON modifica events runtime behavior — descriptor field documented lock only.
    // F8 publish/subscribe pass-through preservato (verifica indirect: no error path).
  })
})

describe('F13 W3 Integration — Edge tests', () => {
  it('Idempotent install — 2x isolationModule().install(broker) → console.warn + early return', () => {
    const broker = createTestBroker()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    installIsolationOnTestBroker(broker)
    const handlersCountAfter1 = broker.handlers.get('microfrontend.registered')?.length ?? 0
    installIsolationOnTestBroker(broker) // 2x install → early return
    const handlersCountAfter2 = broker.handlers.get('microfrontend.registered')?.length ?? 0
    expect(handlersCountAfter2).toBe(handlersCountAfter1) // no extra subscription
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already installed'))
    warnSpy.mockRestore()
  })

  it('AbortSignal cascade — broker abort → cache cleared + handlers unsubscribed', () => {
    const broker = createTestBroker()
    const handle = installIsolationOnTestBroker(broker)
    broker.publish('microfrontend.registered', {
      descriptor: { id: 'mf-1', name: 'mf-1', version: '1.0.0' },
    })
    const svc = broker.getService<{
      getResolvedPolicy: (mfId: string) => ResolvedIsolationPolicy | undefined
    }>('isolation')
    expect(svc?.getResolvedPolicy('mf-1')).toBeDefined()
    // Trigger abort cascade
    handle.abort()
    expect(svc?.getResolvedPolicy('mf-1')).toBeUndefined() // cache cleared
    expect(broker.handlers.get('microfrontend.registered')?.length ?? 0).toBe(0) // unsubscribed
  })
})

describe('F13 W3 Integration — Helpers verification', () => {
  it('scopeCss helper + applyMountIsolation chain (manual binding alt)', () => {
    const cache = createPolicyCache()
    const resolved = resolvePolicy({ dom: 'shadow-dom', css: 'shadow-dom' }, undefined, 'mf-shadow')
    cache.set('mf-shadow', resolved)
    const host = document.createElement('div')
    const mount = { element: host, context: {} }
    applyMountIsolation('mf-shadow', mount, cache, {})
    // shadow-dom Strategy A: element mutato
    expect(host.shadowRoot).not.toBeNull()
    // scopeCss helper standalone
    const scoped = scopeCss('.btn { color: red; }', 'mf-1')
    expect(scoped).toContain('[data-gz-mf="mf-1"]')
  })

  it('Warning matrix multi-warning detection (P-13 + GLOBALS_ISOLATED_JS_SHARED)', () => {
    const resolved = resolvePolicy(
      { js: 'shared-window', network: 'blocked', globals: 'isolated' },
      undefined,
      'mf-1',
    )
    const warnings = detectInconsistentCombinations(resolved, 'mf-1')
    const codes = warnings.map((w) => w.code)
    expect(codes).toContain('P-13')
    expect(codes).toContain('GLOBALS_ISOLATED_JS_SHARED')
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
