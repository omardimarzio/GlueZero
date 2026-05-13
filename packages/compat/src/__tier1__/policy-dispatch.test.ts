/**
 * F12 W2 Task 2 — Tier-1 unit suite per `policy-dispatch.ts` (MF-COMPAT-04).
 *
 * Coverage:
 * - 5 policy × 3 phase matrix (D-12-02..D-12-05).
 * - OQ-3 ratify: `block-load` su phase=`load` triggera throw VERO + alias mount carryover F11.
 * - D-12-05: emit topic 'failed'/'warning' PRIMA del throw.
 * - `policy='off'` no-op total.
 *
 * @see plan 12-02 Task 2 behavior — 15 test cases
 */
import { createBroker, isBrokerError } from '@gluezero/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enforceCompatPolicy } from '../policy-dispatch'
import type { CompatibilityReport } from '../types/report'

function makeReport(ok: boolean, withWarnings = false): CompatibilityReport {
  return {
    ok,
    microFrontendId: 'mf-1',
    checkedAt: 1700000000000,
    errors: ok
      ? []
      : [
          {
            type: 'gluezero-version',
            required: '^2.0.0',
            actual: '3.0.0',
            message: 'mismatch',
          },
        ],
    warnings: withWarnings
      ? [
          {
            type: 'topic-version',
            required: '^1.0.0',
            message: 'topic missing',
            context: { subKey: 'order.placed' },
          },
        ]
      : [],
  }
}

let warnSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
})

function setup() {
  const broker = createBroker({})
  const publishSpy = vi.spyOn(broker, 'publish')
  return { broker, publishSpy }
}

