/**
 * Tier-1 jsdom test integration `createThemeManager` + persistence
 * (W2 plan 07-04, THEME-08).
 *
 * Copertura:
 * - Default OFF (D-F7-12 + backward-compat W2 plan 07-03 baseline):
 *   `persistence: false` o `undefined` NON tocca localStorage.
 * - `persistence: 'localStorage'`: setMode/setDensity/setDirection scrivono
 *   le 4 chiavi separate.
 * - Boot scenario: ThemeManager con persistence attiva legge stato
 *   pre-esistente in localStorage e applica mode/density/direction al boot.
 * - Cross-tab StorageEvent: dispatch simulato aggiorna ThemeManager DOM
 *   senza re-emettere su storage (no echo loop).
 * - Lifecycle: ThemeManager.destroy() rimuove storage listener (no leak).
 *
 * Refs: 07-04-PLAN.md Task 2, 07-CONTEXT.md D-F7-12, THEME-08.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createThemeManager } from '../theme-manager'

describe('createThemeManager + persistence', () => {
  function clearHtmlAttrs(): void {
    document.documentElement.removeAttribute('data-gz-theme')
    document.documentElement.removeAttribute('data-gz-mode')
    document.documentElement.removeAttribute('data-gz-density')
    document.documentElement.removeAttribute('data-gz-direction')
    document.documentElement.removeAttribute('dir')
  }

  beforeEach(() => {
    try {
      window.localStorage.clear()
    } catch {
      // ignore
    }
    clearHtmlAttrs()
  })

  afterEach(() => {
    try {
      window.localStorage.clear()
    } catch {
      // ignore
    }
    clearHtmlAttrs()
  })

  it('persistence: false (default) does NOT touch localStorage on setMode', () => {
    // jsdom Storage usa Proxy: replace via prototype per intercept reale.
    const proto = Object.getPrototypeOf(window.localStorage) as Storage
    const origSet = proto.setItem
    const setCalls: Array<[string, string]> = []
    proto.setItem = function (key: string, value: string): void {
      setCalls.push([key, value])
      return origSet.call(this, key, value)
    }
    try {
      const tm = createThemeManager() // default persistence undefined === false
      tm.setMode('dark')
      tm.setDensity('compact')
      tm.setDirection('rtl')
      const themeKeys = setCalls.filter(([k]) => k.startsWith('gluezero.theme.'))
      expect(themeKeys).toHaveLength(0)
      tm.destroy()
    } finally {
      proto.setItem = origSet
    }
  })

  it('persistence: localStorage writes mode on setMode', () => {
    const tm = createThemeManager({ persistence: 'localStorage' })
    tm.setMode('dark')
    expect(window.localStorage.getItem('gluezero.theme.mode')).toBe('dark')
    tm.destroy()
  })

  it('persistence: localStorage writes density on setDensity', () => {
    const tm = createThemeManager({ persistence: 'localStorage' })
    tm.setDensity('compact')
    expect(window.localStorage.getItem('gluezero.theme.density')).toBe(
      'compact',
    )
    tm.destroy()
  })

  it('persistence: localStorage writes direction on setDirection', () => {
    const tm = createThemeManager({ persistence: 'localStorage' })
    tm.setDirection('rtl')
    expect(window.localStorage.getItem('gluezero.theme.direction')).toBe('rtl')
    tm.destroy()
  })

  it('boot reads persisted mode and applies to DOM', () => {
    window.localStorage.setItem('gluezero.theme.mode', 'dark')
    const tm = createThemeManager({ persistence: 'localStorage' })
    const snap = tm.getActiveTheme()
    expect(snap.mode).toBe('dark')
    expect(snap.resolvedMode).toBe('dark')
    tm.destroy()
  })

  it('boot reads persisted density and applies', () => {
    window.localStorage.setItem('gluezero.theme.density', 'compact')
    const tm = createThemeManager({ persistence: 'localStorage' })
    const snap = tm.getActiveTheme()
    expect(snap.density).toBe('compact')
    tm.destroy()
  })

  it('boot reads persisted direction and applies', () => {
    window.localStorage.setItem('gluezero.theme.direction', 'rtl')
    const tm = createThemeManager({ persistence: 'localStorage' })
    const snap = tm.getActiveTheme()
    expect(snap.direction).toBe('rtl')
    tm.destroy()
  })

  it('boot reads all 3 persisted values and applies all', () => {
    window.localStorage.setItem('gluezero.theme.mode', 'dark')
    window.localStorage.setItem('gluezero.theme.density', 'compact')
    window.localStorage.setItem('gluezero.theme.direction', 'rtl')
    const tm = createThemeManager({ persistence: 'localStorage' })
    const snap = tm.getActiveTheme()
    expect(snap.mode).toBe('dark')
    expect(snap.density).toBe('compact')
    expect(snap.direction).toBe('rtl')
    tm.destroy()
  })

  it('boot ignores invalid persisted values (silent)', () => {
    window.localStorage.setItem('gluezero.theme.mode', 'NEON_INVALID')
    const tm = createThemeManager({ persistence: 'localStorage' })
    const snap = tm.getActiveTheme()
    // Default mode (auto) preserved.
    expect(snap.mode).toBe('auto')
    tm.destroy()
  })

  it('cross-tab StorageEvent updates ThemeManager DOM (mode)', () => {
    const tm = createThemeManager({ persistence: 'localStorage' })
    tm.setMode('light')
    expect(document.documentElement.getAttribute('data-gz-theme')).toBe('light')
    // Simulate other tab change
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'gluezero.theme.mode',
        newValue: 'dark',
        oldValue: 'light',
      }),
    )
    expect(document.documentElement.getAttribute('data-gz-theme')).toBe('dark')
    expect(tm.getActiveTheme().mode).toBe('dark')
    tm.destroy()
  })

  it('cross-tab StorageEvent updates ThemeManager DOM (density)', () => {
    const tm = createThemeManager({ persistence: 'localStorage' })
    tm.setDensity('comfortable')
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'gluezero.theme.density',
        newValue: 'spacious',
      }),
    )
    expect(document.documentElement.getAttribute('data-gz-density')).toBe(
      'spacious',
    )
    expect(tm.getActiveTheme().density).toBe('spacious')
    tm.destroy()
  })

  it('cross-tab StorageEvent updates ThemeManager DOM (direction)', () => {
    const tm = createThemeManager({ persistence: 'localStorage' })
    tm.setDirection('ltr')
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'gluezero.theme.direction',
        newValue: 'rtl',
      }),
    )
    expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    expect(document.documentElement.getAttribute('data-gz-direction')).toBe(
      'rtl',
    )
    expect(tm.getActiveTheme().direction).toBe('rtl')
    tm.destroy()
  })

  it('cross-tab does NOT echo write on storage (no infinite loop)', () => {
    const tm = createThemeManager({ persistence: 'localStorage' })
    tm.setMode('light')
    // Track setItem calls via prototype intercept.
    const proto = Object.getPrototypeOf(window.localStorage) as Storage
    const origSet = proto.setItem
    const setCalls: Array<[string, string]> = []
    proto.setItem = function (key: string, value: string): void {
      setCalls.push([key, value])
      return origSet.call(this, key, value)
    }
    try {
      // Other tab changes mode → our listener should apply DOM but NOT
      // re-write to storage (otherwise infinite ping-pong).
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'gluezero.theme.mode',
          newValue: 'dark',
        }),
      )
      const themeWrites = setCalls.filter(([k]) =>
        k.startsWith('gluezero.theme.'),
      )
      expect(themeWrites).toHaveLength(0)
    } finally {
      proto.setItem = origSet
      tm.destroy()
    }
  })

  it('destroy cleans up persistence storage listener', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const tm = createThemeManager({ persistence: 'localStorage' })
    tm.destroy()
    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('persistence: undefined === persistence: false (backward compat W2 baseline)', () => {
    const proto = Object.getPrototypeOf(window.localStorage) as Storage
    const origSet = proto.setItem
    const setCalls: Array<[string, string]> = []
    proto.setItem = function (key: string, value: string): void {
      setCalls.push([key, value])
      return origSet.call(this, key, value)
    }
    try {
      const tm = createThemeManager({ /* persistence undefined */ })
      tm.setMode('dark')
      const themeKeys = setCalls.filter(([k]) => k.startsWith('gluezero.theme.'))
      expect(themeKeys).toHaveLength(0)
      tm.destroy()
    } finally {
      proto.setItem = origSet
    }
  })
})
