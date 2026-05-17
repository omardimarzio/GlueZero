// snapshot-providers.test.ts — Tier-1 jsdom unit per F16 W1 P01 MIN-3 Registry.
//
// 7 test it() blocks:
//   - registry vuoto → collect() empty + size() === 0
//   - register/collect single provider → name-keyed output
//   - register idempotent (overwrite same name) — D-V2-F16-01
//   - unregister true/false su present/absent name
//   - provider throw → skip silenzioso, altri provider integri
//   - sync invocation a ogni collect() — D-V2-F16-03 (no caching)
//   - multi-provider name-keyed merge — D-V2-F16-02
//
// Pattern carryover: cardinality-cap.test.ts (closure factory unit pattern).

import { describe, expect, it, vi } from 'vitest'
import { createSnapshotProviderRegistry } from './snapshot-providers'

describe('createSnapshotProviderRegistry (W1 P01 — MIN-3)', () => {
  it('Test 1: registry vuoto → collect() ritorna {} e size() === 0', () => {
    const reg = createSnapshotProviderRegistry()
    expect(reg.size()).toBe(0)
    expect(reg.collect()).toEqual({})
  })

  it("Test 2: register('mf', () => ({a:1})) + collect() ritorna {mf:{a:1}} e size() === 1", () => {
    const reg = createSnapshotProviderRegistry()
    reg.register('mf', () => ({ a: 1 }))
    expect(reg.size()).toBe(1)
    expect(reg.collect()).toEqual({ mf: { a: 1 } })
  })

  it('Test 3: register stesso name due volte → overwrite idempotent (D-V2-F16-01)', () => {
    const reg = createSnapshotProviderRegistry()
    reg.register('mf', () => ({ v: 'first' }))
    reg.register('mf', () => ({ v: 'second' }))
    expect(reg.size()).toBe(1)
    expect(reg.collect()).toEqual({ mf: { v: 'second' } })
  })

  it("Test 4: unregister('mf') ritorna true + size===0; unregister('absent') ritorna false", () => {
    const reg = createSnapshotProviderRegistry()
    reg.register('mf', () => ({}))
    expect(reg.unregister('mf')).toBe(true)
    expect(reg.size()).toBe(0)
    expect(reg.unregister('absent')).toBe(false)
  })

  it('Test 5: provider che throws → collect() skip silenzioso + altri provider integri', () => {
    const reg = createSnapshotProviderRegistry()
    reg.register('broken', () => {
      throw new Error('boom')
    })
    reg.register('ok', () => ({ value: 1 }))
    const out = reg.collect()
    expect(out).toEqual({ ok: { value: 1 } })
    expect(out).not.toHaveProperty('broken')
  })

  it('Test 6: sync invocation a ogni collect() — D-V2-F16-03 (no caching)', () => {
    const reg = createSnapshotProviderRegistry()
    const fn = vi.fn(() => ({ ts: Date.now() }))
    reg.register('mf', fn)
    reg.collect()
    reg.collect()
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('Test 7: multi-provider name-keyed merge — D-V2-F16-02', () => {
    const reg = createSnapshotProviderRegistry()
    reg.register('mf', () => ({ kind: 'mf' }))
    reg.register('theme', () => ({ kind: 'theme' }))
    reg.register('audit', () => ({ kind: 'audit' }))
    expect(reg.size()).toBe(3)
    expect(reg.collect()).toEqual({
      mf: { kind: 'mf' },
      theme: { kind: 'theme' },
      audit: { kind: 'audit' },
    })
  })
})
