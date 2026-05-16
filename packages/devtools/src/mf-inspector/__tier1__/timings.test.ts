/**
 * Tier-1 jsdom unit test per `createTimingsCollector` (D-V2-F16-09).
 *
 * Copre: tutti 11 topic → 11 field, first-write-wins, non-lifecycle skip,
 * mfId unknown ritorna undefined, clear.
 */
import { describe, expect, it } from 'vitest'
import { createTimingsCollector } from '../timings'

describe('createTimingsCollector (D-V2-F16-09 — 11 topic mapping)', () => {
  it('microfrontend.registered → registeredAt', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.registered', 100)
    expect(t.get('mf1')?.registeredAt).toBe(100)
  })

  it('microfrontend.loading → loadStartedAt', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.loading', 200)
    expect(t.get('mf1')?.loadStartedAt).toBe(200)
  })

  it('microfrontend.loaded → loadedAt', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.loaded', 300)
    expect(t.get('mf1')?.loadedAt).toBe(300)
  })

  it('microfrontend.bootstrapping → bootstrapStartedAt', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.bootstrapping', 400)
    expect(t.get('mf1')?.bootstrapStartedAt).toBe(400)
  })

  it('microfrontend.bootstrapped → bootstrappedAt', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.bootstrapped', 500)
    expect(t.get('mf1')?.bootstrappedAt).toBe(500)
  })

  it('microfrontend.mounting → mountStartedAt', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.mounting', 600)
    expect(t.get('mf1')?.mountStartedAt).toBe(600)
  })

  it('microfrontend.mounted → mountedAt', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.mounted', 700)
    expect(t.get('mf1')?.mountedAt).toBe(700)
  })

  it('microfrontend.unmounting → unmountStartedAt', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.unmounting', 800)
    expect(t.get('mf1')?.unmountStartedAt).toBe(800)
  })

  it('microfrontend.unmounted → unmountedAt', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.unmounted', 900)
    expect(t.get('mf1')?.unmountedAt).toBe(900)
  })

  it('microfrontend.destroying → destroyStartedAt', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.destroying', 1000)
    expect(t.get('mf1')?.destroyStartedAt).toBe(1000)
  })

  it('microfrontend.destroyed → destroyedAt', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.destroyed', 1100)
    expect(t.get('mf1')?.destroyedAt).toBe(1100)
  })

  it('first-write-wins — re-emit NON sovrascrive (D-V2-F16-09)', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.loading', 100)
    t.recordIfLifecycle('mf1', 'microfrontend.loading', 200) // ignored
    expect(t.get('mf1')?.loadStartedAt).toBe(100)
  })

  it('topic non-lifecycle skip (no field popolato)', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.failed', 100)
    t.recordIfLifecycle('mf1', 'custom.event', 200)
    expect(t.get('mf1')).toBeUndefined()
  })

  it('get(mfId) ritorna undefined per mfId mai osservato', () => {
    const t = createTimingsCollector()
    expect(t.get('unknown')).toBeUndefined()
  })

  it('clear() svuota tutto lo state', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.registered', 100)
    t.recordIfLifecycle('mf2', 'microfrontend.registered', 200)
    t.clear()
    expect(t.get('mf1')).toBeUndefined()
    expect(t.get('mf2')).toBeUndefined()
  })

  it('isolamento per-MF — timing di mf1 non interferisce con mf2', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.registered', 100)
    t.recordIfLifecycle('mf2', 'microfrontend.registered', 200)
    expect(t.get('mf1')?.registeredAt).toBe(100)
    expect(t.get('mf2')?.registeredAt).toBe(200)
  })

  it('get ritorna deep-clone (mutare NON corrompe state)', () => {
    const t = createTimingsCollector()
    t.recordIfLifecycle('mf1', 'microfrontend.registered', 100)
    const out = t.get('mf1')!
    out.registeredAt = 999
    expect(t.get('mf1')?.registeredAt).toBe(100)
  })
})
