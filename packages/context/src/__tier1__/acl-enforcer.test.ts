/**
 * Tier-1 jsdom — ACL enforcement (MF-CTX-04, D-V2-F10-05/06).
 *
 * Unit suite (questo file):
 * - `getWritableKeys` — type narrowing locale + default fail-secure.
 * - `enforceWrite` — app shell pass-through, denied throw, topic publish ordering.
 *
 * Integration suite (Task 3 — append `describe('integration: setRuntimeContext + ACL', ...)`).
 *
 * Threat T-F10-01 (ACL bypass) verified: stateless check + fail-secure default.
 */
import type { Broker } from '@gluezero/core'
import { createBroker } from '@gluezero/core'
import type { MicroFrontendDescriptor, MicroFrontendsService } from '@gluezero/microfrontends'
import { microfrontendModule } from '@gluezero/microfrontends'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CONTEXT_DENIED_TOPIC, enforceWrite, getWritableKeys } from '../acl-enforcer'
import { contextModule } from '../context-module'
import {
  __resetForTest,
  clearRuntimeContext,
  getRuntimeContext,
  replaceRuntimeContext,
  setRuntimeContext,
} from '../runtime-context'

describe('getWritableKeys — type narrowing locale (D-V2-F10-05 fail-secure)', () => {
  it('default vuoto se descriptor sans context field', () => {
    const desc = { id: 'mf-x', name: 'X', version: '1.0' } as MicroFrontendDescriptor
    expect(getWritableKeys(desc)).toEqual([])
  })

  it('default vuoto se descriptor.context = {}', () => {
    const desc = { id: 'mf-x', context: {} } as unknown as MicroFrontendDescriptor
    expect(getWritableKeys(desc)).toEqual([])
  })

  it('ritorna writableKeys se descriptor.context.writableKeys array presente', () => {
    const desc = {
      id: 'mf-x',
      context: { writableKeys: ['currentRoute', 'theme'] },
    } as unknown as MicroFrontendDescriptor
    expect(getWritableKeys(desc)).toEqual(['currentRoute', 'theme'])
  })

  it('default vuoto se writableKeys explicitly undefined', () => {
    const desc = {
      id: 'mf-x',
      context: { writableKeys: undefined },
    } as unknown as MicroFrontendDescriptor
    expect(getWritableKeys(desc)).toEqual([])
  })

  it('ritorna writableKeys vuoto se explicit empty array (read-only explicit)', () => {
    const desc = {
      id: 'mf-x',
      context: { writableKeys: [] },
    } as unknown as MicroFrontendDescriptor
    expect(getWritableKeys(desc)).toEqual([])
  })
})

