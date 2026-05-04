// backpressure-storm.test.ts — TEST-03 + D-115 + PITFALL §11.5 (queue-bounded drop policy).
//
// Scenario D-119 #6 — backpressure storm:
//   1. Connect SSE channel
//   2. Push 1000 eventi rapidi (smoke — il "10K eventi/sec" del CONTEXT è lo stress
//      target; 1000 è sufficiente come Tier-1 jsdom smoke)
//   3. Verifica broker non crasha + eventi processati (subset accettabile per drop policy)
//
// **D-115 reuse F3**: backpressure adapter-level (per-canale opt-in via `def.backpressure`).
// Senza config, V1 default è no-throttling (publish sincrono via publishFn). Lo smoke
// V1 verifica solo che il broker sopravviva al volume.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRealtimeHarness, type RealtimeHarness } from '../test-utils/realtime-harness'

describe('Backpressure storm (TEST-03 + D-115 + PITFALL §11.5)', () => {
  let h: RealtimeHarness

  beforeEach(() => {
    h = createRealtimeHarness()
  })

  afterEach(() => {
    h.reset()
  })

  it('Scenario D-119 #6: 1000 eventi rapidi (smoke) — broker non crash, eventi processati', async () => {
    await h.broker.connectRealtime({
      name: 'storm',
      mode: 'sse',
      url: 'http://x/?_channel=storm',
    })
    h.openChannel('storm')
    await h.flushAsync(10)

    for (let i = 0; i < 1000; i++) {
      h.pushSseEvent('storm', `{"i":${i}}`, `evt-${i}`, 'message')
    }
    await h.flushAsync(50)

    // Smoke: il broker non deve crashare. events array popolato (anche se subset
    // per backpressure drop V1.x se config attivata).
    expect(h.events.length).toBeGreaterThan(0)
    // Snapshot canale ancora attivo dopo lo storm.
    expect(h.broker.getDebugSnapshot().realtime.channelCount).toBe(1)
  })
})
