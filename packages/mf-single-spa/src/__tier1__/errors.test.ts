/**
 * Tier-1 jsdom — `errors.ts` MfSingleSpaError class + factory + 4 literal codes
 * (D-V2-F15-12).
 */
import { describe, expect, it } from 'vitest'
import { createMfSingleSpaError, MfSingleSpaError, type MfSingleSpaErrorCode } from '../errors'

describe('MfSingleSpaError — D-V2-F15-12 class + 4 literal codes', () => {
  it('instanceof MfSingleSpaError + Error', () => {
    const err = new MfSingleSpaError({
      code: 'MF_SS_LIFECYCLE_INVALID',
      message: 'lifecycle invalid',
    })
    expect(err).toBeInstanceOf(MfSingleSpaError)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('MfSingleSpaError')
  })

  it('BrokerError shape: category = "microfrontend" readonly inline', () => {
    const err = new MfSingleSpaError({
      code: 'MF_SS_MOUNT_FAILED',
      message: 'mount failed',
    })
    expect(err.category).toBe('microfrontend')
  })

  it('4 literal codes union — all valid', () => {
    const codes: MfSingleSpaErrorCode[] = [
      'MF_SS_LIFECYCLE_INVALID',
      'MF_SS_BOOTSTRAP_FAILED',
      'MF_SS_MOUNT_FAILED',
      'MF_SS_UNMOUNT_FAILED',
    ]
    for (const code of codes) {
      const err = new MfSingleSpaError({ code, message: `test ${code}` })
      expect(err.code).toBe(code)
    }
  })

  it('microFrontendId + appName + details propagati', () => {
    const err = new MfSingleSpaError({
      code: 'MF_SS_MOUNT_FAILED',
      message: 'mount failed',
      microFrontendId: 'mf-navbar',
      appName: 'navbar',
      details: { phase: 'mount' },
    })
    expect(err.microFrontendId).toBe('mf-navbar')
    expect(err.appName).toBe('navbar')
    expect(err.details).toEqual({ phase: 'mount' })
  })

  it('originalError + cause ES2022 chain', () => {
    const original = new Error('underlying lifecycle')
    const err = new MfSingleSpaError({
      code: 'MF_SS_BOOTSTRAP_FAILED',
      message: 'wrapped',
      originalError: original,
    })
    expect(err.originalError).toBe(original)
    expect(err.cause).toBe(original)
  })

  it('createMfSingleSpaError factory equivalent al new MfSingleSpaError', () => {
    const errA = createMfSingleSpaError({
      code: 'MF_SS_UNMOUNT_FAILED',
      message: 'unmount failed',
      appName: 'foo',
    })
    expect(errA).toBeInstanceOf(MfSingleSpaError)
    expect(errA.code).toBe('MF_SS_UNMOUNT_FAILED')
    expect(errA.appName).toBe('foo')
  })
})
