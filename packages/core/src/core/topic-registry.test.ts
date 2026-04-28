import { describe, expect, it, vi } from 'vitest'
import { TopicRegistry } from './topic-registry'

describe('TopicRegistry', () => {
  it('register returns true on new topic, false on duplicate (idempotent)', () => {
    const reg = new TopicRegistry()
    expect(reg.register('weather.requested')).toBe(true)
    expect(reg.register('weather.requested')).toBe(false)
  })

  it('has returns correct presence', () => {
    const reg = new TopicRegistry()
    expect(reg.has('weather.requested')).toBe(false)
    reg.register('weather.requested')
    expect(reg.has('weather.requested')).toBe(true)
  })

  it('list returns alphabetically sorted topics', () => {
    const reg = new TopicRegistry()
    reg.register('weather.requested')
    reg.register('auth.failed')
    reg.register('form.submit')
    expect(reg.list()).toEqual(['auth.failed', 'form.submit', 'weather.requested'])
  })

  it('list on empty registry returns []', () => {
    const reg = new TopicRegistry()
    expect(reg.list()).toEqual([])
  })

  it('onRegistered listener invoked on new register only', () => {
    const reg = new TopicRegistry()
    const listener = vi.fn()
    reg.onRegistered(listener)
    reg.register('a.b')
    reg.register('a.b') // duplicate, listener should NOT fire again
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('a.b')
  })

  it('onRegistered returns unsubscribe function', () => {
    const reg = new TopicRegistry()
    const listener = vi.fn()
    const unsub = reg.onRegistered(listener)
    reg.register('a.b')
    unsub()
    reg.register('c.d')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('a.b')
  })

  it('multiple listeners all invoked; throwing listener does not break others', () => {
    const reg = new TopicRegistry()
    const ok1 = vi.fn()
    const ok2 = vi.fn()
    const bad = vi.fn(() => {
      throw new Error('oops')
    })
    reg.onRegistered(ok1)
    reg.onRegistered(bad)
    reg.onRegistered(ok2)
    expect(() => reg.register('x.y')).not.toThrow()
    expect(ok1).toHaveBeenCalledWith('x.y')
    expect(ok2).toHaveBeenCalledWith('x.y')
    expect(bad).toHaveBeenCalledWith('x.y')
  })

  it('list returns a fresh array on each call (no internal Set leak)', () => {
    const reg = new TopicRegistry()
    reg.register('a.b')
    const first = reg.list()
    first.push('mutated')
    const second = reg.list()
    expect(second).toEqual(['a.b'])
  })
})
