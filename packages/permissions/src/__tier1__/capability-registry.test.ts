/**
 * F11 W2-P04 Task 1 — Tier-1 unit suite per `capability-registry.ts`.
 *
 * Coverage:
 * - MF-CAP-02 (5 API methods PRD §17.4 + cleanup cascade D-V2-16)
 * - MF-CAP-03 (CheckResult shape PRD §17.5 6-field)
 * - D-V2-F11-09 (global single SoT)
 * - D-V2-F11-10 (string equality only — semver defer F12)
 * - Pitfall 6 first-wins (warn once per name+version tuple)
 * - Pitfall 7 ACK (F8 governance topic riusato — verifica indiretta)
 */
import { createBroker } from '@gluezero/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCapabilityRegistry } from '../capability-registry'

let warnSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

function setup() {
  const broker = createBroker({})
  const registry = createCapabilityRegistry(broker, 'warn')
  return { broker, registry }
}

describe('createCapabilityRegistry (5 API methods PRD §17.4 + cleanup cascade D-V2-16)', () => {
  it('registerCapability + hasCapability exact match', () => {
    const { registry } = setup()
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mfA')
    expect(registry.hasCapability('theme.v1', '1.0.0')).toBe(true)
  })

  it('hasCapability senza version: any version match', () => {
    const { registry } = setup()
    registry.registerCapability({ name: 'theme.v1', version: '2.3.4' }, 'mfA')
    expect(registry.hasCapability('theme.v1')).toBe(true)
    expect(registry.hasCapability('missing.cap')).toBe(false)
  })

  it('hasCapability missing → false', () => {
    const { registry } = setup()
    expect(registry.hasCapability('theme.v1', '1.0.0')).toBe(false)
  })

  it('Pitfall 6 first-wins: duplicate registration warn + ignore', () => {
    const { registry } = setup()
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mfA')
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mfB')
    expect(warnSpy).toHaveBeenCalled()
    const msg = warnSpy.mock.calls[0]![0] as string
    expect(msg).toMatch(/theme\.v1@1\.0\.0/)
    expect(msg).toMatch(/mfA/)
    expect(msg).toMatch(/mfB/)
    expect(msg).toMatch(/ignoring duplicate/)
  })

  it('Pitfall 6: warn una volta sola per (name, version) tuple', () => {
    const { registry } = setup()
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mfA')
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mfB')
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mfC')
    const pitfall6Warns = warnSpy.mock.calls.filter((c) =>
      typeof c[0] === 'string' && /ignoring duplicate registration/.test(c[0] as string),
    )
    expect(pitfall6Warns).toHaveLength(1)
  })

  it('unregisterCapability + topic capability.unregistered emit', () => {
    const { broker, registry } = setup()
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mfA')
    const handler = vi.fn()
    broker.subscribe('capability.unregistered', handler)
    expect(registry.unregisterCapability('theme.v1', '1.0.0')).toBe(true)
    expect(registry.hasCapability('theme.v1', '1.0.0')).toBe(false)
    expect(handler).toHaveBeenCalledOnce()
  })

  it('unregisterCapability su entry inesistente: ritorna false (no-op)', () => {
    const { broker, registry } = setup()
    const handler = vi.fn()
    broker.subscribe('capability.unregistered', handler)
    expect(registry.unregisterCapability('missing', '1.0.0')).toBe(false)
    expect(handler).not.toHaveBeenCalled()
  })

  it('getCapabilities enumera tutti gli entries registrati', () => {
    const { registry } = setup()
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mfA')
    registry.registerCapability({ name: 'i18n.v2', version: '2.5.0' }, 'mfB')
    const all = registry.getCapabilities()
    expect(all).toHaveLength(2)
    expect(all).toContainEqual({ name: 'theme.v1', version: '1.0.0' })
    expect(all).toContainEqual({ name: 'i18n.v2', version: '2.5.0' })
  })

  it('topic capability.registered emit su register successful', () => {
    const { broker, registry } = setup()
    const handler = vi.fn()
    broker.subscribe('capability.registered', handler)
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mfA')
    expect(handler).toHaveBeenCalledOnce()
    const evt = handler.mock.calls[0]![0] as {
      payload: { name: string; version: string; providerMfId: string; timestamp: number }
    }
    expect(evt.payload).toMatchObject({
      name: 'theme.v1',
      version: '1.0.0',
      providerMfId: 'mfA',
    })
    expect(typeof evt.payload.timestamp).toBe('number')
  })

  it('topic capability.registered NON emit su duplicate first-wins skip', () => {
    const { broker, registry } = setup()
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mfA')
    const handler = vi.fn()
    broker.subscribe('capability.registered', handler)
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mfB')
    expect(handler).not.toHaveBeenCalled()
  })

  it('cleanupByMfId rimuove tutte le caps providedBy mfA (D-V2-16 cascade)', () => {
    const { registry } = setup()
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mfA')
    registry.registerCapability({ name: 'i18n.v2', version: '2.5.0' }, 'mfA')
    registry.registerCapability({ name: 'analytics.v1', version: '1.0.0' }, 'mfB')
    const removed = registry.cleanupByMfId('mfA')
    expect(removed).toBe(2)
    expect(registry.hasCapability('theme.v1', '1.0.0')).toBe(false)
    expect(registry.hasCapability('i18n.v2', '2.5.0')).toBe(false)
    expect(registry.hasCapability('analytics.v1', '1.0.0')).toBe(true)
  })

  it('cleanupByMfId su mfId senza caps: ritorna 0 (no-op)', () => {
    const { registry } = setup()
    expect(registry.cleanupByMfId('mf-unknown')).toBe(0)
  })

  it('invalidateCheckCache: ri-evaluate check result post-mutation registry', () => {
    const { registry } = setup()
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mfA')
    const r1 = registry.checkMicroFrontendCapabilities('mf1', {
      requires: [{ name: 'theme.v1', version: '1.0.0' }],
    })
    expect(r1.ok).toBe(true)
    // Unregister + clear cache → ri-evaluate.
    registry.unregisterCapability('theme.v1', '1.0.0')
    const r2 = registry.checkMicroFrontendCapabilities('mf1', {
      requires: [{ name: 'theme.v1', version: '1.0.0' }],
    })
    expect(r2.ok).toBe(false)
    expect(r2.missing).toContain('theme.v1')
  })
})