describe('enforceWrite — ACL throw + topic publish (MF-CTX-04, D-V2-F10-06)', () => {
  function makeMockBroker(): { broker: Broker; publish: ReturnType<typeof vi.fn> } {
    const publish = vi.fn()
    const broker = { publish } as unknown as Broker
    return { broker, publish }
  }

  it('mfId undefined (app shell) → pass-through NO throw NO publish', () => {
    const { broker, publish } = makeMockBroker()
    expect(() => enforceWrite(broker, undefined, ['tenantId'], [])).not.toThrow()
    expect(publish).not.toHaveBeenCalled()
  })

  it('mfId defined + tutte chiavi in writableKeys → NO throw NO publish', () => {
    const { broker, publish } = makeMockBroker()
    expect(() =>
      enforceWrite(broker, 'mf-x', ['currentRoute'], ['currentRoute', 'theme']),
    ).not.toThrow()
    expect(publish).not.toHaveBeenCalled()
  })

  it('mfId defined + 1+ chiave NOT in writableKeys → THROW MF_CONTEXT_WRITE_DENIED', () => {
    const { broker } = makeMockBroker()
    expect(() => enforceWrite(broker, 'mf-x', ['tenantId'], ['currentRoute'])).toThrowError(
      /MicroFrontend "mf-x" attempted/,
    )
  })

  it('THROW anche se 1/N allowed (fail-secure su prima denied — no partial mutation)', () => {
    const { broker } = makeMockBroker()
    expect(() =>
      enforceWrite(broker, 'mf-x', ['tenantId', 'currentRoute'], ['currentRoute']),
    ).toThrow()
  })

  it('writableKeys vuoto + MF tenta scrittura → THROW (fail-secure default)', () => {
    const { broker } = makeMockBroker()
    expect(() => enforceWrite(broker, 'mf-x', ['tenantId'], [])).toThrowError(
      /MicroFrontend "mf-x" attempted/,
    )
  })

  it('publica topic microfrontend.context.denied PRIMA del throw (ordering)', () => {
    const { broker, publish } = makeMockBroker()
    try {
      enforceWrite(broker, 'mf-x', ['tenantId'], ['currentRoute'])
      expect.fail('should have thrown')
    } catch {
      // Topic deve essere stato pubblicato PRIMA del throw
      expect(publish).toHaveBeenCalledTimes(1)
      const call = publish.mock.calls[0]!
      expect(call[0]).toBe(CONTEXT_DENIED_TOPIC)
    }
  })

  it('payload denied shape: {microFrontendId, attemptedKeys, allowedKeys, timestamp}', () => {
    const { broker, publish } = makeMockBroker()
    try {
      enforceWrite(broker, 'mf-x', ['tenantId', 'user'], ['currentRoute'])
    } catch {
      const payload = publish.mock.calls[0]![1] as Record<string, unknown>
      expect(payload['microFrontendId']).toBe('mf-x')
      expect(payload['attemptedKeys']).toEqual(['tenantId', 'user'])
      expect(payload['allowedKeys']).toEqual(['currentRoute'])
      expect(typeof payload['timestamp']).toBe('number')
    }
  })

  it('publish options include source descriptor + deliveryMode sync (D-23 + D-V2-F10-14)', () => {
    const { broker, publish } = makeMockBroker()
    try {
      enforceWrite(broker, 'mf-x', ['tenantId'], ['currentRoute'])
    } catch {
      const opts = publish.mock.calls[0]![2] as Record<string, unknown>
      expect(opts).toBeDefined()
      expect(opts['source']).toMatchObject({ type: 'plugin', id: 'context' })
      expect(opts['deliveryMode']).toBe('sync')
    }
  })

  it('CONTEXT_DENIED_TOPIC literal locale è "microfrontend.context.denied"', () => {
    expect(CONTEXT_DENIED_TOPIC).toBe('microfrontend.context.denied')
  })

  it('error details contiene mfId + attemptedKeys + allowedKeys + deniedKeys', () => {
    const { broker } = makeMockBroker()
    try {
      enforceWrite(broker, 'mf-x', ['tenantId', 'user', 'currentRoute'], ['currentRoute'])
      expect.fail('should have thrown')
    } catch (err: unknown) {
      const e = err as { details?: Record<string, unknown> }
      expect(e.details?.['mfId']).toBe('mf-x')
      expect(e.details?.['attemptedKeys']).toEqual(['tenantId', 'user', 'currentRoute'])
      expect(e.details?.['allowedKeys']).toEqual(['currentRoute'])
      expect(e.details?.['deniedKeys']).toEqual(['tenantId', 'user'])
    }
  })
})

// ===== Integration: setRuntimeContext + ACL writableKeys end-to-end =====

interface TestMfDescriptor extends MicroFrontendDescriptor {
  readonly context?: { readonly writableKeys?: readonly string[] }
}

