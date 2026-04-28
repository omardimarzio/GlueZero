import { describe, expect, it } from 'vitest'
import { deepFreeze } from './deep-freeze'

describe('deepFreeze', () => {
  it('freezes nested object recursively', () => {
    const obj = { a: { b: { c: 1 } } }
    deepFreeze(obj)
    expect(Object.isFrozen(obj)).toBe(true)
    expect(Object.isFrozen(obj.a)).toBe(true)
    expect(Object.isFrozen(obj.a.b)).toBe(true)
  })

  it('freezes array and its elements', () => {
    const arr = [{ a: 1 }, { b: 2 }]
    deepFreeze(arr)
    expect(Object.isFrozen(arr)).toBe(true)
    expect(Object.isFrozen(arr[0])).toBe(true)
    expect(Object.isFrozen(arr[1])).toBe(true)
  })

  it('handles circular references without stack overflow', () => {
    const o: { self?: unknown; v: number } = { v: 1 }
    o.self = o
    expect(() => deepFreeze(o)).not.toThrow()
    expect(Object.isFrozen(o)).toBe(true)
  })

  it('skips Date by default', () => {
    const d = new Date()
    deepFreeze(d)
    expect(Object.isFrozen(d)).toBe(false)
  })

  it('freezes Date when skipDates: false', () => {
    const d = new Date()
    deepFreeze(d, { skipDates: false })
    expect(Object.isFrozen(d)).toBe(true)
  })

  it('skips TypedArray by default (would break iteration)', () => {
    const ta = new Uint8Array([1, 2, 3])
    deepFreeze(ta)
    expect(Object.isFrozen(ta)).toBe(false)
  })

  it('freezes Map and its values by default', () => {
    const m = new Map<string, { v: number }>([['k', { v: 1 }]])
    deepFreeze(m)
    expect(Object.isFrozen(m)).toBe(true)
    expect(Object.isFrozen(m.get('k'))).toBe(true)
  })

  it('freezes Set and its elements by default', () => {
    const s = new Set([{ a: 1 }, { b: 2 }])
    deepFreeze(s)
    expect(Object.isFrozen(s)).toBe(true)
    for (const v of s) expect(Object.isFrozen(v)).toBe(true)
  })

  it('throws TypeError on mutation in strict mode', () => {
    const obj = { a: 1 }
    deepFreeze(obj)
    expect(() => {
      ;(obj as { a: number }).a = 2
    }).toThrow(TypeError)
  })

  it('handles null and undefined gracefully', () => {
    expect(() => deepFreeze(null)).not.toThrow()
    expect(() => deepFreeze(undefined)).not.toThrow()
    expect(deepFreeze(null)).toBe(null)
    expect(deepFreeze(undefined)).toBe(undefined)
  })

  it('handles primitives gracefully', () => {
    expect(deepFreeze(42)).toBe(42)
    expect(deepFreeze('str')).toBe('str')
    expect(deepFreeze(true)).toBe(true)
  })

  it('completes in <50ms for object with 1000 flat keys', () => {
    const big: Record<string, number> = {}
    for (let i = 0; i < 1000; i++) big[`k${i}`] = i
    const start = performance.now()
    deepFreeze(big)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(50)
    expect(Object.isFrozen(big)).toBe(true)
  })

  it('skips already-frozen objects (idempotent + perf optimization)', () => {
    const obj = { a: { b: 1 } }
    deepFreeze(obj)
    const start = performance.now()
    deepFreeze(obj)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(5)
  })
})
