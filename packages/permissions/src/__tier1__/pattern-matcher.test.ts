/**
 * Tier-1 unit test — `matchPatterns` (4 modes + deny-wins order-independent).
 *
 * Copertura: D-V2-F11-05 deny-wins order-independent + D-V2-F11-14 fail-secure
 * empty + 4 modes coverage (esatto/wildcard finale/globale/deny `!`).
 *
 * @see packages/permissions/src/pattern-matcher.ts
 * @see prd_2.0.0.md §19.4
 */
import { describe, expect, it } from 'vitest'
import { matchPatterns } from '../pattern-matcher'

describe('matchPatterns (4 modes + deny-wins order-independent)', () => {
  it('allow simple', () => {
    expect(matchPatterns(['customer.*'], 'customer.order')).toBe(true)
  })

  it('no match → false', () => {
    expect(matchPatterns(['customer.*'], 'other.topic')).toBe(false)
  })

  it('deny-wins order-A: allow + deny', () => {
    expect(matchPatterns(['customer.*', '!customer.pii.*'], 'customer.pii.email')).toBe(false)
  })

  it('deny-wins order-B: deny + allow (ORDER-INDEPENDENT D-V2-F11-05)', () => {
    expect(matchPatterns(['!customer.pii.*', 'customer.*'], 'customer.pii.email')).toBe(false)
  })

  it('global wildcard allow', () => {
    expect(matchPatterns(['*'], 'anything.deep.path')).toBe(true)
  })

  it('empty patterns → fail-secure deny-all (D-V2-F11-14)', () => {
    expect(matchPatterns([], 'anything')).toBe(false)
  })

  it('deny-only patterns array → false (no allow match anyway)', () => {
    expect(matchPatterns(['!customer.pii.*'], 'customer.pii.email')).toBe(false)
    expect(matchPatterns(['!customer.pii.*'], 'safe.topic')).toBe(false)
  })

  it('allow + matching deny but different topic → allowed', () => {
    expect(matchPatterns(['customer.*', '!customer.pii.*'], 'customer.order.created')).toBe(true)
  })
})
