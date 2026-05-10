// Tier-1 jsdom tests per `createSnapshot` + `diffSnapshots` (D-F7-08).
//
// Coverage:
// - createSnapshot: tutte le 8 chiavi presenti, deep-frozen recursive.
// - diffSnapshots: added / removed / changed; combined diff.
//
// Refs: 07-02-PLAN.md Task 2 behavior tests 1-3; THEME-09; UI-DEVTOOLS-04 (W5a reuse).

import { describe, expect, it } from 'vitest'
import { createSnapshot, diffSnapshots } from '../snapshot'

describe('createSnapshot', () => {
  it('produces all 8 fields from input', () => {
    const snap = createSnapshot({
      themeId: 't1',
      tokens: { 'color-primary': '#fff' },
      mode: 'light',
      resolvedMode: 'light',
      density: 'comfortable',
      direction: 'ltr',
      activeAdapterId: null,
      scope: 'root',
    })
    expect(snap.themeId).toBe('t1')
    expect(snap.tokens['color-primary']).toBe('#fff')
    expect(snap.mode).toBe('light')
    expect(snap.resolvedMode).toBe('light')
    expect(snap.density).toBe('comfortable')
    expect(snap.direction).toBe('ltr')
    expect(snap.activeAdapterId).toBeNull()
    expect(snap.scope).toBe('root')
  })

  it('returns deep-frozen object (D-F7-08)', () => {
    const snap = createSnapshot({
      themeId: 't1',
      tokens: { x: '1', y: '2' },
      mode: 'dark',
      resolvedMode: 'dark',
      density: 'compact',
      direction: 'rtl',
      activeAdapterId: 'tailwind',
      scope: 'scoped',
    })
    expect(Object.isFrozen(snap)).toBe(true)
    expect(Object.isFrozen(snap.tokens)).toBe(true)
  })

  it('mutating snapshot.tokens throws in strict mode', () => {
    const snap = createSnapshot({
      themeId: 't1',
      tokens: { x: '1' },
      mode: 'light',
      resolvedMode: 'light',
      density: 'comfortable',
      direction: 'ltr',
      activeAdapterId: null,
      scope: 'root',
    })
    expect(() => {
      ;(snap.tokens as Record<string, string>).x = 'mutated'
    }).toThrow()
  })

  it('decouples internal Map: mutating input post-snapshot does NOT affect snapshot', () => {
    const tokens: Record<string, string> = { x: '1' }
    const snap = createSnapshot({
      themeId: 't1',
      tokens,
      mode: 'light',
      resolvedMode: 'light',
      density: 'comfortable',
      direction: 'ltr',
      activeAdapterId: null,
      scope: 'root',
    })
    tokens.x = 'mutated'
    tokens['y'] = 'added'
    expect(snap.tokens['x']).toBe('1')
    expect(snap.tokens['y']).toBeUndefined()
  })
})

describe('diffSnapshots', () => {
  it('detects added keys', () => {
    const d = diffSnapshots({ x: '1' }, { x: '1', y: '2' })
    expect(d.added).toEqual({ y: '2' })
    expect(d.removed).toEqual({})
    expect(d.changed).toEqual({})
  })

  it('detects removed keys', () => {
    const d = diffSnapshots({ x: '1', y: '2' }, { x: '1' })
    expect(d.removed).toEqual({ y: '2' })
    expect(d.added).toEqual({})
    expect(d.changed).toEqual({})
  })

  it('detects changed values', () => {
    const d = diffSnapshots({ x: '1' }, { x: '2' })
    expect(d.changed).toEqual({ x: { from: '1', to: '2' } })
    expect(d.added).toEqual({})
    expect(d.removed).toEqual({})
  })

  it('combined diff: added + removed + changed', () => {
    const d = diffSnapshots({ x: '1', y: '2' }, { x: '9', z: '3' })
    expect(d.added).toEqual({ z: '3' })
    expect(d.removed).toEqual({ y: '2' })
    expect(d.changed).toEqual({ x: { from: '1', to: '9' } })
  })

  it('returns frozen result (immutable diff)', () => {
    const d = diffSnapshots({ x: '1' }, { x: '2' })
    expect(Object.isFrozen(d)).toBe(true)
    expect(Object.isFrozen(d.added)).toBe(true)
    expect(Object.isFrozen(d.removed)).toBe(true)
    expect(Object.isFrozen(d.changed)).toBe(true)
  })

  it('empty inputs: no-op diff', () => {
    const d = diffSnapshots({}, {})
    expect(d.added).toEqual({})
    expect(d.removed).toEqual({})
    expect(d.changed).toEqual({})
  })
})
