/**
 * Tier-1 unit suite per `lifecycle-mount-hook.ts` (W2 P03 — 3 test).
 *
 * Cover REQ-IDs: MF-ISO-02 (apply chain dom→css→iframe pre-mount); MF-ISO-05
 * parziale (events isolation lock via descriptor cache W3 P05 integration).
 *
 * Mock broker subset duck-typed (BrokerSubscribeApi) — NO mount Broker F1 reale
 * per isolation unit test (Tier-1 jsdom default D-V2-F13-14).
 *
 * @see D-V2-F13-01 — Seam hybrid wrap-context + lifecycle subscribe
 * @see RESEARCH §3 OQ-1 — Timing SYNC verifica empirica
 */
import type { BrokerEvent } from '@gluezero/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyMountIsolation, installMountHook, type PolicyCache } from './lifecycle-mount-hook.js'
import type { MountTarget } from './dom-isolation.js'
import type { ResolvedIsolationPolicy } from './types/policy.js'
import { DEFAULT_ISOLATION_POLICY } from './types/policy.js'

// Mock broker subset duck-typed.
function makeMockBroker() {
  const handlers = new Map<string, Array<(event: BrokerEvent) => void>>()
  const subscriptions: Array<{ pattern: string; handler: (event: BrokerEvent) => void }> = []

  function subscribe(
    pattern: string,
    handler: (event: BrokerEvent) => void,
  ): { unsubscribe: () => void } {
    if (!handlers.has(pattern)) handlers.set(pattern, [])
    handlers.get(pattern)?.push(handler)
    const entry = { pattern, handler }
    subscriptions.push(entry)
    return {
      unsubscribe: (): void => {
        const arr = handlers.get(pattern)
        if (arr) {
          const idx = arr.indexOf(handler)
          if (idx >= 0) arr.splice(idx, 1)
        }
      },
    }
  }

  function publish(pattern: string, payload: unknown): void {
    const arr = handlers.get(pattern)
    if (!arr) return
    const event = { id: 'evt-1', topic: pattern, payload, timestamp: Date.now() } as BrokerEvent
    for (const h of arr.slice()) h(event)
  }

  return { subscribe, publish, handlers }
}

function makePolicyCache(
  entries: Record<string, Partial<ResolvedIsolationPolicy>> = {},
): PolicyCache {
  const map = new Map<string, ResolvedIsolationPolicy>()
  for (const [k, v] of Object.entries(entries)) {
    map.set(k, { ...DEFAULT_ISOLATION_POLICY, ...v })
  }
  return {
    get: (mfId: string): ResolvedIsolationPolicy | undefined => map.get(mfId),
  }
}

function makeMount(): MountTarget {
  const host = document.createElement('div')
  document.body.appendChild(host)
  return { element: host, context: {} }
}

describe('installMountHook', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('Subscribe topic correct: handler registrato su `microfrontend.mounting`', () => {
    const broker = makeMockBroker()
    const cache = makePolicyCache()

    const handle = installMountHook(broker, { cache, resolvers: {} })

    expect(broker.handlers.has('microfrontend.mounting')).toBe(true)
    expect(broker.handlers.get('microfrontend.mounting')?.length).toBe(1)
    expect(typeof handle.unsubscribe).toBe('function')
  })

  it('Apply chain dom→css: publish payload con dom=shadow-dom + css=scoped → mount.element mutato + data-gz-mf settato (no iframe = no throw)', () => {
    const broker = makeMockBroker()
    const cache = makePolicyCache({
      'mf-1': { dom: 'shadow-dom', css: 'scoped' },
    })
    installMountHook(broker, { cache, resolvers: {} })

    const mount = makeMount()
    const hostRef = mount.element

    broker.publish('microfrontend.mounting', { id: 'mf-1', mount })

    // applyDomIsolation Strategy A: mount.element mutato al div interno.
    expect(mount.element).not.toBe(hostRef)
    expect(hostRef.shadowRoot).not.toBeNull()
    // applyCssIsolation: data-gz-mf settato sul nuovo mount.element (innerDiv).
    expect(mount.element.getAttribute('data-gz-mf')).toBe('mf-1')
    // applyIframeStub: no-op (dom !== 'iframe') — nessun throw.
  })

  it('AbortSignal cascade cleanup: ctrl.abort() → subscription.unsubscribe() invocato', () => {
    const broker = makeMockBroker()
    const cache = makePolicyCache()
    const ctrl = new AbortController()

    installMountHook(broker, { cache, resolvers: {}, signal: ctrl.signal })
    expect(broker.handlers.get('microfrontend.mounting')?.length).toBe(1)

    ctrl.abort()

    expect(broker.handlers.get('microfrontend.mounting')?.length).toBe(0)
  })
})

describe('applyMountIsolation (helper esplicito Strategy A binding alt)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('Cache miss: console.warn + skip apply (mount.element preserved)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const cache = makePolicyCache()
    const mount = makeMount()
    const hostRef = mount.element

    applyMountIsolation('mf-missing', mount, cache, {})

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toContain("mf='mf-missing'")
    expect(mount.element).toBe(hostRef) // No mutation.
    expect(hostRef.shadowRoot).toBeNull()
  })

  it('Payload F8 standard (no `mount` field) → skip silently (no throw, no apply)', () => {
    const broker = makeMockBroker()
    const cache = makePolicyCache({ 'mf-1': { dom: 'shadow-dom' } })
    installMountHook(broker, { cache, resolvers: {} })

    // Payload F8 standard ({id, name, state, ...}) senza `mount`.
    expect(() => {
      broker.publish('microfrontend.mounting', {
        id: 'mf-1',
        name: 'MF One',
        state: 'mounting',
        timestamp: Date.now(),
      })
    }).not.toThrow()
  })

  it('Iframe path: policy.dom=iframe senza resolver → throw IFRAME_ADAPTER_REQUIRED propagato', () => {
    const cache = makePolicyCache({ 'mf-iframe': { dom: 'iframe' } })
    const mount = makeMount()

    try {
      applyMountIsolation('mf-iframe', mount, cache, {})
      expect.unreachable('Expected throw IFRAME_ADAPTER_REQUIRED')
    } catch (err) {
      const e = err as { code?: string }
      expect(e.code).toBe('IFRAME_ADAPTER_REQUIRED')
    }
  })
})
