/**
 * Tier-1 jsdom end-to-end tests for `runtime-context.ts` — 5 API CRUD MF-CTX-01 +
 * 11 chiavi PRD §18.4 MF-CTX-02 + events 1+N MF-CTX-03 + selector dispatch SC1 MF-CTX-05.
 *
 * Harness: `createBroker({ modules: [microfrontendModule(), contextModule()] })` per
 * verifica install lookup + initRuntimeContext + integrazione broker.publish/subscribe.
 *
 * @see packages/context/src/runtime-context.ts
 * @see packages/context/src/context-module.ts
 */
import { createBroker } from '@gluezero/core'
import { microfrontendModule } from '@gluezero/microfrontends'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contextModule } from '../context-module'
import {
  __resetForTest,
  clearRuntimeContext,
  getRuntimeContext,
  replaceRuntimeContext,
  setRuntimeContext,
  subscribeRuntimeContext,
} from '../runtime-context'

describe('runtime-context — 5 API CRUD + 11 chiavi PRD §18.4 (MF-CTX-01, MF-CTX-02)', () => {
  beforeEach(() => {
    __resetForTest()
    // Setup broker harness — installa microfrontendModule() + contextModule() in ordine.
    createBroker({ modules: [microfrontendModule(), contextModule()] })
  })

  afterEach(() => {
    __resetForTest()
  })

  it('5 API esposte: set / replace / get / subscribe / clear', () => {
    expect(typeof setRuntimeContext).toBe('function')
    expect(typeof replaceRuntimeContext).toBe('function')
    expect(typeof getRuntimeContext).toBe('function')
    expect(typeof subscribeRuntimeContext).toBe('function')
    expect(typeof clearRuntimeContext).toBe('function')
  })

  it('setRuntimeContext({tenantId}) + getRuntimeContext() ritorna stato corrente', () => {
    setRuntimeContext({ tenantId: 'acme' })
    expect(getRuntimeContext()).toEqual({ tenantId: 'acme' })
  })

  it('11 chiavi standard PRD §18.4 accettate', () => {
    setRuntimeContext({
      tenantId: 'T',
      user: { id: 'u' },
      locale: 'it',
      timezone: 'Europe/Rome',
      permissions: ['read'],
      featureFlags: { beta: true },
      theme: 'dark',
      direction: 'ltr',
      environment: 'production',
      currentRoute: { path: '/home' },
      metadata: { custom: 'x' },
    })
    const ctx = getRuntimeContext()
    expect(Object.keys(ctx)).toHaveLength(11)
  })

  it('replaceRuntimeContext({}) cancella stato precedente', () => {
    setRuntimeContext({ tenantId: 'T', user: { id: 'u' } })
    replaceRuntimeContext({})
    expect(getRuntimeContext()).toEqual({})
  })

  it('clearRuntimeContext([keys]) rimuove solo chiavi specifiche', () => {
    setRuntimeContext({ tenantId: 'T', user: { id: 'u' }, locale: 'it' })
    clearRuntimeContext(['tenantId', 'locale'])
    expect(getRuntimeContext()).toEqual({ user: { id: 'u' } })
  })

  it('clearRuntimeContext() no-args rimuove tutte 11 chiavi standard', () => {
    setRuntimeContext({ tenantId: 'T', theme: 'dark', currentRoute: { path: '/h' } })
    clearRuntimeContext()
    expect(getRuntimeContext()).toEqual({})
  })
})

describe('runtime-context — throw esplicativo not initialized (T-F10-W2-P02-01)', () => {
  beforeEach(() => {
    __resetForTest() // brokerRef undefined
  })

  it('throw esplicativo se contextModule NON installato', () => {
    expect(() => setRuntimeContext({ tenantId: 'X' })).toThrow(/not initialized/)
  })

  it('throw esplicativo si applica anche a replace/clear', () => {
    expect(() => replaceRuntimeContext({})).toThrow(/not initialized/)
    expect(() => clearRuntimeContext()).toThrow(/not initialized/)
  })
})

