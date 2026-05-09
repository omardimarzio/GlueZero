/**
 * Tier-1 jsdom test per `createThemePersistence` (W2 plan 07-04, THEME-08).
 *
 * Copertura:
 * - Default OFF (D-F7-12): `enabled: false` → read null + write no-op senza
 *   toccare localStorage.
 * - 4-keys namespace (Q3 lockata): `gluezero.theme.{mode,density,direction,adapter}`
 * - Whitelist read/write enum: valori non validi ritornati come undefined.
 * - Multi-tab StorageEvent listener: solo chiavi prefix `gluezero.theme.` +
 *   value enum whitelist (T-F7-04 Spoofing mitigation).
 * - Try/catch difensivo su SecurityError (CSP/incognito) + QuotaExceededError
 *   (T-F7-02 InformationDisclosure / T-F7-03 DoS mitigation).
 * - destroy() rimuove listener `storage` (no leak multi-tab).
 *
 * Refs: 07-04-PLAN.md Task 1, 07-CONTEXT.md D-F7-12, 07-RESEARCH.md Q3.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createThemePersistence } from '../persistence'

describe('createThemePersistence', () => {
  beforeEach(() => {
    try {
      window.localStorage.clear()
    } catch {
      // ignore
    }
  })

  afterEach(() => {
    try {
      window.localStorage.clear()
    } catch {
      // ignore
    }
  })

  it('disabled: read returns null without touching storage', () => {
    const spy = vi.spyOn(window.localStorage, 'getItem')
    const p = createThemePersistence({ enabled: false })
    expect(p.read()).toBeNull()
    expect(spy).not.toHaveBeenCalled()
    p.destroy()
    spy.mockRestore()
  })

  it('disabled: write is no-op (does not touch storage)', () => {
    const spy = vi.spyOn(window.localStorage, 'setItem')
    const p = createThemePersistence({ enabled: false })
    p.write({ mode: 'dark' })
    expect(spy).not.toHaveBeenCalled()
    p.destroy()
    spy.mockRestore()
  })

  it('disabled: subscribe is no-op (no listener registered)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const p = createThemePersistence({ enabled: false })
    const unsub = p.subscribe(vi.fn())
    expect(addSpy).not.toHaveBeenCalledWith('storage', expect.any(Function))
    expect(typeof unsub).toBe('function')
    unsub()
    p.destroy()
    addSpy.mockRestore()
  })

  it('enabled: write({mode}) sets gluezero.theme.mode', () => {
    const p = createThemePersistence({ enabled: true })
    p.write({ mode: 'dark' })
    expect(window.localStorage.getItem('gluezero.theme.mode')).toBe('dark')
    p.destroy()
  })

  it('enabled: write({density}) sets gluezero.theme.density', () => {
    const p = createThemePersistence({ enabled: true })
    p.write({ density: 'compact' })
    expect(window.localStorage.getItem('gluezero.theme.density')).toBe(
      'compact',
    )
    p.destroy()
  })

  it('enabled: write({direction}) sets gluezero.theme.direction', () => {
    const p = createThemePersistence({ enabled: true })
    p.write({ direction: 'rtl' })
    expect(window.localStorage.getItem('gluezero.theme.direction')).toBe('rtl')
    p.destroy()
  })

  it('enabled: write({adapter}) sets gluezero.theme.adapter', () => {
    const p = createThemePersistence({ enabled: true })
    p.write({ adapter: 'tailwind' })
    expect(window.localStorage.getItem('gluezero.theme.adapter')).toBe(
      'tailwind',
    )
    p.destroy()
  })

  it('enabled: read returns 4-keys state', () => {
    window.localStorage.setItem('gluezero.theme.mode', 'dark')
    window.localStorage.setItem('gluezero.theme.density', 'compact')
    window.localStorage.setItem('gluezero.theme.direction', 'rtl')
    window.localStorage.setItem('gluezero.theme.adapter', 'tailwind')
    const p = createThemePersistence({ enabled: true })
    const state = p.read()
    expect(state).toEqual({
      mode: 'dark',
      density: 'compact',
      direction: 'rtl',
      adapter: 'tailwind',
    })
    p.destroy()
  })

  it('enabled: read rejects non-whitelist values silently (returns null when no valid keys)', () => {
    window.localStorage.setItem('gluezero.theme.mode', 'NEON')
    const p = createThemePersistence({ enabled: true })
    const state = p.read()
    expect(state).toBeNull() // no valid keys → null
    p.destroy()
  })

  it('enabled: read returns partial state when only some keys valid', () => {
    window.localStorage.setItem('gluezero.theme.mode', 'dark')
    window.localStorage.setItem('gluezero.theme.density', 'INVALID')
    window.localStorage.setItem('gluezero.theme.direction', 'ltr')
    const p = createThemePersistence({ enabled: true })
    const state = p.read()
    expect(state).toEqual({ mode: 'dark', direction: 'ltr' })
    p.destroy()
  })

  it('enabled: read rejects adapter id with non-allowed chars', () => {
    window.localStorage.setItem('gluezero.theme.adapter', '<script>alert(1)</script>')
    const p = createThemePersistence({ enabled: true })
    const state = p.read()
    expect(state).toBeNull()
    p.destroy()
  })

  it('subscribe receives StorageEvent for namespace mode key', () => {
    const p = createThemePersistence({ enabled: true })
    const listener = vi.fn()
    p.subscribe(listener)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'gluezero.theme.mode',
        newValue: 'dark',
        oldValue: 'light',
      }),
    )
    expect(listener).toHaveBeenCalledWith({ mode: 'dark' })
    p.destroy()
  })

  it('subscribe receives StorageEvent for namespace density key', () => {
    const p = createThemePersistence({ enabled: true })
    const listener = vi.fn()
    p.subscribe(listener)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'gluezero.theme.density',
        newValue: 'spacious',
      }),
    )
    expect(listener).toHaveBeenCalledWith({ density: 'spacious' })
    p.destroy()
  })

  it('subscribe ignores non-namespace keys', () => {
    const p = createThemePersistence({ enabled: true })
    const listener = vi.fn()
    p.subscribe(listener)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'other.app.foo',
        newValue: 'bar',
      }),
    )
    expect(listener).not.toHaveBeenCalled()
    p.destroy()
  })

  it('subscribe ignores invalid value silently (mode = NEON)', () => {
    const p = createThemePersistence({ enabled: true })
    const listener = vi.fn()
    p.subscribe(listener)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'gluezero.theme.mode',
        newValue: 'NEON',
      }),
    )
    expect(listener).not.toHaveBeenCalled()
    p.destroy()
  })

  it('subscribe ignores StorageEvent with null key', () => {
    const p = createThemePersistence({ enabled: true })
    const listener = vi.fn()
    p.subscribe(listener)
    // localStorage.clear() dispatch StorageEvent con key=null
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: null,
        newValue: null,
      }),
    )
    expect(listener).not.toHaveBeenCalled()
    p.destroy()
  })

  it('subscribe returns unsubscribe function that removes the specific listener', () => {
    const p = createThemePersistence({ enabled: true })
    const listenerA = vi.fn()
    const listenerB = vi.fn()
    const unsubA = p.subscribe(listenerA)
    p.subscribe(listenerB)
    unsubA()
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'gluezero.theme.mode',
        newValue: 'dark',
      }),
    )
    expect(listenerA).not.toHaveBeenCalled()
    expect(listenerB).toHaveBeenCalledWith({ mode: 'dark' })
    p.destroy()
  })

  it('destroy removes storage listener (no leak)', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const p = createThemePersistence({ enabled: true })
    p.subscribe(vi.fn())
    p.destroy()
    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function))
    removeSpy.mockRestore()
  })

  it('destroy is idempotent', () => {
    const p = createThemePersistence({ enabled: true })
    p.subscribe(vi.fn())
    expect(() => {
      p.destroy()
      p.destroy()
    }).not.toThrow()
  })

  it('post-destroy: subscribe is no-op (no listener wiring)', () => {
    const p = createThemePersistence({ enabled: true })
    p.destroy()
    const listener = vi.fn()
    const unsub = p.subscribe(listener)
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'gluezero.theme.mode',
        newValue: 'dark',
      }),
    )
    expect(listener).not.toHaveBeenCalled()
    expect(typeof unsub).toBe('function')
  })

  it('SecurityError on getItem: read returns null without throw', () => {
    const spy = vi
      .spyOn(window.localStorage, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError')
      })
    const p = createThemePersistence({ enabled: true })
    expect(() => p.read()).not.toThrow()
    expect(p.read()).toBeNull()
    p.destroy()
    spy.mockRestore()
  })

  it('QuotaExceededError on setItem: write logs warn, no throw', () => {
    const spy = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = createThemePersistence({ enabled: true })
    expect(() => p.write({ mode: 'dark' })).not.toThrow()
    expect(warnSpy).toHaveBeenCalled()
    p.destroy()
    spy.mockRestore()
    warnSpy.mockRestore()
  })

  it('enabled is exposed read-only on the returned API', () => {
    const pOff = createThemePersistence({ enabled: false })
    const pOn = createThemePersistence({ enabled: true })
    expect(pOff.enabled).toBe(false)
    expect(pOn.enabled).toBe(true)
    pOff.destroy()
    pOn.destroy()
  })
})
