/**
 * Tier-1 jsdom — `errors.ts` MfIframeError class + factory + 6 literal codes
 * (D-V2-F15-12).
 */
import { describe, expect, it } from 'vitest'
import { createMfIframeError, MfIframeError, type MfIframeErrorCode } from '../errors'

describe('MfIframeError — D-V2-F15-12 class + 6 literal codes', () => {
  it('instanceof MfIframeError + Error', () => {
    const err = new MfIframeError({
      code: 'MF_IFRAME_BRIDGE_TIMEOUT',
      message: 'timeout test',
    })
    expect(err).toBeInstanceOf(MfIframeError)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('MfIframeError')
  })

  it('BrokerError shape: category = microfrontend readonly', () => {
    const err = new MfIframeError({
      code: 'MF_IFRAME_ORIGIN_MISMATCH',
      message: 'origin mismatch test',
    })
    expect(err.category).toBe('microfrontend')
  })

  it('6 literal codes union — all valid', () => {
    const codes: MfIframeErrorCode[] = [
      'MF_IFRAME_BRIDGE_TIMEOUT',
      'MF_IFRAME_ORIGIN_MISMATCH',
      'MF_IFRAME_SCHEMA_INVALID',
      'MF_IFRAME_REPLAY_DETECTED',
      'MF_IFRAME_RATE_LIMITED',
      'MF_IFRAME_SANDBOX_DENIED',
    ]
    for (const code of codes) {
      const err = new MfIframeError({ code, message: `test ${code}` })
      expect(err.code).toBe(code)
    }
  })

  it('microFrontendId + origin + details propagati', () => {
    const err = new MfIframeError({
      code: 'MF_IFRAME_REPLAY_DETECTED',
      message: 'replay detected',
      microFrontendId: 'mf-x',
      origin: 'https://iframe.com',
      details: { messageId: 'msg-1' },
    })
    expect(err.microFrontendId).toBe('mf-x')
    expect(err.origin).toBe('https://iframe.com')
    expect(err.details).toEqual({ messageId: 'msg-1' })
  })

  it('originalError + cause ES2022 chain', () => {
    const original = new Error('underlying')
    const err = new MfIframeError({
      code: 'MF_IFRAME_BRIDGE_TIMEOUT',
      message: 'wrapped',
      originalError: original,
    })
    expect(err.originalError).toBe(original)
    expect(err.cause).toBe(original)
  })

  it('createMfIframeError factory equivalent al new MfIframeError', () => {
    const errA = createMfIframeError({
      code: 'MF_IFRAME_SCHEMA_INVALID',
      message: 'schema-invalid',
      microFrontendId: 'mf-y',
    })
    expect(errA).toBeInstanceOf(MfIframeError)
    expect(errA.code).toBe('MF_IFRAME_SCHEMA_INVALID')
    expect(errA.microFrontendId).toBe('mf-y')
  })
})
