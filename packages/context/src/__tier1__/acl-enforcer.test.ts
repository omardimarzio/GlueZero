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
import type { MicroFrontendDescriptor } from '@gluezero/microfrontends'
import { describe, expect, it, vi } from 'vitest'
import { CONTEXT_DENIED_TOPIC, enforceWrite, getWritableKeys } from '../acl-enforcer'

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
