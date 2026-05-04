// visibility-aware.test.ts — D-110 + RESEARCH §5.2 (Visibility API integration).
//
// Scenario D-119 #4 — visibility-aware freshness check:
//   1. Connect SSE channel (lazy init VisibilityDetector — D-110 + plan 04-04/04-07)
//   2. Dispatch `visibilitychange` event con state='visible' su `document`
//   3. Manager invoca `checkFreshnessAll()` su tutti i canali registrati (no crash)
//
// **Smoke test V1**: l'integrazione full Visibility API end-to-end (`document.hidden`
// transition + reconnect immediato) è coperta in unit test plan 04-04
// (visibility-detector.test.ts) + plan 04-07 (realtime-channel-manager.test.ts).
// Qui verifichiamo solo che il broker sopravviva a un visibilitychange dispatch
// con almeno 1 canale registrato (smoke).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRealtimeHarness, type RealtimeHarness } from '../test-utils/realtime-harness'

describe('Visibility-aware freshness check (D-110 + RESEARCH §5.2)', () => {
  let h: RealtimeHarness

  beforeEach(() => {
    h = createRealtimeHarness()
  })

  afterEach(() => {
    h.reset()
  })

  it('Scenario D-119 #4: visibilitychange dispatch → checkFreshnessAll non crasha', async () => {
    await h.broker.connectRealtime({
      name: 'feed',
      mode: 'sse',
      url: 'http://x/?_channel=feed',
    })
    h.openChannel('feed')
    await h.flushAsync(10)

    // Dispatch visibilitychange su document (jsdom).
    if (typeof document !== 'undefined') {
      const ev = new Event('visibilitychange')
      document.dispatchEvent(ev)
    }
    await h.flushAsync(10)

    // Smoke: nessun crash + canale ancora registrato.
    const snap = h.broker.getDebugSnapshot()
    expect(snap.realtime.channelCount).toBe(1)
    expect(snap.realtime.channels[0]!.name).toBe('feed')
  })

  it('Scenario D-110 lazy init: visibility detector attivo dopo primo connect, teardown all\'ultimo disconnect', async () => {
    expect(h.broker.getDebugSnapshot().realtime.visibilityActive).toBe(false)

    await h.broker.connectRealtime({
      name: 'a',
      mode: 'sse',
      url: 'http://x/?_channel=a',
    })
    expect(h.broker.getDebugSnapshot().realtime.visibilityActive).toBe(true)

    h.broker.disconnectRealtime('a')
    expect(h.broker.getDebugSnapshot().realtime.visibilityActive).toBe(false)
  })
})
