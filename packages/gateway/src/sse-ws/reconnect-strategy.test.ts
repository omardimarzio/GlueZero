// reconnect-strategy.test.ts — Test deterministici per `createReconnectStrategy`
// (D-107 fallback + D-109 full jitter + Q3 §6.2 consolidationMs guard).
//
// Coverage:
// - Full jitter math (D-109 / RT-05) — formula `floor(random * min(cap, base * 2^attempt))`.
// - Auto-fallback state machine (D-107) — switch SSE↔WS dopo `fallbackThreshold` fail
//   consecutivi; cycle cap globale = 5.
// - Reset criteria (Q3 §6.2) — `recordSuccess` resetta counter SOLO se trascorre
//   `consolidationMs` dal precedente success (anti-flap detection).
// - `maxAttempts` cap (RT-05) — `isPermanentlyFailed` true al raggiungimento.
// - `reset()` riporta state alla configurazione iniziale.
//
// Pattern: `vi.useFakeTimers()` + `random` + `now` DI per deterministic timing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createReconnectStrategy } from './reconnect-strategy'

describe('createReconnectStrategy (D-107 fallback + D-109 backoff + Q3 reset)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('full jitter math (D-109 + RT-05 + RESEARCH §6.1)', () => {
    it('Test 1: nextDelayMs base case — random=0.5, baseMs=1000, capMs=30000 → 500', () => {
      const r = createReconnectStrategy({ baseMs: 1000, capMs: 30_000, random: () => 0.5 })
      expect(r.nextDelayMs()).toBe(500) // floor(0.5 * (1000 * 2^0)) = 500
    })

    it('Test 2: nextDelayMs dopo 1 fail — random=0.5 → 1000', () => {
      const r = createReconnectStrategy({ baseMs: 1000, capMs: 30_000, random: () => 0.5 })
      r.recordFailure()
      expect(r.nextDelayMs()).toBe(1000) // floor(0.5 * (1000 * 2^1)) = 1000
    })

    it('Test 3: nextDelayMs cap a capMs — random=0.999, exp grande → capMs - small', () => {
      const r = createReconnectStrategy({ baseMs: 1000, capMs: 30_000, random: () => 0.999 })
      // dopo molti fail: 1000 * 2^20 = enorme, capped a 30000
      for (let i = 0; i < 20; i++) r.recordFailure()
      const delay = r.nextDelayMs()
      expect(delay).toBeLessThanOrEqual(30_000)
      expect(delay).toBeGreaterThanOrEqual(29_000) // floor(0.999 * 30000) ≈ 29970
    })
  })

  describe('auto-fallback state machine (D-107)', () => {
    it('Test 4: 3 fail consecutivi → shouldFallback() true', () => {
      const r = createReconnectStrategy({ fallbackThreshold: 3 })
      r.recordFailure()
      r.recordFailure()
      r.recordFailure()
      expect(r.shouldFallback()).toBe(true)
    })

    it('Test 5: <3 fail consecutivi → shouldFallback() false', () => {
      const r = createReconnectStrategy({ fallbackThreshold: 3 })
      r.recordFailure()
      r.recordFailure()
      expect(r.shouldFallback()).toBe(false)
    })

    it('Test 6: fallback() sse → websocket', () => {
      const r = createReconnectStrategy({ initialMode: 'sse' })
      expect(r.fallback()).toBe('websocket')
      expect(r.getMode()).toBe('websocket')
    })

    it('Test 7: fallback() websocket → sse (round-trip)', () => {
      const r = createReconnectStrategy({ initialMode: 'websocket' })
      r.fallback() // → sse
      r.fallback() // → websocket
      expect(r.getMode()).toBe('websocket')
    })

    it('Test 8: fallback() resetta consecutiveFailures (counter reset al cambio mode)', () => {
      const r = createReconnectStrategy({ fallbackThreshold: 3 })
      r.recordFailure()
      r.recordFailure()
      r.recordFailure()
      r.fallback()
      expect(r.shouldFallback()).toBe(false) // counter back to 0
    })

    it('Test 9: globalCycleCap=5 raggiunto → isPermanentlyFailed() true E shouldFallback() false', () => {
      const r = createReconnectStrategy({ fallbackThreshold: 1, globalCycleCap: 5 })
      for (let i = 0; i < 5; i++) {
        r.recordFailure()
        r.fallback()
      }
      expect(r.isPermanentlyFailed()).toBe(true)
      expect(r.shouldFallback()).toBe(false)
    })
  })

  describe('reset criteria con consolidationMs guard (Q3 §6.2)', () => {
    it('Test 10: recordSuccess() entro consolidationMs NON resetta cycles (anti-flap)', () => {
      const fakeNow = vi.fn(() => 1_000_000)
      const r = createReconnectStrategy({
        consolidationMs: 5_000,
        fallbackThreshold: 1,
        now: fakeNow,
      })
      r.recordFailure()
      r.fallback() // cycles=1
      r.recordSuccess() // first success at t=1_000_000 — establishes baseline
      // Second success at t=1_001_000 (1s later — under consolidationMs)
      fakeNow.mockReturnValue(1_001_000)
      r.recordSuccess()
      // Counter NON azzerati: bastando un solo failure per fallback (threshold=1)
      r.recordFailure()
      expect(r.shouldFallback()).toBe(true)
    })

    it('Test 11: recordSuccess() dopo consolidationMs resetta consecutiveFailures e cycles', () => {
      const fakeNow = vi.fn(() => 1_000_000)
      const r = createReconnectStrategy({
        consolidationMs: 5_000,
        fallbackThreshold: 3,
        globalCycleCap: 5,
        now: fakeNow,
      })
      r.recordSuccess() // first success — establishes lastSuccessAt baseline
      // Accumulate 2 fail
      r.recordFailure()
      r.recordFailure()
      // Advance now beyond consolidationMs
      fakeNow.mockReturnValue(1_006_000) // 6s later
      r.recordSuccess() // SHOULD reset counters
      expect(r.shouldFallback()).toBe(false) // counter reset
      // Aggiungi 3 fail per verifica reset cycles
      r.recordFailure()
      r.recordFailure()
      r.recordFailure()
      expect(r.shouldFallback()).toBe(true)
    })

    it('Test 12: maxAttempts cap → isPermanentlyFailed() true', () => {
      const r = createReconnectStrategy({ maxAttempts: 3 })
      r.recordFailure()
      r.recordFailure()
      r.recordFailure()
      expect(r.isPermanentlyFailed()).toBe(true)
    })
  })

  describe('reset() + initialMode', () => {
    it('Test 13: reset() riporta state allo stato iniziale', () => {
      const r = createReconnectStrategy({ initialMode: 'sse', fallbackThreshold: 1 })
      r.recordFailure()
      r.fallback() // mode → ws, cycles=1
      r.reset()
      expect(r.getMode()).toBe('sse')
      expect(r.isPermanentlyFailed()).toBe(false)
      expect(r.shouldFallback()).toBe(false)
    })

    it('Test 14: getMode default initialMode "sse" (D-107 SSE-first)', () => {
      const r = createReconnectStrategy()
      expect(r.getMode()).toBe('sse')
    })

    it('Test 15: getMode override initialMode "websocket"', () => {
      const r = createReconnectStrategy({ initialMode: 'websocket' })
      expect(r.getMode()).toBe('websocket')
    })
  })
})
