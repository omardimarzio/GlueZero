import { isBrokerError } from '@gluezero/core'
import { describe, expect, it } from 'vitest'
import { createMfError } from './microfrontend-error'

describe('createMfError', () => {
  it('crea un BrokerError con category microfrontend', () => {
    const err = createMfError({
      code: 'MF_DESCRIPTOR_INVALID',
      message: 'test descriptor invalid',
    })
    expect(isBrokerError(err)).toBe(true)
    expect(err.code).toBe('MF_DESCRIPTOR_INVALID')
    expect(err.category).toBe('microfrontend')
    expect(err.message).toBe('test descriptor invalid')
  })

  it('include details quando fornito', () => {
    const err = createMfError({
      code: 'MF_STATE_INVALID',
      message: 'invalid transition',
      details: { from: 'destroyed', to: 'mounted' },
    })
    expect(err.details).toEqual({ from: 'destroyed', to: 'mounted' })
  })

  it('preserva originalError come cause', () => {
    const original = new Error('root cause')
    const err = createMfError({
      code: 'MF_LOADER_INVALID_MODULE',
      message: 'wrapper',
      originalError: original,
    })
    expect(err.cause).toBe(original)
  })

  it('tutti gli 8 error codes sono validi', () => {
    const codes = [
      'MF_DESCRIPTOR_INVALID',
      'MF_STATE_INVALID',
      'MF_NOT_REGISTERED',
      'MF_LIFECYCLE_IN_FLIGHT',
      'MF_LOADER_NOT_FOUND',
      'MF_LOADER_TYPE_DUPLICATE',
      'MF_LOADER_INVALID_MODULE',
      'MF_MOUNT_TARGET_NOT_FOUND',
    ] as const
    for (const code of codes) {
      const err = createMfError({ code, message: `test ${code}` })
      expect(err.code).toBe(code)
    }
  })
})
