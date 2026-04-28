// Test suite per event-validator (VAL-01, VAL-06).
//
// Coverage:
// - validateEvent accetta event minimo valido
// - validateEvent accetta event con tutti i campi opzionali (incl. priority='critical')
// - validateEvent rifiuta {} con BrokerError code='event.validation.failed'
// - validateEvent rifiuta empty id (minLength 1)
// - validateEvent rifiuta topic invalido (uppercase)
// - validateEvent rifiuta timestamp negativo
// - validateEvent rifiuta source.id empty
// - validateEvent rifiuta source.type non in picklist
// - validateEvent rifiuta deliveryMode non in picklist
// - validateEvent accetta priority='critical'
// - BrokerError lanciato include details.issues come array Valibot

import { describe, expect, it } from 'vitest'
import { isBrokerError } from './broker-error'
import { validateEvent } from './event-validator'

const baseValid = {
  id: 'evt-1',
  topic: 'weather.requested',
  timestamp: 1700000000000,
  source: { type: 'plugin', id: 'plugin-a' },
  payload: { city: 'Roma' },
}

describe('validateEvent', () => {
  it('accepts a minimal valid event', () => {
    expect(() => validateEvent(baseValid)).not.toThrow()
  })

  it('accepts event with all optional fields', () => {
    expect(() =>
      validateEvent({
        ...baseValid,
        metadata: { x: 1 },
        correlationId: 'c-1',
        causationId: 'c-0',
        traceId: 't-1',
        schemaVersion: '1.0',
        deliveryMode: 'async',
        priority: 'critical',
        ttlMs: 5000,
        dedupeKey: 'k-1',
      }),
    ).not.toThrow()
  })

  it('rejects empty object', () => {
    let caught: unknown = null
    try {
      validateEvent({})
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('event.validation.failed')
  })

  it('rejects empty id', () => {
    expect(() => validateEvent({ ...baseValid, id: '' })).toThrow()
  })

  it('rejects invalid topic (uppercase)', () => {
    expect(() => validateEvent({ ...baseValid, topic: 'Weather.X' })).toThrow()
  })

  it('rejects negative timestamp', () => {
    expect(() => validateEvent({ ...baseValid, timestamp: -1 })).toThrow()
  })

  it('rejects empty source.id', () => {
    expect(() => validateEvent({ ...baseValid, source: { type: 'plugin', id: '' } })).toThrow()
  })

  it('rejects invalid source.type', () => {
    expect(() => validateEvent({ ...baseValid, source: { type: 'invalid', id: 'p' } })).toThrow()
  })

  it('rejects invalid deliveryMode', () => {
    expect(() => validateEvent({ ...baseValid, deliveryMode: 'invalid' })).toThrow()
  })

  it('accepts priority "critical"', () => {
    expect(() => validateEvent({ ...baseValid, priority: 'critical' })).not.toThrow()
  })

  it('attached error includes details.issues', () => {
    let caught: unknown = null
    try {
      validateEvent({})
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    const details = (caught as { details: { issues: unknown[] } }).details
    expect(Array.isArray(details.issues)).toBe(true)
    expect(details.issues.length).toBeGreaterThan(0)
  })
})
