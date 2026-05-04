// cascade-cleanup.test.ts — TEST-01 + LIFE-02 ext F4 + D-112 (cascade cleanup).
//
// Scenario D-119 #5 — cascade cleanup on plugin unregister:
//   1. Registra 5 plugin con realtimeChannels distinti
//   2. unregisterPlugin('p3') → manager.disconnectByOwner('p3') chiude SOLO il canale di p3
//   3. Gli altri 4 plugin + canali rimangono attivi
//
// **D-112 chain**: estende D-86 di F3 (cascade routes/http abort + F2 + F1 unsub) con
// cleanup canali realtime registrati dal plugin. Pattern try/catch isolato in
// `RealtimeBroker.unregisterPlugin` (plan 04-08).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRealtimeHarness, type RealtimeHarness } from '../test-utils/realtime-harness'

describe('Cascade cleanup F4 (TEST-01 + LIFE-02 ext + D-112)', () => {
  let h: RealtimeHarness

  beforeEach(() => {
    h = createRealtimeHarness()
  })

  afterEach(() => {
    h.reset()
  })

  it('Scenario D-119 #5: 5 plugin con realtimeChannels → unregisterPlugin di p3 → solo p3 chiuso', async () => {
    for (const pid of ['p1', 'p2', 'p3', 'p4', 'p5']) {
      await h.broker.registerPlugin({
        id: pid,
        realtimeChannels: [
          {
            name: `${pid}.feed`,
            mode: 'sse',
            url: `http://x/?_channel=${pid}.feed`,
          },
        ],
      })
    }

    expect(h.broker.getDebugSnapshot().realtime.channelCount).toBe(5)

    await h.broker.unregisterPlugin('p3')

    const snap = h.broker.getDebugSnapshot()
    expect(snap.realtime.channelCount).toBe(4)
    expect(snap.realtime.channels.find((c) => c.name === 'p3.feed')).toBeUndefined()

    // Verifica che gli altri 4 siano ancora registrati con loro ownerId.
    const remainingOwners = snap.realtime.channels.map((c) => c.ownerId).sort()
    expect(remainingOwners).toEqual(['p1', 'p2', 'p4', 'p5'])
  })

  it('D-112 idempotency: unregisterPlugin senza realtimeChannels — nessuna eccezione, snapshot invariato', async () => {
    await h.broker.connectRealtime({
      name: 'system-ch',
      mode: 'sse',
      url: 'http://x/?_channel=system-ch',
    })
    await h.broker.registerPlugin({ id: 'no-channels' })
    expect(h.broker.getDebugSnapshot().realtime.channelCount).toBe(1)

    await expect(h.broker.unregisterPlugin('no-channels')).resolves.toBeUndefined()
    expect(h.broker.getDebugSnapshot().realtime.channelCount).toBe(1)
  })
})
