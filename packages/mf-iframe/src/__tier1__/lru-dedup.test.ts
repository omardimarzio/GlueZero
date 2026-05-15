/**
 * Tier-1 jsdom — `lru-dedup.ts` DedupRegistry + replay-guard 30s dual-defense
 * (D-V2-F15-02 + D-V2-F15-03 — T-15-02..03 + T-15-09 mfId spoofing).
 */
import { describe, expect, it } from 'vitest'
import { DedupRegistry, LRU_CAP_PER_TUPLE, TIMESTAMP_WINDOW_MS } from '../lru-dedup'

describe('DedupRegistry — D-V2-F15-02 + D-V2-F15-03 dual-defense', () => {
  it('isReplay false su primo messaggio nuovo', () => {
    const dedup = new DedupRegistry()
    const now = 1700000000000
    const result = dedup.isReplay('https://iframe.com', 'mf-x', 'msg-1', now, now)
    expect(result).toBe(false)
  })

  it('isReplay true su exact ID replay stessa tuple (origin, mfId)', () => {
    const dedup = new DedupRegistry()
    const now = 1700000000000
    dedup.isReplay('https://iframe.com', 'mf-x', 'msg-1', now, now)
    const replay = dedup.isReplay('https://iframe.com', 'mf-x', 'msg-1', now, now)
    expect(replay).toBe(true)
  })

  it('isReplay false su stesso messageId ma origin diverso (per-tuple scoping T-15-09)', () => {
    const dedup = new DedupRegistry()
    const now = 1700000000000
    dedup.isReplay('https://iframe-A.com', 'mf-x', 'msg-1', now, now)
    const result = dedup.isReplay('https://iframe-B.com', 'mf-x', 'msg-1', now, now)
    expect(result).toBe(false)
  })

  it('isReplay false su stesso messageId ma mfId diverso (per-tuple scoping)', () => {
    const dedup = new DedupRegistry()
    const now = 1700000000000
    dedup.isReplay('https://iframe.com', 'mf-A', 'msg-1', now, now)
    const result = dedup.isReplay('https://iframe.com', 'mf-B', 'msg-1', now, now)
    expect(result).toBe(false)
  })

  it('isReplay true su timestamp > 30s future-dated (D-V2-F15-03)', () => {
    const dedup = new DedupRegistry()
    const now = 1700000000000
    const futureTs = now + TIMESTAMP_WINDOW_MS + 1000
    const result = dedup.isReplay('https://iframe.com', 'mf-x', 'msg-future', futureTs, now)
    expect(result).toBe(true)
  })

  it('isReplay true su timestamp > 30s past-dated (D-V2-F15-03)', () => {
    const dedup = new DedupRegistry()
    const now = 1700000000000
    const pastTs = now - TIMESTAMP_WINDOW_MS - 1000
    const result = dedup.isReplay('https://iframe.com', 'mf-x', 'msg-past', pastTs, now)
    expect(result).toBe(true)
  })

  it('LRU cap 500 — entry 501 evicta primo (insertion-order eviction Map spec)', () => {
    const dedup = new DedupRegistry()
    const now = 1700000000000
    // Riempi cap
    for (let i = 0; i < LRU_CAP_PER_TUPLE; i++) {
      dedup.isReplay('https://iframe.com', 'mf-x', `msg-${i}`, now, now)
    }
    // 501st entry triggera eviction primo (msg-0)
    dedup.isReplay('https://iframe.com', 'mf-x', `msg-${LRU_CAP_PER_TUPLE}`, now, now)
    // msg-0 ora evicted: re-isReplay con msg-0 deve ritornare false (no più in buffer)
    const result = dedup.isReplay('https://iframe.com', 'mf-x', 'msg-0', now, now)
    expect(result).toBe(false)
  })

  it('clearForMf rimuove buffer specifico tuple', () => {
    const dedup = new DedupRegistry()
    const now = 1700000000000
    dedup.isReplay('https://iframe.com', 'mf-x', 'msg-1', now, now)
    expect(dedup.tupleCount).toBe(1)
    dedup.clearForMf('https://iframe.com', 'mf-x')
    expect(dedup.tupleCount).toBe(0)
  })

  it('clearAll reset completo (testing helper)', () => {
    const dedup = new DedupRegistry()
    const now = 1700000000000
    dedup.isReplay('https://iframe-A.com', 'mf-1', 'msg-1', now, now)
    dedup.isReplay('https://iframe-B.com', 'mf-2', 'msg-2', now, now)
    expect(dedup.tupleCount).toBe(2)
    dedup.clearAll()
    expect(dedup.tupleCount).toBe(0)
  })
})
