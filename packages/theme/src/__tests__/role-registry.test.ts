/**
 * Tier-1 jsdom tests per `createRoleRegistry` closure factory.
 *
 * Refs:
 * - 07-05-PLAN.md Task 2
 * - UI-ROLE-01 (idempotent register), UI-ROLE-06 (cap 100), D-F7-14
 * - D-F7-16 (dot-notation enforcement)
 * - D-30 (anti-singleton parallel instances)
 */
import { describe, expect, it, vi } from 'vitest'
import { createRoleRegistry } from '../role-registry'

describe('createRoleRegistry', () => {
  it('exposes register/unregister/has/list/get/subscribe/destroy', () => {
    const r = createRoleRegistry()
    expect(typeof r.register).toBe('function')
    expect(typeof r.unregister).toBe('function')
    expect(typeof r.has).toBe('function')
    expect(typeof r.list).toBe('function')
    expect(typeof r.get).toBe('function')
    expect(typeof r.subscribe).toBe('function')
    expect(typeof r.destroy).toBe('function')
  })

  it('register valid role', () => {
    const r = createRoleRegistry()
    r.register({ 'custom.button': { description: 'Button' } })
    expect(r.has('custom.button')).toBe(true)
    expect(r.get('custom.button')?.description).toBe('Button')
  })

  it('register invalid role throws theme.role.invalid', () => {
    const r = createRoleRegistry()
    expect(() => r.register({ NO_DOT: {} })).toThrowError(
      /theme\.role\.invalid|Invalid role/,
    )
  })

  it('register with empty payload is no-op (no throw)', () => {
    const r = createRoleRegistry()
    expect(() => r.register({})).not.toThrow()
    expect(r.list().length).toBe(0)
  })

  it('register idempotent: second register same role no-op + warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = createRoleRegistry()
    r.register({ 'action.primary': { description: 'A' } })
    r.register({ 'action.primary': { description: 'B' } })
    expect(r.get('action.primary')?.description).toBe('A') // first wins
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('already registered'),
    )
    warnSpy.mockRestore()
  })

  it('register over cap 100 without allowMore throws theme.role.cap-exceeded', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = createRoleRegistry()
    const big: Record<string, { description: string }> = {}
    for (let i = 0; i < 101; i++) big[`x.role-${i}`] = { description: '' }
    expect(() => r.register(big)).toThrowError(/role\.cap-exceeded|cap reached/)
    warnSpy.mockRestore()
  })

  it('register over cap with allowMore succeeds', () => {
    const r = createRoleRegistry()
    const big: Record<string, { description: string }> = {}
    for (let i = 0; i < 101; i++) big[`x.role-${i}`] = { description: '' }
    expect(() => r.register(big, { allowMore: true })).not.toThrow()
    expect(r.list().length).toBe(101)
  })

  it('unregister removes role', () => {
    const r = createRoleRegistry()
    r.register({ 'custom.button': { description: 'B' } })
    r.unregister('custom.button')
    expect(r.has('custom.button')).toBe(false)
  })

  it('unregister non-existent throws theme.role.unregistered', () => {
    const r = createRoleRegistry()
    let caught: unknown
    try {
      r.unregister('action.primary')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeDefined()
    expect((caught as { code?: string }).code).toBe('theme.role.unregistered')
    expect((caught as Error).message).toMatch(/is not registered/)
  })

  it('list returns frozen readonly array of registered role names', () => {
    const r = createRoleRegistry()
    r.register({
      'action.primary': { description: '' },
      'feedback.error': { description: '' },
    })
    const list = r.list()
    expect(list).toContain('action.primary')
    expect(list).toContain('feedback.error')
    expect(list.length).toBe(2)
    expect(Object.isFrozen(list)).toBe(true)
  })

  it('subscribe receives registered events', () => {
    const r = createRoleRegistry()
    const listener = vi.fn()
    r.subscribe(listener)
    r.register({ 'action.primary': { description: '' } })
    expect(listener).toHaveBeenCalledWith({
      kind: 'registered',
      role: 'action.primary',
    })
  })

  it('subscribe receives unregistered events', () => {
    const r = createRoleRegistry()
    r.register({ 'action.primary': { description: '' } })
    const listener = vi.fn()
    r.subscribe(listener)
    r.unregister('action.primary')
    expect(listener).toHaveBeenCalledWith({
      kind: 'unregistered',
      role: 'action.primary',
    })
  })

  it('subscribe returns unsubscribe', () => {
    const r = createRoleRegistry()
    const listener = vi.fn()
    const unsub = r.subscribe(listener)
    unsub()
    r.register({ 'action.primary': { description: '' } })
    expect(listener).not.toHaveBeenCalled()
  })

  it('destroy: subsequent register throws theme.snapshot.frozen', () => {
    const r = createRoleRegistry()
    r.destroy()
    expect(() => r.register({ 'action.primary': {} })).toThrowError(
      /frozen|destroyed/,
    )
  })

  it('destroy: subsequent unregister throws theme.snapshot.frozen', () => {
    const r = createRoleRegistry()
    r.register({ 'action.primary': {} })
    r.destroy()
    expect(() => r.unregister('action.primary')).toThrowError(
      /frozen|destroyed/,
    )
  })

  it('destroy: idempotent (second destroy is no-op)', () => {
    const r = createRoleRegistry()
    r.destroy()
    expect(() => r.destroy()).not.toThrow()
  })

  it('two parallel registries do not interfere (D-30)', () => {
    const a = createRoleRegistry()
    const b = createRoleRegistry()
    a.register({ 'action.primary': {} })
    expect(a.has('action.primary')).toBe(true)
    expect(b.has('action.primary')).toBe(false)
  })

  it('listener errors are isolated (no crash propagation)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = createRoleRegistry()
    r.subscribe(() => {
      throw new Error('boom')
    })
    expect(() => r.register({ 'action.primary': {} })).not.toThrow()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('soft-warn at 50% cap is logged but allow=true', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = createRoleRegistry()
    const payload: Record<string, { description: string }> = {}
    for (let i = 0; i < 60; i++) payload[`x.role-${i}`] = { description: '' }
    r.register(payload)
    expect(r.list().length).toBe(60)
    // Soft-warn message contains "over 50% of cap"
    expect(
      warnSpy.mock.calls.some((call) =>
        String(call[0] ?? '').includes('over 50% of cap'),
      ),
    ).toBe(true)
    warnSpy.mockRestore()
  })
})
