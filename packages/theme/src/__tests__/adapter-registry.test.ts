/**
 * Tier-1 jsdom test per `createAdapterRegistry` (UI-ROLE-03, UI-ROLE-09).
 *
 * Coverage:
 * - Surface API completa (register/unregister/has/get/setActive/getActive/list/subscribe/destroy)
 * - Valibot validation register-time (ThemeAdapterSchema reuse W2)
 * - Collision throw `theme.adapter.duplicate` + override opt-in (D-F7-09)
 * - Active management (setActive/getActive/getActiveId con previous tracking)
 * - Observer pattern (subscribe registered/activated/deactivated/unregistered)
 * - LIFE-02 ext F7 prep: ownerPluginId saved for cascade W4
 * - Object.freeze post-register (T-F7-04 mitigation tampering)
 *
 * Refs: 07-06-PLAN.md Task 2; 07-CONTEXT.md D-F7-09 (collision + override).
 */

import { describe, expect, it, vi } from 'vitest'
import { createAdapterRegistry } from '../adapter-registry'

const tailwindAdapter = {
  id: 'tailwind',
  roleMap: {
    'action.primary': 'bg-indigo-600 text-white px-4 py-2 rounded',
    'action.secondary': 'bg-gray-200 text-gray-900 px-4 py-2 rounded',
  },
}
const bootstrapAdapter = {
  id: 'bootstrap5',
  roleMap: {
    'action.primary': 'btn btn-primary',
    'action.secondary': 'btn btn-secondary',
  },
}
const tokensOnlyAdapter = {
  id: 'tokens-only',
  cssRules: {
    'action.primary':
      'background: var(--gz-color-primary); color: var(--gz-color-on-primary); padding: var(--gz-spacing-md);',
  },
}

describe('createAdapterRegistry', () => {
  it('exposes full surface', () => {
    const r = createAdapterRegistry()
    expect(typeof r.register).toBe('function')
    expect(typeof r.unregister).toBe('function')
    expect(typeof r.has).toBe('function')
    expect(typeof r.get).toBe('function')
    expect(typeof r.setActive).toBe('function')
    expect(typeof r.getActive).toBe('function')
    expect(typeof r.getActiveId).toBe('function')
    expect(typeof r.list).toBe('function')
    expect(typeof r.subscribe).toBe('function')
    expect(typeof r.destroy).toBe('function')
    expect(typeof r.getOwnerPluginId).toBe('function')
  })

  it('register valid adapter', () => {
    const r = createAdapterRegistry()
    r.register(tailwindAdapter)
    expect(r.has('tailwind')).toBe(true)
    expect(r.get('tailwind')?.roleMap?.['action.primary']).toBe(
      'bg-indigo-600 text-white px-4 py-2 rounded',
    )
  })

  it('register duplicate id throws theme.adapter.duplicate', () => {
    const r = createAdapterRegistry()
    r.register(tailwindAdapter)
    expect(() => r.register(tailwindAdapter)).toThrowError(
      /adapter\.duplicate|already registered/,
    )
  })

  it('register duplicate with override succeeds', () => {
    const r = createAdapterRegistry()
    r.register(tailwindAdapter)
    expect(() =>
      r.register(
        { ...tailwindAdapter, roleMap: { 'action.primary': 'NEW' } },
        { override: true },
      ),
    ).not.toThrow()
    expect(r.get('tailwind')?.roleMap?.['action.primary']).toBe('NEW')
  })

  it('register invalid shape throws theme.adapter.invalid', () => {
    const r = createAdapterRegistry()
    expect(() =>
      r.register({ id: '' } as unknown as { id: string }),
    ).toThrowError(/adapter\.invalid|Invalid adapter/)
  })

  it('setActive returns previous + current', () => {
    const r = createAdapterRegistry()
    r.register(tailwindAdapter)
    r.register(bootstrapAdapter)
    const swap1 = r.setActive('tailwind')
    expect(swap1).toEqual({ previous: null, current: 'tailwind' })
    const swap2 = r.setActive('bootstrap5')
    expect(swap2).toEqual({ previous: 'tailwind', current: 'bootstrap5' })
  })

  it('setActive unknown throws theme.adapter.unknown', () => {
    const r = createAdapterRegistry()
    expect(() => r.setActive('ghost')).toThrowError(
      /adapter\.unknown|unknown adapter/,
    )
  })

  it('setActive(null) deactivates', () => {
    const r = createAdapterRegistry()
    r.register(tailwindAdapter)
    r.setActive('tailwind')
    r.setActive(null)
    expect(r.getActive()).toBeNull()
    expect(r.getActiveId()).toBeNull()
  })

  it('unregister active adapter deactivates', () => {
    const r = createAdapterRegistry()
    r.register(tailwindAdapter)
    r.setActive('tailwind')
    r.unregister('tailwind')
    expect(r.getActive()).toBeNull()
    expect(r.has('tailwind')).toBe(false)
  })

  it('unregister unknown throws theme.adapter.unknown', () => {
    const r = createAdapterRegistry()
    expect(() => r.unregister('ghost')).toThrowError(
      /adapter\.unknown|not registered/,
    )
  })

  it('subscribe receives registered/activated/deactivated/unregistered events', () => {
    const r = createAdapterRegistry()
    const listener = vi.fn()
    r.subscribe(listener)
    r.register(tailwindAdapter)
    r.setActive('tailwind')
    r.setActive(null)
    r.unregister('tailwind')
    const calls = listener.mock.calls.map((c) => c[0])
    expect(calls).toEqual([
      expect.objectContaining({ kind: 'registered', adapterId: 'tailwind' }),
      expect.objectContaining({ kind: 'activated', adapterId: 'tailwind' }),
      expect.objectContaining({ kind: 'deactivated', adapterId: 'tailwind' }),
      expect.objectContaining({ kind: 'unregistered', adapterId: 'tailwind' }),
    ])
  })

  it('register with ownerPluginId saves it for cascade (W4 prep)', () => {
    const r = createAdapterRegistry()
    r.register(tailwindAdapter, { ownerPluginId: 'my-plugin' })
    expect(r.getOwnerPluginId('tailwind')).toBe('my-plugin')
  })

  it('list returns frozen array', () => {
    const r = createAdapterRegistry()
    r.register(tailwindAdapter)
    r.register(bootstrapAdapter)
    const list = r.list()
    expect(list).toContain('tailwind')
    expect(list).toContain('bootstrap5')
    expect(Object.isFrozen(list)).toBe(true)
  })

  it('adapter retrieved is frozen (post-register mutation prevention)', () => {
    const r = createAdapterRegistry()
    r.register(tailwindAdapter)
    const a = r.get('tailwind')!
    expect(Object.isFrozen(a)).toBe(true)
  })

  it('destroy: subsequent register throws frozen', () => {
    const r = createAdapterRegistry()
    r.destroy()
    expect(() => r.register(tailwindAdapter)).toThrowError(
      /frozen|destroyed/,
    )
  })

  it('cssRules-only adapter accepted (Strategia B only)', () => {
    const r = createAdapterRegistry()
    expect(() => r.register(tokensOnlyAdapter)).not.toThrow()
    expect(r.get('tokens-only')?.cssRules?.['action.primary']).toContain(
      '--gz-color-primary',
    )
  })
})
