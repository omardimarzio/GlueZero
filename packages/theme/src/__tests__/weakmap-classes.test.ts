/**
 * Tier-1 jsdom test per `createClassesTracker` (UI-ROLE-10).
 *
 * Pattern critico: WeakMap<HTMLElement, Set<string>> per cleanup non-destructive
 * durante hot-swap adapter (UI-ROLE-05). Le classi pre-esistenti (NON aggiunte
 * dal tracker) NON devono essere rimosse da `restore`.
 *
 * Refs: 07-06-PLAN.md Task 1; 07-CONTEXT.md UI-ROLE-10.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createClassesTracker } from '../internal/weakmap-classes'

describe('createClassesTracker', () => {
  let el: HTMLElement
  let pre: HTMLElement

  beforeEach(() => {
    el = document.createElement('div')
    document.body.appendChild(el)
    pre = document.createElement('div')
    pre.className = 'pre-existing native'
    document.body.appendChild(pre)
  })

  afterEach(() => {
    document.body.removeChild(el)
    document.body.removeChild(pre)
  })

  it('exposes track/restore/destroy', () => {
    const t = createClassesTracker()
    expect(typeof t.track).toBe('function')
    expect(typeof t.restore).toBe('function')
    expect(typeof t.destroy).toBe('function')
  })

  it('track adds classes to element', () => {
    const t = createClassesTracker()
    t.track(el, ['btn', 'primary'])
    expect(el.classList.contains('btn')).toBe(true)
    expect(el.classList.contains('primary')).toBe(true)
  })

  it('subsequent track adds new classes without removing previous', () => {
    const t = createClassesTracker()
    t.track(el, ['btn'])
    t.track(el, ['primary'])
    expect(el.classList.contains('btn')).toBe(true)
    expect(el.classList.contains('primary')).toBe(true)
  })

  it('restore removes ONLY tracked classes (preserves pre-existing)', () => {
    const t = createClassesTracker()
    t.track(pre, ['adapter-btn'])
    expect(pre.classList.contains('pre-existing')).toBe(true)
    expect(pre.classList.contains('adapter-btn')).toBe(true)
    t.restore(pre)
    expect(pre.classList.contains('pre-existing')).toBe(true)
    expect(pre.classList.contains('native')).toBe(true)
    expect(pre.classList.contains('adapter-btn')).toBe(false)
  })

  it('track does NOT track pre-existing classes (so restore does not remove them)', () => {
    const t = createClassesTracker()
    t.track(pre, ['native', 'new-class'])
    expect(pre.classList.contains('native')).toBe(true)
    expect(pre.classList.contains('new-class')).toBe(true)
    t.restore(pre)
    expect(pre.classList.contains('native')).toBe(true)
    expect(pre.classList.contains('new-class')).toBe(false)
  })

  it('track empty array is no-op', () => {
    const t = createClassesTracker()
    t.track(el, [])
    expect(el.classList.length).toBe(0)
  })

  it('restore on untracked element is no-op', () => {
    const t = createClassesTracker()
    expect(() => t.restore(el)).not.toThrow()
  })

  it('skip class names with spaces (defensive)', () => {
    const t = createClassesTracker()
    t.track(el, ['btn primary'])
    expect(el.classList.contains('btn primary')).toBe(false)
    expect(el.classList.contains('btn')).toBe(false)
  })

  it('two elements tracked independently (WeakMap behavior)', () => {
    const t = createClassesTracker()
    const el2 = document.createElement('div')
    document.body.appendChild(el2)
    t.track(el, ['a'])
    t.track(el2, ['b'])
    t.restore(el)
    expect(el.classList.contains('a')).toBe(false)
    expect(el2.classList.contains('b')).toBe(true)
    document.body.removeChild(el2)
  })

  it('destroy: subsequent restore is no-op (entries forgotten)', () => {
    const t = createClassesTracker()
    t.track(el, ['c'])
    t.destroy()
    expect(() => t.restore(el)).not.toThrow()
    // Class still on element (destroy non rimuove auto, solo dimentica tracking)
    expect(el.classList.contains('c')).toBe(true)
    el.classList.remove('c')
  })
})
