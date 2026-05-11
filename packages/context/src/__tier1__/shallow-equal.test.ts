/**
 * Tier-1 jsdom unit tests for `shallow-equal.ts` — D-V2-F10-02 Object.is top-level gate.
 *
 * @see packages/context/src/shallow-equal.ts
 */
import { describe, expect, it } from 'vitest'
import { shallowEqual } from '../shallow-equal'

describe('shallowEqual — Object.is top-level (D-V2-F10-02)', () => {
  it('ritorna true se Object.is(a, b) — stesso ref', () => {
    const ref = { user: 'u' }
    expect(shallowEqual(ref, ref)).toBe(true)
  })

  it('gestisce Object.is(NaN, NaN) → true', () => {
    expect(shallowEqual({ x: NaN }, { x: NaN })).toBe(true)
  })

  it('ritorna false se null vs object', () => {
    expect(shallowEqual(null, { a: 1 })).toBe(false)
    expect(shallowEqual({ a: 1 }, null)).toBe(false)
  })

  it('ritorna false se primitives diversi (string/number)', () => {
    expect(shallowEqual('a', 'b')).toBe(false)
    expect(shallowEqual(1, 2)).toBe(false)
  })

  it('ritorna true se primitives uguali', () => {
    expect(shallowEqual('a', 'a')).toBe(true)
    expect(shallowEqual(42, 42)).toBe(true)
  })

  it('ritorna false se length keys diverso', () => {
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('reference identity preserved: nested ref stesso → true', () => {
    const user = { id: 'u1' }
    expect(shallowEqual({ user }, { user })).toBe(true)
  })

  it('nested ref diversa → false (NO deep equal)', () => {
    expect(shallowEqual({ user: { id: 'u1' } }, { user: { id: 'u1' } })).toBe(false)
  })

  it('gestisce empty objects → true', () => {
    expect(shallowEqual({}, {})).toBe(true)
  })

  it('null vs null → true (Object.is short-circuit)', () => {
    expect(shallowEqual(null, null)).toBe(true)
  })
})
