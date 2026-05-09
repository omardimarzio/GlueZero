// Tier-1 jsdom tests per `createTokenRegistry` (closure factory D-30 anti-singleton).
//
// Coverage:
// - Surface API: apply / getActive / subscribe / destroy
// - DOM write-through: :root.style.setProperty con prefix --gz-*
// - Multi-scope (D-F7-05): scope HTMLElement vs :root
// - Validation register-time: Valibot rejection → throw theme.token.invalid
// - Cardinality cap (THEME-11): cap 200 + allowMore opt-in
// - Subscribe/unsubscribe + destroy lifecycle
// - Initial seed populates active senza DOM write
//
// Refs: 07-02-PLAN.md Task 2 behavior tests 4-12; THEME-01/02/09/11; D-F7-05/08.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTokenRegistry } from '../token-registry'

describe('createTokenRegistry', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style')
  })

  afterEach(() => {
    document.documentElement.removeAttribute('style')
  })

  it('exposes apply/getActive/subscribe/destroy methods', () => {
    const reg = createTokenRegistry()
    expect(typeof reg.apply).toBe('function')
    expect(typeof reg.getActive).toBe('function')
    expect(typeof reg.subscribe).toBe('function')
    expect(typeof reg.destroy).toBe('function')
  })

  it('apply sets :root CSS Custom Property with --gz-* prefix', () => {
    const reg = createTokenRegistry()
    reg.apply({ 'color-primary': '#FF6B35' })
    expect(
      document.documentElement.style.getPropertyValue('--gz-color-primary'),
    ).toBe('#FF6B35')
    expect(reg.getActive()['color-primary']).toBe('#FF6B35')
  })

  it('apply with scope writes to scoped element only (D-F7-05 multi-tema)', () => {
    const reg = createTokenRegistry()
    const el = document.createElement('div')
    document.body.appendChild(el)
    reg.apply({ 'color-primary': '#000' }, { scope: el })
    expect(el.style.getPropertyValue('--gz-color-primary')).toBe('#000')
    expect(
      document.documentElement.style.getPropertyValue('--gz-color-primary'),
    ).toBe('')
    document.body.removeChild(el)
  })

  it('apply with invalid value (script injection) throws ThemeError theme.token.invalid', () => {
    const reg = createTokenRegistry()
    expect(() =>
      reg.apply({ 'color-primary': '<script>alert(1)</script>' }),
    ).toThrow(/theme\.token\.invalid|Invalid token set/)
  })

  it('apply with invalid key (uppercase) throws', () => {
    const reg = createTokenRegistry()
    expect(() => reg.apply({ 'BAD-KEY': '#fff' })).toThrow(
      /theme\.token\.invalid|Invalid token set/,
    )
  })

  it('apply over cap 200 without allowMore throws theme.token.cap-exceeded', () => {
    const reg = createTokenRegistry()
    const tokens: Record<string, string> = {}
    for (let i = 0; i < 201; i++) {
      tokens[`color-token-${i}`] = '#fff'
    }
    expect(() => reg.apply(tokens)).toThrow(/cap-exceeded|cap reached/)
  })

  it('apply over cap with allowMore: true succeeds without throw', () => {
    const reg = createTokenRegistry()
    const tokens: Record<string, string> = {}
    for (let i = 0; i < 201; i++) {
      tokens[`color-token-${i}`] = '#fff'
    }
    expect(() => reg.apply(tokens, { allowMore: true })).not.toThrow()
    // Verifica che almeno il primo + ultimo siano applicati
    expect(reg.getActive()['color-token-0']).toBe('#fff')
    expect(reg.getActive()['color-token-200']).toBe('#fff')
  })

  it('apply soft-warn (≥50% cap) emits console.warn but does not throw', () => {
    const reg = createTokenRegistry()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const tokens: Record<string, string> = {}
    for (let i = 0; i < 100; i++) {
      tokens[`color-tk-${i}`] = '#000'
    }
    reg.apply(tokens)
    expect(warnSpy).toHaveBeenCalled()
    expect(warnSpy.mock.calls[0]![0]).toContain('over 50%')
    warnSpy.mockRestore()
  })

  it('subscribe is notified on apply with snapshot record', () => {
    const reg = createTokenRegistry()
    const listener = vi.fn()
    reg.subscribe(listener)
    reg.apply({ 'color-primary': '#000' })
    expect(listener).toHaveBeenCalledOnce()
    const arg = listener.mock.calls[0]![0] as Record<string, string>
    expect(arg['color-primary']).toBe('#000')
  })

  it('subscribe returns unsubscribe function', () => {
    const reg = createTokenRegistry()
    const listener = vi.fn()
    const unsub = reg.subscribe(listener)
    unsub()
    reg.apply({ 'color-primary': '#000' })
    expect(listener).not.toHaveBeenCalled()
  })

  it('multiple subscribers all notified', () => {
    const reg = createTokenRegistry()
    const a = vi.fn()
    const b = vi.fn()
    reg.subscribe(a)
    reg.subscribe(b)
    reg.apply({ 'color-primary': '#000' })
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
  })

  it('destroy clears state and prevents subsequent apply', () => {
    const reg = createTokenRegistry()
    reg.apply({ 'color-primary': '#000' })
    reg.destroy()
    expect(() => reg.apply({ 'color-secondary': '#fff' })).toThrow(
      /destroyed|frozen/,
    )
  })

  it('destroy clears all listeners (no notify after destroy)', () => {
    const reg = createTokenRegistry()
    const listener = vi.fn()
    reg.subscribe(listener)
    reg.destroy()
    expect(listener).not.toHaveBeenCalled()
  })

  it('initial seed populates active without DOM write', () => {
    const reg = createTokenRegistry({ initial: { 'color-primary': '#abc' } })
    expect(reg.getActive()['color-primary']).toBe('#abc')
    // Initial NOT propagated a DOM (boot script anti-FOUC handles pre-paint write)
    expect(
      document.documentElement.style.getPropertyValue('--gz-color-primary'),
    ).toBe('')
  })

  it('getActive returns frozen snapshot (immutable)', () => {
    const reg = createTokenRegistry()
    reg.apply({ 'color-primary': '#000' })
    const active = reg.getActive()
    expect(Object.isFrozen(active)).toBe(true)
  })

  it('apply twice merges cumulatively (existing tokens preserved)', () => {
    const reg = createTokenRegistry()
    reg.apply({ 'color-primary': '#000' })
    reg.apply({ 'color-secondary': '#fff' })
    const active = reg.getActive()
    expect(active['color-primary']).toBe('#000')
    expect(active['color-secondary']).toBe('#fff')
  })

  it('apply twice with same key: second value overwrites first', () => {
    const reg = createTokenRegistry()
    reg.apply({ 'color-primary': '#000' })
    reg.apply({ 'color-primary': '#FFF' })
    expect(reg.getActive()['color-primary']).toBe('#FFF')
    expect(
      document.documentElement.style.getPropertyValue('--gz-color-primary'),
    ).toBe('#FFF')
  })

  it('multiple registries are independent (D-30 anti-singleton)', () => {
    const reg1 = createTokenRegistry()
    const reg2 = createTokenRegistry()
    reg1.apply({ 'color-primary': '#111' })
    expect(reg2.getActive()['color-primary']).toBeUndefined()
  })
})
