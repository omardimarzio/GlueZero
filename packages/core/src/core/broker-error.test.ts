import { describe, expect, it } from 'vitest'
import { createBrokerError, isBrokerError } from './broker-error'

describe('createBrokerError', () => {
  it('builds a BrokerError with required fields', () => {
    const err = createBrokerError({ code: 'foo.bar', category: 'plugin', message: 'oops' })
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('BrokerError')
    expect(err.code).toBe('foo.bar')
    expect(err.category).toBe('plugin')
    expect(err.message).toBe('oops')
  })

  it('attaches optional fields when provided', () => {
    const original = new Error('underlying')
    const err = createBrokerError({
      code: 'route.failed',
      category: 'route',
      message: 'route x failed',
      details: { attempt: 2 },
      originalError: original,
      routeId: 'r1',
      topic: 'weather.requested',
      eventId: 'evt-1',
    })
    expect(err.details).toEqual({ attempt: 2 })
    expect(err.originalError).toBe(original)
    expect(err.routeId).toBe('r1')
    expect(err.topic).toBe('weather.requested')
    expect(err.eventId).toBe('evt-1')
  })

  it('sets Error.cause when originalError is provided (ES2022)', () => {
    const original = new Error('underlying')
    const err = createBrokerError({
      code: 'x',
      category: 'system',
      message: 'y',
      originalError: original,
    })
    expect((err as Error & { cause?: unknown }).cause).toBe(original)
  })

  it('omits optional fields entirely when not provided (no undefined property)', () => {
    const err = createBrokerError({ code: 'x', category: 'system', message: 'y' })
    expect('details' in err).toBe(false)
    expect('originalError' in err).toBe(false)
    expect('routeId' in err).toBe(false)
    expect('topic' in err).toBe(false)
    expect('eventId' in err).toBe(false)
  })
})

describe('isBrokerError', () => {
  it('returns true for a BrokerError', () => {
    const err = createBrokerError({ code: 'x', category: 'system', message: 'y' })
    expect(isBrokerError(err)).toBe(true)
  })

  it('returns false for a plain Error', () => {
    expect(isBrokerError(new Error('plain'))).toBe(false)
  })

  it('returns false for null/undefined', () => {
    expect(isBrokerError(null)).toBe(false)
    expect(isBrokerError(undefined)).toBe(false)
  })

  it('returns false for a plain object with code+category but not an Error', () => {
    expect(isBrokerError({ code: 'x', category: 'system', message: 'y' })).toBe(false)
  })

  it('returns false for a string', () => {
    expect(isBrokerError('error string')).toBe(false)
  })
})
