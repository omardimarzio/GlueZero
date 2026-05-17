/**
 * `lifecycle-register-hook.test.ts` — Tier-1 unit suite (jsdom) per il register hook.
 *
 * Cover REQ-IDs: MF-ISO-01 (cache populated alla register) + MF-ISO-06 (warning emit).
 *
 * 7 test totali:
 *  1. Subscribe topic `microfrontend.registered` (verifica handlers registrato).
 *  2. Resolve + cache populated (descriptor.isolation parziale).
 *  3. Emit warning topic `microfrontend.isolation.warning` (P-13 trigger).
 *  4. Console.warn injection seam called (test stub).
 *  5. No warning su DEFAULT policy (zero emit).
 *  6. AbortSignal cascade: ctrl.abort() → cache cleared + handler rimosso.
 *  7. Idempotent register stesso mfId (cache.set sovrascrive senza throw).
 */
import { describe, expect, test, vi } from 'vitest'
import {
  installRegisterHook,
  type RegisterHookBroker,
} from './lifecycle-register-hook.js'
import { createPolicyCache } from './internal/policy-cache.js'
import { ISOLATION_WARNING_TOPIC } from './topics.js'
import { DEFAULT_ISOLATION_POLICY } from './policy-resolver.js'

/**
 * Mock broker minimal (sync publish dispatch). Replica F1 pattern pub/sub SYNC mode.
 */
interface MockBroker extends RegisterHookBroker {
  readonly handlers: Map<string, Array<(p: unknown) => void>>
  readonly published: Array<{ topic: string; payload: unknown }>
}

function createMockBroker(): MockBroker {
  const handlers = new Map<string, Array<(p: unknown) => void>>()
  const published: Array<{ topic: string; payload: unknown }> = []
  return {
    handlers,
    published,
    subscribe(topic, h) {
      const arr = handlers.get(topic) ?? []
      arr.push(h)
      handlers.set(topic, arr)
      return {
        unsubscribe(): void {
          const a = handlers.get(topic) ?? []
          const idx = a.indexOf(h)
          if (idx !== -1) a.splice(idx, 1)
        },
      }
    },
    publish(topic, payload) {
      published.push({ topic, payload })
      const arr = handlers.get(topic) ?? []
      for (const h of arr) h(payload)
    },
  }
}

/** Descriptor stub minimale (id obbligatorio per extractMfId). */
function descriptorStub(id: string, isolation?: Record<string, unknown>) {
  return {
    descriptor: {
      id,
      version: '1.0.0',
      ...(isolation ? { isolation } : {}),
    },
  }
}

