/**
 * Tier-1 jsdom test per `createThemeManager` (W2 plan 07-03).
 *
 * Copertura:
 * - Surface API (setMode/setDensity/setDirection/getActiveTheme/destroy/tokens)
 * - DOM write-through `<html>` attributes (data-gz-theme, data-gz-mode,
 *   data-gz-density, data-gz-direction, dir)
 * - Auto-mode mirror OS prefers-color-scheme (D-F7-13)
 * - Whitelist enum validation con throw `ThemeError` (T-F7-01 mitigation)
 * - getActiveTheme deep-frozen snapshot (D-F7-08)
 * - destroy idempotent + rimuove matchMedia listener (T-F7-04)
 * - D-30 anti-singleton: 2 istanze parallele non interferiscono
 *
 * Refs: 07-03-PLAN.md Task 2, 07-CONTEXT.md D-F7-13/D-F7-08/D-F7-12
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isThemeError } from '../theme-error'
import { createThemeManager } from '../theme-manager'

describe('createThemeManager', () => {
  function clearHtmlAttrs(): void {
    document.documentElement.removeAttribute('data-gz-theme')
    document.documentElement.removeAttribute('data-gz-mode')
    document.documentElement.removeAttribute('data-gz-density')
    document.documentElement.removeAttribute('data-gz-direction')
    document.documentElement.removeAttribute('dir')
  }

  beforeEach(() => {
    clearHtmlAttrs()
  })

  afterEach(() => {
    clearHtmlAttrs()
  })

  it('exposes setMode/setDensity/setDirection/getActiveTheme/destroy/tokens', () => {
    const tm = createThemeManager()
    expect(typeof tm.setMode).toBe('function')
    expect(typeof tm.setDensity).toBe('function')
    expect(typeof tm.setDirection).toBe('function')
    expect(typeof tm.getActiveTheme).toBe('function')
    expect(typeof tm.destroy).toBe('function')
    expect(tm.tokens).toBeDefined()
    expect(typeof tm.tokens.apply).toBe('function')
    tm.destroy()
  })

  it('setMode("light") sets data-gz-theme="light" + data-gz-mode="light"', () => {
    const tm = createThemeManager()
    tm.setMode('light')
    expect(document.documentElement.getAttribute('data-gz-theme')).toBe('light')
    expect(document.documentElement.getAttribute('data-gz-mode')).toBe('light')
    tm.destroy()
  })

  it('setMode("dark") sets data-gz-theme="dark" + data-gz-mode="dark"', () => {
    const tm = createThemeManager()
    tm.setMode('dark')
    expect(document.documentElement.getAttribute('data-gz-theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-gz-mode')).toBe('dark')
    tm.destroy()
  })

  it('setMode("auto") with OS dark sets data-gz-theme="dark" + data-gz-mode="auto"', () => {
    const original = window.matchMedia
    // matchMedia stub: prefers-color-scheme: dark MATCHES
    window.matchMedia = vi.fn(() => {
      const listeners = new Set<(e: MediaQueryListEvent) => void>()
      return {
        matches: true,
        media: '',
        onchange: null,
        addEventListener: vi.fn(
          (_: string, l: (e: MediaQueryListEvent) => void) => listeners.add(l),
        ),
        removeEventListener: vi.fn(
          (_: string, l: (e: MediaQueryListEvent) => void) =>
            listeners.delete(l),
        ),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList
    }) as unknown as typeof window.matchMedia
    const tm = createThemeManager()
    tm.setMode('auto')
    expect(document.documentElement.getAttribute('data-gz-theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-gz-mode')).toBe('auto')
    tm.destroy()
    window.matchMedia = original
  })

  it('setMode invalid throws ThemeError with code theme.mode.invalid', () => {
    const tm = createThemeManager()
    let caught: unknown = null
    try {
      tm.setMode('foo' as 'light')
    } catch (err) {
      caught = err
    }
    expect(isThemeError(caught)).toBe(true)
    if (isThemeError(caught)) {
      expect(caught.code).toBe('theme.mode.invalid')
    }
    tm.destroy()
  })

  it('setDensity("compact") sets data-gz-density="compact"', () => {
    const tm = createThemeManager()
    tm.setDensity('compact')
    expect(document.documentElement.getAttribute('data-gz-density')).toBe(
      'compact',
    )
    tm.destroy()
  })

  it('setDensity invalid throws ThemeError with code theme.density.invalid', () => {
    const tm = createThemeManager()
    let caught: unknown = null
    try {
      tm.setDensity('huge' as 'compact')
    } catch (err) {
      caught = err
    }
    expect(isThemeError(caught)).toBe(true)
    if (isThemeError(caught)) {
      expect(caught.code).toBe('theme.density.invalid')
    }
    tm.destroy()
  })

  it('setDirection("rtl") sets dir="rtl" + data-gz-direction="rtl"', () => {
    const tm = createThemeManager()
    tm.setDirection('rtl')
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    expect(document.documentElement.getAttribute('data-gz-direction')).toBe(
      'rtl',
    )
    tm.destroy()
  })

  it('setDirection invalid throws ThemeError with code theme.direction.invalid', () => {
    const tm = createThemeManager()
    let caught: unknown = null
    try {
      tm.setDirection('skew' as 'ltr')
    } catch (err) {
      caught = err
    }
    expect(isThemeError(caught)).toBe(true)
    if (isThemeError(caught)) {
      expect(caught.code).toBe('theme.direction.invalid')
    }
    tm.destroy()
  })

  it('getActiveTheme returns deep-frozen ThemeSnapshot (D-F7-08)', () => {
    const tm = createThemeManager()
    tm.setMode('dark')
    tm.setDensity('compact')
    tm.setDirection('rtl')
    const snap = tm.getActiveTheme()
    expect(snap.mode).toBe('dark')
    expect(snap.resolvedMode).toBe('dark')
    expect(snap.density).toBe('compact')
    expect(snap.direction).toBe('rtl')
    expect(snap.activeAdapterId).toBe(null)
    expect(snap.scope).toBe('root')
    expect(Object.isFrozen(snap)).toBe(true)
    expect(Object.isFrozen(snap.tokens)).toBe(true)
    tm.destroy()
  })

  it('getActiveTheme has nanoid themeId by default', () => {
    const tm = createThemeManager()
    const snap = tm.getActiveTheme()
    expect(typeof snap.themeId).toBe('string')
    expect(snap.themeId.length).toBeGreaterThan(0)
    tm.destroy()
  })

  it('getActiveTheme uses user-provided themeId', () => {
    const tm = createThemeManager({ themeId: 'app-theme' })
    expect(tm.getActiveTheme().themeId).toBe('app-theme')
    tm.destroy()
  })

  it('destroy prevents subsequent setMode (theme.snapshot.frozen)', () => {
    const tm = createThemeManager()
    tm.destroy()
    let caught: unknown = null
    try {
      tm.setMode('dark')
    } catch (err) {
      caught = err
    }
    expect(isThemeError(caught)).toBe(true)
    if (isThemeError(caught)) {
      expect(caught.code).toBe('theme.snapshot.frozen')
    }
  })

  it('destroy is idempotent (safe to call multiple times)', () => {
    const tm = createThemeManager()
    tm.destroy()
    expect(() => tm.destroy()).not.toThrow()
  })

  it('two parallel managers do not interfere (D-30 anti-singleton)', () => {
    const a = createThemeManager({ themeId: 'a' })
    const b = createThemeManager({ themeId: 'b' })
    expect(a.getActiveTheme().themeId).toBe('a')
    expect(b.getActiveTheme().themeId).toBe('b')
    a.destroy()
    b.destroy()
  })

  it('setMode("auto") subscribes to OS prefs change and updates data-gz-theme', () => {
    const listeners = new Set<(e: MediaQueryListEvent) => void>()
    let currentDark = false
    const mql = {
      get matches() {
        return currentDark
      },
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
    const original = window.matchMedia
    window.matchMedia = vi.fn(() => mql)
    const tm = createThemeManager()
    tm.setMode('auto')
    // Initially light
    expect(document.documentElement.getAttribute('data-gz-theme')).toBe('light')
    // Simulate OS switch to dark
    currentDark = true
    mql.dispatchEvent(new Event('change'))
    expect(document.documentElement.getAttribute('data-gz-theme')).toBe('dark')
    tm.destroy()
    window.matchMedia = original
  })

  it('setMode("light") after setMode("auto") unsubscribes from OS listener', () => {
    const listeners = new Set<(e: MediaQueryListEvent) => void>()
    let currentDark = false
    const mql = {
      get matches() {
        return currentDark
      },
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
    const original = window.matchMedia
    window.matchMedia = vi.fn(() => mql)
    const tm = createThemeManager()
    tm.setMode('auto')
    tm.setMode('light')
    // OS change non deve più affettare data-gz-theme (rimasto 'light' user-locked)
    currentDark = true
    mql.dispatchEvent(new Event('change'))
    expect(document.documentElement.getAttribute('data-gz-theme')).toBe('light')
    tm.destroy()
    window.matchMedia = original
  })

  it('tokens registry is composed and accessible', () => {
    const tm = createThemeManager()
    tm.tokens.apply({ 'color-primary': '#FF6B35' })
    const snap = tm.getActiveTheme()
    expect(snap.tokens['color-primary']).toBe('#FF6B35')
    tm.destroy()
  })
})
