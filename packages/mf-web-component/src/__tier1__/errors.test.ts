/**
 * Tier-1 unit tests — `MfWebComponentError` class + `createMfWebComponentError` factory.
 *
 * Coverage:
 * - instanceof MfWebComponentError + instanceof Error (cross-realm safe via setPrototypeOf)
 * - BrokerError shape inline (`category: 'microfrontend'` readonly + `code` + `microFrontendId?` + `details?`)
 * - `cause` ES2022 propagato via `super(message, {cause})`
 * - `originalError` preservato + auto-aliased a `cause` se `cause` undefined
 * - Factory `createMfWebComponentError` ritorna MfWebComponentError instance
 *
 * @see D-V2-F15-12 — Custom error class per-package
 */
import { describe, expect, it } from 'vitest'
import {
  createMfWebComponentError,
  MfWebComponentError,
  type MfWebComponentErrorCode,
} from '../errors'

describe('MfWebComponentError class', () => {
  it('instanceof MfWebComponentError + instanceof Error per ognuno dei 4 codes', () => {
    const codes: MfWebComponentErrorCode[] = [
      'MF_WC_DEFINE_TIMEOUT',
      'MF_WC_ALREADY_DEFINED',
      'MF_WC_SCRIPT_LOAD_FAILED',
      'MF_WC_CONTEXT_MODE_INVALID',
    ]
    for (const code of codes) {
      const err = new MfWebComponentError({ code, message: `msg-${code}` })
      expect(err).toBeInstanceOf(MfWebComponentError)
      expect(err).toBeInstanceOf(Error)
      expect(err.code).toBe(code)
      expect(err.name).toBe('MfWebComponentError')
    }
  })

  it('BrokerError shape inline: category=microfrontend readonly + message + code + name', () => {
    const err = new MfWebComponentError({
      code: 'MF_WC_DEFINE_TIMEOUT',
      message: 'timeout',
      microFrontendId: 'mf-x',
      details: { elementName: 'mf-x-comp', timeoutMs: 15000 },
    })
    expect(err.category).toBe('microfrontend')
    expect(err.code).toBe('MF_WC_DEFINE_TIMEOUT')
    expect(err.microFrontendId).toBe('mf-x')
    expect(err.details).toEqual({ elementName: 'mf-x-comp', timeoutMs: 15000 })
    expect(err.message).toBe('timeout')
  })

  it('cause ES2022 propagato via super(message, {cause})', () => {
    const original = new Error('original cause')
    const err = new MfWebComponentError({
      code: 'MF_WC_SCRIPT_LOAD_FAILED',
      message: 'wrap',
      cause: original,
    })
    expect((err as Error & { cause?: unknown }).cause).toBe(original)
  })

  it('originalError preservato + auto-alias a cause se cause undefined', () => {
    const original = new TypeError('network error')
    const err = new MfWebComponentError({
      code: 'MF_WC_SCRIPT_LOAD_FAILED',
      message: 'import failed',
      originalError: original,
    })
    expect(err.originalError).toBe(original)
    expect((err as Error & { cause?: unknown }).cause).toBe(original)
  })

  it('factory createMfWebComponentError ritorna MfWebComponentError instance', () => {
    const err = createMfWebComponentError({
      code: 'MF_WC_CONTEXT_MODE_INVALID',
      message: 'invalid mode',
      details: { mode: 'unknown' },
    })
    expect(err).toBeInstanceOf(MfWebComponentError)
    expect(err.code).toBe('MF_WC_CONTEXT_MODE_INVALID')
    expect(err.category).toBe('microfrontend')
  })

  it('isBrokerError duck-typing compatible (code !== undefined && category !== undefined)', () => {
    const err = new MfWebComponentError({
      code: 'MF_WC_ALREADY_DEFINED',
      message: 'collision',
    })
    // Duck-typing check senza dipendenza diretta da @gluezero/core/isBrokerError
    expect(err.code).not.toBeUndefined()
    expect(err.category).not.toBeUndefined()
  })
})
