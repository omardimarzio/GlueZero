/**
 * `RetryEngine` test suite Tier-1 (jsdom, vi.useFakeTimers + Math.random spyOn).
 *
 * 20+ test scenari coverage MF-FALLBACK-02:
 * - 3 backoff mode (`none` / `linear` / `exponential`) — PRD §29.3 verbatim.
 * - Jitter ±20% (factor = 0.8 + Math.random() * 0.4) determinismo via mock.
 * - Counter Map per-key (`mfId::phase`) isolation (per-MF + per-phase).
 * - resetCounter semantics.
 * - shouldRetry predicate boundary (`counter < policy.attempts`).
 *
 * @see packages/fallbacks/src/retry-engine.ts — Implementation under test
 * @see D-V2-F14-09 — Retry scope + ±20% jitter
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRetryEngine } from './retry-engine.js'

describe('RetryEngine — computeDelay', () => {
  let engine: ReturnType<typeof createRetryEngine>

  beforeEach(() => {
    engine = createRetryEngine()
  })

  describe('backoff:"none"', () => {
    it('returns delayMs constant for attempt=0', () => {
      expect(
        engine.computeDelay(0, { attempts: 3, backoff: 'none', delayMs: 100 }),
      ).toBe(100)
    })

    it('returns delayMs constant for attempt=1', () => {
      expect(
        engine.computeDelay(1, { attempts: 3, backoff: 'none', delayMs: 100 }),
      ).toBe(100)
    })

    it('returns 0 when delayMs omitted', () => {
      expect(engine.computeDelay(0, { attempts: 3, backoff: 'none' })).toBe(0)
    })

    it('uses backoff:"none" as default when backoff omitted', () => {
      expect(engine.computeDelay(2, { attempts: 3, delayMs: 100 })).toBe(100)
    })
  })

  describe('backoff:"linear"', () => {
    it('attempt=0 → base * 1', () => {
      expect(
        engine.computeDelay(0, { attempts: 3, backoff: 'linear', delayMs: 100 }),
      ).toBe(100)
    })

    it('attempt=1 → base * 2', () => {
      expect(
        engine.computeDelay(1, { attempts: 3, backoff: 'linear', delayMs: 100 }),
      ).toBe(200)
    })

    it('attempt=2 → base * 3', () => {
      expect(
        engine.computeDelay(2, { attempts: 3, backoff: 'linear', delayMs: 100 }),
      ).toBe(300)
    })
  })

  describe('backoff:"exponential"', () => {
    it('attempt=0 → base * 2^0 = base', () => {
      expect(
        engine.computeDelay(0, {
          attempts: 3,
          backoff: 'exponential',
          delayMs: 50,
        }),
      ).toBe(50)
    })

    it('attempt=1 → base * 2', () => {
      expect(
        engine.computeDelay(1, {
          attempts: 3,
          backoff: 'exponential',
          delayMs: 50,
        }),
      ).toBe(100)
    })

    it('attempt=2 → base * 4', () => {
      expect(
        engine.computeDelay(2, {
          attempts: 3,
          backoff: 'exponential',
          delayMs: 50,
        }),
      ).toBe(200)
    })

    it('attempt=3 → base * 8', () => {
      expect(
        engine.computeDelay(3, {
          attempts: 5,
          backoff: 'exponential',
          delayMs: 50,
        }),
      ).toBe(400)
    })
  })

  describe('jitter ±20% (D-V2-F14-09)', () => {
    let randomSpy: ReturnType<typeof vi.spyOn> | undefined

    afterEach(() => {
      randomSpy?.mockRestore()
    })

    it('Math.random=0.5 → factor=1.0 → delay invariato', () => {
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      expect(
        engine.computeDelay(0, {
          attempts: 3,
          backoff: 'none',
          delayMs: 100,
          jitter: true,
        }),
      ).toBe(100)
    })

    it('Math.random=0 → factor=0.8 → delay = floor(100 * 0.8) = 80', () => {
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
      expect(
        engine.computeDelay(0, {
          attempts: 3,
          backoff: 'none',
          delayMs: 100,
          jitter: true,
        }),
      ).toBe(80)
    })

    it('Math.random=0.999 → factor≈1.1996 → delay = floor(100 * 1.1996) = 119', () => {
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999)
      expect(
        engine.computeDelay(0, {
          attempts: 3,
          backoff: 'none',
          delayMs: 100,
          jitter: true,
        }),
      ).toBe(119)
    })

    it('jitter:false NON applica randomization', () => {
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
      expect(
        engine.computeDelay(0, {
          attempts: 3,
          backoff: 'none',
          delayMs: 100,
          jitter: false,
        }),
      ).toBe(100)
    })

    it('jitter omitted NON applica randomization', () => {
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
      expect(
        engine.computeDelay(0, {
          attempts: 3,
          backoff: 'none',
          delayMs: 100,
        }),
      ).toBe(100)
    })

    it('jitter applicato sopra exponential backoff (attempt=2, base=50, jitter ±20%)', () => {
      randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      // 50 * 2^2 = 200; factor = 1.0 → 200
      expect(
        engine.computeDelay(2, {
          attempts: 5,
          backoff: 'exponential',
          delayMs: 50,
          jitter: true,
        }),
      ).toBe(200)
    })
  })

  it('Math.floor applied — integer output for setTimeout API', () => {
    const out = engine.computeDelay(1, {
      attempts: 3,
      backoff: 'linear',
      delayMs: 33,
    })
    expect(Number.isInteger(out)).toBe(true)
  })
})

describe('RetryEngine — counter Map<{mfId,phase}, attempts>', () => {
  let engine: ReturnType<typeof createRetryEngine>

  beforeEach(() => {
    engine = createRetryEngine()
  })

  it('incrementAttempt returns new count (1 first, 2 second)', () => {
    expect(engine.incrementAttempt('mf-A', 'load')).toBe(1)
    expect(engine.incrementAttempt('mf-A', 'load')).toBe(2)
  })

  it('getAttempts default 0 for unseen key', () => {
    expect(engine.getAttempts('mf-X', 'load')).toBe(0)
  })

  it('per-phase isolation: mf-A load NON interferisce mf-A bootstrap', () => {
    engine.incrementAttempt('mf-A', 'load')
    engine.incrementAttempt('mf-A', 'load')
    expect(engine.getAttempts('mf-A', 'load')).toBe(2)
    expect(engine.getAttempts('mf-A', 'bootstrap')).toBe(0)
  })

  it('per-MF isolation: mf-A load NON interferisce mf-B load', () => {
    engine.incrementAttempt('mf-A', 'load')
    expect(engine.getAttempts('mf-A', 'load')).toBe(1)
    expect(engine.getAttempts('mf-B', 'load')).toBe(0)
  })

  it('resetCounter clears specific key only', () => {
    engine.incrementAttempt('mf-A', 'load')
    engine.incrementAttempt('mf-A', 'bootstrap')
    engine.resetCounter('mf-A', 'load')
    expect(engine.getAttempts('mf-A', 'load')).toBe(0)
    expect(engine.getAttempts('mf-A', 'bootstrap')).toBe(1)
  })

  it('resetCounter on unseen key is no-op (no throw)', () => {
    expect(() => engine.resetCounter('mf-X', 'load')).not.toThrow()
  })

  it('Anti-singleton D-30: 2 engine indipendenti hanno counter separati', () => {
    const engineA = createRetryEngine()
    const engineB = createRetryEngine()
    engineA.incrementAttempt('mf-A', 'load')
    expect(engineA.getAttempts('mf-A', 'load')).toBe(1)
    expect(engineB.getAttempts('mf-A', 'load')).toBe(0)
  })
})

describe('RetryEngine — shouldRetry predicate', () => {
  let engine: ReturnType<typeof createRetryEngine>

  beforeEach(() => {
    engine = createRetryEngine()
  })

  it('returns true when counter=0 < policy.attempts=3', () => {
    expect(engine.shouldRetry('mf-A', 'load', { attempts: 3 })).toBe(true)
  })

  it('returns true after 2 increments with attempts=3 (counter=2 < 3)', () => {
    engine.incrementAttempt('mf-A', 'load')
    engine.incrementAttempt('mf-A', 'load')
    expect(engine.shouldRetry('mf-A', 'load', { attempts: 3 })).toBe(true)
  })

  it('returns false when counter=3 >= policy.attempts=3 (exhausted)', () => {
    engine.incrementAttempt('mf-A', 'load')
    engine.incrementAttempt('mf-A', 'load')
    engine.incrementAttempt('mf-A', 'load')
    expect(engine.shouldRetry('mf-A', 'load', { attempts: 3 })).toBe(false)
  })

  it('returns false when attempts=1 and counter=1 (default no-retry)', () => {
    engine.incrementAttempt('mf-A', 'load')
    expect(engine.shouldRetry('mf-A', 'load', { attempts: 1 })).toBe(false)
  })
})