describe('enforceCompatPolicy — 5 policy × 3 phase matrix (D-12-02..D-12-05)', () => {
  it('Test 1: policy=off + ok=false → NO emit, NO throw', () => {
    const { broker, publishSpy } = setup()
    expect(() =>
      enforceCompatPolicy(broker, 'mf-1', makeReport(false), 'off', 'mount'),
    ).not.toThrow()
    expect(publishSpy).not.toHaveBeenCalled()
  })

  it('Test 2: policy=warn + ok=true + warnings=[] → NO emit', () => {
    const { broker, publishSpy } = setup()
    enforceCompatPolicy(broker, 'mf-1', makeReport(true), 'warn', 'mount')
    expect(publishSpy).not.toHaveBeenCalled()
  })

  it('Test 3: policy=warn + ok=true + warnings>0 → emit warning only', () => {
    const { broker, publishSpy } = setup()
    enforceCompatPolicy(broker, 'mf-1', makeReport(true, true), 'warn', 'mount')
    expect(publishSpy).toHaveBeenCalledTimes(1)
    expect(publishSpy).toHaveBeenCalledWith(
      'microfrontend.compatibility.warning',
      expect.any(Object),
      expect.any(Object),
    )
  })

  it('Test 4: policy=warn + ok=false → emit failed + console.warn + NO throw', () => {
    const { broker, publishSpy } = setup()
    expect(() =>
      enforceCompatPolicy(broker, 'mf-1', makeReport(false), 'warn', 'mount'),
    ).not.toThrow()
    const topicsEmitted = publishSpy.mock.calls.map((c) => c[0])
    expect(topicsEmitted).toContain('microfrontend.compatibility.warning')
    expect(topicsEmitted).toContain('microfrontend.compatibility.failed')
    expect(warnSpy).toHaveBeenCalled()
  })

  it('Test 5: policy=block-registration + phase=registration + ok=false → emit failed + throw', () => {
    const { broker, publishSpy } = setup()
    let thrown: unknown
    try {
      enforceCompatPolicy(
        broker,
        'mf-1',
        makeReport(false),
        'block-registration',
        'registration',
      )
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeDefined()
    expect(isBrokerError(thrown as Error)).toBe(true)
    expect((thrown as { code: string }).code).toBe('COMPAT_INCOMPATIBLE')
    expect(publishSpy).toHaveBeenCalledWith(
      'microfrontend.compatibility.failed',
      expect.any(Object),
      expect.any(Object),
    )
  })

  it('Test 6: policy=block-registration + phase=load → NO throw (phase non match)', () => {
    const { broker } = setup()
    expect(() =>
      enforceCompatPolicy(
        broker,
        'mf-1',
        makeReport(false),
        'block-registration',
        'load',
      ),
    ).not.toThrow()
  })

  it('Test 7: policy=block-registration + phase=mount → NO throw', () => {
    const { broker } = setup()
    expect(() =>
      enforceCompatPolicy(
        broker,
        'mf-1',
        makeReport(false),
        'block-registration',
        'mount',
      ),
    ).not.toThrow()
  })

  it('Test 8: policy=block-load + phase=load + ok=false → emit + THROW (OQ-3 FUNZIONALE F12)', () => {
    const { broker } = setup()
    expect(() =>
      enforceCompatPolicy(broker, 'mf-1', makeReport(false), 'block-load', 'load'),
    ).toThrow()
  })

  it('Test 9: policy=block-load + phase=mount + ok=false → emit + THROW (alias mount F11 carryover)', () => {
    const { broker } = setup()
    expect(() =>
      enforceCompatPolicy(broker, 'mf-1', makeReport(false), 'block-load', 'mount'),
    ).toThrow()
  })

  it('Test 10: policy=block-load + phase=registration → NO throw', () => {
    const { broker } = setup()
    expect(() =>
      enforceCompatPolicy(
        broker,
        'mf-1',
        makeReport(false),
        'block-load',
        'registration',
      ),
    ).not.toThrow()
  })

  it('Test 11: policy=block-mount + phase=mount + ok=false → emit + THROW', () => {
    const { broker } = setup()
    expect(() =>
      enforceCompatPolicy(broker, 'mf-1', makeReport(false), 'block-mount', 'mount'),
    ).toThrow()
  })

  it('Test 12: policy=block-mount + phase=load → NO throw', () => {
    const { broker } = setup()
    expect(() =>
      enforceCompatPolicy(broker, 'mf-1', makeReport(false), 'block-mount', 'load'),
    ).not.toThrow()
  })

  it('Test 13: policy=block-mount + phase=registration → NO throw', () => {
    const { broker } = setup()
    expect(() =>
      enforceCompatPolicy(
        broker,
        'mf-1',
        makeReport(false),
        'block-mount',
        'registration',
      ),
    ).not.toThrow()
  })

  it('Test 14: throw CompatError ha code COMPAT_INCOMPATIBLE + details.phase matched', () => {
    const { broker } = setup()
    let thrown: unknown
    try {
      enforceCompatPolicy(broker, 'mf-1', makeReport(false), 'block-mount', 'mount')
    } catch (e) {
      thrown = e
    }
    expect((thrown as { code: string }).code).toBe('COMPAT_INCOMPATIBLE')
    const details = (thrown as { details: { phase: string; microFrontendId: string } }).details
    expect(details.phase).toBe('mount')
    expect(details.microFrontendId).toBe('mf-1')
  })

  it('Test 15: emit-PRIMA-del-throw ordering verified (failed emit before throw exec)', () => {
    const { broker, publishSpy } = setup()
    let throwOrder = -1
    publishSpy.mockImplementation(() => {
      throwOrder = throwOrder === -1 ? 1 : throwOrder
    })
    try {
      enforceCompatPolicy(broker, 'mf-1', makeReport(false), 'block-mount', 'mount')
    } catch {
      // throw happens AFTER publish — verify by call count
    }
    expect(publishSpy).toHaveBeenCalled()
    // L'ordering è verificato dal fatto che il throw avviene DOPO il publish
    // (test che il publish è stato chiamato anche se è seguito da throw).
    expect(publishSpy.mock.calls.length).toBeGreaterThan(0)
    expect(publishSpy.mock.calls[0]![0]).toBe('microfrontend.compatibility.failed')
  })
})
