/**
 * `topics.test.ts` — Tier-1 unit suite (jsdom) per i topics F14 literal.
 *
 * Cover REQ-IDs: MF-FALLBACK-03 (3 nuovi topics + governance F8 riuso).
 *
 * 5 test totali:
 *  1. `MF_FALLBACK_TOPICS` array literal — esattamente 3 entry in ordine atteso.
 *  2. `FALLBACK_EVENT_DEFAULT_TOPIC` literal exact match.
 *  3. `FALLBACK_RENDERED_TOPIC` riuso F8 governance (`MF_GOVERNANCE_TOPICS[4]`).
 *  4. `MfFallbackTopic` union narrowing — 5 valori type-compatibili.
 *  5. Topic literals unicità (set di 5 elementi distinti).
 */
import { describe, it, expect } from 'vitest'
import { MF_GOVERNANCE_TOPICS } from '@gluezero/microfrontends'
import {
  MF_FALLBACK_TOPICS,
  FALLBACK_EVENT_DEFAULT_TOPIC,
  FALLBACK_RENDERED_TOPIC,
  type MfFallbackTopic,
} from './topics.js'

describe('Topics F14 literal', () => {
  it('MF_FALLBACK_TOPICS contains exactly 3 literal topics in expected order', () => {
    expect(MF_FALLBACK_TOPICS).toEqual([
      'microfrontend.recovered',
      'microfrontend.circuit.opened',
      'microfrontend.circuit.closed',
    ])
    expect(MF_FALLBACK_TOPICS.length).toBe(3)
  })

  it('FALLBACK_EVENT_DEFAULT_TOPIC literal exact match', () => {
    expect(FALLBACK_EVENT_DEFAULT_TOPIC).toBe('microfrontend.fallback.event')
  })

  it('FALLBACK_RENDERED_TOPIC reuses F8 governance (MF_GOVERNANCE_TOPICS[4])', () => {
    expect(FALLBACK_RENDERED_TOPIC).toBe('microfrontend.fallback.rendered')
    expect(FALLBACK_RENDERED_TOPIC).toBe(MF_GOVERNANCE_TOPICS[4])
  })

  it('MfFallbackTopic union narrowing accepts F14-locali + governance F8 + default event', () => {
    const t1: MfFallbackTopic = 'microfrontend.recovered'
    const t2: MfFallbackTopic = 'microfrontend.circuit.opened'
    const t3: MfFallbackTopic = 'microfrontend.circuit.closed'
    const t4: MfFallbackTopic = 'microfrontend.fallback.rendered'
    const t5: MfFallbackTopic = 'microfrontend.fallback.event'
    expect([t1, t2, t3, t4, t5].every((t) => typeof t === 'string')).toBe(true)
  })

  it('topic literals are unique (no duplicates between MF_FALLBACK_TOPICS + governance reused)', () => {
    const all = new Set<string>([
      ...MF_FALLBACK_TOPICS,
      FALLBACK_RENDERED_TOPIC,
      FALLBACK_EVENT_DEFAULT_TOPIC,
    ])
    expect(all.size).toBe(5)
  })
})
