/**
 * F11 W2-P04 Task 2 — Tier-1 unit suite per `capability-checker.ts`.
 *
 * Coverage:
 * - MF-CAP-04 (4 policy valori PRD §17.6 dispatch)
 * - D-V2-F11-11 (event-driven enforcement contract)
 * - OQ-2 block-load alias a block-mount (research §6/§9 ACK)
 * - Pitfall 7 reuse F8 governance topic
 */
import { createBroker } from '@gluezero/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enforceCapabilityPolicy } from '../capability-checker'
import type { CapabilityCheckResult } from '../types/capabilities'

let warnSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

function okResult(): CapabilityCheckResult {
  return {
    ok: true,
    missing: [],
    incompatible: [],
    optionalMissing: [],
    provided: [],
    warnings: [],
  }
}

function failResult(): CapabilityCheckResult {
  return {
    ok: false,
    missing: ['theme.v1'],
    incompatible: [{ name: 'i18n.v2', required: '2.0.0', provided: '1.5.0' }],
    optionalMissing: [],
    provided: [],
    warnings: [],
  }
}

describe('enforceCapabilityPolicy (MF-CAP-04 — 4 policy valori PRD §17.6)', () => {
  it('policy off: skip (NO topic, NO throw, NO warn)', () => {
    const broker = createBroker({})
    const handler = vi.fn()
    broker.subscribe('microfrontend.capability.missing', handler)
    expect(() => enforceCapabilityPolicy(broker, 'mf1', failResult(), 'off')).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
    const checkerWarns = warnSpy.mock.calls.filter(
      (c) =>
        typeof c[0] === 'string' &&
        /capability check failed|aliased to 'block-mount'/.test(c[0] as string),
    )
    expect(checkerWarns).toHaveLength(0)
  })

  it('result.ok=true: skip qualunque policy', () => {
    const broker = createBroker({})
    const handler = vi.fn()
    broker.subscribe('microfrontend.capability.missing', handler)
    expect(() =>
      enforceCapabilityPolicy(broker, 'mf1', okResult(), 'block-mount'),
    ).not.toThrow()
    expect(handler).not.toHaveBeenCalled()
  })

  it('policy warn: topic publish + console.warn + NO throw', () => {
    const broker = createBroker({})
    const handler = vi.fn()
    broker.subscribe('microfrontend.capability.missing', handler)
    expect(() => enforceCapabilityPolicy(broker, 'mf1', failResult(), 'warn')).not.toThrow()
    expect(handler).toHaveBeenCalledOnce()
    const checkerWarns = warnSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && /capability check failed/.test(c[0] as string),
    )
    expect(checkerWarns).toHaveLength(1)
  })

  it('policy block-mount: topic + THROW CAPABILITY_MISSING', () => {
    const broker = createBroker({})
    const handler = vi.fn()
    broker.subscribe('microfrontend.capability.missing', handler)
    let thrown: unknown
    try {
      enforceCapabilityPolicy(broker, 'mf1', failResult(), 'block-mount')
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeDefined()
    const err = thrown as { code: string; category: string; details: { missing: string[] } }
    expect(err.code).toBe('CAPABILITY_MISSING')
    expect(err.category).toBe('microfrontend')
    expect(err.details.missing).toContain('theme.v1')
    expect(handler).toHaveBeenCalledOnce()
  })

  it('OQ-2 policy block-load: alias a block-mount + warning + THROW', () => {
    const broker = createBroker({})
    const handler = vi.fn()
    broker.subscribe('microfrontend.capability.missing', handler)
    expect(() =>
      enforceCapabilityPolicy(broker, 'mf1', failResult(), 'block-load'),
    ).toThrow(/missing capabilities/)
    expect(handler).toHaveBeenCalledOnce()
    const aliasWarns = warnSpy.mock.calls.filter(
      (c) => typeof c[0] === 'string' && /aliased to 'block-mount'/.test(c[0] as string),
    )
    expect(aliasWarns).toHaveLength(1)
  })

  it('payload topic include microFrontendId + missing + incompatible + timestamp', () => {
    const broker = createBroker({})
    const handler = vi.fn()
    broker.subscribe('microfrontend.capability.missing', handler)
    try {
      enforceCapabilityPolicy(broker, 'mf1', failResult(), 'block-mount')
    } catch {
      // intentional — verifica side-effect topic emit
    }
    const evt = handler.mock.calls[0]![0] as {
      payload: {
        microFrontendId: string
        missing: readonly string[]
        incompatible: readonly { name: string; required: string; provided: string }[]
        timestamp: number
      }
    }
    expect(evt.payload.microFrontendId).toBe('mf1')
    expect(evt.payload.missing).toContain('theme.v1')
    expect(evt.payload.incompatible).toContainEqual({
      name: 'i18n.v2',
      required: '2.0.0',
      provided: '1.5.0',
    })
    expect(typeof evt.payload.timestamp).toBe('number')
  })

  it('error message verbose include missing + incompatible details', () => {
    const broker = createBroker({})
    try {
      enforceCapabilityPolicy(broker, 'mf1', failResult(), 'block-mount')
    } catch (e) {
      const err = e as { message: string }
      expect(err.message).toMatch(/theme\.v1/)
      expect(err.message).toMatch(/i18n\.v2/)
      expect(err.message).toMatch(/2\.0\.0/)
      expect(err.message).toMatch(/1\.5\.0/)
    }
  })

  it('topic publish PRIMA del throw (sync flush garantito)', () => {
    const broker = createBroker({})
    const order: string[] = []
    broker.subscribe('microfrontend.capability.missing', () => {
      order.push('topic')
    })
    try {
      enforceCapabilityPolicy(broker, 'mf1', failResult(), 'block-mount')
    } catch {
      order.push('throw')
    }
    expect(order).toEqual(['topic', 'throw'])
  })
})
