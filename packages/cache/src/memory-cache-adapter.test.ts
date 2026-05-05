// memory-cache-adapter.test.ts — Tier-1 jsdom test deterministici per
// MemoryCacheAdapter F6 (plan 06-02 D-158 LRU bounded + TTL + invalidate).
//
// 15 test totali:
//   - factory + override (Test 1-2): default maxEntries=1000 / opts.maxEntries override
//   - get/set baseline + stats (Test 3-4): hit/miss counters cumulative
//   - LRU eviction (Test 5): cap reach → drop oldest (Map insertion order)
//   - LRU touch on get (Test 6): get re-orders entry to tail
//   - TTL expiry lazy fake-timers (Test 7): expiresAt < Date.now() → undefined + evict
//   - delete (Test 8): true/false return semantics
//   - invalidate 3 dispatch (Test 9-11): string exact, RegExp match, { prefix } startsWith
//   - size + clear (Test 12): cumulative semantic
//   - stats readonly (Test 13): cumulative counters dal boot
//   - replace in-place no-evict (Test 14): set existing key non triggera eviction
//   - TTL=undefined → expiresAt: Infinity (Test 15): mai scade
//
// Pattern role-match con `packages/gateway/src/http/strategies/dedupe-strategy.test.ts`
// (analog F3 D-74 cap maxInflight) + `packages/worker/src/worker-registry.test.ts`
// (analog F5 cap registry).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryCacheAdapter } from './memory-cache-adapter'

describe('createMemoryCacheAdapter — factory + defaults', () => {
  it('Test 1: createMemoryCacheAdapter() ritorna CacheAdapter conforme interface (default maxEntries=1000)', () => {
    const cache = createMemoryCacheAdapter()
    expect(typeof cache.get).toBe('function')
    expect(typeof cache.set).toBe('function')
    expect(typeof cache.delete).toBe('function')
    expect(typeof cache.invalidate).toBe('function')
    expect(typeof cache.size).toBe('function')
    expect(typeof cache.clear).toBe('function')
    expect(typeof cache.stats).toBe('function')
    expect(cache.size()).toBe(0)
  })

  it('Test 2: createMemoryCacheAdapter({ maxEntries: 10 }) rispetta override', () => {
    const cache = createMemoryCacheAdapter({ maxEntries: 10 })
    // Fill 11 entries → size cap 10 (eviction kicks in)
    for (let i = 0; i < 11; i++) cache.set(`k${i}`, i)
    expect(cache.size()).toBe(10)
  })
})

describe('get/set baseline + stats counters', () => {
  it('Test 3: set + get ritorna entry shape + stats.hits=1', () => {
    const cache = createMemoryCacheAdapter()
    const before = Date.now()
    cache.set('k', { value: 42 })
    const entry = cache.get('k')
    expect(entry).toBeDefined()
    expect(entry?.value).toEqual({ value: 42 })
    expect(entry?.expiresAt).toBe(Number.POSITIVE_INFINITY)
    expect(entry?.setAt).toBeGreaterThanOrEqual(before)
    expect(cache.stats().hits).toBe(1)
    expect(cache.stats().misses).toBe(0)
  })

  it('Test 4: get(missing) ritorna undefined + stats.misses=1', () => {
    const cache = createMemoryCacheAdapter()
    expect(cache.get('absent')).toBeUndefined()
    expect(cache.stats().misses).toBe(1)
    expect(cache.stats().hits).toBe(0)
  })
})

describe('LRU eviction (Map insertion order — D-158)', () => {
  it('Test 5: cap=10, 11 set sequenziali → primo k0 evicted; stats.evictions=1', () => {
    const cache = createMemoryCacheAdapter({ maxEntries: 10 })
    for (let i = 0; i < 11; i++) cache.set(`k${i}`, i)
    expect(cache.size()).toBe(10)
    // k0 inserito per primo → evicted
    expect(cache.get('k0')).toBeUndefined()
    // k1..k10 ancora presenti
    expect(cache.get('k1')?.value).toBe(1)
    expect(cache.get('k10')?.value).toBe(10)
    expect(cache.stats().evictions).toBe(1)
  })

  it('Test 6: LRU touch — cap=10, 10 set + get(k0) + 1 set → ora k1 evicted (NOT k0)', () => {
    const cache = createMemoryCacheAdapter({ maxEntries: 10 })
    for (let i = 0; i < 10; i++) cache.set(`k${i}`, i)
    // get(k0) re-ordina k0 in coda — adesso k1 è il più vecchio
    expect(cache.get('k0')?.value).toBe(0)
    cache.set('k10', 10)
    // k0 ancora presente, k1 evicted
    expect(cache.get('k0')?.value).toBe(0)
    expect(cache.get('k1')).toBeUndefined()
    expect(cache.stats().evictions).toBe(1)
  })
})

