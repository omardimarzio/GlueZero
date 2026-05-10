// Tier-1 jsdom tests per `createThemeError` factory + `isThemeError` type guard.
//
// Pattern role-match con `packages/core/src/core/broker-error.test.ts`. Coverage:
// shape Error nativo + readonly fields + conditional details (exactOptionalPropertyTypes).
//
// Refs: 07-01-PLAN.md Task 3 behavior test 4; PRD §22 (BrokerError contract).

import { describe, expect, it } from 'vitest'
import { createThemeError, isThemeError } from '../theme-error'

describe('createThemeError', () => {
  it('produces Error with code/category/message/name', () => {
    const err = createThemeError({
      code: 'theme.adapter.duplicate',
      message: 'Adapter "tailwind" già registrato',
    })
    expect(err).toBeInstanceOf(Error)
    expect(err.code).toBe('theme.adapter.duplicate')
    expect(err.category).toBe('theme')
    expect(err.message).toBe('Adapter "tailwind" già registrato')
    expect(err.name).toBe('ThemeError')
  })

  it('attaches details when provided', () => {
    const err = createThemeError({
      code: 'theme.token.invalid',
      message: 'Token validation failed',
      details: { field: 'color-primary', value: '<script>' },
    })
    expect(err.details).toEqual({ field: 'color-primary', value: '<script>' })
  })

  it('omits details property when not provided (exactOptionalPropertyTypes)', () => {
    const err = createThemeError({ code: 'theme.role.unregistered', message: 'X' })
    expect(err.details).toBeUndefined()
    expect('details' in err).toBe(false)
  })

  it('omits details property when explicitly null/undefined', () => {
    const err = createThemeError({
      code: 'theme.role.unregistered',
      message: 'X',
      details: undefined,
    })
    expect(err.details).toBeUndefined()
    expect('details' in err).toBe(false)
  })

  it('supports all ThemeErrorCode literals', () => {
    const codes = [
      'theme.token.invalid',
      'theme.token.cap-exceeded',
      'theme.role.invalid',
      'theme.role.unregistered',
      'theme.role.cap-exceeded',
      'theme.adapter.duplicate',
      'theme.adapter.invalid',
      'theme.adapter.unknown',
      'theme.snapshot.frozen',
      'theme.persistence.unavailable',
    ] as const
    for (const code of codes) {
      const err = createThemeError({ code, message: 'test' })
      expect(err.code).toBe(code)
    }
  })
})

describe('isThemeError', () => {
  it('returns true for ThemeError instance', () => {
    const err = createThemeError({ code: 'theme.snapshot.frozen', message: 'X' })
    expect(isThemeError(err)).toBe(true)
  })

  it('returns false for plain Error', () => {
    expect(isThemeError(new Error('plain'))).toBe(false)
  })

  it('returns false for non-Error values', () => {
    expect(isThemeError(null)).toBe(false)
    expect(isThemeError(undefined)).toBe(false)
    expect(isThemeError({})).toBe(false)
    expect(isThemeError('string')).toBe(false)
    expect(isThemeError(42)).toBe(false)
  })

  it('returns false for Error with foreign category', () => {
    const err = new Error('foreign') as Error & { category?: string; code?: string }
    err.category = 'broker'
    err.code = 'topic.invalid'
    expect(isThemeError(err)).toBe(false)
  })
})
