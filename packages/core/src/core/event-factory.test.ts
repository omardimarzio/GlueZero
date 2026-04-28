// Test suite per event-factory (CORE-07, D-21..D-23).
//
// Coverage:
// - Default id (nanoid 21+ chars URL-safe) e uniqueness probabilistica
// - Custom id rispettato quando fornito
// - Default timestamp = Date.now() entro [before, after] window
// - Custom timestamp rispettato
// - Default deliveryMode='async' (D-01) e priority='normal'
// - source obbligatorio (D-23): throw BrokerError event.source.missing se mancante
// - defaultSource fallback quando params.source assente
// - source param vince su defaultSource quando entrambi presenti
// - exactOptionalPropertyTypes: campi opzionali NON aggiunti come `undefined` se assenti
//   (`'foo' in event === false` se non fornito)
// - Optional fields preservati quando forniti

import { describe, expect, it } from 'vitest'
import type { EventSource } from '../types/broker-event'
import { isBrokerError } from './broker-error'
import { createBrokerEvent } from './event-factory'

const SRC: EventSource = { type: 'plugin', id: 'plugin-a' }

describe('createBrokerEvent', () => {
  it('generates a default id (nanoid, length >= 21)', () => {
    const evt = createBrokerEvent(
      { topic: 'weather.requested', payload: { city: 'Roma' }, source: SRC },
      undefined,
    )
    expect(typeof evt.id).toBe('string')
    expect(evt.id.length).toBeGreaterThanOrEqual(21)
  })

  it('generates unique ids across calls', () => {
    const a = createBrokerEvent({ topic: 't.a', payload: {}, source: SRC }, undefined)
    const b = createBrokerEvent({ topic: 't.a', payload: {}, source: SRC }, undefined)
    expect(a.id).not.toBe(b.id)
  })

  it('respects custom id when provided', () => {
    const evt = createBrokerEvent(
      { topic: 't.a', payload: {}, source: SRC, id: 'custom-id' },
      undefined,
    )
    expect(evt.id).toBe('custom-id')
  })

  it('generates default timestamp via Date.now()', () => {
    const before = Date.now()
    const evt = createBrokerEvent({ topic: 't.a', payload: {}, source: SRC }, undefined)
    const after = Date.now()
    expect(evt.timestamp).toBeGreaterThanOrEqual(before)
    expect(evt.timestamp).toBeLessThanOrEqual(after)
  })

  it('respects custom timestamp', () => {
    const evt = createBrokerEvent(
      { topic: 't.a', payload: {}, source: SRC, timestamp: 12345 },
      undefined,
    )
    expect(evt.timestamp).toBe(12345)
  })

  it('default deliveryMode is "async"', () => {
    const evt = createBrokerEvent({ topic: 't.a', payload: {}, source: SRC }, undefined)
    expect(evt.deliveryMode).toBe('async')
  })

  it('default priority is "normal"', () => {
    const evt = createBrokerEvent({ topic: 't.a', payload: {}, source: SRC }, undefined)
    expect(evt.priority).toBe('normal')
  })

  it('throws BrokerError event.source.missing when no source and no defaultSource', () => {
    let caught: unknown = null
    try {
      createBrokerEvent({ topic: 't.a', payload: {} }, undefined)
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('event.source.missing')
  })

  it('uses defaultSource when source param absent', () => {
    const def: EventSource = { type: 'system', id: 'broker' }
    const evt = createBrokerEvent({ topic: 't.a', payload: {} }, def)
    expect(evt.source).toEqual(def)
  })

  it('source param wins over defaultSource', () => {
    const def: EventSource = { type: 'system', id: 'broker' }
    const evt = createBrokerEvent({ topic: 't.a', payload: {}, source: SRC }, def)
    expect(evt.source).toEqual(SRC)
  })

  it('omits optional fields when not provided', () => {
    const evt = createBrokerEvent({ topic: 't.a', payload: {}, source: SRC }, undefined)
    expect('correlationId' in evt).toBe(false)
    expect('causationId' in evt).toBe(false)
    expect('traceId' in evt).toBe(false)
    expect('schemaVersion' in evt).toBe(false)
    expect('ttlMs' in evt).toBe(false)
    expect('dedupeKey' in evt).toBe(false)
    expect('metadata' in evt).toBe(false)
  })

  it('includes optional fields when provided', () => {
    const evt = createBrokerEvent(
      {
        topic: 't.a',
        payload: {},
        source: SRC,
        correlationId: 'c-1',
        causationId: 'c-0',
        traceId: 't-1',
        schemaVersion: '1.0',
        ttlMs: 5000,
        dedupeKey: 'k-1',
        metadata: { foo: 'bar' },
      },
      undefined,
    )
    expect(evt.correlationId).toBe('c-1')
    expect(evt.causationId).toBe('c-0')
    expect(evt.traceId).toBe('t-1')
    expect(evt.schemaVersion).toBe('1.0')
    expect(evt.ttlMs).toBe(5000)
    expect(evt.dedupeKey).toBe('k-1')
    expect(evt.metadata).toEqual({ foo: 'bar' })
  })
})
