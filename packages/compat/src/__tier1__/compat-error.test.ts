/**
 * F12 W2 Task 2 — Tier-1 unit suite per `compat-error.ts` (MF-COMPAT-04 + OQ-4).
 *
 * Coverage:
 * - `createCompatError` shape (category 'microfrontend' direct-cast OQ-4 + code + details).
 * - `publishCompatTopics` (level='failed' → F8 governance reuse; level='warning' → F12 locale).
 * - REVISIONE WARNING 8: source via `COMPAT_PUBLISH_SOURCE` import.
 *
 * @see plan 12-02 Task 2 behavior — 5 test cases
 */
import { createBroker, isBrokerError } from '@gluezero/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCompatError, publishCompatTopics } from '../compat-error'
import { COMPAT_PUBLISH_SOURCE } from '../internal/compat-source'
import type { CompatibilityReport } from '../types/report'

function fakeReport(overrides?: Partial<CompatibilityReport>): CompatibilityReport {
  return {
    ok: false,
    microFrontendId: 'mf-1',
    checkedAt: 1700000000000,
    errors: [
      { type: 'gluezero-version', required: '^2.0.0', actual: '3.0.0', message: 'mismatch' },
    ],
    warnings: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('createCompatError — BrokerError factory (OQ-4 microfrontend direct-cast)', () => {
  it('Test 1: code COMPAT_INCOMPATIBLE + category microfrontend + details shape', () => {
    const report = fakeReport()
    const err = createCompatError({
      code: 'COMPAT_INCOMPATIBLE',
      message: 'MF "mf-1" incompatible at mount',
      phase: 'mount',
      microFrontendId: 'mf-1',
      report,
    })
    expect(isBrokerError(err)).toBe(true)
    expect(err.code).toBe('COMPAT_INCOMPATIBLE')
    expect(err.category).toBe('microfrontend') // OQ-4 direct-cast (NON 'compatibility')
    expect(err.message).toBe('MF "mf-1" incompatible at mount')
    expect(err.details).toMatchObject({
      microFrontendId: 'mf-1',
      phase: 'mount',
      report,
    })
  })

  it('Test 2: code COMPAT_VERSION_INVALID + category preserved', () => {
    const report = fakeReport()
    const err = createCompatError({
      code: 'COMPAT_VERSION_INVALID',
      message: 'invalid range',
      phase: 'registration',
      microFrontendId: 'mf-x',
      report,
      details: { invalidValue: 'garbage' },
    })
    expect(err.code).toBe('COMPAT_VERSION_INVALID')
    expect(err.category).toBe('microfrontend')
    expect((err.details as { invalidValue: string }).invalidValue).toBe('garbage')
    expect((err.details as { microFrontendId: string }).microFrontendId).toBe('mf-x')
    expect((err.details as { phase: string }).phase).toBe('registration')
  })
})

describe('publishCompatTopics — F8 reuse + F12 locale', () => {
  it("Test 3: level='failed' emit 'microfrontend.compatibility.failed' (F8 reuse)", () => {
    const broker = createBroker({})
    const publishSpy = vi.spyOn(broker, 'publish')
    const report = fakeReport()
    publishCompatTopics(broker, report, 'failed')
    expect(publishSpy).toHaveBeenCalledTimes(1)
    expect(publishSpy).toHaveBeenCalledWith(
      'microfrontend.compatibility.failed',
      report,
      expect.any(Object),
    )
  })

  it("Test 4: level='warning' emit 'microfrontend.compatibility.warning' (F12 locale)", () => {
    const broker = createBroker({})
    const publishSpy = vi.spyOn(broker, 'publish')
    const report = fakeReport()
    publishCompatTopics(broker, report, 'warning')
    expect(publishSpy).toHaveBeenCalledTimes(1)
    expect(publishSpy).toHaveBeenCalledWith(
      'microfrontend.compatibility.warning',
      report,
      expect.any(Object),
    )
  })

  it('Test 5: emit usa source COMPAT_PUBLISH_SOURCE + deliveryMode sync (REVISIONE WARNING 8)', () => {
    const broker = createBroker({})
    const publishSpy = vi.spyOn(broker, 'publish')
    const report = fakeReport()
    publishCompatTopics(broker, report, 'failed')
    expect(publishSpy).toHaveBeenCalledWith(
      'microfrontend.compatibility.failed',
      report,
      expect.objectContaining({
        source: COMPAT_PUBLISH_SOURCE,
        deliveryMode: 'sync',
      }),
    )
  })
})
