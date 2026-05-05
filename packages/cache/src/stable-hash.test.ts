// stable-hash.test.ts — Tier-1 jsdom test deterministici per stable-hash utility F6
// (plan 06-02 D-155 cache key default + D-156 scope prefix + FNV-1a 32-bit).
//
// 15 test totali:
//   - determinismo + edge cases (Test 1-3): null/numero/stringa primitive
//   - key ordering invariance (Test 4-6): object key sorted, array preservato, ricorsione
//   - FNV-1a determinismo + collision soft (Test 7-9): formato hex 8-char + diff input
//   - end-to-end determinism (Test 10): stableHash key invariance
//   - cacheKey format (Test 11-13): topic+hash, scope prefix D-156, scope null neutro
//   - collision rate stress (Test 14): 10k random payload <0.1% collision (soft assertion)
//   - cyclic invariant caveat (Test 15): RangeError T-06-02-06 — caller responsibility
//
// Pattern role-match con `packages/gateway/src/http/strategies/dedupe-strategy.test.ts`
// (analog F3 D-74 KeyBased) — generalizzato qui in funzione pubblica.

import { describe, expect, it } from 'vitest'
import { cacheKey, fnv1a32, stableHash, stableStringify } from './stable-hash'

describe('stableStringify (D-155 determinismo)', () => {
  it("Test 1: stableStringify(null) ritorna 'null'", () => {
    expect(stableStringify(null)).toBe('null')
  })

  it("Test 2: stableStringify(42) ritorna '42'", () => {
    expect(stableStringify(42)).toBe('42')
  })

  it("Test 3: stableStringify('foo') ritorna '\"foo\"'", () => {
    expect(stableStringify('foo')).toBe('"foo"')
  })

  it('Test 4: object key ordering invariance ({ b: 2, a: 1 } === { a: 1, b: 2 })', () => {
    const a = stableStringify({ b: 2, a: 1 })
    const b = stableStringify({ a: 1, b: 2 })
    expect(a).toBe(b)
    expect(a).toBe('{"a":1,"b":2}')
  })

  it("Test 5: array NON re-ordinato (preserva semantica) — '[3,1,2]'", () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]')
  })

  it('Test 6: ricorsione nested object key ordering deterministico', () => {
    const a = stableStringify({ nested: { z: 1, a: 2 } })
    const b = stableStringify({ nested: { a: 2, z: 1 } })
    expect(a).toBe(b)
    expect(a).toBe('{"nested":{"a":2,"z":1}}')
  })
})

describe('fnv1a32 (32-bit hash inline RESEARCH §3.2)', () => {
  it("Test 7: fnv1a32('foo') ritorna 8-char lowercase hex string", () => {
    const hash = fnv1a32('foo')
    expect(hash).toMatch(/^[0-9a-f]{8}$/)
    expect(hash.length).toBe(8)
  })

  it('Test 8: determinismo — stesso input → stesso hash su 1000 iterazioni', () => {
    const expected = fnv1a32('payload-deterministic')
    for (let i = 0; i < 1000; i++) {
      expect(fnv1a32('payload-deterministic')).toBe(expected)
    }
  })

  it('Test 9: input diverso → hash diverso atteso', () => {
    expect(fnv1a32('foo')).not.toBe(fnv1a32('bar'))
    expect(fnv1a32('a')).not.toBe(fnv1a32('b'))
  })
})

describe('stableHash (end-to-end determinismo)', () => {
  it('Test 10: { a: 1, b: 2 } === { b: 2, a: 1 } end-to-end (D-155)', () => {
    expect(stableHash({ a: 1, b: 2 })).toBe(stableHash({ b: 2, a: 1 }))
  })
})

describe('cacheKey (D-155 default + D-156 scope prefix)', () => {
  it("Test 11: cacheKey({ topic, payload }) ritorna 'topic::<8 hex>'", () => {
    const key = cacheKey({ topic: 'weather.requested', payload: { city: 'Roma' } })
    expect(key).toMatch(/^weather\.requested::[0-9a-f]{8}$/)
  })

  it("Test 12: cacheKey con scope ritorna 'scope::topic::<hex>' (D-156)", () => {
    const key = cacheKey({ topic: 't', payload: {}, scope: 'user-42' })
    expect(key).toMatch(/^user-42::t::[0-9a-f]{8}$/)
  })

  it('Test 13: scope=null === no scope (null prefix neutro)', () => {
    const a = cacheKey({ topic: 't', payload: {}, scope: null })
    const b = cacheKey({ topic: 't', payload: {} })
    expect(a).toBe(b)
  })
})

describe('FNV-1a collision rate (RESEARCH §3.2 cite C1)', () => {
  it('Test 14: collision rate <0.1% su 10000 random payload (soft assertion)', () => {
    const seen = new Set<string>()
    let collisions = 0
    for (let i = 0; i < 10000; i++) {
      const payload = { id: i, value: Math.random().toString(36) + i.toString(36) }
      const h = stableHash(payload)
      if (seen.has(h)) {
        collisions++
      } else {
        seen.add(h)
      }
    }
    // Soft assertion: <10 collisioni su 10k = <0.1% — citato C1 RESEARCH §3.2
    expect(collisions).toBeLessThan(10)
  })
})

describe('Acyclic invariant caveat (T-06-02-06)', () => {
  it('Test 15: cyclic structure → RangeError stack overflow (caller responsibility)', () => {
    const cyclic: Record<string, unknown> = { a: 1 }
    cyclic.self = cyclic
    expect(() => stableStringify(cyclic)).toThrow(RangeError)
  })
})
