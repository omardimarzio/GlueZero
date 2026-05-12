/**
 * Tier-1 unit test — `matchesPattern` (helper multi-segment F11 DIVERGE F1).
 *
 * Copertura: 4 modes pattern matching + multi-segment DIVERGE F1 single-segment
 * (D-V2-F11-06) + no-false-prefix safety.
 *
 * @see packages/permissions/src/internal/topic-pattern-match.ts
 * @see prd_2.0.0.md §19.4
 */
import { describe, expect, it } from 'vitest'
import { matchesPattern } from '../internal/topic-pattern-match'

describe('matchesPattern (multi-segment F11 DIVERGE F1)', () => {
  it('matcha wildcard globale * con qualunque topic', () => {
    expect(matchesPattern('*', 'anything')).toBe(true)
    expect(matchesPattern('*', 'a.b.c.d')).toBe(true)
    expect(matchesPattern('*', '')).toBe(true)
  })

  it('matcha esatto', () => {
    expect(matchesPattern('customer.order', 'customer.order')).toBe(true)
  })

  it('NON matcha sotto-stringa parziale', () => {
    expect(matchesPattern('customer.order', 'customer')).toBe(false)
    expect(matchesPattern('customer', 'customer.order')).toBe(false)
  })

  it('wildcard finale matcha prefix base', () => {
    expect(matchesPattern('customer.*', 'customer')).toBe(true)
  })

  it('wildcard finale matcha single-level', () => {
    expect(matchesPattern('customer.*', 'customer.order')).toBe(true)
  })

  it('wildcard finale matcha multi-level (DIVERGE F1 single-segment)', () => {
    expect(matchesPattern('customer.*', 'customer.order.created')).toBe(true)
    expect(matchesPattern('customer.*', 'customer.a.b.c.d.e')).toBe(true)
  })

  it('NON matcha false prefix (no separator)', () => {
    expect(matchesPattern('customer.*', 'customerOther')).toBe(false)
    expect(matchesPattern('customer.*', 'customerized')).toBe(false)
  })
})
