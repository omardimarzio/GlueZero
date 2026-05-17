/**
 * Tier-1 jsdom test suite per `dispatchFallback` dispatcher 5-mode + emit unificato.
 *
 * Coverage 25+ scenari (MF-FALLBACK-05 closure):
 * - 4-mode dispatch (html/component/event/custom) + edge cases (target null, handler throw).
 * - Isolation respect: F13 shadow-dom target detection via SERVICE_ISOLATION mock.
 * - F15 adapter delega: SERVICE_FRAMEWORK_ADAPTER mock presente vs assente.
 * - W7 fix: ShadowRoot direct input come mountElement.
 * - Emit unificato `microfrontend.fallback.rendered` (F8 governance riuso) — 1 chiamata
 *   per dispatch + payload uniform + source descriptor F1 D-23.
 *
 * @see D-V2-F14-02 — F8 governance topic riuso
 * @see D-V2-F14-13/14/15 — 4 rendering modes spec
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dispatchFallback } from './fallback-renderer.js'
import type { FallbackDefinition } from './types/policy.js'

function createMockBroker(services: Record<string, unknown> = {}) {
  const publish = vi.fn()
  const getService = vi.fn(<T>(name: string): T | undefined => services[name] as T | undefined)
  return { publish, getService } as unknown as {
    publish: ReturnType<typeof vi.fn>
    getService: ReturnType<typeof vi.fn>
  }
}

function setupDom(): HTMLDivElement {
  document.body.innerHTML = ''
  const root = document.createElement('div')
  root.id = 'root'
  document.body.appendChild(root)
  return root
}

describe('dispatchFallback — type:"html"', () => {
  let broker: ReturnType<typeof createMockBroker>

  beforeEach(() => {
    broker = createMockBroker()
  })

  it('applies innerHTML to mountElement', async () => {
    const target = setupDom()
    const def: FallbackDefinition = { type: 'html', html: '<p>err</p>' }
    const result = await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'load',
      error: { message: 'm' },
      definition: def,
      mountElement: target,
    })
    expect(target.innerHTML).toBe('<p>err</p>')
    expect(result.fallbackType).toBe('html')
    expect(result.applied).toBe(true)
  })

  it('fallback querySelector(selector) quando mountElement undefined', async () => {
    setupDom()
    const def: FallbackDefinition = { type: 'html', html: '<p>err</p>' }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'load',
      error: { message: 'm' },
      definition: def,
      selector: '#root',
    })
    expect(document.querySelector('#root')!.innerHTML).toBe('<p>err</p>')
  })

  it('no target → console.warn + fallbackType:"html-skipped"', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const def: FallbackDefinition = { type: 'html', html: '<p>err</p>' }
    const result = await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-X',
      phase: 'load',
      error: { message: 'm' },
      definition: def,
    })
    expect(warnSpy).toHaveBeenCalled()
    expect(result.fallbackType).toBe('html-skipped')
    expect(result.applied).toBe(false)
    warnSpy.mockRestore()
  })

  it('respect F13 shadow-dom: target = shadowRoot quando policy.dom="shadow-dom"', async () => {
    const host = setupDom()
    const shadowRoot = host.attachShadow({ mode: 'open' })
    broker = createMockBroker({
      isolation: {
        getResolvedPolicy: (_mfId: string) => ({ dom: 'shadow-dom' }),
      },
    })
    const def: FallbackDefinition = { type: 'html', html: '<p>shadow</p>' }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'load',
      error: { message: 'm' },
      definition: def,
      mountElement: host,
    })
    expect(shadowRoot.innerHTML).toBe('<p>shadow</p>')
    expect(host.innerHTML).not.toContain('<p>shadow</p>')
  })

  it('shadow-dom edge case: host.shadowRoot=null fallback su host innerHTML', async () => {
    const host = setupDom()
    broker = createMockBroker({
      isolation: {
        getResolvedPolicy: (_mfId: string) => ({ dom: 'shadow-dom' }),
      },
    })
    const def: FallbackDefinition = { type: 'html', html: '<p>x</p>' }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'load',
      error: { message: 'm' },
      definition: def,
      mountElement: host,
    })
    expect(host.innerHTML).toBe('<p>x</p>')
  })

  it('W7: ShadowRoot direct input come mountElement applica innerHTML su shadowRoot', async () => {
    // W7 fix: signature widened HTMLElement | ShadowRoot — caller F13 può passare shadowRoot direttamente
    const host = setupDom()
    const shadowRoot = host.attachShadow({ mode: 'open' })
    const def: FallbackDefinition = { type: 'html', html: '<p>direct-shadow</p>' }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'load',
      error: { message: 'm' },
      definition: def,
      mountElement: shadowRoot, // direct ShadowRoot input
    })
    expect(shadowRoot.innerHTML).toBe('<p>direct-shadow</p>')
    expect(host.innerHTML).not.toContain('<p>direct-shadow</p>')
  })

  it('html undefined → innerHTML = "" default', async () => {
    const target = setupDom()
    target.innerHTML = 'previous'
    const def: FallbackDefinition = { type: 'html' }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'load',
      error: { message: 'm' },
      definition: def,
      mountElement: target,
    })
    expect(target.innerHTML).toBe('')
  })

  it('isolation policy dom!="shadow-dom" → target rimane host element', async () => {
    const host = setupDom()
    host.attachShadow({ mode: 'open' })
    broker = createMockBroker({
      isolation: {
        getResolvedPolicy: (_mfId: string) => ({ dom: 'mount-root' }),
      },
    })
    const def: FallbackDefinition = { type: 'html', html: '<p>host</p>' }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'load',
      error: { message: 'm' },
      definition: def,
      mountElement: host,
    })
    expect(host.innerHTML).toBe('<p>host</p>')
  })
})

describe('dispatchFallback — type:"component"', () => {
  let broker: ReturnType<typeof createMockBroker>

  beforeEach(() => {
    broker = createMockBroker()
  })

  it('delega a F15 adapter quando SERVICE_FRAMEWORK_ADAPTER presente', async () => {
    const renderFn = vi.fn()
    const target = setupDom()
    broker = createMockBroker({
      'framework-adapter': { renderFallbackComponent: renderFn },
    })
    const def: FallbackDefinition = { type: 'component', component: { name: 'MockC' } }
    const result = await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'mount',
      error: { message: 'm' },
      definition: def,
      mountElement: target,
    })
    expect(renderFn).toHaveBeenCalledTimes(1)
    expect(result.fallbackType).toBe('component')
    expect(result.applied).toBe(true)
  })

  it('adapter assente → console.warn + HTML stub + fallbackType:"component-stub"', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const target = setupDom()
    const def: FallbackDefinition = { type: 'component', component: { name: 'MockC' } }
    const result = await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'mount',
      error: { message: 'm' },
      definition: def,
      mountElement: target,
    })
    expect(warnSpy).toHaveBeenCalled()
    expect(target.innerHTML).toContain('data-gz-fallback-stub')
    expect(result.fallbackType).toBe('component-stub')
    warnSpy.mockRestore()
  })

  it('no target → component-stub skip with reason', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const def: FallbackDefinition = { type: 'component', component: {} }
    const result = await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-X',
      phase: 'mount',
      error: { message: 'm' },
      definition: def,
    })
    expect(result.applied).toBe(false)
    expect(result.fallbackType).toBe('component-stub')
    expect(result.reason).toBe('target-not-found')
    warnSpy.mockRestore()
  })

  it('component fallback via selector lookup', async () => {
    const renderFn = vi.fn()
    setupDom()
    broker = createMockBroker({
      'framework-adapter': { renderFallbackComponent: renderFn },
    })
    const def: FallbackDefinition = { type: 'component', component: { name: 'MockC' } }
    const result = await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'mount',
      error: { message: 'm' },
      definition: def,
      selector: '#root',
    })
    expect(renderFn).toHaveBeenCalledTimes(1)
    expect(result.fallbackType).toBe('component')
  })
})

describe('dispatchFallback — type:"event"', () => {
  let broker: ReturnType<typeof createMockBroker>

  beforeEach(() => {
    broker = createMockBroker()
  })

  it('emette su definition.topic se presente', async () => {
    const def: FallbackDefinition = { type: 'event', topic: 'custom.fallback' }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'mount',
      error: { message: 'm' },
      definition: def,
    })
    expect(broker.publish).toHaveBeenCalledWith(
      'custom.fallback',
      expect.objectContaining({
        microFrontendId: 'mf-A',
        lifecyclePhase: 'mount',
        fallbackApplied: true,
      }),
      expect.objectContaining({ deliveryMode: 'sync' }),
    )
  })

  it('topic default microfrontend.fallback.event quando omesso', async () => {
    const def: FallbackDefinition = { type: 'event' }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'mount',
      error: { message: 'm' },
      definition: def,
    })
    expect(broker.publish).toHaveBeenCalledWith(
      'microfrontend.fallback.event',
      expect.objectContaining({ microFrontendId: 'mf-A' }),
      expect.any(Object),
    )
  })

  it('source descriptor F1 D-23 obbligatorio', async () => {
    const def: FallbackDefinition = { type: 'event' }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'mount',
      error: { message: 'm' },
      definition: def,
    })
    // Event call (NOT rendered call) — usa calls[0] perché event è first publish
    const opts = broker.publish.mock.calls[0]?.[2]
    expect(opts).toMatchObject({
      source: { type: 'plugin', id: 'fallbacks', name: '@gluezero/fallbacks' },
    })
  })

  it('payload include timestamp number', async () => {
    const def: FallbackDefinition = { type: 'event' }
    const before = Date.now()
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'mount',
      error: { message: 'm' },
      definition: def,
    })
    const payload = broker.publish.mock.calls[0]?.[1] as { timestamp: number }
    expect(typeof payload.timestamp).toBe('number')
    expect(payload.timestamp).toBeGreaterThanOrEqual(before)
  })
})

describe('dispatchFallback — type:"custom"', () => {
  let broker: ReturnType<typeof createMockBroker>

  beforeEach(() => {
    broker = createMockBroker()
  })

  it('handler sync void → fallbackType:"custom"', async () => {
    const handler = vi.fn()
    const def: FallbackDefinition = { type: 'custom', handler }
    const result = await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'runtime',
      error: { message: 'm' },
      definition: def,
    })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(result.fallbackType).toBe('custom')
  })

  it('handler async resolved → await + custom', async () => {
    let resolved = false
    const handler = vi.fn(async () => {
      await Promise.resolve()
      resolved = true
    })
    const def: FallbackDefinition = { type: 'custom', handler }
    const result = await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'runtime',
      error: { message: 'm' },
      definition: def,
    })
    expect(resolved).toBe(true)
    expect(result.fallbackType).toBe('custom')
  })

  it('handler throw sync → console.error + custom-failed', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const handler = vi.fn(() => {
      throw new Error('boom')
    })
    const def: FallbackDefinition = { type: 'custom', handler }
    const result = await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'runtime',
      error: { message: 'm' },
      definition: def,
    })
    expect(errSpy).toHaveBeenCalled()
    expect(result.fallbackType).toBe('custom-failed')
    errSpy.mockRestore()
  })

  it('handler rejected → console.error + custom-failed', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const handler = vi.fn(async () => {
      throw new Error('boom')
    })
    const def: FallbackDefinition = { type: 'custom', handler }
    const result = await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'runtime',
      error: { message: 'm' },
      definition: def,
    })
    expect(errSpy).toHaveBeenCalled()
    expect(result.fallbackType).toBe('custom-failed')
    errSpy.mockRestore()
  })

  it('handler undefined → console.warn + custom-failed', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const def: FallbackDefinition = { type: 'custom' }
    const result = await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'runtime',
      error: { message: 'm' },
      definition: def,
    })
    expect(warnSpy).toHaveBeenCalled()
    expect(result.applied).toBe(false)
    expect(result.fallbackType).toBe('custom-failed')
    warnSpy.mockRestore()
  })

  it('handler riceve ctx parameter', async () => {
    const handler = vi.fn()
    const ctxObj = { storage: 'mock', gateway: 'mock' }
    const def: FallbackDefinition = { type: 'custom', handler }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'runtime',
      error: { message: 'm' },
      definition: def,
      ctx: ctxObj,
    })
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ message: 'm' }), ctxObj)
  })
})

describe('dispatchFallback — type:"none"', () => {
  let broker: ReturnType<typeof createMockBroker>

  beforeEach(() => {
    broker = createMockBroker()
  })

  it('no-op + emit fallbackType:"none" observability', async () => {
    const def: FallbackDefinition = { type: 'none' }
    const result = await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'load',
      error: { message: 'm' },
      definition: def,
    })
    expect(result.fallbackType).toBe('none')
    expect(result.applied).toBe(true)
    expect(broker.publish).toHaveBeenCalledWith(
      'microfrontend.fallback.rendered',
      expect.objectContaining({ fallbackType: 'none' }),
      expect.any(Object),
    )
  })
})

describe('dispatchFallback — emit unificato microfrontend.fallback.rendered', () => {
  let broker: ReturnType<typeof createMockBroker>

  beforeEach(() => {
    broker = createMockBroker()
  })

  it('emit chiamato esattamente 1 volta per dispatch (html mode)', async () => {
    const target = setupDom()
    const def: FallbackDefinition = { type: 'html', html: '<p>x</p>' }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'load',
      error: { message: 'm' },
      definition: def,
      mountElement: target,
    })
    const calls = broker.publish.mock.calls.filter(
      (c) => c[0] === 'microfrontend.fallback.rendered',
    )
    expect(calls.length).toBe(1)
  })

  it('payload include {microFrontendId, lifecyclePhase, fallbackType, timestamp}', async () => {
    const target = setupDom()
    const def: FallbackDefinition = { type: 'html', html: '<p>x</p>' }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'mount',
      error: { message: 'm' },
      definition: def,
      mountElement: target,
    })
    const renderedCall = broker.publish.mock.calls.find(
      (c) => c[0] === 'microfrontend.fallback.rendered',
    )!
    const payload = renderedCall[1] as Record<string, unknown>
    expect(payload).toMatchObject({
      microFrontendId: 'mf-A',
      lifecyclePhase: 'mount',
      fallbackType: 'html',
    })
    expect(typeof payload.timestamp).toBe('number')
  })

  it('opts source descriptor F1 D-23 + deliveryMode:"sync"', async () => {
    const target = setupDom()
    const def: FallbackDefinition = { type: 'html', html: '<p>x</p>' }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'load',
      error: { message: 'm' },
      definition: def,
      mountElement: target,
    })
    const renderedCall = broker.publish.mock.calls.find(
      (c) => c[0] === 'microfrontend.fallback.rendered',
    )!
    expect(renderedCall[2]).toMatchObject({
      source: { type: 'plugin', id: 'fallbacks', name: '@gluezero/fallbacks' },
      deliveryMode: 'sync',
    })
  })

  it('emit chiamato anche per custom-failed (observability preserve)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const def: FallbackDefinition = {
      type: 'custom',
      handler: () => {
        throw new Error('boom')
      },
    }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'runtime',
      error: { message: 'm' },
      definition: def,
    })
    const renderedCall = broker.publish.mock.calls.find(
      (c) => c[0] === 'microfrontend.fallback.rendered',
    )!
    expect(renderedCall).toBeDefined()
    expect((renderedCall[1] as { fallbackType: string }).fallbackType).toBe('custom-failed')
    errSpy.mockRestore()
  })

  it('emit chiamato anche per html-skipped (target-not-found)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const def: FallbackDefinition = { type: 'html', html: '<p>x</p>' }
    await dispatchFallback({
      broker: broker as never,
      mfId: 'mf-X',
      phase: 'load',
      error: { message: 'm' },
      definition: def,
    })
    const renderedCall = broker.publish.mock.calls.find(
      (c) => c[0] === 'microfrontend.fallback.rendered',
    )!
    expect(renderedCall).toBeDefined()
    expect((renderedCall[1] as { fallbackType: string }).fallbackType).toBe('html-skipped')
    warnSpy.mockRestore()
  })
})

describe('dispatchFallback — return Promise<RenderResult>', () => {
  it('ritorna Promise<RenderResult> (async per supportare custom)', async () => {
    const broker = createMockBroker()
    const def: FallbackDefinition = { type: 'none' }
    const promise = dispatchFallback({
      broker: broker as never,
      mfId: 'mf-A',
      phase: 'load',
      error: { message: 'm' },
      definition: def,
    })
    expect(promise).toBeInstanceOf(Promise)
    const result = await promise
    expect(result.applied).toBe(true)
  })
})
