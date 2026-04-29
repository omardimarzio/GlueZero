// Test unit per CanonicalRegistry (plan 02-03 — TDD RED→GREEN).
//
// Copre i 11 behavior del PLAN <task>:
// - Idempotent register (Test 1)
// - D-36 requires resolution (Test 2, 3)
// - has/get accessor (Test 4, 5)
// - list() ordering + immutability T-02-03-02 (Test 6)
// - onRegistered observer pattern + unsubscribe (Test 7)
// - Listener throw isolation T-02-03-01 (Test 8)
// - unregister D-26 ext F2 (Test 9, 10)
// - strict mode duplicate detection (Test 11)
//
// Pattern replicato da packages/core/src/core/topic-registry.test.ts.

import { isBrokerError } from '@sembridge/core'
import { describe, expect, it, vi } from 'vitest'
import { CanonicalRegistry } from './canonical-registry'
import type { CanonicalSchema, CanonicalSchemaId } from './types/canonical-schema'

const makeSchema = (id: string, overrides: Partial<CanonicalSchema> = {}): CanonicalSchema => ({
  id: id as CanonicalSchemaId,
  fields: { foo: { type: 'string', required: true } },
  ...overrides,
})

describe('CanonicalRegistry', () => {
  it('register returns true for new schema, false on duplicate (idempotent)', () => {
    const reg = new CanonicalRegistry()
    expect(reg.register(makeSchema('weather'))).toBe(true)
    expect(reg.register(makeSchema('weather'))).toBe(false)
  })

  it('register throws canonical.requires.unresolved when requires contains unknown id (D-36)', () => {
    const reg = new CanonicalRegistry()
    let caught: unknown
    try {
      reg.register(makeSchema('forecast', { requires: ['user'] }))
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('canonical.requires.unresolved')
    expect((caught as { details: Record<string, unknown> }).details.id).toBe('forecast')
    expect((caught as { details: Record<string, unknown> }).details.missingRequires).toEqual([
      'user',
    ])
  })

  it('register succeeds when requires schemas are already registered', () => {
    const reg = new CanonicalRegistry()
    reg.register(makeSchema('user'))
    expect(reg.register(makeSchema('forecast', { requires: ['user'] }))).toBe(true)
  })

  it('has returns true for registered, false otherwise', () => {
    const reg = new CanonicalRegistry()
    reg.register(makeSchema('weather'))
    expect(reg.has('weather' as CanonicalSchemaId)).toBe(true)
    expect(reg.has('unknown' as CanonicalSchemaId)).toBe(false)
  })

  it('get returns the schema if present, undefined otherwise', () => {
    const reg = new CanonicalRegistry()
    const schema = makeSchema('weather')
    reg.register(schema)
    expect(reg.get('weather' as CanonicalSchemaId)).toEqual(schema)
    expect(reg.get('missing' as CanonicalSchemaId)).toBeUndefined()
  })

  it('list returns sorted array (deterministic) and a fresh copy on each call', () => {
    const reg = new CanonicalRegistry()
    reg.register(makeSchema('zeta'))
    reg.register(makeSchema('alpha'))
    reg.register(makeSchema('beta'))
    expect(reg.list()).toEqual(['alpha', 'beta', 'zeta'])

    // Mutation esterna non altera state interno (T-02-03-02 mitigation)
    const copy = reg.list()
    copy.push('mutated')
    expect(reg.list()).toEqual(['alpha', 'beta', 'zeta'])
  })

  it('onRegistered invokes listener on each new register; returns unsubscribe', () => {
    const reg = new CanonicalRegistry()
    const listener = vi.fn()
    const unsub = reg.onRegistered(listener)
    reg.register(makeSchema('a'))
    reg.register(makeSchema('b'))
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 'a' }))
    expect(listener).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 'b' }))

    unsub()
    reg.register(makeSchema('c'))
    expect(listener).toHaveBeenCalledTimes(2) // unchanged after unsub
  })

  it('listener throw is swallowed; subsequent listeners + register flow continue (T-02-03-01)', () => {
    const reg = new CanonicalRegistry()
    const throwingListener = vi.fn(() => {
      throw new Error('boom')
    })
    const goodListener = vi.fn()
    reg.onRegistered(throwingListener)
    reg.onRegistered(goodListener)
    expect(() => reg.register(makeSchema('a'))).not.toThrow()
    expect(throwingListener).toHaveBeenCalledTimes(1)
    expect(goodListener).toHaveBeenCalledTimes(1)
  })

  it('unregister removes schema and returns true; returns false on unknown id', () => {
    const reg = new CanonicalRegistry()
    reg.register(makeSchema('weather'))
    expect(reg.unregister('weather' as CanonicalSchemaId)).toBe(true)
    expect(reg.has('weather' as CanonicalSchemaId)).toBe(false)
    expect(reg.unregister('weather' as CanonicalSchemaId)).toBe(false)
    expect(reg.unregister('never' as CanonicalSchemaId)).toBe(false)
  })

  it('unregister with dependent schemas leaves orphan schemas valid (no cascade in V1)', () => {
    const reg = new CanonicalRegistry()
    reg.register(makeSchema('user'))
    reg.register(makeSchema('forecast', { requires: ['user'] }))
    // Rimuovo 'user' — 'forecast' rimane registrato (nessuna cascade integrity policy in F2)
    expect(reg.unregister('user' as CanonicalSchemaId)).toBe(true)
    expect(reg.has('forecast' as CanonicalSchemaId)).toBe(true)
    expect(reg.has('user' as CanonicalSchemaId)).toBe(false)
  })

  it('strict register throws canonical.id.duplicate on id collision', () => {
    const reg = new CanonicalRegistry()
    reg.register(makeSchema('weather'))
    let caught: unknown
    try {
      reg.register(makeSchema('weather'), { strict: true })
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('canonical.id.duplicate')
    expect((caught as { details: Record<string, unknown> }).details.id).toBe('weather')
  })
})