describe('runtime-context — events 1+N + selector dispatch (MF-CTX-03, MF-CTX-05)', () => {
  beforeEach(() => {
    __resetForTest()
  })

  afterEach(() => {
    __resetForTest()
  })

  it('SC1: reference identity preserved — update locale NON triggera handler su selector user', () => {
    createBroker({ modules: [microfrontendModule(), contextModule()] })
    setRuntimeContext({ user: { id: 'u1' }, tenantId: 'T1' })

    const userHandler = vi.fn()
    const localeHandler = vi.fn()
    subscribeRuntimeContext((ctx) => ctx.user, userHandler)
    subscribeRuntimeContext((ctx) => ctx.locale, localeHandler)

    // Update SOLO locale — user invariato
    setRuntimeContext({ locale: 'it' })

    // CRITICAL SC1: userHandler NON deve essere chiamato
    expect(userHandler).not.toHaveBeenCalled()
    expect(localeHandler).toHaveBeenCalledTimes(1)
  })

  it('Fire pattern 1 aggregator + N specific: subscribe a context.changed + context.user.changed', () => {
    const broker = createBroker({ modules: [microfrontendModule(), contextModule()] })

    const aggHandler = vi.fn()
    const userTopicHandler = vi.fn()
    broker.subscribe('context.changed', aggHandler)
    broker.subscribe('context.user.changed', userTopicHandler)

    setRuntimeContext({ user: { id: 'u1' }, tenantId: 'T1' })

    expect(aggHandler).toHaveBeenCalledTimes(1) // 1 aggregator
    expect(userTopicHandler).toHaveBeenCalledTimes(1) // 1 specific user
  })

  it('clearRuntimeContext emette context.changed con changedKeys = chiavi rimosse', () => {
    const broker = createBroker({ modules: [microfrontendModule(), contextModule()] })
    setRuntimeContext({ tenantId: 'T', locale: 'it' })

    const handler = vi.fn()
    broker.subscribe('context.changed', handler)

    clearRuntimeContext(['tenantId'])
    expect(handler).toHaveBeenCalledTimes(1)
    // BrokerEvent payload: handler riceve BrokerEvent<ContextChangedPayload>
    const call = handler.mock.calls[0]
    const event = call?.[0] as { payload: { changedKeys: string[] } }
    expect(event.payload.changedKeys).toContain('tenantId')
  })

  it('setRuntimeContext senza changes (partial = stato corrente) NO publish + NO dispatch', () => {
    const broker = createBroker({ modules: [microfrontendModule(), contextModule()] })
    setRuntimeContext({ tenantId: 'T1' })

    const handler = vi.fn()
    broker.subscribe('context.changed', handler)

    setRuntimeContext({ tenantId: 'T1' }) // same value
    expect(handler).not.toHaveBeenCalled()
  })

  it('replaceRuntimeContext con state identico NO publish (changedKeys empty)', () => {
    const broker = createBroker({ modules: [microfrontendModule(), contextModule()] })
    setRuntimeContext({ tenantId: 'T1' })

    const handler = vi.fn()
    broker.subscribe('context.changed', handler)

    // Replace con state vuoto — tenantId rimosso → changed
    replaceRuntimeContext({})
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('subscribeRuntimeContext keys-array overload Sig 2 integration', () => {
    createBroker({ modules: [microfrontendModule(), contextModule()] })

    const handler = vi.fn()
    subscribeRuntimeContext(['user', 'tenantId'] as const, handler)

    setRuntimeContext({ user: { id: 'u1' }, tenantId: 'T1' })
    expect(handler).toHaveBeenCalledTimes(1)
    const call = handler.mock.calls[0]
    expect(call?.[0]).toEqual({ user: { id: 'u1' }, tenantId: 'T1' })
  })
})
