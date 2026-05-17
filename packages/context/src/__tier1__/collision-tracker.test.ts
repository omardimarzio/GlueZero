/**
 * Tier-1 jsdom test suite — `collision-tracker.ts` Set dedup (D-V2-F10-11).
 *
 * @see T-F10-03 (namespace collision register-time)
 * @see T-F10-05 (cleanup cascade)
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  __resetCollisionsForTest,
  clearCollisionsForMf,
  hasSeenCollision,
  markCollision,
} from '../collision-tracker'

describe('collision-tracker — Set dedup (D-V2-F10-11)', () => {
  afterEach(() => {
    __resetCollisionsForTest()
  })

  it('markCollision + hasSeenCollision happy path', () => {
    expect(hasSeenCollision('mf-x', 'customerId')).toBe(false)
    markCollision('mf-x', 'customerId')
    expect(hasSeenCollision('mf-x', 'customerId')).toBe(true)
  })

  it('dedup: stesso (mfId, field) added 100× → 1 entry idempotent', () => {
    for (let i = 0; i < 100; i++) markCollision('mf-x', 'customerId')
    expect(hasSeenCollision('mf-x', 'customerId')).toBe(true)
    // Set semantic: idempotent — second markCollision no-op
    markCollision('mf-x', 'customerId')
    expect(hasSeenCollision('mf-x', 'customerId')).toBe(true)
  })

  it('isolation: (mf-x, field) NOT same as (mf-y, field)', () => {
    markCollision('mf-x', 'customerId')
    expect(hasSeenCollision('mf-y', 'customerId')).toBe(false)
    expect(hasSeenCollision('mf-x', 'customerId')).toBe(true)
  })

  it('isolation: stesso mfId, field diversi → entries indipendenti', () => {
    markCollision('mf-x', 'customerId')
    markCollision('mf-x', 'tenantId')
    expect(hasSeenCollision('mf-x', 'customerId')).toBe(true)
    expect(hasSeenCollision('mf-x', 'tenantId')).toBe(true)
    expect(hasSeenCollision('mf-x', 'otherField')).toBe(false)
  })

  it('clearCollisionsForMf rimuove entries solo per mfId target', () => {
    markCollision('mf-x', 'customerId')
    markCollision('mf-x', 'tenantId')
    markCollision('mf-y', 'customerId')
    clearCollisionsForMf('mf-x')
    expect(hasSeenCollision('mf-x', 'customerId')).toBe(false)
    expect(hasSeenCollision('mf-x', 'tenantId')).toBe(false)
    expect(hasSeenCollision('mf-y', 'customerId')).toBe(true) // preserved
  })

  it('clearCollisionsForMf no-op se mfId non ha entries', () => {
    markCollision('mf-y', 'customerId')
    clearCollisionsForMf('mf-x') // no entries — no throw
    expect(hasSeenCollision('mf-y', 'customerId')).toBe(true)
  })

  it('__resetCollisionsForTest pulisce tutto', () => {
    markCollision('mf-x', 'f1')
    markCollision('mf-y', 'f2')
    __resetCollisionsForTest()
    expect(hasSeenCollision('mf-x', 'f1')).toBe(false)
    expect(hasSeenCollision('mf-y', 'f2')).toBe(false)
  })
})
