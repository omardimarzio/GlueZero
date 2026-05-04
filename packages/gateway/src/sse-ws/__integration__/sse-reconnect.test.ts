// sse-reconnect.test.ts — TEST-02 + RT-07 + RESEARCH §3.2 (Last-Event-ID via query string).
//
// Scenario D-119 #1 — SSE reconnect lifecycle:
//   1. Connect SSE channel → open → push 1 event
//   2. Trigger error (server reboot simulato) → adapter publica
//      `system.realtime.disconnected` con reason 'eventsource.error'
//
// **Last-Event-ID query string** (RESEARCH §3.2 / D-105 — chiusura RT-07): l'adapter
// memorizza `lastEventId` su `MessageEvent.lastEventId`. Al re-connect, inietta via
// `?lastEventId=<id>` (vincolo D-105 no header custom). Test full round-trip in
// `msw-sse-replay.test.ts` (Tier-2).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRealtimeHarness, type RealtimeHarness } from '../test-utils/realtime-harness'

describe('SSE reconnect lifecycle (TEST-02 + RT-07 + D-105)', () => {
  let h: RealtimeHarness

  beforeEach(() => {
    h = createRealtimeHarness()
  })

  afterEach(() => {
    h.reset()
  })

  it('Scenario D-119 #1: SSE → 1 evento → error → publish system.realtime.disconnected', async () => {
    await h.broker.connectRealtime({
      name: 'orders',
      mode: 'sse',
      url: 'http://x/?_channel=orders',
    })
    h.openChannel('orders')

    // Verifica system.realtime.connected pubblicato all'open.
    await h.flushAsync(10)
    const connected = h.events.find((e) => e.topic === 'system.realtime.connected')
    expect(connected).toBeDefined()
    expect((connected!.payload as { channel?: string }).channel).toBe('orders')

    // Push un evento applicativo.
    h.pushSseEvent('orders', '{"value":1}', 'evt-1', 'message')
    await h.flushAsync(10)

    const ordersEvent = h.events.find((e) => e.topic === 'orders')
    expect(ordersEvent).toBeDefined()
    expect(ordersEvent!.payload).toEqual({ value: 1 })

    // Server reboot simulato — error event-side.
    h.errorChannel('orders')
    await h.flushAsync(10)

    const disconnected = h.events.find((e) => e.topic === 'system.realtime.disconnected')
    expect(disconnected).toBeDefined()
    expect((disconnected!.payload as { reason?: string }).reason).toBe('eventsource.error')
  })
})
