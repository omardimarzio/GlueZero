/**
 * Tier-1 jsdom — `rate-limiter.ts` fixed-window 100 msg/s drop + emit topic 1×/window
 * (D-V2-F15-04 — T-15-06 DoS flood mitigation).
 */
import { describe, expect, it, vi } from 'vitest'
import type { Broker } from '@gluezero/core'
import { RATE_LIMIT_MSG_PER_SEC, RateLimiter, WINDOW_MS } from '../rate-limiter'

function createMockBroker(): Broker & { _publishes: Array<{ topic: string; payload: unknown }> } {
  const publishes: Array<{ topic: string; payload: unknown }> = []
  const publish = vi.fn((topic: string, payload: unknown) => {
    publishes.push({ topic, payload })
  })
  // Minimal stub Broker per test rate-limiter (publish only)
  const broker = { publish } as unknown as Broker & {
    _publishes: typeof publishes
  }
  ;(broker as { _publishes: typeof publishes })._publishes = publishes
  return broker
}

describe('RateLimiter — D-V2-F15-04 fixed-window 100 msg/s', () => {
  it('shouldDrop false per primi 100 msg in 1s window', () => {
    const limiter = new RateLimiter()
    const broker = createMockBroker()
    const now = 1700000000000
    for (let i = 0; i < RATE_LIMIT_MSG_PER_SEC; i++) {
      const drop = limiter.shouldDrop('mf-x', 'https://iframe.com', broker, now)
      expect(drop).toBe(false)
    }
  })

  it('shouldDrop true per 101st msg in stesso window + emit topic UNA volta', () => {
    const limiter = new RateLimiter()
    const broker = createMockBroker()
    const now = 1700000000000
    for (let i = 0; i < RATE_LIMIT_MSG_PER_SEC; i++) {
      limiter.shouldDrop('mf-x', 'https://iframe.com', broker, now)
    }
    // 101st msg → drop + emit topic
    const drop = limiter.shouldDrop('mf-x', 'https://iframe.com', broker, now)
    expect(drop).toBe(true)
    expect(broker._publishes).toHaveLength(1)
    expect(broker._publishes[0]?.topic).toBe('microfrontend.iframe.bridge.rate-limited')
  })

  it('emit topic payload contiene mfId + origin + droppedCount + windowMs + timestamp', () => {
    const limiter = new RateLimiter()
    const broker = createMockBroker()
    const now = 1700000000000
    for (let i = 0; i < RATE_LIMIT_MSG_PER_SEC; i++) {
      limiter.shouldDrop('mf-x', 'https://iframe.com', broker, now)
    }
    limiter.shouldDrop('mf-x', 'https://iframe.com', broker, now)
    const payload = broker._publishes[0]?.payload as Record<string, unknown>
    expect(payload).toMatchObject({
      mfId: 'mf-x',
      origin: 'https://iframe.com',
      droppedCount: 1,
      windowMs: WINDOW_MS,
      timestamp: now,
    })
  })

  it('emit topic UNA volta per window — warned flag (anti-amplification)', () => {
    const limiter = new RateLimiter()
    const broker = createMockBroker()
    const now = 1700000000000
    for (let i = 0; i < RATE_LIMIT_MSG_PER_SEC + 10; i++) {
      limiter.shouldDrop('mf-x', 'https://iframe.com', broker, now)
    }
    expect(broker._publishes).toHaveLength(1) // UNA volta nonostante 10 drop
  })

  it('reset window dopo 1000 ms — count restart da 1', () => {
    const limiter = new RateLimiter()
    const broker = createMockBroker()
    const now = 1700000000000
    for (let i = 0; i < RATE_LIMIT_MSG_PER_SEC; i++) {
      limiter.shouldDrop('mf-x', 'https://iframe.com', broker, now)
    }
    const nextWindow = now + WINDOW_MS + 1
    const dropFirstInNewWindow = limiter.shouldDrop(
      'mf-x',
      'https://iframe.com',
      broker,
      nextWindow,
    )
    expect(dropFirstInNewWindow).toBe(false)
    expect(limiter.getCountForMf('mf-x')).toBe(1)
  })

  it('clearForMf reset window per mfId su unmount', () => {
    const limiter = new RateLimiter()
    const broker = createMockBroker()
    limiter.shouldDrop('mf-x', 'https://iframe.com', broker, 1700000000000)
    expect(limiter.getCountForMf('mf-x')).toBe(1)
    limiter.clearForMf('mf-x')
    expect(limiter.getCountForMf('mf-x')).toBe(0)
  })

  it('per-mfId scoping — mf-A floods senza affettare mf-B', () => {
    const limiter = new RateLimiter()
    const broker = createMockBroker()
    const now = 1700000000000
    for (let i = 0; i < RATE_LIMIT_MSG_PER_SEC + 5; i++) {
      limiter.shouldDrop('mf-A', 'https://iframe.com', broker, now)
    }
    const dropB = limiter.shouldDrop('mf-B', 'https://iframe.com', broker, now)
    expect(dropB).toBe(false)
  })
})
