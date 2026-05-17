/**
 * Tier-1 jsdom — `share-scope-conflict.ts` warn + emit topic (D-V2-F15-10 warn + proceed).
 *
 * Coverage:
 * - Version match → no warn / no emit (happy path).
 * - Version mismatch → console.warn + emit topic `microfrontend.mf.share.version-mismatch`.
 * - Payload shape `{mfId, sharedKey, required, provided, timestamp}` corretto.
 * - NO throw — procede (D-V2-F15-10 warn-then-proceed carryover F12).
 * - Issue #4071 awareness — host version not resolvable → silent skip (no false positive).
 */
import type { Broker } from '@gluezero/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { compareShareScopes, type ShareVersionMismatchPayload } from '../share-scope-conflict'

interface MockBroker {
  readonly publish: ReturnType<typeof vi.fn>
}

function makeBroker(): MockBroker {
  return { publish: vi.fn() }
}

describe('compareShareScopes — D-V2-F15-10 warn + proceed (carryover F12)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // Clean up global pollution from prior tests.
    delete (globalThis as Record<string, unknown>)['__webpack_share_scopes__']
    delete (globalThis as Record<string, unknown>)['react']
    delete (globalThis as Record<string, unknown>)['vue']
  })

  afterEach(() => {
    warnSpy.mockRestore()
    delete (globalThis as Record<string, unknown>)['__webpack_share_scopes__']
    delete (globalThis as Record<string, unknown>)['react']
    delete (globalThis as Record<string, unknown>)['vue']
  })

  it('version match — no warn + no emit (happy path)', () => {
    // host fornisce react@18.2.5, MF richiede ^18.2.0 → match
    ;(globalThis as Record<string, unknown>)['react'] = { version: '18.2.5' }
    const broker = makeBroker()
    compareShareScopes({ react: { requiredVersion: '^18.2.0' } }, broker as unknown as Broker, 'mf-x')
    expect(warnSpy).not.toHaveBeenCalled()
    expect(broker.publish).not.toHaveBeenCalled()
  })

  it('version mismatch — warn + emit topic microfrontend.mf.share.version-mismatch', () => {
    // host fornisce react@19.0.0, MF richiede ^18.2 → mismatch
    ;(globalThis as Record<string, unknown>)['react'] = { version: '19.0.0' }
    const broker = makeBroker()
    compareShareScopes(
      { react: { requiredVersion: '^18.2.0' } },
      broker as unknown as Broker,
      'mf-dashboard',
    )
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toContain('mf-mf')
    expect(warnSpy.mock.calls[0]?.[0]).toContain('mf-dashboard')
    expect(warnSpy.mock.calls[0]?.[0]).toContain('react@^18.2.0')
    expect(warnSpy.mock.calls[0]?.[0]).toContain('react@19.0.0')
    expect(broker.publish).toHaveBeenCalledTimes(1)
    const [topic, payload] = broker.publish.mock.calls[0] as [string, ShareVersionMismatchPayload]
    expect(topic).toBe('microfrontend.mf.share.version-mismatch')
    expect(payload.mfId).toBe('mf-dashboard')
    expect(payload.sharedKey).toBe('react')
    expect(payload.required).toBe('^18.2.0')
    expect(payload.provided).toBe('19.0.0')
    expect(typeof payload.timestamp).toBe('number')
    expect(payload.timestamp).toBeGreaterThan(0)
  })

  it('compareShareScopes NON throw — procede (D-V2-F15-10 warn-then-proceed)', () => {
    ;(globalThis as Record<string, unknown>)['react'] = { version: '19.0.0' }
    const broker = makeBroker()
    expect(() => {
      compareShareScopes(
        { react: { requiredVersion: '^18.2.0' } },
        broker as unknown as Broker,
        'mf-x',
      )
    }).not.toThrow()
  })

  it('Issue #4071 — host version not resolvable → silent skip (no false positive)', () => {
    // NO window.react NO __webpack_share_scopes__ — host version unknown
    const broker = makeBroker()
    compareShareScopes(
      { react: { requiredVersion: '^18.2.0' } },
      broker as unknown as Broker,
      'mf-x',
    )
    expect(warnSpy).not.toHaveBeenCalled()
    expect(broker.publish).not.toHaveBeenCalled()
  })

  it('Strategy 2 — webpack MF runtime __webpack_share_scopes__ detection', () => {
    ;(globalThis as Record<string, unknown>)['__webpack_share_scopes__'] = {
      default: { vue: { version: '3.5.0' } },
    }
    const broker = makeBroker()
    compareShareScopes(
      { vue: { requiredVersion: '^2.7.0' } },
      broker as unknown as Broker,
      'mf-vue',
    )
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(broker.publish).toHaveBeenCalledWith(
      'microfrontend.mf.share.version-mismatch',
      expect.objectContaining({
        mfId: 'mf-vue',
        sharedKey: 'vue',
        required: '^2.7.0',
        provided: '3.5.0',
      }),
    )
  })

  it('requiredVersion undefined — skip (no check)', () => {
    ;(globalThis as Record<string, unknown>)['react'] = { version: '19.0.0' }
    const broker = makeBroker()
    compareShareScopes({ react: { singleton: true } }, broker as unknown as Broker, 'mf-x')
    expect(warnSpy).not.toHaveBeenCalled()
    expect(broker.publish).not.toHaveBeenCalled()
  })
})
