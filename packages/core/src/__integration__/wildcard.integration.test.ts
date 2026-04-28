// Integration test — Wildcard subscribe (CORE-09, success criterion #4 ROADMAP Phase 1).
//
// Verifica end-to-end i 4 pattern wildcard del PRD §12.3 + decisione D-11
// (`*` può comparire in posizione qualsiasi, non solo finale):
//   - `weather.*`        → matcha topic con prefisso entity (D-10 full-segment wildcard)
//   - `*.failed`         → matcha topic con suffix action (D-10)
//   - `weather.*.failed` → matcha pattern intermedio (D-11 multi-position)
//   - `form.customer.*`  → matcha topic con prefisso 2-segment
//
// Coverage aggiuntiva: subscriber esatto + subscriber wildcard sullo stesso
// topic vengono entrambi invocati (no shadowing).

import { describe, expect, it, vi } from 'vitest'
import { createPipelineHarness } from '../test-utils/pipeline-harness'

describe('Wildcard subscribe (CORE-09, success criterion #4)', () => {
  it('weather.* receives weather.requested AND weather.loaded', () => {
    const h = createPipelineHarness()
    const handler = vi.fn()
    h.broker.subscribe('weather.*', handler)
    h.broker.publish(
      'weather.requested',
      { x: 1 },
      { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' },
    )
    h.broker.publish(
      'weather.loaded',
      { y: 2 },
      { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' },
    )
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('*.failed receives weather.failed AND auth.failed', () => {
    const h = createPipelineHarness()
    const handler = vi.fn()
    h.broker.subscribe('*.failed', handler)
    h.broker.publish(
      'weather.failed',
      {},
      { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' },
    )
    h.broker.publish(
      'auth.failed',
      {},
      { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' },
    )
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('weather.*.failed receives weather.alert.failed AND weather.danger.failed (D-11 multi-position)', () => {
    const h = createPipelineHarness()
    const handler = vi.fn()
    h.broker.subscribe('weather.*.failed', handler)
    h.broker.publish(
      'weather.alert.failed',
      {},
      { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' },
    )
    h.broker.publish(
      'weather.danger.failed',
      {},
      { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' },
    )
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('form.customer.* receives nested topics', () => {
    const h = createPipelineHarness()
    const handler = vi.fn()
    h.broker.subscribe('form.customer.*', handler)
    h.broker.publish(
      'form.customer.submit',
      {},
      { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' },
    )
    h.broker.publish(
      'form.customer.cancel',
      {},
      { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' },
    )
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('exact + wildcard subscribers both invoked for matching topic', () => {
    const h = createPipelineHarness()
    const exact = vi.fn()
    const wild = vi.fn()
    h.broker.subscribe('weather.requested', exact)
    h.broker.subscribe('weather.*', wild)
    h.broker.publish(
      'weather.requested',
      {},
      { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' },
    )
    expect(exact).toHaveBeenCalledTimes(1)
    expect(wild).toHaveBeenCalledTimes(1)
  })
})
