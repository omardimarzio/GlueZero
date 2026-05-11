/**
 * Tier-1 jsdom — `createContextError` factory locale (MF-CTX-04, D-V2-F9-12 carryover).
 *
 * Verifica:
 * - `code: 'MF_CONTEXT_WRITE_DENIED'` literal preserved.
 * - `category: 'microfrontend'` cast literal (riuso F8 additive).
 * - `message` preserved as-is.
 * - `details` preserved se fornito; assente se omesso (spread conditional).
 * - `ContextErrorCode` literal narrow type (TS compile verification).
 */
import { describe, expect, it } from 'vitest'
import { type ContextErrorCode, createContextError } from '../context-error'

describe('createContextError — factory locale F9 D-V2-F9-12 carryover (MF-CTX-04)', () => {
  it('ritorna BrokerError con code MF_CONTEXT_WRITE_DENIED literal', () => {
    const err = createContextError({
      code: 'MF_CONTEXT_WRITE_DENIED',
      message: 'test denied',
    })
    expect(err.code).toBe('MF_CONTEXT_WRITE_DENIED')
  })

  it('category cast `microfrontend` (riuso F8 additive)', () => {
    const err = createContextError({
      code: 'MF_CONTEXT_WRITE_DENIED',
      message: 'test',
    })
    expect(err.category).toBe('microfrontend')
  })

  it('message preserved as-is', () => {
    const msg = 'MicroFrontend "x" attempted to write keys not allowed'
    const err = createContextError({ code: 'MF_CONTEXT_WRITE_DENIED', message: msg })
    expect(err.message).toBe(msg)
  })

  it('details preserved se fornito', () => {
    const details = { mfId: 'x', attemptedKeys: ['a'], allowedKeys: ['b'], deniedKeys: ['a'] }
    const err = createContextError({
      code: 'MF_CONTEXT_WRITE_DENIED',
      message: 'denied',
      details,
    })
    expect(err.details).toEqual(details)
  })

  it('details assente se omesso (spread conditional)', () => {
    const err = createContextError({
      code: 'MF_CONTEXT_WRITE_DENIED',
      message: 'denied',
    })
    expect(err.details).toBeUndefined()
  })

  it('ContextErrorCode è literal narrow type', () => {
    // Type-only test — TS compile verification
    const code: ContextErrorCode = 'MF_CONTEXT_WRITE_DENIED'
    expect(code).toBe('MF_CONTEXT_WRITE_DENIED')
    // @ts-expect-error — invalid code not in union
    const badCode: ContextErrorCode = 'INVALID_CODE'
    void badCode
  })

  it('shape completo BrokerError {code, category, message, details}', () => {
    const err = createContextError({
      code: 'MF_CONTEXT_WRITE_DENIED',
      message: 'integration shape test',
      details: { mfId: 'mf-test' },
    })
    expect(err).toMatchObject({
      code: 'MF_CONTEXT_WRITE_DENIED',
      category: 'microfrontend',
      message: 'integration shape test',
      details: { mfId: 'mf-test' },
    })
  })
})
