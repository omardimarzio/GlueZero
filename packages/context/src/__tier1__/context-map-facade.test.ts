/**
 * Tier-1 jsdom test suite — `context-map-facade.ts` ctx.context auto-injection LIVE
 * (MF-CTX-06 + D-V2-F10-15).
 *
 * Test coverage:
 * - computeContextSnapshot: passthrough standard keys
 * - computeContextSnapshot: contextMap alias localizzato (PRD §18.8)
 * - attachMfContext: mutation cast iniziale `ctx.context`
 * - attachMfContext: LIVE update su `context.changed`
 * - contextMap aggiornato LIVE (passthrough + alias entrambi)
 * - Cascade cleanup via AbortSignal mount lifecycle (D-V2-F10-04 + D-V2-F10-15)
 * - detachMfContext explicit cleanup
 *
 * @see D-V2-F10-15 (contextMap auto-injection LIVE)
 * @see T-F10-W2-P04-03 (internal subscribe leak mitigation)
 * @see T-F10-W2-P04-04 (mutation cast safety)
 */
import { createBroker } from '@gluezero/core'
import type { MicroFrontendRegistration } from '@gluezero/microfrontends'
import { microfrontendModule } from '@gluezero/microfrontends'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { contextModule } from '../context-module'
import {
  __resetFacadeForTest,
  attachMfContext,
  computeContextSnapshot,
  detachMfContext,
} from '../context-map-facade'
import { __resetForTest, setRuntimeContext } from '../runtime-context'

/**
 * Mock MicroFrontendRegistration con `runtimeContext` mock-injected per testing
 * mutation cast Strategy A. F8 production crea runtimeContext on-demand via
 * `createMfRuntimeContext` — qui simuliamo lo store-pattern attached in W3.
 */
function makeMockReg(opts: {
  id: string
  contextMap?: Record<string, string>
}): MicroFrontendRegistration & { runtimeContext: { context?: unknown } } {
  const ctx = {} as { context?: unknown }
  const descriptor = {
    id: opts.id,
    name: opts.id,
    version: '1.0.0',
    loader: { type: 'esm' as const, url: '/x.js' },
    ...(opts.contextMap !== undefined && {
      mapping: { contextMap: opts.contextMap },
    }),
  }
  return {
    descriptor,
    state: 'mounted',
    runtimeContext: ctx,
  } as unknown as MicroFrontendRegistration & { runtimeContext: { context?: unknown } }
}

describe('context-map-facade — ctx.context auto-injection LIVE (MF-CTX-06 + D-V2-F10-15)', () => {
  beforeEach(() => {
    __resetForTest()
    __resetFacadeForTest()
  })

  afterEach(() => {
    __resetForTest()
    __resetFacadeForTest()
  })

  it('computeContextSnapshot: passthrough standard keys', () => {
    createBroker({ modules: [microfrontendModule(), contextModule()] })
    setRuntimeContext({ tenantId: 'acme', locale: 'it' })
    const reg = makeMockReg({ id: 'mf-x' })
    const snap = computeContextSnapshot(reg.descriptor)
    expect(snap['tenantId']).toBe('acme')
    expect(snap['locale']).toBe('it')
  })

  it('computeContextSnapshot: contextMap alias localizzato (PRD §18.8)', () => {
    createBroker({ modules: [microfrontendModule(), contextModule()] })
    setRuntimeContext({ tenantId: 'acme', locale: 'it' })
    const reg = makeMockReg({
      id: 'mf-x',
      contextMap: { currentTenant: 'tenantId', language: 'locale' },
    })
    const snap = computeContextSnapshot(reg.descriptor)
    // Passthrough
    expect(snap['tenantId']).toBe('acme')
    expect(snap['locale']).toBe('it')
    // Alias overlay
    expect(snap['currentTenant']).toBe('acme')
    expect(snap['language']).toBe('it')
  })

  it('attachMfContext: mutation cast iniziale ctx.context (Strategy A)', () => {
    createBroker({ modules: [microfrontendModule(), contextModule()] })
    setRuntimeContext({ tenantId: 'acme' })
    const reg = makeMockReg({ id: 'mf-x' })
    attachMfContext('mf-x', reg, undefined)
    expect(reg.runtimeContext.context).toEqual({ tenantId: 'acme' })
  })

  it('attachMfContext: LIVE update su context.changed (D-V2-F10-15)', () => {
    createBroker({ modules: [microfrontendModule(), contextModule()] })
    const reg = makeMockReg({ id: 'mf-x' })
    attachMfContext('mf-x', reg, undefined)
    expect(reg.runtimeContext.context).toEqual({})
    setRuntimeContext({ tenantId: 'acme' })
    expect(reg.runtimeContext.context).toEqual({ tenantId: 'acme' })
    setRuntimeContext({ locale: 'it' })
    expect(reg.runtimeContext.context).toEqual({ tenantId: 'acme', locale: 'it' })
  })

  it('contextMap aggiornato LIVE (passthrough + alias entrambi)', () => {
    createBroker({ modules: [microfrontendModule(), contextModule()] })
    const reg = makeMockReg({
      id: 'mf-x',
      contextMap: { currentTenant: 'tenantId' },
    })
    attachMfContext('mf-x', reg, undefined)
    setRuntimeContext({ tenantId: 'acme' })
    const ctx = reg.runtimeContext.context as Record<string, unknown>
    expect(ctx['tenantId']).toBe('acme')
    expect(ctx['currentTenant']).toBe('acme')
  })

  it('cascade cleanup via abortSignal mount lifecycle (D-V2-F10-04 + D-V2-F10-15)', () => {
    createBroker({ modules: [microfrontendModule(), contextModule()] })
    const reg = makeMockReg({ id: 'mf-x' })
    const ctrl = new AbortController()
    attachMfContext('mf-x', reg, ctrl.signal)
    setRuntimeContext({ tenantId: 'acme' })
    expect(reg.runtimeContext.context).toEqual({ tenantId: 'acme' })
    // Abort cascade
    ctrl.abort()
    setRuntimeContext({ locale: 'it' })
    // Context NON aggiornato post-abort
    expect(reg.runtimeContext.context).toEqual({ tenantId: 'acme' })
  })

  it('detachMfContext explicit cleanup', () => {
    createBroker({ modules: [microfrontendModule(), contextModule()] })
    const reg = makeMockReg({ id: 'mf-x' })
    attachMfContext('mf-x', reg, undefined)
    setRuntimeContext({ tenantId: 'acme' })
    detachMfContext('mf-x')
    setRuntimeContext({ locale: 'it' })
    // Context NON aggiornato post-detach (tenantId rimane, locale NON propagato)
    const ctx = reg.runtimeContext.context as Record<string, unknown>
    expect(ctx['tenantId']).toBe('acme')
    expect(ctx['locale']).toBeUndefined()
  })

  it('attachMfContext: skip se runtimeContext undefined (defensive — F8 lifecycle edge)', () => {
    createBroker({ modules: [microfrontendModule(), contextModule()] })
    // Mock reg SENZA runtimeContext field
    const reg = { descriptor: { id: 'mf-x', name: 'X', version: '1.0.0' } } as unknown as MicroFrontendRegistration
    expect(() => attachMfContext('mf-x', reg, undefined)).not.toThrow()
    // setRuntimeContext non triggera mutation (subscribe non avvenuta)
    setRuntimeContext({ tenantId: 'acme' })
    expect((reg as { runtimeContext?: unknown }).runtimeContext).toBeUndefined()
  })
})