describe('checkMicroFrontendCapabilities (MF-CAP-03 6-field shape + D-V2-F11-10 string equality)', () => {
  it('caps undefined → ok true + tutti i field empty', () => {
    const { registry } = setup()
    const r = registry.checkMicroFrontendCapabilities('mf1', undefined)
    expect(r).toEqual({
      ok: true,
      missing: [],
      incompatible: [],
      optionalMissing: [],
      provided: [],
      warnings: [],
    })
  })

  it('required exact match present → ok', () => {
    const { registry } = setup()
    registry.registerCapability({ name: 'theme.v1', version: '1.0.0' }, 'mfA')
    const r = registry.checkMicroFrontendCapabilities('mf1', {
      requires: [{ name: 'theme.v1', version: '1.0.0' }],
    })
    expect(r.ok).toBe(true)
    expect(r.missing).toEqual([])
    expect(r.incompatible).toEqual([])
  })

  it('required name+version absent → missing populated', () => {
    const { registry } = setup()
    const r = registry.checkMicroFrontendCapabilities('mf1', {
      requires: [{ name: 'theme.v1', version: '1.0.0' }],
    })
    expect(r.ok).toBe(false)
    expect(r.missing).toContain('theme.v1')
    expect(r.incompatible).toEqual([])
  })

  it('D-V2-F11-10 string equality: required name presente con version diversa → incompatible', () => {
    const { registry } = setup()
    registry.registerCapability({ name: 'theme.v1', version: '1.0.5' }, 'mfA')
    const r = registry.checkMicroFrontendCapabilities('mf1', {
      requires: [{ name: 'theme.v1', version: '1.0.0' }],
    })
    expect(r.ok).toBe(false)
    expect(r.incompatible).toContainEqual({
      name: 'theme.v1',
      required: '1.0.0',
      provided: '1.0.5',
    })
    expect(r.missing).toEqual([])
  })

  it('required version undefined (any version) → any provided matcha', () => {
    const { registry } = setup()
    registry.registerCapability({ name: 'theme.v1', version: '1.0.5' }, 'mfA')
    const r = registry.checkMicroFrontendCapabilities('mf1', {
      requires: [{ name: 'theme.v1' }],
    })
    expect(r.ok).toBe(true)
    expect(r.missing).toEqual([])
  })

  it('optional missing → optionalMissing + warnings populated (OQ-4)', () => {
    const { registry } = setup()
    const r = registry.checkMicroFrontendCapabilities('mf1', {
      optional: [{ name: 'analytics.v1', version: '2.0.0' }],
    })
    expect(r.ok).toBe(true) // optional NON fa fallire
    expect(r.optionalMissing).toContain('analytics.v1')
    expect(r.warnings.length).toBeGreaterThan(0)
    expect(r.warnings[0]).toMatch(/Optional capability "analytics\.v1@2\.0\.0"/)
  })

  it('optional senza version assente → optionalMissing + warning any version', () => {
    const { registry } = setup()
    const r = registry.checkMicroFrontendCapabilities('mf1', {
      optional: [{ name: 'analytics.v1' }],
    })
    expect(r.optionalMissing).toContain('analytics.v1')
    expect(r.warnings[0]).toMatch(/"analytics\.v1" \(any version\) not satisfied/)
  })

  it('caps.provides passa-through come provided[]', () => {
    const { registry } = setup()
    const r = registry.checkMicroFrontendCapabilities('mf1', {
      provides: [{ name: 'mf1.cap.v1', version: '1.0.0' }],
    })
    expect(r.provided).toContainEqual({ name: 'mf1.cap.v1', version: '1.0.0' })
  })
})