describe('integration: setRuntimeContext + ACL writableKeys (MF-CTX-04 end-to-end)', () => {
  beforeEach(() => {
    __resetForTest()
  })
  afterEach(() => {
    __resetForTest()
  })

  function makeHarnessWithMf(
    mfId: string,
    writableKeys: readonly string[] | undefined,
  ): { broker: Broker; mfService: MicroFrontendsService } {
    const broker = createBroker({ modules: [microfrontendModule(), contextModule()] })
    const mfService = broker.getService<MicroFrontendsService>('microfrontends')
    if (!mfService) throw new Error('mfService missing — microfrontendModule not installed')

    // Build descriptor con context.writableKeys (cast TestMfDescriptor per type narrowing locale).
    const descriptor: TestMfDescriptor = {
      id: mfId,
      name: `Test MF ${mfId}`,
      version: '1.0.0',
      loader: { type: 'esm', url: `/${mfId}.js` },
      ...(writableKeys !== undefined && { context: { writableKeys } }),
    } as TestMfDescriptor
    mfService.register(descriptor)
    return { broker, mfService }
  }

  it('callerMfId defined + chiave NOT in writableKeys → THROW + publish denied topic', () => {
    const { broker } = makeHarnessWithMf('mf-x', ['currentRoute'])
    const deniedHandler = vi.fn()
    broker.subscribe('microfrontend.context.denied', deniedHandler)

    expect(() =>
      setRuntimeContext({ tenantId: 'acme' }, { callerMfId: 'mf-x' }),
    ).toThrowError(/MicroFrontend "mf-x" attempted/)
    expect(deniedHandler).toHaveBeenCalledTimes(1)
  })

  it('callerMfId defined + chiave IN writableKeys → OK + state aggiornato', () => {
    makeHarnessWithMf('mf-x', ['currentRoute'])
    const route = { path: '/home' }
    expect(() =>
      setRuntimeContext({ currentRoute: route }, { callerMfId: 'mf-x' }),
    ).not.toThrow()
    expect(getRuntimeContext().currentRoute).toEqual(route)
  })

  it('callerMfId undefined (app shell) → OK su qualsiasi chiave (bypass ACL)', () => {
    makeHarnessWithMf('mf-x', ['currentRoute']) // MF setup ma chiamiamo da app shell
    expect(() => setRuntimeContext({ tenantId: 'acme' })).not.toThrow()
    expect(getRuntimeContext().tenantId).toBe('acme')
  })

  it('writableKeys vuoto (fail-secure explicit) → MF NON può scrivere niente', () => {
    makeHarnessWithMf('mf-x', []) // explicit empty
    expect(() => setRuntimeContext({ tenantId: 'acme' }, { callerMfId: 'mf-x' })).toThrow()
    expect(() =>
      setRuntimeContext({ currentRoute: { path: '/h' } }, { callerMfId: 'mf-x' }),
    ).toThrow()
  })

  it('descriptor sans context field (fail-secure default) → MF NON può scrivere niente', () => {
    makeHarnessWithMf('mf-y', undefined) // NO context field
    expect(() => setRuntimeContext({ tenantId: 'acme' }, { callerMfId: 'mf-y' })).toThrow()
  })

  it('fail-fast: no partial mutation se denied (state invariato post-throw)', () => {
    makeHarnessWithMf('mf-x', ['currentRoute'])
    setRuntimeContext({ tenantId: 'pre' }) // app shell setup pre-existing
    try {
      setRuntimeContext(
        { tenantId: 'denied', currentRoute: { path: '/h' } },
        { callerMfId: 'mf-x' },
      )
      expect.fail('should have thrown')
    } catch {
      /* expected */
    }
    // State invariato: tenantId rimane 'pre', currentRoute mai scritto (no partial mutation)
    const ctx = getRuntimeContext()
    expect(ctx.tenantId).toBe('pre')
    expect(ctx.currentRoute).toBeUndefined()
  })

  it('clearRuntimeContext con callerMfId che clear chiave NOT in writableKeys → THROW', () => {
    makeHarnessWithMf('mf-x', ['currentRoute'])
    setRuntimeContext({ tenantId: 'X' }) // app shell setup
    expect(() => clearRuntimeContext(['tenantId'], { callerMfId: 'mf-x' })).toThrow()
  })

  it('clearRuntimeContext con callerMfId che clear chiave IN writableKeys → OK', () => {
    makeHarnessWithMf('mf-x', ['currentRoute'])
    setRuntimeContext({ currentRoute: { path: '/h' } }) // app shell setup
    expect(() => clearRuntimeContext(['currentRoute'], { callerMfId: 'mf-x' })).not.toThrow()
    expect(getRuntimeContext().currentRoute).toBeUndefined()
  })

  it('replaceRuntimeContext con callerMfId controlla union previous+next keys', () => {
    makeHarnessWithMf('mf-x', ['currentRoute'])
    setRuntimeContext({ tenantId: 'X' }) // app shell pre-existing
    // MF tenta replace → union(['tenantId'], ['currentRoute']) include 'tenantId' NOT in writable → throw
    expect(() =>
      replaceRuntimeContext({ currentRoute: { path: '/h' } }, { callerMfId: 'mf-x' }),
    ).toThrow()
  })

  it('MF non registrato (defensive) → pass-through senza throw (tratta come app shell)', () => {
    makeHarnessWithMf('mf-x', ['currentRoute'])
    // callerMfId 'mf-ghost' non registrato → checkAcl defensive return
    expect(() =>
      setRuntimeContext({ tenantId: 'acme' }, { callerMfId: 'mf-ghost' }),
    ).not.toThrow()
  })

  it('payload denied topic shape end-to-end (microFrontendId + attemptedKeys + allowedKeys + timestamp)', () => {
    const { broker } = makeHarnessWithMf('mf-x', ['currentRoute'])
    const deniedHandler = vi.fn()
    broker.subscribe('microfrontend.context.denied', deniedHandler)

    try {
      setRuntimeContext({ tenantId: 'acme', user: { id: 'u1' } }, { callerMfId: 'mf-x' })
    } catch {
      /* expected */
    }
    expect(deniedHandler).toHaveBeenCalledTimes(1)
    const event = deniedHandler.mock.calls[0]![0] as {
      payload: Record<string, unknown>
    }
    expect(event.payload['microFrontendId']).toBe('mf-x')
    expect(event.payload['attemptedKeys']).toEqual(['tenantId', 'user'])
    expect(event.payload['allowedKeys']).toEqual(['currentRoute'])
    expect(typeof event.payload['timestamp']).toBe('number')
  })
})
