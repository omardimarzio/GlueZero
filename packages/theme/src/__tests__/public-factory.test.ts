/**
 * createTheme() public factory tests (W4 plan 07-08, Task 3).
 *
 * Verifica orchestrazione: ThemeManager + DomApplier (Strategia A) +
 * StyleSheetGenerator (Strategia B) + ClassesTracker (UI-ROLE-10).
 *
 * Surface ergonomica: register/setActiveAdapter/applyTokens/getActiveTheme/destroy.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
// W4 Task 3 — createTheme è esposto via subpath `@gluezero/theme/factory`
// (D-F7-04 bundle mitigation). Test importa direttamente dal source per
// stesso entry point del subpath build target.
import { createTheme } from '../public-factory'

async function flushAll(): Promise<void> {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 20))
  await new Promise((resolve) => setTimeout(resolve, 20))
}

describe('createTheme public factory (W4 plan 07-08)', () => {
  let root: HTMLElement
  beforeEach(() => {
    root = document.createElement('div')
    document.body.appendChild(root)
  })
  afterEach(() => {
    if (root.parentNode) document.body.removeChild(root)
    document
      .querySelectorAll('style[data-gz-stylesheet]')
      .forEach((s) => s.remove())
    document.documentElement.removeAttribute('data-gz-theme')
    document.documentElement.removeAttribute('data-gz-mode')
    document.documentElement.removeAttribute('data-gz-density')
    document.documentElement.removeAttribute('data-gz-direction')
    document.documentElement.removeAttribute('dir')
  })

  it('exposes manager + register + setActiveAdapter + applyTokens + getActiveTheme + destroy', () => {
    const t = createTheme()
    expect(t.manager).toBeDefined()
    expect(typeof t.register).toBe('function')
    expect(typeof t.setActiveAdapter).toBe('function')
    expect(typeof t.applyTokens).toBe('function')
    expect(typeof t.getActiveTheme).toBe('function')
    expect(typeof t.destroy).toBe('function')
    t.destroy()
  })

  it('register adds adapter to manager.adapters', () => {
    const t = createTheme()
    t.register({ id: 'tailwind', roleMap: { 'action.primary': 'bg-indigo-600' } })
    expect(t.manager.adapters.has('tailwind')).toBe(true)
    t.destroy()
  })

  it('setActiveAdapter activates DomApplier for roleMap adapter', async () => {
    const btn = document.createElement('button')
    btn.setAttribute('data-gz-role', 'action.primary')
    root.appendChild(btn)
    const t = createTheme({ observerRoot: root })
    t.register({
      id: 'tailwind',
      roleMap: { 'action.primary': 'bg-indigo-600 text-white' },
    })
    t.setActiveAdapter('tailwind')
    await flushAll()
    expect(btn.classList.contains('bg-indigo-600')).toBe(true)
    expect(btn.classList.contains('text-white')).toBe(true)
    t.destroy()
  })

  it('setActiveAdapter mounts StyleSheetGenerator for cssRules adapter', () => {
    const t = createTheme({ scope: root })
    t.register({
      id: 'tokens-only',
      cssRules: { 'action.primary': 'background: red;' },
    })
    t.setActiveAdapter('tokens-only')
    const styleEl = root.querySelector('style[data-gz-stylesheet="tokens-only"]')
    expect(styleEl).not.toBeNull()
    t.destroy()
  })

  it('hot-swap adapter restores previous classes + applies new (UI-ROLE-05)', async () => {
    const btn = document.createElement('button')
    btn.setAttribute('data-gz-role', 'action.primary')
    root.appendChild(btn)
    const t = createTheme({ observerRoot: root })
    t.register({
      id: 'tailwind',
      roleMap: { 'action.primary': 'bg-indigo-600' },
    })
    t.register({
      id: 'bootstrap',
      roleMap: { 'action.primary': 'btn btn-primary' },
    })
    t.setActiveAdapter('tailwind')
    await flushAll()
    expect(btn.classList.contains('bg-indigo-600')).toBe(true)
    t.setActiveAdapter('bootstrap')
    await flushAll()
    expect(btn.classList.contains('bg-indigo-600')).toBe(false)
    expect(btn.classList.contains('btn')).toBe(true)
    expect(btn.classList.contains('btn-primary')).toBe(true)
    t.destroy()
  })

  it('applyTokens delegates to manager.tokens.apply', () => {
    const t = createTheme()
    t.applyTokens({ 'color-primary': '#FF6B35' })
    expect(
      document.documentElement.style.getPropertyValue('--gz-color-primary'),
    ).toBe('#FF6B35')
    t.destroy()
    document.documentElement.style.removeProperty('--gz-color-primary')
  })

  it('destroy cleans up DomApplier + StyleSheetGenerator + manager', async () => {
    const t = createTheme({ observerRoot: root })
    t.register({
      id: 'tailwind',
      roleMap: { 'action.primary': 'bg-indigo-600' },
      cssRules: { 'action.primary': 'background: red;' },
    })
    t.setActiveAdapter('tailwind')
    await flushAll()
    t.destroy()
    expect(document.querySelectorAll('style[data-gz-stylesheet]').length).toBe(0)
  })

  it('with broker: setActiveAdapter triggers ui.adapter.changed via manager', () => {
    const calls: { topic: string; payload: unknown }[] = []
    const broker = {
      publish(topic: string, payload: unknown) {
        calls.push({ topic, payload })
        return undefined
      },
      subscribe(_t: string, _h: () => void) {
        return () => {}
      },
    }
    const t = createTheme({ broker })
    t.register({ id: 'tailwind', roleMap: {} })
    t.setActiveAdapter('tailwind')
    const ev = calls.find((c) => c.topic === 'ui.adapter.changed')
    expect(ev).toBeDefined()
    t.destroy()
  })

  it('without broker: setActiveAdapter no publish (no throw)', () => {
    const t = createTheme()
    t.register({ id: 'tailwind', roleMap: {} })
    expect(() => t.setActiveAdapter('tailwind')).not.toThrow()
    t.destroy()
  })

  it('getActiveTheme returns deep-frozen snapshot', () => {
    const t = createTheme()
    const snap = t.getActiveTheme()
    expect(snap).toBeDefined()
    expect(Object.isFrozen(snap)).toBe(true)
    t.destroy()
  })
})
