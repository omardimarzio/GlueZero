/**
 * `microfrontend-error.test.ts` — Tier-1 unit suite (jsdom) per `MicroFrontendError` class.
 *
 * Cover REQ-IDs: MF-FALLBACK-04 (class extends Error + BrokerError shape inline +
 * cause ES2022 + duck-typing compat + toBrokerError helper).
 *
 * 12 test totali:
 *  1. Constructor minimal + tutti readonly fields settati.
 *  2. instanceof MicroFrontendError + instanceof Error (entrambi true).
 *  3. isBrokerError(err) duck-typing PASS (compat @gluezero/core).
 *  4. ES2022 cause propagato via super(message, {cause}).
 *  5. originalError → cause fallback quando cause undefined (ES2022 chain).
 *  6. toBrokerError() ritorna plain shape (no instanceof MicroFrontendError).
 *  7. 5 codici MfFallbackErrorCode hint compile + runtime assignment.
 *  8. recoverable:false per phase unmount/destroy (heuristic default).
 *  9. details Record<string,unknown> preserved.
 * 10. originalError separate da cause quando entrambi forniti.
 * 11. name === 'MicroFrontendError' (stack trace + JSON.stringify).
 * 12. Prototype chain preserved via Object.setPrototypeOf (cross-realm instanceof).
 */
import { describe, it, expect } from 'vitest'
import { isBrokerError } from '@gluezero/core'
import { MicroFrontendError } from './microfrontend-error.js'
import type { MfFallbackErrorCode } from './types/errors.js'

describe('MicroFrontendError class', () => {
  it('constructs minimal with all required readonly fields', () => {
    const err = new MicroFrontendError({
      code: 'MF_FALLBACK_RENDER_FAILED',
      message: 'render failed',
      microFrontendId: 'mf-1',
      lifecyclePhase: 'load',
      recoverable: true,
    })
    expect(err.message).toBe('render failed')
    expect(err.code).toBe('MF_FALLBACK_RENDER_FAILED')
    expect(err.microFrontendId).toBe('mf-1')
    expect(err.lifecyclePhase).toBe('load')
    expect(err.recoverable).toBe(true)
    expect(err.category).toBe('microfrontend')
  })

  it('is instanceof MicroFrontendError AND instanceof Error', () => {
    const err = new MicroFrontendError({
      code: 'X',
      message: 'm',
      microFrontendId: 'mf-1',
      lifecyclePhase: 'mount',
      recoverable: false,
    })
    expect(err instanceof MicroFrontendError).toBe(true)
    expect(err instanceof Error).toBe(true)
  })

  it('passes isBrokerError duck-typing guard from @gluezero/core', () => {
    const err = new MicroFrontendError({
      code: 'X',
      message: 'm',
      microFrontendId: 'mf-1',
      lifecyclePhase: 'bootstrap',
      recoverable: true,
    })
    expect(isBrokerError(err)).toBe(true)
  })

  it('propagates ES2022 cause via super(message, { cause })', () => {
    const reason = new Error('root cause')
    const err = new MicroFrontendError({
      code: 'X',
      message: 'wrapped',
      microFrontendId: 'mf-1',
      lifecyclePhase: 'load',
      recoverable: true,
      cause: reason,
    })
    expect((err as Error & { cause?: unknown }).cause).toBe(reason)
  })

  it('uses originalError as cause when cause is undefined (ES2022 chain fallback)', () => {
    const orig = new Error('original')
    const err = new MicroFrontendError({
      code: 'X',
      message: 'wrapped',
      microFrontendId: 'mf-1',
      lifecyclePhase: 'load',
      recoverable: true,
      originalError: orig,
    })
    expect(err.originalError).toBe(orig)
    expect((err as Error & { cause?: unknown }).cause).toBe(orig)
  })

  it('toBrokerError() returns plain shape with category/code/message/details/originalError', () => {
    const orig = new Error('original')
    const err = new MicroFrontendError({
      code: 'MF_RETRY_EXHAUSTED',
      message: 'retry exhausted',
      microFrontendId: 'mf-1',
      lifecyclePhase: 'mount',
      recoverable: false,
      details: { attempts: 3 },
      originalError: orig,
    })
    const be = err.toBrokerError()
    expect(be.category).toBe('microfrontend')
    expect(be.code).toBe('MF_RETRY_EXHAUSTED')
    expect(be.message).toBe('retry exhausted')
    expect(be.details).toEqual({ attempts: 3 })
    expect(be.originalError).toBe(orig)
    // toBrokerError returns plain BrokerError shape, NOT MicroFrontendError instance
    expect((be as unknown) instanceof MicroFrontendError).toBe(false)
  })

  it('accepts all 5 MfFallbackErrorCode hint values (compile-time check + runtime assignment)', () => {
    const codes: MfFallbackErrorCode[] = [
      'MF_FALLBACK_RENDER_FAILED',
      'MF_RETRY_EXHAUSTED',
      'MF_CIRCUIT_OPEN',
      'MF_FALLBACK_TARGET_NOT_FOUND',
      'MF_FALLBACK_COMPONENT_NO_ADAPTER',
    ]
    for (const code of codes) {
      const err = new MicroFrontendError({
        code,
        message: 'x',
        microFrontendId: 'mf-1',
        lifecyclePhase: 'load',
        recoverable: true,
      })
      expect(err.code).toBe(code)
    }
  })

  it('accepts recoverable:false heuristic for unmount/destroy phase', () => {
    const errU = new MicroFrontendError({
      code: 'X',
      message: 'm',
      microFrontendId: 'mf-1',
      lifecyclePhase: 'unmount',
      recoverable: false,
    })
    const errD = new MicroFrontendError({
      code: 'X',
      message: 'm',
      microFrontendId: 'mf-1',
      lifecyclePhase: 'destroy',
      recoverable: false,
    })
    expect(errU.recoverable).toBe(false)
    expect(errD.recoverable).toBe(false)
  })

  it('preserves details Record<string, unknown> optional field', () => {
    const err = new MicroFrontendError({
      code: 'X',
      message: 'm',
      microFrontendId: 'mf-1',
      lifecyclePhase: 'load',
      recoverable: true,
      details: { foo: 'bar', count: 42, nested: { ok: true } },
    })
    expect(err.details).toEqual({ foo: 'bar', count: 42, nested: { ok: true } })
  })

  it('propagates originalError separately from cause when both provided', () => {
    const orig = new Error('original')
    const causeVal = 'string-cause'
    const err = new MicroFrontendError({
      code: 'X',
      message: 'm',
      microFrontendId: 'mf-1',
      lifecyclePhase: 'load',
      recoverable: true,
      originalError: orig,
      cause: causeVal,
    })
    expect(err.originalError).toBe(orig)
    expect((err as Error & { cause?: unknown }).cause).toBe(causeVal)
  })

  it('has name === "MicroFrontendError" for stack trace + JSON.stringify', () => {
    const err = new MicroFrontendError({
      code: 'X',
      message: 'm',
      microFrontendId: 'mf-1',
      lifecyclePhase: 'load',
      recoverable: true,
    })
    expect(err.name).toBe('MicroFrontendError')
  })

  it('preserves prototype chain via Object.setPrototypeOf (cross-realm instanceof)', () => {
    const err = new MicroFrontendError({
      code: 'X',
      message: 'm',
      microFrontendId: 'mf-1',
      lifecyclePhase: 'load',
      recoverable: true,
    })
    expect(Object.getPrototypeOf(err)).toBe(MicroFrontendError.prototype)
  })
})
