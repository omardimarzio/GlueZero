import { describe, expect, it, vi } from 'vitest'
import type { PluginRegistration, PluginState } from '../types/plugin'
import { isBrokerError } from './broker-error'
import { transitionState } from './lifecycle'
import { silentLogger } from './logger'

const makeReg = (state: PluginState): PluginRegistration => ({
  descriptor: { id: 'p1' },
  state,
  subscriptions: new Set(),
  abortController: new AbortController(),
  registeredAt: Date.now(),
})

describe('transitionState — valid transitions (D-25)', () => {
  it.each([
    ['unregistered', 'registered'],
    ['registered', 'mounting'],
    ['registered', 'unmounted'],
    ['mounting', 'mounted'],
    ['mounting', 'failed'],
    ['mounted', 'unmounting'],
    ['unmounting', 'unmounted'],
    ['unmounting', 'failed'],
    ['unmounted', 'destroyed'],
    ['failed', 'unmounting'],
    ['failed', 'destroyed'],
  ] as const)('allows %s → %s', (from, to) => {
    const reg = makeReg(from)
    expect(() => transitionState(reg, to, silentLogger)).not.toThrow()
    expect(reg.state).toBe(to)
  })
})

describe('transitionState — invalid transitions throw BrokerError', () => {
  it.each([
    ['unregistered', 'mounted'],
    ['unregistered', 'destroyed'],
    ['registered', 'destroyed'],
    ['mounted', 'mounting'],
    ['mounted', 'destroyed'],
    ['destroyed', 'mounted'],
    ['destroyed', 'registered'],
  ] as const)('rejects %s → %s', (from, to) => {
    const reg = makeReg(from)
    let caught: unknown = null
    try {
      transitionState(reg, to, silentLogger)
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('plugin.lifecycle.invalid-transition')
  })

  it('does not mutate reg.state on invalid transition', () => {
    const reg = makeReg('unregistered')
    try {
      transitionState(reg, 'destroyed', silentLogger)
    } catch {
      // expected throw
    }
    expect(reg.state).toBe('unregistered')
  })
})

describe('transitionState — error details', () => {
  it('error.details contains from, to, pluginId', () => {
    const reg = makeReg('unregistered')
    let caught: unknown = null
    try {
      transitionState(reg, 'destroyed', silentLogger)
    } catch (e) {
      caught = e
    }
    const details = (caught as { details: Record<string, unknown> }).details
    expect(details.from).toBe('unregistered')
    expect(details.to).toBe('destroyed')
    expect(details.pluginId).toBe('p1')
  })

  it('error.category is plugin', () => {
    const reg = makeReg('unregistered')
    let caught: unknown = null
    try {
      transitionState(reg, 'destroyed', silentLogger)
    } catch (e) {
      caught = e
    }
    expect((caught as { category: string }).category).toBe('plugin')
  })

  it('error logged via logger.error before throw', () => {
    const reg = makeReg('unregistered')
    const errorSpy = vi.fn()
    const logger = { ...silentLogger, error: errorSpy }
    try {
      transitionState(reg, 'destroyed', logger)
    } catch {
      // expected throw
    }
    expect(errorSpy).toHaveBeenCalled()
    // Logger invocato PRIMA del throw, quindi spy.mock.calls deve contenere
    // un messaggio descrittivo + meta { error }
    const [msg, meta] = errorSpy.mock.calls[0] as [string, Record<string, unknown>]
    expect(typeof msg).toBe('string')
    expect(meta).toBeDefined()
    expect(meta.error).toBeDefined()
  })
})

describe('transitionState — destroyed is terminal', () => {
  it.each([
    'registered',
    'mounting',
    'mounted',
    'unmounting',
    'unmounted',
    'failed',
    'unregistered',
  ] as const)('destroyed cannot transition to %s', (target) => {
    const reg = makeReg('destroyed')
    expect(() => transitionState(reg, target, silentLogger)).toThrow()
  })
})
