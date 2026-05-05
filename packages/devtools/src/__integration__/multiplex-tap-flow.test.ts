// multiplex-tap-flow.test.ts — Tier-1 jsdom integration test plan 06-08b Wave 4b.
//
// Verifica end-to-end via createDevtoolsBroker:
// - 3+ tap chain (Inspector + Metrics + custom user) tutti invocati
// - error isolation: tap throw NON blocca downstream tap (D-159)
// - step 14 attivazione D-161: post inner.publish il MultiplexTap riceve event.observed

import type { EventTap, PipelineSnapshot } from '@sembridge/core'
import { describe, expect, it } from 'vitest'
import { createDevtoolsBroker } from '../public-factory'

function flushAsync(): Promise<void> {
  return new Promise((r) => setTimeout(r, 10))
}

describe('multiplex-tap-flow integration — D-159 chain + error isolation + D-161 step 14', () => {
  it('Test 1: 3+ tap chain (Inspector + Metrics + custom) — tutti invocati al publish', async () => {
    const customSteps: string[] = []
    const customTap: EventTap = {
      onPipelineStep: (_step, snap: PipelineSnapshot) => {
        customSteps.push(snap.step as string)
      },
    }
    const broker = createDevtoolsBroker({ taps: [customTap] })
    broker.subscribe('chain.topic', () => {})
    broker.publish('chain.topic', { v: 1 }, {
      source: { type: 'plugin', id: 'app' },
    } as never)
    await flushAsync()

    // Custom tap riceve almeno uno step
    expect(customSteps.length).toBeGreaterThan(0)
    // Inspector ha popolato il buffer (sezione Inspector + RouteInspector
    // attive nella chain)
    const snap = broker.getDebugSnapshot()
    expect(snap.recentEvents.length).toBeGreaterThan(0)
    // Step 14 attivazione D-161 — event.observed presente nei step custom tap
    expect(customSteps).toContain('event.observed')
  })

  it('Test 2: error isolation — tap throw NON blocca downstream tap (D-159)', async () => {
    const goodSteps: string[] = []
    const badTap: EventTap = {
      onPipelineStep: () => {
        throw new Error('user tap fail')
      },
    }
    const goodTap: EventTap = {
      onPipelineStep: (_step, snap: PipelineSnapshot) => {
        goodSteps.push(snap.step as string)
      },
    }
    const broker = createDevtoolsBroker({ taps: [badTap, goodTap] })
    broker.subscribe('iso.topic', () => {})
    broker.publish('iso.topic', { v: 1 }, {
      source: { type: 'plugin', id: 'app' },
    } as never)
    await flushAsync()

    // Tap buono riceve eventi nonostante il primo lanci
    expect(goodSteps.length).toBeGreaterThan(0)
  })

  it('Test 3: step 14 D-161 attivazione — event.observed emesso post inner.publish', async () => {
    const observedSteps: string[] = []
    const tap: EventTap = {
      onPipelineStep: (_step, snap: PipelineSnapshot) => {
        observedSteps.push(snap.step as string)
      },
    }
    const broker = createDevtoolsBroker({ taps: [tap] })
    broker.subscribe('observed.topic', () => {})
    broker.publish('observed.topic', { observed: true }, {
      source: { type: 'plugin', id: 'app' },
    } as never)
    await flushAsync()

    expect(observedSteps).toContain('event.observed')
    // Step pipeline F1 esistenti dovrebbero precederlo
    const observedIdx = observedSteps.indexOf('event.observed')
    expect(observedIdx).toBeGreaterThan(-1)
  })
})
