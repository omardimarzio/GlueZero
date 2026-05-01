// retry-after-parser.test.ts — copre RFC 7231 §7.1.3 (delta-seconds + HTTP-date).
//
// Behavior coperti (4 test):
// 1. Delta-seconds → ms (cap MAX_BACKOFF_MS = 60000).
// 2. HTTP-date future → ms delta clamped MAX_BACKOFF_MS.
// 3. HTTP-date past → 0.
// 4. Malformed/null → undefined.

import { describe, expect, it } from 'vitest'
import { MAX_BACKOFF_MS, parseRetryAfter } from './retry-after-parser'

describe('retry-after-parser.ts (RFC 7231 — D-69, MAX_BACKOFF_MS cap)', () => {
  it('parses delta-seconds (numeric string) to ms with cap', () => {
    // delta-seconds entro il cap → ritorna ms esatti.
    expect(parseRetryAfter('30')).toBe(30_000)
    expect(parseRetryAfter('0')).toBe(0)
    // delta-seconds OLTRE il cap → cap applicato (T-03-08-03 mitigation).
    // 120 seconds = 120000 ms; clamped a MAX_BACKOFF_MS = 60000 ms.
    expect(parseRetryAfter('120')).toBe(MAX_BACKOFF_MS)
    expect(parseRetryAfter('600')).toBe(MAX_BACKOFF_MS)
    expect(MAX_BACKOFF_MS).toBe(60_000)
  })

  it('parses future HTTP-date returning delta ms clamped to MAX_BACKOFF_MS', () => {
    const now = Date.parse('Wed, 30 Apr 2026 12:00:00 GMT')
    // future +30 seconds
    const headerNear = 'Wed, 30 Apr 2026 12:00:30 GMT'
    expect(parseRetryAfter(headerNear, now)).toBe(30_000)
    // future +10 minutes → clamped al cap
    const headerFar = 'Wed, 30 Apr 2026 12:10:00 GMT'
    expect(parseRetryAfter(headerFar, now)).toBe(MAX_BACKOFF_MS)
  })

  it('returns 0 for past HTTP-date', () => {
    const now = Date.parse('Wed, 30 Apr 2026 12:00:00 GMT')
    const headerPast = 'Wed, 30 Apr 2026 11:59:50 GMT'
    expect(parseRetryAfter(headerPast, now)).toBe(0)
  })

  it('returns undefined for malformed/null/empty values', () => {
    expect(parseRetryAfter(null)).toBeUndefined()
    expect(parseRetryAfter('')).toBeUndefined()
    expect(parseRetryAfter('not-a-number-or-date')).toBeUndefined()
    expect(parseRetryAfter('-1')).toBeUndefined()
  })
})
