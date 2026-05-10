/**
 * Tier-1 jsdom test per `createOsPreferenceWatcher` (D-F7-13).
 *
 * Mock pattern matchMedia: stub `window.matchMedia` con MediaQueryList custom
 * con `addEventListener`/`removeEventListener`/`dispatchEvent` reali (Set-based)
 * — jsdom ha matchMedia stub di default che ritorna `matches: false` e listener
 * no-op; per testare il subscribe flow serve un MQL real-like.
 *
 * Refs:
 * - 07-RESEARCH.md "Standard Stack" matchMedia universale
 * - 07-RESEARCH.md Pitfall HIGH #6 (OS prefs ignorate) mitigation
 * - 07-CONTEXT.md D-F7-13 default setMode auto mirror OS
 * - 07-03-PLAN.md Task 1
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOsPreferenceWatcher } from '../os-preference'

describe('createOsPreferenceWatcher', () => {
  let originalMatchMedia: typeof window.matchMedia | undefined

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia
    }
  })

  /**
   * Mock MediaQueryList con `addEventListener`/`removeEventListener`/`dispatchEvent`
   * funzionanti (Set-based listener registry).
   */
  function mockMatchMedia(matches: boolean): MediaQueryList {
    const listeners = new Set<(e: MediaQueryListEvent) => void>()
    const mql = {
      matches,
      media: '',
      onchange: null,
      addEventListener: vi.fn(
        (_: string, l: (e: MediaQueryListEvent) => void) => {
          listeners.add(l)
        },
      ),
      removeEventListener: vi.fn(
        (_: string, l: (e: MediaQueryListEvent) => void) => {
          listeners.delete(l)
        },
      ),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn((e: Event) => {
        for (const l of listeners) l(e as MediaQueryListEvent)
        return true
      }),
    } as unknown as MediaQueryList
    return mql
  }

  it('getColorScheme returns light by default (matchMedia matches=false)', () => {
    window.matchMedia = vi.fn(() => mockMatchMedia(false))
    const w = createOsPreferenceWatcher()
    expect(w.getColorScheme()).toBe('light')
    w.destroy()
  })

  it('getColorScheme returns dark when prefers-color-scheme: dark', () => {
    window.matchMedia = vi.fn(() => mockMatchMedia(true))
    const w = createOsPreferenceWatcher()
    expect(w.getColorScheme()).toBe('dark')
    w.destroy()
  })

  it('getReducedMotion returns boolean (false default)', () => {
    window.matchMedia = vi.fn(() => mockMatchMedia(false))
    const w = createOsPreferenceWatcher()
    expect(w.getReducedMotion()).toBe(false)
    w.destroy()
  })

  it('getReducedMotion returns true when prefers-reduced-motion: reduce', () => {
    window.matchMedia = vi.fn(() => mockMatchMedia(true))
    const w = createOsPreferenceWatcher()
    expect(w.getReducedMotion()).toBe(true)
    w.destroy()
  })

  it('getContrast returns no-preference by default', () => {
    window.matchMedia = vi.fn(() => mockMatchMedia(false))
    const w = createOsPreferenceWatcher()
    expect(w.getContrast()).toBe('no-preference')
    w.destroy()
  })

  it('subscribe invokes listener on change event', () => {
    const mql = mockMatchMedia(false)
    window.matchMedia = vi.fn(() => mql)
    const w = createOsPreferenceWatcher()
    const listener = vi.fn()
    w.subscribe('color-scheme', listener)
    // Simulate OS change
    mql.dispatchEvent(new Event('change'))
    expect(listener).toHaveBeenCalled()
    w.destroy()
  })

  it('subscribe returns unsubscribe; listener no longer invoked', () => {
    const mql = mockMatchMedia(false)
    window.matchMedia = vi.fn(() => mql)
    const w = createOsPreferenceWatcher()
    const listener = vi.fn()
    const unsub = w.subscribe('color-scheme', listener)
    unsub()
    mql.dispatchEvent(new Event('change'))
    expect(listener).not.toHaveBeenCalled()
    w.destroy()
  })

  it('destroy removes all matchMedia listeners (no leak)', () => {
    const mql = mockMatchMedia(false)
    const removeSpy = mql.removeEventListener as unknown as ReturnType<
      typeof vi.fn
    >
    window.matchMedia = vi.fn(() => mql)
    const w = createOsPreferenceWatcher()
    w.subscribe('color-scheme', vi.fn())
    w.destroy()
    expect(removeSpy).toHaveBeenCalled()
  })

  it('destroy is idempotent (safe to call multiple times)', () => {
    window.matchMedia = vi.fn(() => mockMatchMedia(false))
    const w = createOsPreferenceWatcher()
    w.subscribe('color-scheme', vi.fn())
    w.destroy()
    expect(() => w.destroy()).not.toThrow()
  })

  it('subscribe post-destroy returns no-op unsubscribe', () => {
    window.matchMedia = vi.fn(() => mockMatchMedia(false))
    const w = createOsPreferenceWatcher()
    w.destroy()
    const unsub = w.subscribe('color-scheme', vi.fn())
    expect(typeof unsub).toBe('function')
    expect(() => unsub()).not.toThrow()
  })

  it('handles missing matchMedia gracefully (SSR / test env)', () => {
    ;(window as unknown as { matchMedia: undefined }).matchMedia =
      undefined as unknown as typeof window.matchMedia
    const w = createOsPreferenceWatcher()
    expect(w.getColorScheme()).toBe('light')
    expect(w.getReducedMotion()).toBe(false)
    expect(w.getContrast()).toBe('no-preference')
    w.destroy()
  })

  it('multiple subscribers same kind: all notified on dispatch', () => {
    const mql = mockMatchMedia(false)
    window.matchMedia = vi.fn(() => mql)
    const w = createOsPreferenceWatcher()
    const l1 = vi.fn()
    const l2 = vi.fn()
    w.subscribe('color-scheme', l1)
    w.subscribe('color-scheme', l2)
    mql.dispatchEvent(new Event('change'))
    expect(l1).toHaveBeenCalled()
    expect(l2).toHaveBeenCalled()
    w.destroy()
  })

  it('different kinds register separate matchMedia queries', () => {
    const mqlMap = new Map<string, MediaQueryList>()
    window.matchMedia = vi.fn((q: string) => {
      let mql = mqlMap.get(q)
      if (!mql) {
        mql = mockMatchMedia(false)
        mqlMap.set(q, mql)
      }
      return mql
    })
    const w = createOsPreferenceWatcher()
    w.subscribe('color-scheme', vi.fn())
    w.subscribe('reduced-motion', vi.fn())
    w.subscribe('contrast', vi.fn())
    expect(mqlMap.size).toBe(3)
    w.destroy()
  })
})
