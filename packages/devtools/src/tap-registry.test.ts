// tap-registry.test.ts — Tier-1 jsdom test plan 06-04 Task 2.
//
// Verifica:
//   - `createTapRegistry()` API runtime: add/remove/list/getMultiplexed
//     (analog Map registry pattern F5 worker-registry.ts:104-110).
//   - `wrapLegacyTap(config)` auto-wrap F1 single-tap (`runtime.tap`) in array F6
//     `taps[]` per backward-compat zero breaking (D-159).
//
// Threat coverage:
// - T-06-04-03 (Logic flaw auto-wrap perde tap legacy): Test 6 verifica che
//   `runtime.tap + taps[]` coexist post-wrap (entrambi chiamati).
//
// Pattern role-match con `multiplex-tap.test.ts` (consumer di createMultiplexTap
// via registry.getMultiplexed()).

import type { EventTap } from '@sembridge/core'
import { describe, expect, it, vi } from 'vitest'
import { createTapRegistry, type TapHandle, type TapRegistry, wrapLegacyTap } from './tap-registry'

describe('createTapRegistry (D-159 runtime add/remove/list + getMultiplexed)', () => {
  it('Test 1: createTapRegistry() ritorna { add, remove, list, getMultiplexed } — base API', () => {
    const registry = createTapRegistry()
    expect(typeof registry.add).toBe('function')
    expect(typeof registry.remove).toBe('function')
    expect(typeof registry.list).toBe('function')
    expect(typeof registry.getMultiplexed).toBe('function')
    // empty registry → list = []
    expect(registry.list()).toEqual([])
  })

  it('Test 2: registry.add(tap) ritorna handle con id + list() include tap aggiunto', () => {
    const registry: TapRegistry = createTapRegistry()
    const tap: EventTap = { onPipelineStep: vi.fn() }
    const handle = registry.add(tap)
    expect(handle).toBeDefined()
    expect(typeof handle.id).toBe('string')
    expect(handle.id.length).toBeGreaterThan(0)
    expect(registry.list()).toHaveLength(1)
    expect(registry.list()[0]).toBe(tap)
  })

  it('Test 3: registry.remove(handle) rimuove tap + list() count diminuito', () => {
    const registry = createTapRegistry()
    const tap1: EventTap = { onPipelineStep: vi.fn() }
    const tap2: EventTap = { onPipelineStep: vi.fn() }
    const h1 = registry.add(tap1)
    registry.add(tap2)
    expect(registry.list()).toHaveLength(2)
    const removed = registry.remove(h1)
    expect(removed).toBe(true)
    expect(registry.list()).toHaveLength(1)
    expect(registry.list()[0]).toBe(tap2)
    // remove duplicato → false (idempotent)
    expect(registry.remove(h1)).toBe(false)
  })

  it('Test 4: registry.getMultiplexed() ritorna EventTap che invoca tutti i tap registrati (consume createMultiplexTap)', () => {
    const registry = createTapRegistry()
    const tap1: EventTap = { onPipelineStep: vi.fn() }
    const tap2: EventTap = { onPipelineStep: vi.fn() }
    registry.add(tap1)
    registry.add(tap2)
    const multiplexed = registry.getMultiplexed()
    multiplexed.onPipelineStep('event.received', {
      eventId: 'e-1',
      topic: 't.1',
      step: 'event.received',
      timestamp: 1700000000000,
      durationMs: 0.1,
    })
    expect(tap1.onPipelineStep).toHaveBeenCalledTimes(1)
    expect(tap2.onPipelineStep).toHaveBeenCalledTimes(1)
  })

  it('Test 5: handle.id univoco fra add() multipli — nessuna collisione', () => {
    const registry = createTapRegistry()
    const ids = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const h = registry.add({ onPipelineStep: () => {} })
      ids.add(h.id)
    }
    expect(ids.size).toBe(20)
  })
})

describe('wrapLegacyTap (D-159 auto-wrap F1 single-tap backward-compat zero breaking)', () => {
  it('Test 6: auto-wrap solo legacy — { runtime: { tap: legacyTap } } → [legacyTap]', () => {
    const legacyTap: EventTap = { onPipelineStep: vi.fn() }
    const result = wrapLegacyTap({ runtime: { tap: legacyTap } })
    expect(result).toEqual([legacyTap])
    expect(result).toHaveLength(1)
  })

  it('Test 7: auto-wrap + array combine — runtime.tap + taps[tap1, tap2] → [tap1, tap2, legacyTap] (legacy at END)', () => {
    const tap1: EventTap = { onPipelineStep: vi.fn() }
    const tap2: EventTap = { onPipelineStep: vi.fn() }
    const legacyTap: EventTap = { onPipelineStep: vi.fn() }
    const result = wrapLegacyTap({
      runtime: { tap: legacyTap },
      taps: [tap1, tap2],
    })
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(tap1)
    expect(result[1]).toBe(tap2)
    expect(result[2]).toBe(legacyTap)
  })

  it('Test 8: auto-wrap solo array — { taps: [tap1] } → [tap1] (no legacy presente)', () => {
    const tap1: EventTap = { onPipelineStep: vi.fn() }
    const result = wrapLegacyTap({ taps: [tap1] })
    expect(result).toEqual([tap1])
  })

  it('Test 9: auto-wrap entrambi vuoti — {} → []', () => {
    const result = wrapLegacyTap({})
    expect(result).toEqual([])
  })

  it('Test 10: auto-wrap runtime senza tap — { runtime: {} } → []', () => {
    const result = wrapLegacyTap({ runtime: {} })
    expect(result).toEqual([])
  })
})
