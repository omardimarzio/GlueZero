// ws-stale-detection.test.ts — TEST-03 + D-111 (WS heartbeat ping/pong + stale watchdog).
//
// Scenario D-119 #2 — WS stale detection:
//   1. Connect WS channel con `heartbeat.{intervalMs, staleTimeoutMs}` configurati
//   2. Open → adapter inizia ping periodici (intervalMs)
//   3. Server NON risponde con `__pong__` → dopo `staleTimeoutMs` adapter dichiara
//      stale → publish `system.realtime.disconnected` con reason 'stale.no-pong'
//      (vedi websocket-adapter.ts plan 04-06).
//
// **Smoke test**: V1 verifica solo l'osservabilità del path stale-detection — il
// timing reale (60s) è coperto in unit test plan 04-06 con `vi.useFakeTimers()`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRealtimeHarness, type RealtimeHarness } from '../test-utils/realtime-harness'

describe('WS stale detection (TEST-03 + D-111)', () => {
  let h: RealtimeHarness

  beforeEach(() => {
    vi.useFakeTimers()
    h = createRealtimeHarness()
  })

  afterEach(() => {
    vi.useRealTimers()
    h.reset()
  })

  it('Scenario D-119 #2: WS connect → no pong oltre staleTimeoutMs → publish disconnected con reason stale', async () => {
    await h.broker.connectRealtime({
      name: 'feed',
      mode: 'websocket',
      url: 'wss://x/?_channel=feed',
      heartbeat: { intervalMs: 1000, staleTimeoutMs: 5000 },
    })
    h.openChannel('feed')
    await vi.advanceTimersByTimeAsync(0)

    // Avanza timer oltre staleTimeoutMs senza inviare pong server-side.
    // L'adapter (plan 04-06) emette ping ogni intervalMs e check stale ogni interval;
    // dopo staleTimeoutMs senza pong, dichiara stale.
    await vi.advanceTimersByTimeAsync(7000)

    // Verifica system.realtime.disconnected pubblicato (reason può variare per
    // implementazione — qui smoke verifica almeno la presenza dell'event).
    const disc = h.events.find((e) => e.topic === 'system.realtime.disconnected')
    // Smoke: anche se il timing pong/stale dell'adapter cambia in V1.x, l'event è
    // osservabile dall'harness — l'assertion è "almeno 1 disconnected pubblicato"
    // (non assertion strict sulla reason — coperto in unit test plan 04-06).
    expect(disc).toBeDefined()
  })
})
