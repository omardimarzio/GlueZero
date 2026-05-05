// inspector-snapshot.test.ts — Tier-1 jsdom integration test plan 06-08b Wave 4b.
//
// Verifica end-to-end via createDevtoolsBroker:
// - Inspector capture publish events (ring buffer popolato)
// - getDebugSnapshot deep-clone immutability (D-162)
// - mutation safety (T-06-08b-02 mitigation)

import { describe, expect, it } from 'vitest'
import { createDevtoolsBroker } from '../public-factory'

function flushAsync(): Promise<void> {
  return new Promise((r) => setTimeout(r, 10))
}

describe('inspector-snapshot integration — D-162 deep-clone + ring buffer capture', () => {
  it('Test 1: Inspector capture multiple publish — ring buffer popolato', async () => {
    const broker = createDevtoolsBroker({})
    broker.subscribe('cap.topic', () => {})
    for (let i = 0; i < 5; i++) {
      broker.publish('cap.topic', { v: i }, {
        source: { type: 'plugin', id: 'app' },
      } as never)
    }
    await flushAsync()

    const snap = broker.getDebugSnapshot()
    expect(snap.recentEvents.length).toBeGreaterThan(0)
  })

  it('Test 2: deep-clone D-162 — mutazione snapshot NON corrompe state interno', async () => {
    const broker = createDevtoolsBroker({})
    broker.subscribe('mut.topic', () => {})
    broker.publish('mut.topic', { v: 1 }, {
      source: { type: 'plugin', id: 'app' },
    } as never)
    await flushAsync()

    const s1 = broker.getDebugSnapshot()
    // Tentativo di iniezione (cast a mutable per il test)
    ;(s1 as { recentEvents: unknown[] }).recentEvents.push({ injected: true } as never)

    const s2 = broker.getDebugSnapshot()
    // s2.recentEvents NON contiene l'iniezione — state interno intatto
    expect(
      (s2.recentEvents as readonly { injected?: boolean }[]).some((e) => e.injected === true),
    ).toBe(false)
  })

  it('Test 3: snapshot shape stabile { recentEvents, recentRoutes, currentMetrics, pausedTopics, enabled }', () => {
    const broker = createDevtoolsBroker({})
    const s = broker.getDebugSnapshot()
    expect(typeof s.enabled).toBe('boolean')
    expect(Array.isArray(s.recentEvents)).toBe(true)
    expect(Array.isArray(s.recentRoutes)).toBe(true)
    expect(Array.isArray(s.pausedTopics)).toBe(true)
    expect(s.currentMetrics).toBeDefined()
    expect(s.currentMetrics.counters).toBeDefined()
    expect(s.currentMetrics.gauges).toBeDefined()
    expect(s.currentMetrics.histograms).toBeDefined()
  })
})
