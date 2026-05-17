/**
 * Tier-1 jsdom unit test per `createMfAggregator` (D-V2-F16-05 + D-V2-F16-06 + D-V2-F16-09).
 *
 * Copre: state vuoto + buildSnapshot, error/fallback/route topics dispatch, ring buffer 500
 * FIFO drop-oldest, Service Locator graceful degradation, deep-clone D-162, subscription
 * counter, isolamento per-MF.
 */
import { describe, expect, it } from 'vitest'
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import { createMfAggregator } from '../aggregator'

// Minimal mock MicroFrontendsService — solo `list()` necessario per buildSnapshot
function mockService(registrations: Array<{
  id: string
  state: string
  version?: string
  loaderType?: string
}>): MicroFrontendsService {
  return {
    list: () =>
      registrations.map((r) => ({
        descriptor: {
          id: r.id,
          name: r.id,
          version: r.version ?? '1.0.0',
          loader: { type: r.loaderType ?? 'mock' },
        },
        state: r.state,
        timings: { registeredAt: 0 },
      })) as never,
  } as never
}

describe('createMfAggregator (D-V2-F16-05 hybrid pull+push)', () => {
  it('aggregator vuoto + 0 events → buildSnapshot ritorna entry per ogni MF registrato', () => {
    const svc = mockService([
      { id: 'mf1', state: 'mounted' },
      { id: 'mf2', state: 'registered' },
    ])
    const aggregator = createMfAggregator({ ringBufferSize: 500, mfService: svc })
    const snap = aggregator.buildSnapshot()
    expect(snap.microFrontends.length).toBe(2)
    expect(snap.microFrontends[0]?.id).toBe('mf1')
    expect(snap.microFrontends[0]?.state).toBe('mounted')
    expect(snap.microFrontends[0]?.errors).toEqual([])
    expect(snap.microFrontends[1]?.id).toBe('mf2')
  })

  it('handleEvent failed → state.errors.length === 1', () => {
    const svc = mockService([{ id: 'mf1', state: 'mounted' }])
    const aggregator = createMfAggregator({ ringBufferSize: 500, mfService: svc })
    aggregator.handleEvent('microfrontend.failed', {
      payload: { id: 'mf1', phase: 'load', message: 'boom', code: 'ERR_LOAD' },
    })
    const snap = aggregator.buildSnapshot()
    expect(snap.microFrontends[0]?.errors.length).toBe(1)
    expect((snap.microFrontends[0]?.errors[0] as { code?: string }).code).toBe('ERR_LOAD')
  })

  it('handleEvent fallback.rendered → state.fallbacksApplied.length === 1', () => {
    const svc = mockService([{ id: 'mf1', state: 'mounted' }])
    const aggregator = createMfAggregator({ ringBufferSize: 500, mfService: svc })
    aggregator.handleEvent('microfrontend.fallback.rendered', {
      payload: { microFrontendId: 'mf1', lifecyclePhase: 'mount', fallbackType: 'html' },
    })
    const snap = aggregator.buildSnapshot()
    expect(snap.microFrontends[0]?.fallbacksApplied.length).toBe(1)
  })

  it('handleEvent error topic appends evento ring buffer + size === 1', () => {
    const svc = mockService([{ id: 'mf1', state: 'mounted' }])
    const aggregator = createMfAggregator({ ringBufferSize: 500, mfService: svc })
    aggregator.handleEvent('microfrontend.failed', { payload: { id: 'mf1' } })
    const buf = aggregator.getRingBuffer('mf1')
    expect(buf.length).toBe(1)
    expect(buf[0]?.topic).toBe('microfrontend.failed')
  })

  it('ring buffer 500 FIFO drop-oldest oltre capacity', () => {
    const svc = mockService([{ id: 'mf1', state: 'mounted' }])
    const aggregator = createMfAggregator({ ringBufferSize: 500, mfService: svc })
    for (let i = 0; i < 600; i++) {
      aggregator.handleEvent('microfrontend.mounted', { payload: { id: 'mf1', i } })
    }
    expect(aggregator.getRingBuffer('mf1').length).toBe(500)
  })

  it('Service Locator graceful degradation (D-V2-F16-06) — undefined lookup → field undefined NO throw', () => {
    const svc = mockService([{ id: 'mf1', state: 'mounted' }])
    const aggregator = createMfAggregator({ ringBufferSize: 500, mfService: svc })
    const snap = aggregator.buildSnapshot()
    expect(snap.microFrontends[0]?.permissions).toBeUndefined()
    expect(snap.microFrontends[0]?.compatibility).toBeUndefined()
    expect(snap.microFrontends[0]?.isolation).toBeUndefined()
    expect(snap.microFrontends[0]?.fallbackPolicy).toBeUndefined()
  })

  it('permsLookup returns object → field permissions popolato', () => {
    const svc = mockService([{ id: 'mf1', state: 'mounted' }])
    const aggregator = createMfAggregator({
      ringBufferSize: 500,
      mfService: svc,
      permsLookup: (id) => ({ id, capabilities: ['read', 'write'] }),
    })
    const snap = aggregator.buildSnapshot()
    expect(snap.microFrontends[0]?.permissions).toEqual({
      id: 'mf1',
      capabilities: ['read', 'write'],
    })
  })

  it('recordTopic + buildSnapshot → topicsPublished contiene topic', () => {
    const svc = mockService([{ id: 'mf1', state: 'mounted' }])
    const aggregator = createMfAggregator({ ringBufferSize: 500, mfService: svc })
    aggregator.recordTopic('mf1', 'custom.event.published')
    const snap = aggregator.buildSnapshot()
    expect(snap.microFrontends[0]?.topicsPublished).toContain('custom.event.published')
  })

  it('handleEvent senza mfId → no-op (state non creato)', () => {
    const svc = mockService([{ id: 'mf1', state: 'mounted' }])
    const aggregator = createMfAggregator({ ringBufferSize: 500, mfService: svc })
    aggregator.handleEvent('custom.event', { payload: { foo: 'bar' } }) // no id
    expect(aggregator.list()).toEqual([])
  })

  it('buildSnapshot deep-clone (structuredClone) — mutare result NON corrompe state', () => {
    const svc = mockService([{ id: 'mf1', state: 'mounted' }])
    const aggregator = createMfAggregator({ ringBufferSize: 500, mfService: svc })
    aggregator.handleEvent('microfrontend.failed', {
      payload: { id: 'mf1', phase: 'load', message: 'err' },
    })
    const snap1 = aggregator.buildSnapshot()
    ;(snap1.microFrontends[0]?.errors as Array<unknown>).push({ injected: true })
    const snap2 = aggregator.buildSnapshot()
    expect(snap2.microFrontends[0]?.errors.length).toBe(1) // unchanged
  })

  it('clear() svuota state + buffers (list ritorna [])', () => {
    const svc = mockService([{ id: 'mf1', state: 'mounted' }])
    const aggregator = createMfAggregator({ ringBufferSize: 500, mfService: svc })
    aggregator.handleEvent('microfrontend.mounted', { payload: { id: 'mf1' } })
    expect(aggregator.list().length).toBe(1)
    aggregator.clear()
    expect(aggregator.list()).toEqual([])
    expect(aggregator.getRingBuffer('mf1')).toEqual([])
  })

  it('2 MF registrati appaiono entrambi nel snapshot anche se solo 1 ha events', () => {
    const svc = mockService([
      { id: 'mf1', state: 'mounted' },
      { id: 'mf2', state: 'registered' },
    ])
    const aggregator = createMfAggregator({ ringBufferSize: 500, mfService: svc })
    aggregator.handleEvent('microfrontend.mounted', { payload: { id: 'mf1' } })
    const snap = aggregator.buildSnapshot()
    expect(snap.microFrontends.length).toBe(2)
    expect(snap.microFrontends.map((m) => m.id).sort()).toEqual(['mf1', 'mf2'])
  })

  it('timingsLookup popola campo timings nel snapshot', () => {
    const svc = mockService([{ id: 'mf1', state: 'mounted' }])
    const aggregator = createMfAggregator({
      ringBufferSize: 500,
      mfService: svc,
      timingsLookup: (id) => (id === 'mf1' ? { registeredAt: 100, loadedAt: 200 } : undefined),
    })
    const snap = aggregator.buildSnapshot()
    expect(snap.microFrontends[0]?.timings).toEqual({ registeredAt: 100, loadedAt: 200 })
  })

  it('subscription.created → subscriptionsCreated++ + activeSubscriptions++', () => {
    const svc = mockService([{ id: 'mf1', state: 'mounted' }])
    const aggregator = createMfAggregator({ ringBufferSize: 500, mfService: svc })
    aggregator.handleEvent('microfrontend.subscription.created', { payload: { id: 'mf1' } })
    aggregator.handleEvent('microfrontend.subscription.created', { payload: { id: 'mf1' } })
    const snap = aggregator.buildSnapshot()
    expect(snap.microFrontends[0]?.subscriptionsCreated).toBe(2)
  })

  it('subscription.disposed → activeSubscriptions-- (clamp ≥ 0)', () => {
    const svc = mockService([{ id: 'mf1', state: 'mounted' }])
    const aggregator = createMfAggregator({ ringBufferSize: 500, mfService: svc })
    aggregator.handleEvent('microfrontend.subscription.created', { payload: { id: 'mf1' } })
    aggregator.handleEvent('microfrontend.subscription.disposed', { payload: { id: 'mf1' } })
    aggregator.handleEvent('microfrontend.subscription.disposed', { payload: { id: 'mf1' } })
    // Internal state (no external getter for activeSubscriptions but get() exposes)
    const s = aggregator.get('mf1')!
    expect(s.activeSubscriptions).toBe(0) // clamped
    expect(s.subscriptionsCreated).toBe(1)
  })

  it('cleanupResources placeholder vuoto [] (RESEARCH §7.1 RESOLVED)', () => {
    const svc = mockService([{ id: 'mf1', state: 'mounted' }])
    const aggregator = createMfAggregator({ ringBufferSize: 500, mfService: svc })
    aggregator.handleEvent('microfrontend.mounted', { payload: { id: 'mf1' } })
    const snap = aggregator.buildSnapshot()
    expect(snap.microFrontends[0]?.cleanupResources).toEqual([])
  })
})