describe('installRegisterHook — subscribe + resolve + cache + warning emit', () => {
  test('1. subscribe topic "microfrontend.registered" correctly', () => {
    const broker = createMockBroker()
    const cache = createPolicyCache()
    installRegisterHook(broker, { cache })
    expect(broker.handlers.has('microfrontend.registered')).toBe(true)
    expect(broker.handlers.get('microfrontend.registered')).toHaveLength(1)
  })

  test('2. resolve + cache populated with descriptor.isolation override', () => {
    const broker = createMockBroker()
    const cache = createPolicyCache()
    installRegisterHook(broker, { cache })

    broker.publish(
      'microfrontend.registered',
      descriptorStub('mf-1', { dom: 'shadow-dom' }),
    )

    const resolved = cache.get('mf-1')
    expect(resolved).toBeDefined()
    expect(resolved?.dom).toBe('shadow-dom')
    // Altri 6 campi fallback DEFAULT.
    expect(resolved?.css).toBe(DEFAULT_ISOLATION_POLICY.css)
    expect(resolved?.js).toBe(DEFAULT_ISOLATION_POLICY.js)
  })

  test('3. emit warning topic on P-13 policy (js=shared-window + network=blocked)', () => {
    const broker = createMockBroker()
    const cache = createPolicyCache()
    installRegisterHook(broker, { cache, warn: () => {} })

    broker.publish(
      'microfrontend.registered',
      descriptorStub('mf-1', { js: 'shared-window', network: 'blocked' }),
    )

    const warningEmits = broker.published.filter(
      (p) => p.topic === ISOLATION_WARNING_TOPIC,
    )
    expect(warningEmits).toHaveLength(1)
    const w = warningEmits[0]?.payload as { code: string; microFrontendId: string }
    expect(w.code).toBe('P-13')
    expect(w.microFrontendId).toBe('mf-1')
  })

  test('4. console.warn injection seam called with warning.message (P-13 substring)', () => {
    const broker = createMockBroker()
    const cache = createPolicyCache()
    const warnSpy = vi.fn()
    installRegisterHook(broker, { cache, warn: warnSpy })

    broker.publish(
      'microfrontend.registered',
      descriptorStub('mf-1', { js: 'shared-window', network: 'blocked' }),
    )

    expect(warnSpy).toHaveBeenCalledTimes(1)
    const msg = warnSpy.mock.calls[0]?.[0] as string
    expect(msg).toContain('Network blocking cannot be fully enforced')
  })

  test('5. no warning on valid DEFAULT policy (zero emit)', () => {
    const broker = createMockBroker()
    const cache = createPolicyCache()
    const warnSpy = vi.fn()
    installRegisterHook(broker, { cache, warn: warnSpy })

    // Descriptor senza override isolation → resolver ritorna DEFAULT.
    broker.publish('microfrontend.registered', descriptorStub('mf-1'))

    expect(warnSpy).not.toHaveBeenCalled()
    const warningEmits = broker.published.filter(
      (p) => p.topic === ISOLATION_WARNING_TOPIC,
    )
    expect(warningEmits).toHaveLength(0)
    // Ma cache è popolata con DEFAULT.
    expect(cache.get('mf-1')).toEqual(DEFAULT_ISOLATION_POLICY)
  })

  test('6. abortSignal cascade: ctrl.abort() → cache cleared + handler unsubscribed', () => {
    const broker = createMockBroker()
    const cache = createPolicyCache()
    const ctrl = new AbortController()
    installRegisterHook(broker, { cache, signal: ctrl.signal })

    broker.publish(
      'microfrontend.registered',
      descriptorStub('mf-1', { dom: 'shadow-dom' }),
    )
    expect(cache.size()).toBe(1)
    expect(broker.handlers.get('microfrontend.registered')).toHaveLength(1)

    ctrl.abort()

    expect(cache.size()).toBe(0)
    expect(broker.handlers.get('microfrontend.registered')).toHaveLength(0)
  })

  test('7. idempotent register stesso mfId: cache.set sovrascrive, warning re-emitted', () => {
    const broker = createMockBroker()
    const cache = createPolicyCache()
    const warnSpy = vi.fn()
    installRegisterHook(broker, { cache, warn: warnSpy })

    // Publish 2x con stesso mfId, descriptors diversi (re-register scenario).
    broker.publish(
      'microfrontend.registered',
      descriptorStub('mf-1', { dom: 'shadow-dom' }),
    )
    broker.publish(
      'microfrontend.registered',
      descriptorStub('mf-1', {
        dom: 'iframe',
        js: 'shared-window',
        network: 'blocked',
      }),
    )

    // Cache sovrascritta con ultimo register.
    expect(cache.size()).toBe(1)
    expect(cache.get('mf-1')?.dom).toBe('iframe')

    // Warning P-13 emesso solo al secondo register (primo register era valid).
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const warningEmits = broker.published.filter(
      (p) => p.topic === ISOLATION_WARNING_TOPIC,
    )
    expect(warningEmits).toHaveLength(1)
  })
})

describe('installRegisterHook — edge cases', () => {
  test('payload malformato senza descriptor id → handler silenzia (defensive)', () => {
    const broker = createMockBroker()
    const cache = createPolicyCache()
    const warnSpy = vi.fn()
    installRegisterHook(broker, { cache, warn: warnSpy })

    // Payload senza descriptor / id → extractMfId ritorna undefined → early return.
    broker.publish('microfrontend.registered', {})
    broker.publish('microfrontend.registered', null)
    broker.publish('microfrontend.registered', undefined)

    expect(cache.size()).toBe(0)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('unsubscribe() handle manuale rimuove la subscription', () => {
    const broker = createMockBroker()
    const cache = createPolicyCache()
    const handle = installRegisterHook(broker, { cache })

    expect(broker.handlers.get('microfrontend.registered')).toHaveLength(1)
    handle.unsubscribe()
    expect(broker.handlers.get('microfrontend.registered')).toHaveLength(0)
  })

  test('signal già abortito alla install → teardown immediato (no subscription attiva)', () => {
    const broker = createMockBroker()
    const cache = createPolicyCache()
    const ctrl = new AbortController()
    ctrl.abort() // abort PRIMA della install
    installRegisterHook(broker, { cache, signal: ctrl.signal })

    // Subscription già rimossa (teardown immediato).
    expect(broker.handlers.get('microfrontend.registered')).toHaveLength(0)
  })
})
