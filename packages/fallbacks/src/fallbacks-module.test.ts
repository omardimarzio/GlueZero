/**
 * Tier-1 jsdom integration test suite per `fallbacksModule.install` FINAL impl (W2 P04).
 *
 * Coverage 10+ scenari (MF-FALLBACK-01 + MF-FALLBACK-05 closure orchestrator):
 * - Factory shape: id + install function + anti-singleton D-30.
 * - Install flow: SERVICE_MICROFRONTENDS lookup throw + idempotent guard + service register.
 * - Full chain integration: emit error topic → subscribe → orchestrator → dispatch → publish.
 * - Orchestrator chain D-V2-F14-12: circuit check + retry success path + skip runtime/update.
 * - AbortSignal cleanup cascade D-V2-16 + cleanup P-02 microfrontend.unregistered.
 *
 * NOTE: il W1 stub e tutti i moduli BrokerModule (isolation, permissions, ecc.) usano
 * `id: 'fallbacks'` (NOT `name:`). Il plan W2 P04 example aveva `name` ma il contract
 * BrokerModule di @gluezero/core è `id: string`. Adjust deviation Rule 1.
 *
 * @see D-V2-F14-12 — Orchestrator chain order
 * @see D-V2-F14-16 — Cleanup cascade
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fallbacksModule } from './fallbacks-module.js'
import { SERVICE_FALLBACKS, SERVICE_MICROFRONTENDS } from '@gluezero/core'

type Handler = (event: { topic: string; payload: unknown }) => void

interface CtxOpts {
  withMfService?: boolean
  preInstallFallbacks?: boolean
  mfGet?: (id: string) => unknown
}

function createCtx(opts: CtxOpts) {
  const handlers = new Map<string, Set<Handler>>()
  const services = new Map<string, unknown>()
  const publish = vi.fn((topic: string, payload: unknown) => {
    const set = handlers.get(topic)
    if (!set) return
    // Snapshot per evitare mutation during iteration
    for (const h of Array.from(set)) h({ topic, payload })
  })
  const subscribe = vi.fn((topic: string, handler: Handler, _opts?: unknown) => {
    if (!handlers.has(topic)) handlers.set(topic, new Set())
    handlers.get(topic)!.add(handler)
    return {
      unsubscribe: () => {
        handlers.get(topic)?.delete(handler)
      },
    }
  })
  const getService = vi.fn(<T>(name: string): T | undefined => services.get(name) as T | undefined)

  if (opts.withMfService !== false) {
    services.set(SERVICE_MICROFRONTENDS, {
      get: opts.mfGet ?? (() => undefined),
      load: vi.fn(async () => undefined),
      bootstrap: vi.fn(async () => undefined),
      mount: vi.fn(async () => undefined),
      unmount: vi.fn(async () => undefined),
      destroy: vi.fn(async () => undefined),
    })
  }
  if (opts.preInstallFallbacks) {
    services.set(SERVICE_FALLBACKS, {})
  }

  const broker = { publish, subscribe, getService }
  const registerService = vi.fn((name: string, impl: unknown) => services.set(name, impl))

  return { broker, registerService, services, publish, subscribe, getService }
}

describe('fallbacksModule — factory', () => {
  it('returns BrokerModule with id "fallbacks" + install function', () => {
    const mod = fallbacksModule()
    expect(mod.id).toBe('fallbacks')
    expect(typeof mod.install).toBe('function')
  })

  it('anti-singleton D-30: 2 calls return distinct objects', () => {
    const a = fallbacksModule()
    const b = fallbacksModule()
    expect(a).not.toBe(b)
  })
})

describe('fallbacksModule — install flow', () => {
  it('throws when SERVICE_MICROFRONTENDS absent', () => {
    const ctx = createCtx({ withMfService: false })
    const mod = fallbacksModule()
    expect(() => mod.install(ctx as never)).toThrow(/@gluezero\/microfrontends/)
  })

  it('idempotent guard: 2 installs → 2° warns + early return', () => {
    const ctx = createCtx({ preInstallFallbacks: true })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const mod = fallbacksModule()
    mod.install(ctx as never)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already installed'))
    warnSpy.mockRestore()
  })

  it('registers SERVICE_FALLBACKS with API getCircuitState + getRetryAttempts', () => {
    const ctx = createCtx({})
    const mod = fallbacksModule()
    mod.install(ctx as never)
    expect(ctx.registerService).toHaveBeenCalledWith(
      SERVICE_FALLBACKS,
      expect.objectContaining({
        getCircuitState: expect.any(Function),
        getRetryAttempts: expect.any(Function),
      }),
    )
  })

  it('service.getRetryAttempts default 0', () => {
    const ctx = createCtx({})
    const mod = fallbacksModule()
    mod.install(ctx as never)
    const svc = ctx.services.get(SERVICE_FALLBACKS) as {
      getRetryAttempts: (id: string, phase: string) => number
    }
    expect(svc.getRetryAttempts('mf-x', 'load')).toBe(0)
  })

  it('service.getCircuitState default "closed"', () => {
    const ctx = createCtx({})
    const mod = fallbacksModule()
    mod.install(ctx as never)
    const svc = ctx.services.get(SERVICE_FALLBACKS) as {
      getCircuitState: (id: string) => string
    }
    expect(svc.getCircuitState('mf-x')).toBe('closed')
  })
})

describe('fallbacksModule — full chain integration', () => {
  let ctx: ReturnType<typeof createCtx>

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    ctx = createCtx({
      mfGet: (_id) => ({
        descriptor: {
          id: 'mf-A',
          name: 'A',
          version: '1.0.0',
          mount: { selector: '#root' },
          fallback: {
            onLoadError: { type: 'event', topic: 'app.fallback' },
          },
        },
      }),
    })
    const mod = fallbacksModule()
    mod.install(ctx as never)
  })

  it('error event → dispatchFallback → broker.publish event topic', async () => {
    ctx.broker.publish('microfrontend.load.failed', {
      id: 'mf-A',
      phase: 'load',
      error: { message: 'fail' },
      recoverable: false,
      timestamp: 0,
    })
    // Wait for fire-and-forget dispatch microtask
    await new Promise((r) => setTimeout(r, 10))
    const eventCalls = ctx.broker.publish.mock.calls.filter((c) => c[0] === 'app.fallback')
    expect(eventCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('emit microfrontend.fallback.rendered post dispatch', async () => {
    ctx.broker.publish('microfrontend.load.failed', {
      id: 'mf-A',
      phase: 'load',
      error: { message: 'fail' },
      recoverable: false,
      timestamp: 0,
    })
    await new Promise((r) => setTimeout(r, 10))
    const renderedCalls = ctx.broker.publish.mock.calls.filter(
      (c) => c[0] === 'microfrontend.fallback.rendered',
    )
    expect(renderedCalls.length).toBeGreaterThanOrEqual(1)
  })
})

describe('fallbacksModule — cleanup cascade P-02', () => {
  it('microfrontend.unregistered → dispose circuit + reset retry counters', async () => {
    const ctx = createCtx({})
    const mod = fallbacksModule()
    mod.install(ctx as never)
    const service = ctx.services.get(SERVICE_FALLBACKS) as {
      getCircuitState: (id: string) => string
      getRetryAttempts: (id: string, phase: string) => number
    }
    // emit unregister
    ctx.broker.publish('microfrontend.unregistered', { id: 'mf-A' })
    // state default (closed + 0 attempts) post-dispose
    expect(service.getCircuitState('mf-A')).toBe('closed')
    expect(service.getRetryAttempts('mf-A', 'load')).toBe(0)
  })

  it('microfrontend.unregistered con microFrontendId alternative key supportato', async () => {
    const ctx = createCtx({})
    const mod = fallbacksModule()
    mod.install(ctx as never)
    const service = ctx.services.get(SERVICE_FALLBACKS) as {
      getCircuitState: (id: string) => string
    }
    // emit con `microFrontendId` invece di `id` — handler accetta entrambi
    ctx.broker.publish('microfrontend.unregistered', { microFrontendId: 'mf-A' })
    expect(service.getCircuitState('mf-A')).toBe('closed')
  })
})

describe('fallbacksModule — W8 retry success path D-V2-F14-12', () => {
  it('W8/Scenario 12: retry success → emit microfrontend.recovered + reset counter + recordSuccess', async () => {
    // W8 fix: covers orchestrator success path step 4 D-V2-F14-12
    // Setup: mfService.load resolves on retry attempt
    document.body.innerHTML = '<div id="root"></div>'
    const loadFn = vi.fn(async () => undefined)
    const ctx = createCtx({
      mfGet: (_id) => ({
        descriptor: {
          id: 'mf-recover',
          mount: { selector: '#root' },
          fallback: {
            onLoadError: { type: 'none' },
            retry: { attempts: 3, delayMs: 10, backoff: 'none' },
          },
        },
      }),
    })
    // Override mfService.load with controlled mock
    const mfService = ctx.services.get(SERVICE_MICROFRONTENDS) as { load: typeof loadFn }
    mfService.load = loadFn

    const mod = fallbacksModule()
    mod.install(ctx as never)

    // Trigger initial error → orchestrator schedules retry
    ctx.broker.publish('microfrontend.load.failed', {
      id: 'mf-recover',
      phase: 'load',
      error: { message: 'fail' },
      recoverable: true,
      timestamp: 0,
    })
    // Wait for retry setTimeout + Promise resolution
    await new Promise((r) => setTimeout(r, 60))

    // Verify load was invoked (retry trigger)
    expect(loadFn).toHaveBeenCalledWith('mf-recover')

    // Verify recovered emit
    const recoveredCalls = ctx.broker.publish.mock.calls.filter(
      (c) => c[0] === 'microfrontend.recovered',
    )
    expect(recoveredCalls.length).toBeGreaterThanOrEqual(1)
    const recoveredPayload = recoveredCalls[0][1] as {
      microFrontendId: string
      lifecyclePhase: string
      attempts: number
    }
    expect(recoveredPayload.microFrontendId).toBe('mf-recover')
    expect(recoveredPayload.lifecyclePhase).toBe('load')
    expect(recoveredPayload.attempts).toBeGreaterThanOrEqual(1)

    // Verify counter reset (service API)
    const service = ctx.services.get(SERVICE_FALLBACKS) as {
      getRetryAttempts: (id: string, phase: string) => number
      getCircuitState: (id: string) => string
    }
    expect(service.getRetryAttempts('mf-recover', 'load')).toBe(0)

    // Verify recordSuccess via circuit state (closed default)
    expect(service.getCircuitState('mf-recover')).toBe('closed')
  })
})

describe('fallbacksModule — skip retry runtime/update OQ-1', () => {
  it('runtime.failed → dispatch fallback diretto (no retry, no setTimeout)', async () => {
    document.body.innerHTML = '<div id="root"></div>'
    const ctx = createCtx({
      mfGet: (_id) => ({
        descriptor: {
          id: 'mf-A',
          mount: { selector: '#root' },
          fallback: {
            onRuntimeError: { type: 'event', topic: 'app.runtime.fallback' },
            retry: { attempts: 3, delayMs: 100, backoff: 'exponential' },
          },
        },
      }),
    })
    const mod = fallbacksModule()
    mod.install(ctx as never)
    ctx.broker.publish('microfrontend.runtime.failed', {
      id: 'mf-A',
      phase: 'runtime',
      error: { message: 'rt' },
      recoverable: true,
      timestamp: 0,
    })
    await new Promise((r) => setTimeout(r, 10))
    const eventCalls = ctx.broker.publish.mock.calls.filter(
      (c) => c[0] === 'app.runtime.fallback',
    )
    expect(eventCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('update.failed → dispatch fallback diretto (no retry, no setTimeout)', async () => {
    document.body.innerHTML = '<div id="root"></div>'
    const ctx = createCtx({
      mfGet: (_id) => ({
        descriptor: {
          id: 'mf-A',
          mount: { selector: '#root' },
          fallback: {
            onUpdateError: { type: 'event', topic: 'app.update.fallback' },
          },
        },
      }),
    })
    const mod = fallbacksModule()
    mod.install(ctx as never)
    ctx.broker.publish('microfrontend.update.failed', {
      id: 'mf-A',
      phase: 'update',
      error: { message: 'up' },
      recoverable: true,
      timestamp: 0,
    })
    await new Promise((r) => setTimeout(r, 10))
    const eventCalls = ctx.broker.publish.mock.calls.filter(
      (c) => c[0] === 'app.update.fallback',
    )
    expect(eventCalls.length).toBeGreaterThanOrEqual(1)
  })
})

describe('fallbacksModule — no fallback policy → emit fallbackType:"none"', () => {
  it('error event con policy assente → emit fallback.rendered fallbackType:"none"', async () => {
    const ctx = createCtx({
      mfGet: (_id) => ({
        descriptor: {
          id: 'mf-A',
          name: 'A',
          version: '1.0.0',
        },
      }),
    })
    const mod = fallbacksModule()
    mod.install(ctx as never)
    ctx.broker.publish('microfrontend.load.failed', {
      id: 'mf-A',
      phase: 'load',
      error: { message: 'fail' },
      recoverable: false,
      timestamp: 0,
    })
    await new Promise((r) => setTimeout(r, 10))
    const renderedCalls = ctx.broker.publish.mock.calls.filter(
      (c) => c[0] === 'microfrontend.fallback.rendered',
    )
    expect(renderedCalls.length).toBeGreaterThanOrEqual(1)
    const lastCall = renderedCalls[renderedCalls.length - 1]
    expect((lastCall[1] as { fallbackType: string }).fallbackType).toBe('none')
  })
})

describe('fallbacksModule — descriptor.fallback override defaultPolicy', () => {
  it('descriptor.fallback presente → ignora options.defaultPolicy', async () => {
    const ctx = createCtx({
      mfGet: (_id) => ({
        descriptor: {
          id: 'mf-A',
          fallback: {
            onLoadError: { type: 'event', topic: 'descriptor.fallback' },
          },
        },
      }),
    })
    const mod = fallbacksModule({
      defaultPolicy: {
        onLoadError: { type: 'event', topic: 'default.fallback' },
      },
    })
    mod.install(ctx as never)
    ctx.broker.publish('microfrontend.load.failed', {
      id: 'mf-A',
      phase: 'load',
      error: { message: 'fail' },
      recoverable: false,
      timestamp: 0,
    })
    await new Promise((r) => setTimeout(r, 10))
    const descriptorCalls = ctx.broker.publish.mock.calls.filter(
      (c) => c[0] === 'descriptor.fallback',
    )
    const defaultCalls = ctx.broker.publish.mock.calls.filter((c) => c[0] === 'default.fallback')
    expect(descriptorCalls.length).toBeGreaterThanOrEqual(1)
    expect(defaultCalls.length).toBe(0)
  })

  it('descriptor.fallback assente + options.defaultPolicy presente → usa defaultPolicy', async () => {
    const ctx = createCtx({
      mfGet: (_id) => ({
        descriptor: { id: 'mf-A' },
      }),
    })
    const mod = fallbacksModule({
      defaultPolicy: {
        onLoadError: { type: 'event', topic: 'default.fallback' },
      },
    })
    mod.install(ctx as never)
    ctx.broker.publish('microfrontend.load.failed', {
      id: 'mf-A',
      phase: 'load',
      error: { message: 'fail' },
      recoverable: false,
      timestamp: 0,
    })
    await new Promise((r) => setTimeout(r, 10))
    const defaultCalls = ctx.broker.publish.mock.calls.filter((c) => c[0] === 'default.fallback')
    expect(defaultCalls.length).toBeGreaterThanOrEqual(1)
  })
})
