// retry-strategy.test.ts — Test deterministici per ExponentialBackoffWithJitter (D-69).
//
// Coverage:
// - 4xx vs 5xx differentiation (chiusura ROUTE-09 / PRD §39 #8)
// - Network error retry, 408/429 retry, altri 4xx NO retry
// - maxAttempts boundary (default 3, opt-out 0)
// - Full jitter formula: min(maxDelay, baseDelay * 2^attempt) * (0.5 + random * 0.5)
// - Retry-After priority over jitter (RFC 7231 + cap MAX_BACKOFF_MS)
// - Varianza > 0 (full jitter randomization PITFALLS #5 mitigation)

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRetryStrategy } from './retry-strategy'

function fakeResponse(status: number): Response {
  // Minimal Response shape sufficient per il test (status only).
  // Cast a Response perché la default RetryStrategy legge solo `status`.
  return { status } as unknown as Response
}

describe('createRetryStrategy — ExponentialBackoffWithJitter (D-69)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Test 1: shouldRetry(undefined, networkError, 1) con maxAttempts:3 → true (network error)', () => {
    const strategy = createRetryStrategy({ maxAttempts: 3 })
    const networkError = new Error('Failed to fetch')
    expect(strategy.shouldRetry(undefined, networkError, 1)).toBe(true)
  })

  it('Test 2: shouldRetry(500-response, undefined, 1) → true (5xx retry)', () => {
    const strategy = createRetryStrategy({ maxAttempts: 3 })
    expect(strategy.shouldRetry(fakeResponse(500), undefined, 1)).toBe(true)
  })

  it('Test 3: shouldRetry(408-response, undefined, 1) → true (408 retry)', () => {
    const strategy = createRetryStrategy({ maxAttempts: 3 })
    expect(strategy.shouldRetry(fakeResponse(408), undefined, 1)).toBe(true)
  })

  it('Test 4: shouldRetry(429-response, undefined, 1) → true (429 retry)', () => {
    const strategy = createRetryStrategy({ maxAttempts: 3 })
    expect(strategy.shouldRetry(fakeResponse(429), undefined, 1)).toBe(true)
  })

  it('Test 5: shouldRetry(400-response, undefined, 1) → false (400 NO retry)', () => {
    const strategy = createRetryStrategy({ maxAttempts: 3 })
    expect(strategy.shouldRetry(fakeResponse(400), undefined, 1)).toBe(false)
  })

  it('Test 6: shouldRetry(401-response, undefined, 1) → false (401 NO retry)', () => {
    const strategy = createRetryStrategy({ maxAttempts: 3 })
    expect(strategy.shouldRetry(fakeResponse(401), undefined, 1)).toBe(false)
  })

  it('Test 7: shouldRetry(404-response, undefined, 1) → false (404 NO retry)', () => {
    const strategy = createRetryStrategy({ maxAttempts: 3 })
    expect(strategy.shouldRetry(fakeResponse(404), undefined, 1)).toBe(false)
  })

  it('Test 8: shouldRetry(500-response, undefined, 3) con maxAttempts:3 → false (max raggiunto)', () => {
    const strategy = createRetryStrategy({ maxAttempts: 3 })
    expect(strategy.shouldRetry(fakeResponse(500), undefined, 3)).toBe(false)
  })

  it('Test 9: shouldRetry(500-response, undefined, 1) con maxAttempts:0 → false (retry disabilitato)', () => {
    const strategy = createRetryStrategy({ maxAttempts: 0 })
    expect(strategy.shouldRetry(fakeResponse(500), undefined, 1)).toBe(false)
  })

  it('Test 10: delayMs(1) con base:300/max:10000 → in [300, 600] (full jitter)', () => {
    const strategy = createRetryStrategy({ baseDelayMs: 300, maxDelayMs: 10_000 })
    // 300 * 2^1 = 600; jitter range = [600 * 0.5, 600 * 1] = [300, 600]
    // Mock Math.random per determinismo: bound test agli estremi
    vi.spyOn(Math, 'random').mockReturnValueOnce(0)
    const lower = strategy.delayMs(1)
    expect(lower).toBeGreaterThanOrEqual(300)
    expect(lower).toBeLessThanOrEqual(600)
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.999999)
    const upper = strategy.delayMs(1)
    expect(upper).toBeGreaterThanOrEqual(300)
    expect(upper).toBeLessThanOrEqual(600)
  })

  it('Test 11: delayMs(2) → in [600, 1200] (full jitter)', () => {
    const strategy = createRetryStrategy({ baseDelayMs: 300, maxDelayMs: 10_000 })
    // 300 * 2^2 = 1200; jitter range = [1200 * 0.5, 1200] = [600, 1200]
    vi.spyOn(Math, 'random').mockReturnValueOnce(0)
    const lower = strategy.delayMs(2)
    expect(lower).toBeGreaterThanOrEqual(600)
    expect(lower).toBeLessThanOrEqual(1200)
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.999999)
    const upper = strategy.delayMs(2)
    expect(upper).toBeGreaterThanOrEqual(600)
    expect(upper).toBeLessThanOrEqual(1200)
  })

  it('Test 12: delayMs(10) → cap a [5000, 10000] (max 10s)', () => {
    const strategy = createRetryStrategy({ baseDelayMs: 300, maxDelayMs: 10_000 })
    // 300 * 2^10 = 307200; cap a 10000; jitter range = [5000, 10000]
    vi.spyOn(Math, 'random').mockReturnValueOnce(0)
    const lower = strategy.delayMs(10)
    expect(lower).toBeGreaterThanOrEqual(5_000)
    expect(lower).toBeLessThanOrEqual(10_000)
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.999999)
    const upper = strategy.delayMs(10)
    expect(upper).toBeGreaterThanOrEqual(5_000)
    expect(upper).toBeLessThanOrEqual(10_000)
  })

  it('Test 13: delayMs(1, "5") (Retry-After 5s) → 5000 (priorità su jitter)', () => {
    const strategy = createRetryStrategy({ baseDelayMs: 300, maxDelayMs: 10_000 })
    expect(strategy.delayMs(1, '5')).toBe(5_000)
  })

  it('Test 14: delayMs(1, HTTP-date future) → ms delta clamped a MAX_BACKOFF_MS', () => {
    const strategy = createRetryStrategy({ baseDelayMs: 300, maxDelayMs: 10_000 })
    // Date un anno nel futuro → cap MAX_BACKOFF_MS=60000
    const futureDate = 'Wed, 21 Oct 2099 07:28:00 GMT'
    const delay = strategy.delayMs(1, futureDate)
    // MAX_BACKOFF_MS = 60_000 (re-export da retry-after-parser)
    expect(delay).toBe(60_000)
  })

  it('Test 15: 100 chiamate delayMs(2) producono varianza > 100ms (full jitter randomization)', () => {
    // NOTA: NO mock di Math.random — verifica che la formula introduce randomness reale.
    const strategy = createRetryStrategy({ baseDelayMs: 300, maxDelayMs: 10_000 })
    const delays: number[] = []
    for (let i = 0; i < 100; i++) {
      delays.push(strategy.delayMs(2))
    }
    const min = Math.min(...delays)
    const max = Math.max(...delays)
    // Range [600, 1200] con full jitter → varianza attesa > 100ms su 100 sample
    expect(max - min).toBeGreaterThan(100)
    expect(min).toBeGreaterThanOrEqual(600)
    expect(max).toBeLessThanOrEqual(1200)
  })
})
