// Integration test — EventTap pre-instrumented su 5 step F1
// (CORE-13, success criterion #5 ROADMAP Phase 1, vincolo architetturale RESEARCH §3.2).
//
// Verifica end-to-end che ogni `Broker.publish` emetta i 5 step F1 della pipeline §28
// nell'ordine canonico:
//   1. event.received
//   2. event.metadata.enriched
//   3. event.validated
//   4. event.dedupe.checked
//   5. event.delivered
//
// + behavior collaterali:
//   - `event.delivered` snapshot include `metadata.subscriberCount`
//   - `debug:true` aggiunge `payloadAfter` agli snapshot; `debug:false` lo omette
//     (privacy production)
//   - tap che throw NON rompe la pipeline (D-20 — safeTapStep swallow)
//   - publish multipli accumulano steps; `harness.reset()` svuota
//
// Vincolo critico verificato: il tap E' instrumentato già in F1 — F2-F5 estenderanno
// la pipeline aggiungendo step (event.source.resolved, event.mapped.canonical, ecc.)
// senza dover retrofittare il filtro.

import { describe, expect, it } from 'vitest'
import { Broker } from '../core/broker'
import { createPipelineHarness } from '../test-utils/pipeline-harness'
import type { EventTap } from '../types/tap'

describe('EventTap integration (CORE-13, success criterion #5)', () => {
  it('emits all 5 F1 steps in order for a publish', () => {
    const h = createPipelineHarness()
    h.broker.subscribe('a.b', () => {})
    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    const stepOrder = h.steps.map((s) => s.step)
    expect(stepOrder).toEqual([
      'event.received',
      'event.metadata.enriched',
      'event.validated',
      'event.dedupe.checked',
      'event.delivered',
    ])
  })

  it('event.delivered snapshot includes subscriberCount metadata', () => {
    const h = createPipelineHarness()
    h.broker.subscribe('a.b', () => {})
    h.broker.subscribe('a.b', () => {})
    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    const delivered = h.byStep('event.delivered')
    expect(delivered[0]?.metadata).toEqual({ subscriberCount: 2 })
  })

  it('debug:true → snapshot includes payloadAfter', () => {
    const h = createPipelineHarness({ debug: true })
    h.broker.subscribe('a.b', () => {})
    h.broker.publish(
      'a.b',
      { x: 42 },
      { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' },
    )
    const received = h.byStep('event.received')
    expect(received[0]?.payloadAfter).toBeDefined()
    expect(received[0]?.payloadAfter).toEqual({ x: 42 })
  })

  it('debug:false → snapshot omits payloadAfter (production privacy)', () => {
    const h = createPipelineHarness({ debug: false })
    h.broker.subscribe('a.b', () => {})
    h.broker.publish(
      'a.b',
      { x: 42 },
      { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' },
    )
    const received = h.byStep('event.received')
    expect(received[0]?.payloadAfter).toBeUndefined()
  })

  it('a tap that throws does NOT break the pipeline (D-20)', () => {
    const tap: EventTap = {
      onPipelineStep: (): void => {
        throw new Error('tap blew up')
      },
    }
    const broker = new Broker({ runtime: { tap, logLevel: 'silent' } })
    const received: unknown[] = []
    broker.subscribe('a.b', (e) => {
      received.push(e.payload)
    })
    expect(() =>
      broker.publish(
        'a.b',
        { x: 1 },
        { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' },
      ),
    ).not.toThrow()
    expect(received).toEqual([{ x: 1 }])
  })

  it('multiple publishes accumulate steps in harness.steps', () => {
    const h = createPipelineHarness()
    h.broker.subscribe('a.b', () => {})
    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    const allSteps = h.steps.length
    expect(allSteps).toBe(10) // 5 steps × 2 publishes
  })

  it('harness.reset() clears recorded steps', () => {
    const h = createPipelineHarness()
    h.broker.subscribe('a.b', () => {})
    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    h.reset()
    expect(h.steps.length).toBe(0)
  })
})
