/**
 * Tier-1 jsdom unit test per `service-locator.ts` (D-V2-F16-04).
 *
 * Copre: SERVICE_MF_INSPECTOR value, interface struttura compile-time, no collision.
 */
import { describe, expect, it } from 'vitest'
import { SERVICE_MF_INSPECTOR, type MfInspectorService } from '../service-locator'

describe('SERVICE_MF_INSPECTOR + MfInspectorService (D-V2-F16-04)', () => {
  it('SERVICE_MF_INSPECTOR === "mf-inspector" literal', () => {
    expect(SERVICE_MF_INSPECTOR).toBe('mf-inspector')
  })

  it('MfInspectorService interface struttura — 4 metodi (compile-time check)', () => {
    // Compile-time assertion via dummy implementation
    const dummy: MfInspectorService = {
      getSnapshot: () => ({ microFrontends: [] }),
      pause: () => undefined,
      resume: () => undefined,
      flush: () => [],
    }
    expect(typeof dummy.getSnapshot).toBe('function')
    expect(typeof dummy.pause).toBe('function')
    expect(typeof dummy.resume).toBe('function')
    expect(typeof dummy.flush).toBe('function')
  })

  it('SERVICE_MF_INSPECTOR distinto da altre constants SERVICE_*', () => {
    // Sanity check no-collision (es. SERVICE_FALLBACKS === 'fallbacks')
    expect(SERVICE_MF_INSPECTOR).not.toBe('fallbacks')
    expect(SERVICE_MF_INSPECTOR).not.toBe('permissions')
    expect(SERVICE_MF_INSPECTOR).not.toBe('compat')
    expect(SERVICE_MF_INSPECTOR).not.toBe('isolation')
    expect(SERVICE_MF_INSPECTOR).not.toBe('microfrontends')
  })
})
