/**
 * F6 cardinality-cap.test.ts — Tier-1 jsdom (plan 06-06 Task 2).
 *
 * Validazione D-166 cap distinct label combinations + audit emit (T-06-06-01
 * mitigation):
 * - flatLabels Prometheus-style alphabetical sort + JSON-escape
 * - createCardinalityTracker cap default 100 distinct combinations per base name
 * - Overflow → drop + onOverflow callback
 * - Empty labels → sempre accept (no cardinality concern)
 * - Cap per base name (NON globale)
 *
 * Pattern carryover: F5 worker-registry.ts:39+104-180 D-128 cap+console.warn.
 */

import { describe, expect, it, vi } from 'vitest'
import { createCardinalityTracker, flatLabels } from './cardinality-cap'

describe('flatLabels — Prometheus-style flatten alphabetical sort', () => {
  it('Test 1: flatLabels(undefined) ritorna empty string', () => {
    expect(flatLabels(undefined)).toBe('')
  })

  it('Test 2: flatLabels({}) ritorna empty string', () => {
    expect(flatLabels({})).toBe('')
  })

  it('Test 3: flatLabels singolo key → {key="value"}', () => {
    expect(flatLabels({ route_id: 'weather' })).toBe('{route_id="weather"}')
  })

  it('Test 4: flatLabels multipli keys → alphabetical sort', () => {
    expect(flatLabels({ status: '200', route_id: 'weather' })).toBe(
      '{route_id="weather",status="200"}',
    )
  })

  it('Test 5: flatLabels JSON-escape values con quotes', () => {
    expect(flatLabels({ msg: 'has "quotes"' })).toBe('{msg="has \\"quotes\\""}')
  })
})

describe('createCardinalityTracker — D-166 cap 100 distinct + audit (T-06-06-01)', () => {
  it('Test 6: cap 5 — primi 5 distinct combo accept', () => {
    const onOverflow = vi.fn()
    const t = createCardinalityTracker({ cap: 5, onOverflow })
    for (let i = 0; i < 5; i++) {
      expect(t.check('m', `{k="${i}"}`)).toBe(true)
    }
    expect(onOverflow).not.toHaveBeenCalled()
  })

  it('Test 7: 6° distinct combo → drop + onOverflow chiamato con baseName + droppedLabels', () => {
    const onOverflow = vi.fn()
    const t = createCardinalityTracker({ cap: 5, onOverflow })
    for (let i = 0; i < 5; i++) t.check('m', `{k="${i}"}`)
    const ok = t.check('m', '{k="overflow"}')
    expect(ok).toBe(false)
    expect(onOverflow).toHaveBeenCalledTimes(1)
    expect(onOverflow).toHaveBeenCalledWith({
      baseName: 'm',
      droppedLabels: '{k="overflow"}',
    })
  })

  it('Test 8: ripetuta combinazione esistente → accept (no count incremento + no overflow)', () => {
    const onOverflow = vi.fn()
    const t = createCardinalityTracker({ cap: 2, onOverflow })
    expect(t.check('m', '{k="a"}')).toBe(true)
    expect(t.check('m', '{k="b"}')).toBe(true)
    // Riusa combo esistente — anche se cap raggiunto NON drop
    expect(t.check('m', '{k="a"}')).toBe(true)
    expect(t.check('m', '{k="b"}')).toBe(true)
    expect(onOverflow).not.toHaveBeenCalled()
    // 3° distinct invece OVERFLOW
    expect(t.check('m', '{k="c"}')).toBe(false)
    expect(onOverflow).toHaveBeenCalledTimes(1)
  })

  it('Test 9: empty labelSig — sempre accept (cardinality cap NON applica a metric senza labels)', () => {
    const onOverflow = vi.fn()
    const t = createCardinalityTracker({ cap: 1, onOverflow })
    expect(t.check('m', '')).toBe(true)
    expect(t.check('m', '')).toBe(true)
    expect(t.check('m', '')).toBe(true)
    expect(onOverflow).not.toHaveBeenCalled()
  })

  it('Test 10: base names diversi → cardinality count separato (cap per base name)', () => {
    const onOverflow = vi.fn()
    const t = createCardinalityTracker({ cap: 2, onOverflow })
    expect(t.check('a', '{k="1"}')).toBe(true)
    expect(t.check('a', '{k="2"}')).toBe(true)
    // 'b' ha cap separato — 2 distinct ammessi anche se 'a' è full
    expect(t.check('b', '{k="1"}')).toBe(true)
    expect(t.check('b', '{k="2"}')).toBe(true)
    expect(onOverflow).not.toHaveBeenCalled()
  })

  it('Test 11: default cap = 100 — verifica costante', () => {
    const t = createCardinalityTracker({})
    for (let i = 0; i < 100; i++) {
      expect(t.check('m', `{k="${i}"}`)).toBe(true)
    }
    expect(t.check('m', '{k="100"}')).toBe(false)
  })

  it('Test 12: senza onOverflow callback → drop silenzioso, no throw', () => {
    const t = createCardinalityTracker({ cap: 1 })
    expect(t.check('m', '{k="a"}')).toBe(true)
    expect(() => t.check('m', '{k="b"}')).not.toThrow()
    expect(t.check('m', '{k="b"}')).toBe(false)
  })
})
