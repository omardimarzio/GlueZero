/**
 * Tier-1 jsdom unit tests for `selector.ts` — D-V2-F10-01..04 overload TS +
 * shallowEqual gate + AbortSignal cascade + T-F10-02 selector throw protection.
 *
 * @see packages/context/src/selector.ts
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetSubscribersForTest, dispatchSelectors, subscribeRuntimeContext } from '../selector'
import { __resetForTest, setState } from '../storage'

describe('subscribeRuntimeContext — overload TS + shallowEqual gate (MF-CTX-05, D-V2-F10-01..04)', () => {
  afterEach(() => {
    __resetForTest()
    __resetSubscribersForTest()
  })

  it('overload Sig 1: function selector (ctx) => slice', () => {
    const handler = vi.fn()
    subscribeRuntimeContext((ctx) => ctx.user, handler)
    const r = setState({ user: { id: 'u1' } })
    dispatchSelectors(r.previous, r.current)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({ id: 'u1' }, undefined)
  })

  it('overload Sig 2: keys array as const', () => {
    const handler = vi.fn()
    subscribeRuntimeContext(['user', 'tenantId'] as const, handler)
    const r = setState({ user: { id: 'u1' }, tenantId: 'T1' })
    dispatchSelectors(r.previous, r.current)
    expect(handler).toHaveBeenCalledTimes(1)
    // slice è Pick<RuntimeContext, 'user' | 'tenantId'>
    const call = handler.mock.calls[0]
    expect(call?.[0]).toEqual({ user: { id: 'u1' }, tenantId: 'T1' })
  })

  it('shallowEqual gate: handler NON invocato se slice same (reference identity preserved)', () => {
    const handler = vi.fn()
    const user = { id: 'u1' }
    setState({ user }) // state initial
    subscribeRuntimeContext((ctx) => ctx.user, handler)
    // Update di locale — user NON cambia → handler NON invocato
    const r = setState({ locale: 'it' })
    dispatchSelectors(r.previous, r.current)
    expect(handler).not.toHaveBeenCalled()
  })

  it('reference identity preserved cross update — SC1 scenario', () => {
    const userHandler = vi.fn()
    const localeHandler = vi.fn()
    subscribeRuntimeContext((ctx) => ctx.user, userHandler)
    subscribeRuntimeContext((ctx) => ctx.locale, localeHandler)
    // Update solo locale
    const r1 = setState({ locale: 'it' })
    dispatchSelectors(r1.previous, r1.current)
    expect(userHandler).not.toHaveBeenCalled() // CRITICAL: SC1 verification
    expect(localeHandler).toHaveBeenCalledTimes(1)
  })

  it('unsubscribe fn rimuove subscriber', () => {
    const handler = vi.fn()
    const off = subscribeRuntimeContext((ctx) => ctx.user, handler)
    off()
    const r = setState({ user: { id: 'u1' } })
    dispatchSelectors(r.previous, r.current)
    expect(handler).not.toHaveBeenCalled()
  })

  it('AbortSignal cascade auto-cleanup (D-V2-F10-04)', () => {
    const handler = vi.fn()
    const controller = new AbortController()
    subscribeRuntimeContext((ctx) => ctx.user, handler, { signal: controller.signal })
    controller.abort()
    const r = setState({ user: { id: 'u1' } })
    dispatchSelectors(r.previous, r.current)
    expect(handler).not.toHaveBeenCalled()
  })

  it('P-17 inline selector cope: new wrapper object → shallow gate naturale top-level', () => {
    const handler = vi.fn()
    // Inline new wrapper ad ogni dispatch — shallow gate top-level catch
    subscribeRuntimeContext(
      (ctx) => ({ user: ctx.user, tenant: ctx.tenantId }),
      handler,
    )
    // First dispatch: tenantId change → wrapper diff su 'tenant' key → handler invocato
    const r1 = setState({ tenantId: 'T1' })
    dispatchSelectors(r1.previous, r1.current)
    expect(handler).toHaveBeenCalledTimes(1)
    // Second dispatch: NO state change → user/tenant same ref → shallow eq → NO trigger
    const r2 = setState({})
    dispatchSelectors(r2.previous, r2.current)
    expect(handler).toHaveBeenCalledTimes(1) // ancora 1, NOT 2 (shallow gate works)
  })

  it('T-F10-02 selector throw → skip subscriber, no cascade crash', () => {
    const goodHandler = vi.fn()
    const badSelector = vi.fn(() => {
      throw new Error('selector boom')
    })
    subscribeRuntimeContext(badSelector, vi.fn())
    subscribeRuntimeContext((ctx) => ctx.user, goodHandler) // good subscriber dopo bad
    const r = setState({ user: { id: 'u1' } })
    expect(() => dispatchSelectors(r.previous, r.current)).not.toThrow()
    expect(goodHandler).toHaveBeenCalledTimes(1)
  })

  it('T-F10-02 handler throw → log-only, continue cascade ad altri subscribers', () => {
    const badHandler = vi.fn(() => {
      throw new Error('handler boom')
    })
    const goodHandler = vi.fn()
    subscribeRuntimeContext((ctx) => ctx.user, badHandler)
    subscribeRuntimeContext((ctx) => ctx.user, goodHandler)
    const r = setState({ user: { id: 'u1' } })
    expect(() => dispatchSelectors(r.previous, r.current)).not.toThrow()
    expect(badHandler).toHaveBeenCalledTimes(1)
    expect(goodHandler).toHaveBeenCalledTimes(1)
  })
})
