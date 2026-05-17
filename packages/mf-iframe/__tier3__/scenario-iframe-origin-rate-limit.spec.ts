/**
 * Tier-3 Scenario Iframe #2 (Chromium reale): `expectedOrigin` MANDATORY enforcement
 * (`'*'` ban) + rate limit fixed-window 100 msg/s drop+emit topic 1×/window
 * (D-V2-F15-04 + REQ MF-IFRAME-04 + REQ MF-SEC-01..04).
 *
 * **Strategia**: testiamo origin validation + rate-limiter (sub-systems isolati) in
 * Chromium reale per validare runtime assert path. Tier-1 jsdom già copre l'API base,
 * Tier-3 valida ulteriore che `Map<string, RateLimitWindow>` + `Date.now()` precision
 * + broker.publish side-effect emit funzionino in Chromium real.
 *
 * Coverage REQ MF-IFRAME-04 (expectedOrigin MANDATORY + targetOrigin '*' BANNED) +
 * REQ MF-SEC-04 + D-V2-F15-04 (rate limit drop+emit topic UNA volta/window) +
 * STRIDE T-15-04/T-15-05/T-15-06.
 *
 * @see PLAN 15-05 Phase A — Tier-3 Playwright Chromium 8 scenari (2 iframe — security)
 * @see SUMMARY 15-03 — STRIDE T-15-04..06 implementation
 */
import { describe, expect, it } from 'vitest'
import { MfIframeError } from '../src/errors.js'
import {
  validateExpectedOrigin,
  validateTargetOrigin,
} from '../src/origin-validator.js'
import {
  RateLimiter,
  RATE_LIMIT_MSG_PER_SEC,
  WINDOW_MS,
} from '../src/rate-limiter.js'

// Mock broker minimale per RateLimiter.shouldDrop side-effect publish
function makeMockBroker(): {
  published: Array<{ topic: string; payload: unknown }>
  publish: (topic: string, payload: unknown) => void
} {
  const published: Array<{ topic: string; payload: unknown }> = []
  return {
    published,
    publish(topic, payload) {
      published.push({ topic, payload })
    },
  }
}

describe('Tier-3 Iframe #2: expectedOrigin enforcement + rate limit 100/s', () => {
  it('expectedOrigin MANDATORY: undefined → MF_IFRAME_ORIGIN_MISMATCH (T-15-04)', () => {
    expect(() => validateExpectedOrigin(undefined, 'mf-x')).toThrow(MfIframeError)
    try {
      validateExpectedOrigin(undefined, 'mf-x')
    } catch (err) {
      expect((err as MfIframeError).code).toBe('MF_IFRAME_ORIGIN_MISMATCH')
      expect((err as MfIframeError).details?.['reason']).toBe('expectedOrigin required')
    }
  })

  it('expectedOrigin wildcard "*" BANNED → MF_IFRAME_ORIGIN_MISMATCH (T-15-05)', () => {
    expect(() => validateExpectedOrigin('*', 'mf-y')).toThrow(MfIframeError)
    try {
      validateExpectedOrigin('*', 'mf-y')
    } catch (err) {
      expect((err as MfIframeError).code).toBe('MF_IFRAME_ORIGIN_MISMATCH')
      expect((err as MfIframeError).details?.['reason']).toBe('wildcard banned')
    }
  })

  it('targetOrigin "*" BANNED runtime PRIMARY (REQ MF-IFRAME-04 dual-defense)', () => {
    expect(() => validateTargetOrigin('*', 'mf-z')).toThrow(MfIframeError)
    try {
      validateTargetOrigin('*', 'mf-z')
    } catch (err) {
      expect((err as MfIframeError).code).toBe('MF_IFRAME_ORIGIN_MISMATCH')
      expect((err as MfIframeError).origin).toBe('*')
    }
  })

  it('targetOrigin valid: NO throw (happy path)', () => {
    expect(() =>
      validateTargetOrigin('https://iframe.example.com', 'mf-ok'),
    ).not.toThrow()
  })

  it('Rate limit 100/s: 101st msg in stesso window → drop + emit topic 1x/window (T-15-06)', () => {
    const limiter = new RateLimiter()
    const broker = makeMockBroker()
    const mfId = 'mf-flood'
    const origin = 'https://attacker.example.com'
    const now = 1700000000000

    // Drive 100 msg within window — tutti acceptati (entro cap)
    for (let i = 0; i < RATE_LIMIT_MSG_PER_SEC; i += 1) {
      expect(limiter.shouldDrop(mfId, origin, broker as never, now)).toBe(false)
    }

    // 101st: drop + emit topic UNA volta
    expect(limiter.shouldDrop(mfId, origin, broker as never, now)).toBe(true)
    expect(broker.published.length).toBe(1)
    expect(broker.published[0]!.topic).toBe('microfrontend.iframe.bridge.rate-limited')
    expect(broker.published[0]!.payload).toMatchObject({
      mfId,
      origin,
      windowMs: WINDOW_MS,
    })

    // 102..105: still drop, ma NO ulteriori emit (anti-amplification 1x/window)
    for (let i = 0; i < 4; i += 1) {
      expect(limiter.shouldDrop(mfId, origin, broker as never, now)).toBe(true)
    }
    expect(broker.published.length).toBe(1) // ANCORA 1 — anti-DoS amplification
  })

  it('Rate limit window reset: 1001ms dopo → nuovo window count=1 (NO drop)', () => {
    const limiter = new RateLimiter()
    const broker = makeMockBroker()
    const mfId = 'mf-window-roll'
    const origin = 'https://mf.example.com'
    const t0 = 1700000000000

    // Floda 101 msg @ t0 (drop + 1 emit)
    for (let i = 0; i < 101; i += 1) {
      limiter.shouldDrop(mfId, origin, broker as never, t0)
    }
    expect(broker.published.length).toBe(1)

    // Avanza t0+1001ms — window roll, count reset, NO drop
    expect(limiter.shouldDrop(mfId, origin, broker as never, t0 + 1001)).toBe(false)
    expect(limiter.getCountForMf(mfId)).toBe(1)
  })

  it('Rate limit isolation per-mfId: mf-A flooded, mf-B unaffected', () => {
    const limiter = new RateLimiter()
    const broker = makeMockBroker()
    const t0 = 1700000000000

    // mf-A: drive 101 msg
    for (let i = 0; i < 101; i += 1) {
      limiter.shouldDrop('mf-A', 'https://a.com', broker as never, t0)
    }
    // mf-B: still 0 count
    expect(limiter.shouldDrop('mf-B', 'https://b.com', broker as never, t0)).toBe(false)
    expect(limiter.getCountForMf('mf-B')).toBe(1)
  })
})
