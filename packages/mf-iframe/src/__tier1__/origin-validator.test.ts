/**
 * Tier-1 jsdom — `origin-validator.ts` expectedOrigin MANDATORY + targetOrigin '*' BAN
 * (REQ MF-IFRAME-04 — T-15-04..05 origin spoofing + wildcard).
 */
import { describe, expect, it } from 'vitest'
import { MfIframeError } from '../errors'
import { validateExpectedOrigin, validateTargetOrigin } from '../origin-validator'

describe('validateExpectedOrigin — REQ MF-IFRAME-04 MANDATORY enforcement', () => {
  it('passes con origin specifico https://...', () => {
    expect(() => validateExpectedOrigin('https://iframe.example.com', 'mf-x')).not.toThrow()
  })

  it('throws MF_IFRAME_ORIGIN_MISMATCH se undefined', () => {
    try {
      validateExpectedOrigin(undefined, 'mf-x')
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(MfIframeError)
      expect((e as MfIframeError).code).toBe('MF_IFRAME_ORIGIN_MISMATCH')
      expect((e as MfIframeError).microFrontendId).toBe('mf-x')
    }
  })

  it('throws MF_IFRAME_ORIGIN_MISMATCH se empty string', () => {
    expect(() => validateExpectedOrigin('', 'mf-x')).toThrow(MfIframeError)
  })

  it("throws MF_IFRAME_ORIGIN_MISMATCH se '*' wildcard banned", () => {
    try {
      validateExpectedOrigin('*', 'mf-x')
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(MfIframeError)
      expect((e as MfIframeError).code).toBe('MF_IFRAME_ORIGIN_MISMATCH')
      expect((e as MfIframeError).details).toMatchObject({ reason: 'wildcard banned' })
    }
  })
})

describe('validateTargetOrigin — runtime dual-defense PRIMARY (REQ MF-IFRAME-04)', () => {
  it('passes con origin specifico https://...', () => {
    expect(() => validateTargetOrigin('https://host.example.com', 'mf-x')).not.toThrow()
  })

  it('throws se empty string', () => {
    expect(() => validateTargetOrigin('', 'mf-x')).toThrow(MfIframeError)
  })

  it("throws con '*' wildcard ban", () => {
    try {
      validateTargetOrigin('*', 'mf-x')
      throw new Error('expected throw')
    } catch (e) {
      expect(e).toBeInstanceOf(MfIframeError)
      expect((e as MfIframeError).code).toBe('MF_IFRAME_ORIGIN_MISMATCH')
      expect((e as MfIframeError).origin).toBe('*')
    }
  })
})
