/**
 * Tier-1 unit test — LRU cache F11 (D-V2-F11-07).
 *
 * Copertura: get/set base + missing + eviction LIFO cap 500 + clearByMfId
 * prefix-scoped + LRU touch order + clearAll.
 *
 * @see packages/permissions/src/lru-cache.ts
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { __cacheSize, lruClearAll, lruClearByMfId, lruGet, lruSet } from '../lru-cache'

describe('lru-cache (Map 500 + clearByMfId D-V2-F11-07)', () => {
  beforeEach(() => lruClearAll())

  it('get/set base', () => {
    lruSet('a', true)
    expect(lruGet('a')).toBe(true)
  })

  it('get missing → undefined', () => {
    expect(lruGet('missing')).toBeUndefined()
  })

  it('eviction LIFO oldest insertion at cap 500', () => {
    for (let i = 0; i < 500; i++) lruSet(`k${i}`, true)
    expect(__cacheSize()).toBe(500)
    lruSet('k500', true)
    expect(__cacheSize()).toBe(500)
    expect(lruGet('k0')).toBeUndefined() // evicted (oldest)
    expect(lruGet('k500')).toBe(true)
  })

  it('clearByMfId rimuove solo prefix matching', () => {
    lruSet('mfA::publish::topic1', true)
    lruSet('mfA::subscribe::topic2', true)
    lruSet('mfB::publish::topic3', true)
    const removed = lruClearByMfId('mfA')
    expect(removed).toBe(2)
    expect(lruGet('mfA::publish::topic1')).toBeUndefined()
    expect(lruGet('mfA::subscribe::topic2')).toBeUndefined()
    expect(lruGet('mfB::publish::topic3')).toBe(true)
  })

  it('LRU touch: get muove entry in coda', () => {
    lruSet('a', true)
    lruSet('b', true)
    for (let i = 0; i < 498; i++) lruSet(`k${i}`, true)
    expect(__cacheSize()).toBe(500)
    // touch `a` — sposta `a` in coda (a diventa MRU dopo k497)
    lruGet('a')
    // cap 500 raggiunto → next set evicting head = `b` (next-oldest dopo touch di a)
    lruSet('newest', true)
    expect(lruGet('a')).toBe(true) // ancora presente (touched)
    expect(lruGet('b')).toBeUndefined() // evicted (next-oldest dopo touch di a)
  })

  it('clearAll svuota cache', () => {
    lruSet('a', true)
    lruSet('b', false)
    lruClearAll()
    expect(__cacheSize()).toBe(0)
  })
})