describe('TTL expiry lazy (T-06-02-04 — atomic single-thread)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('Test 7: set ttlMs=100 + advance 200ms + get → undefined + stats.evictions=1 + stats.misses=1', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const cache = createMemoryCacheAdapter()
    cache.set('expiring', 'value', 100)
    // Prima della scadenza → hit
    vi.advanceTimersByTime(50)
    expect(cache.get('expiring')?.value).toBe('value')
    // Dopo la scadenza → miss + eviction
    vi.advanceTimersByTime(200)
    expect(cache.get('expiring')).toBeUndefined()
    expect(cache.stats().misses).toBe(1)
    expect(cache.stats().evictions).toBe(1)
    expect(cache.size()).toBe(0)
  })
})

describe('delete + invalidate dispatch (D-155 invalidate API)', () => {
  it('Test 8: delete(existing) → true + entry rimossa; delete(missing) → false', () => {
    const cache = createMemoryCacheAdapter()
    cache.set('k', 1)
    expect(cache.delete('k')).toBe(true)
    expect(cache.get('k')).toBeUndefined()
    expect(cache.delete('absent')).toBe(false)
  })

  it('Test 9: invalidate(string exact) → 1 + entry rimossa', () => {
    const cache = createMemoryCacheAdapter()
    cache.set('exact-key', 1)
    cache.set('other', 2)
    expect(cache.invalidate('exact-key')).toBe(1)
    expect(cache.size()).toBe(1)
    expect(cache.get('other')?.value).toBe(2)
    // missing → 0
    expect(cache.invalidate('absent')).toBe(0)
  })

  it('Test 10: invalidate(RegExp) — 5 match + 3 non-match → ritorna 5', () => {
    const cache = createMemoryCacheAdapter()
    for (let i = 0; i < 5; i++) cache.set(`user-42::topic::h${i}`, i)
    cache.set('user-99::topic::h1', 100)
    cache.set('global::topic::h2', 200)
    cache.set('weather::data', 300)
    expect(cache.size()).toBe(8)
    const removed = cache.invalidate(/^user-42::/)
    expect(removed).toBe(5)
    expect(cache.size()).toBe(3)
  })

  it('Test 11: invalidate({ prefix }) — startsWith match', () => {
    const cache = createMemoryCacheAdapter()
    cache.set('weather.requested::a', 1)
    cache.set('weather.refresh::b', 2)
    cache.set('user.login::c', 3)
    const removed = cache.invalidate({ prefix: 'weather.' })
    expect(removed).toBe(2)
    expect(cache.size()).toBe(1)
    expect(cache.get('user.login::c')?.value).toBe(3)
  })
})

describe('size + clear + stats readonly', () => {
  it('Test 12: size + clear cumulative semantic', () => {
    const cache = createMemoryCacheAdapter()
    cache.set('a', 1)
    cache.set('b', 2)
    expect(cache.size()).toBe(2)
    cache.clear()
    expect(cache.size()).toBe(0)
    // Stats cumulative NON resettate da clear (D-164)
    expect(cache.stats().entries).toBe(0)
  })

  it('Test 13: stats() ritorna readonly { hits, misses, evictions, entries } cumulative dal boot', () => {
    const cache = createMemoryCacheAdapter()
    cache.set('a', 1)
    cache.get('a') // hit
    cache.get('a') // hit
    cache.get('absent') // miss
    const s = cache.stats()
    expect(s.hits).toBe(2)
    expect(s.misses).toBe(1)
    expect(s.evictions).toBe(0)
    expect(s.entries).toBe(1)
  })
})

describe('Edge cases (replace in-place + TTL infinite)', () => {
  it('Test 14: set su key esistente NON triggera eviction (replace in-place)', () => {
    const cache = createMemoryCacheAdapter({ maxEntries: 2 })
    cache.set('k1', 1)
    cache.set('k2', 2)
    cache.set('k1', 'new-val') // replace, no eviction
    expect(cache.size()).toBe(2)
    expect(cache.get('k1')?.value).toBe('new-val')
    expect(cache.get('k2')?.value).toBe(2)
    expect(cache.stats().evictions).toBe(0)
  })

  it('Test 15: TTL=undefined → expiresAt: Number.POSITIVE_INFINITY (mai scade)', () => {
    const cache = createMemoryCacheAdapter()
    cache.set('eternal', 'forever')
    const entry = cache.get('eternal')
    expect(entry?.expiresAt).toBe(Number.POSITIVE_INFINITY)
  })
})
