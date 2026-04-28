// Integration test — Deep-freeze enforcement (D-04, D-05, T-07-04 mitigation).
//
// Verifica end-to-end che in `debug:true` (dev mode) il subscriber che tenta di
// mutare il payload riceva un TypeError (Object.freeze applicato deeply prima
// del delivery — bus.ts.freezeForDelivery).
//
// In `debug:false` (production) il deep-freeze NON viene applicato (D-05 perf
// trade-off): la mutation success (no TypeError) — l'enforcement type-level
// `DeepReadonly<TPayload>` resta come compile-time guard.
//
// + edge case:
//   - Nested object mutation throws (deepFreeze ricorsivo)
//   - enableDebug() runtime toggle attiva il freeze su publish successivi

import { describe, expect, it } from 'vitest'
import { createPipelineHarness } from '../test-utils/pipeline-harness'
import type { BrokerEvent } from '../types/broker-event'

describe('Deep-freeze enforcement (D-04, D-05)', () => {
  it('debug:true → subscriber attempting to mutate payload throws TypeError', () => {
    const h = createPipelineHarness({ debug: true })
    let mutationError: unknown = null
    h.broker.subscribe('a.b', (e: BrokerEvent<{ x: number }>) => {
      try {
        ;(e.payload as { x: number }).x = 999
      } catch (err) {
        mutationError = err
      }
    })
    h.broker.publish('a.b', { x: 1 }, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    expect(mutationError).toBeInstanceOf(TypeError)
  })

  it('debug:false → mutation silently succeeds (production performance, type-level only enforcement)', () => {
    const h = createPipelineHarness({ debug: false })
    let mutated = false
    h.broker.subscribe('a.b', (e: BrokerEvent<{ x: number }>) => {
      try {
        ;(e.payload as { x: number }).x = 999
        mutated = true
      } catch {
        // unexpected in non-debug mode — non avviene perche' il payload non e' frozen
      }
    })
    h.broker.publish('a.b', { x: 1 }, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    expect(mutated).toBe(true)
  })

  it('debug:true → nested object mutation also throws', () => {
    const h = createPipelineHarness({ debug: true })
    let mutationError: unknown = null
    h.broker.subscribe('a.b', (e: BrokerEvent<{ nested: { y: number } }>) => {
      try {
        ;(e.payload as { nested: { y: number } }).nested.y = 999
      } catch (err) {
        mutationError = err
      }
    })
    h.broker.publish(
      'a.b',
      { nested: { y: 1 } },
      { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' },
    )
    expect(mutationError).toBeInstanceOf(TypeError)
  })

  it('toggling enableDebug after creation freezes subsequent payloads', () => {
    const h = createPipelineHarness({ debug: false })
    h.broker.enableDebug()
    let mutationError: unknown = null
    h.broker.subscribe('a.b', (e: BrokerEvent<{ x: number }>) => {
      try {
        ;(e.payload as { x: number }).x = 999
      } catch (err) {
        mutationError = err
      }
    })
    h.broker.publish('a.b', { x: 1 }, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    expect(mutationError).toBeInstanceOf(TypeError)
  })
})
