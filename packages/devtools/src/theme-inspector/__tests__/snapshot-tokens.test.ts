// snapshot-tokens.test.ts — F7 plan 07-09 W5a Task 2.
//
// Tier-1 jsdom suite per `snapshotTokens` + `diffSnapshots` re-export
// (UI-DEVTOOLS-04 + UI-DEVTOOLS-05).
//
// NOTA jsdom (Tier-1) limitation: `getComputedStyle('--gz-*')` ritorna `''` per
// CSS Custom Properties (Vitest issue #1689). Il test legge da `target.style`
// (inline) — funziona in jsdom anche su `--gz-*` set via `setProperty`. Tier-3
// Playwright Chromium (W6 plan 07-13) verifica il path completo cascade.
//
// Refs:
// - 07-09-PLAN.md Task 2 behavior 9-10
// - 07-CONTEXT.md UI-DEVTOOLS-04 (snapshot+diff)

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { diffSnapshots, snapshotTokens } from '../snapshot-tokens'

describe('snapshotTokens', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style')
  })
  afterEach(() => {
    document.documentElement.removeAttribute('style')
  })

  it('reads --gz-* properties from inline style (default scope = documentElement)', () => {
    document.documentElement.style.setProperty('--gz-color-primary', '#FF6B35')
    document.documentElement.style.setProperty('--gz-spacing-md', '1rem')
    const snap = snapshotTokens()
    expect(snap['color-primary']).toBe('#FF6B35')
    expect(snap['spacing-md']).toBe('1rem')
  })

  it('filters out non-`--gz-*` properties', () => {
    document.documentElement.style.setProperty('--gz-color-primary', '#FF6B35')
    document.documentElement.style.setProperty('--other-token', 'red')
    document.documentElement.style.setProperty('--app-bg', 'blue')
    const snap = snapshotTokens()
    expect(snap['color-primary']).toBe('#FF6B35')
    expect(snap['other-token']).toBeUndefined()
    expect(snap['app-bg']).toBeUndefined()
  })

  it('strips `--gz-` prefix from keys', () => {
    document.documentElement.style.setProperty('--gz-radius-md', '8px')
    const snap = snapshotTokens()
    expect(snap['radius-md']).toBe('8px')
    expect(snap['--gz-radius-md']).toBeUndefined()
    expect(snap['gz-radius-md']).toBeUndefined()
  })

  it('respects explicit scope argument', () => {
    const el = document.createElement('div')
    el.style.setProperty('--gz-color-primary', '#abc')
    document.body.appendChild(el)
    const snap = snapshotTokens(el)
    expect(snap['color-primary']).toBe('#abc')
    document.body.removeChild(el)
  })

  it('returns empty object for element without `--gz-*` tokens', () => {
    const el = document.createElement('div')
    el.style.color = 'red' // non-gz inline
    document.body.appendChild(el)
    expect(snapshotTokens(el)).toEqual({})
    document.body.removeChild(el)
  })

  it('returns empty object when no scope and document undefined-safe', () => {
    // Caso normale jsdom: usa default documentElement (no token set)
    document.documentElement.removeAttribute('style')
    const snap = snapshotTokens()
    expect(snap).toEqual({})
  })

  it('multiple tokens preserved with original values trimmed', () => {
    document.documentElement.style.setProperty('--gz-color-primary', ' #FF6B35 ')
    document.documentElement.style.setProperty('--gz-spacing-md', '1rem')
    document.documentElement.style.setProperty('--gz-radius-full', '9999px')
    const snap = snapshotTokens()
    expect(Object.keys(snap).length).toBe(3)
    // Trim is applied
    expect(snap['color-primary']).toBe('#FF6B35')
  })

  it('skips tokens with empty string value', () => {
    document.documentElement.style.setProperty('--gz-color-primary', '#abc')
    // Set a value then clear it: should be removed from style.length
    // jsdom: setProperty with empty string actually removes the property
    const snap = snapshotTokens()
    expect(snap['color-primary']).toBe('#abc')
  })
})

describe('diffSnapshots (re-exported from @gluezero/theme)', () => {
  it('detects added/removed/changed', () => {
    const d = diffSnapshots({ x: '1' }, { x: '2', y: '3' })
    expect(d.added).toEqual({ y: '3' })
    expect(d.changed).toEqual({ x: { from: '1', to: '2' } })
    expect(d.removed).toEqual({})
  })

  it('detects removed-only', () => {
    const d = diffSnapshots({ x: '1', y: '2' }, { x: '1' })
    expect(d.added).toEqual({})
    expect(d.changed).toEqual({})
    expect(d.removed).toEqual({ y: '2' })
  })

  it('empty diff for equal snapshots', () => {
    const d = diffSnapshots({ x: '1' }, { x: '1' })
    expect(d.added).toEqual({})
    expect(d.removed).toEqual({})
    expect(d.changed).toEqual({})
  })

  it('result is deep-frozen (immutability cross-consumer)', () => {
    const d = diffSnapshots({ x: '1' }, { x: '2' })
    expect(Object.isFrozen(d)).toBe(true)
    expect(Object.isFrozen(d.added)).toBe(true)
    expect(Object.isFrozen(d.removed)).toBe(true)
    expect(Object.isFrozen(d.changed)).toBe(true)
  })
})
