// multi-channel-routing.test.ts — B-2 closure smoke (Tier-1 jsdom).
//
// Scenario: due canali SSE simultanei ('a' e 'b') devono pubblicare ai SUBSCRIBER
// rispettivi senza cross-pollution. La harness usa `byChannelName` Map (B-NEW-2 fix iter 2)
// per routing strict — niente fallback "ultima istanza" pre-fix B-2.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRealtimeHarness, type RealtimeHarness } from '../test-utils/realtime-harness'

describe('Multi-channel routing harness (B-2 closure)', () => {
  let h: RealtimeHarness

  beforeEach(() => {
    h = createRealtimeHarness()
  })

  afterEach(() => {
    h.reset()
  })

  it('B-2 closure: pushSseEvent("a", ...) raggiunge SOLO subscriber del canale "a"', async () => {
    await h.broker.connectRealtime({
      name: 'a',
      mode: 'sse',
      url: 'http://x/?_channel=a',
    })
    await h.broker.connectRealtime({
      name: 'b',
      mode: 'sse',
      url: 'http://x/?_channel=b',
    })
    h.openChannel('a')
    h.openChannel('b')

    const aEvents: unknown[] = []
    const bEvents: unknown[] = []
    h.broker.subscribe('a', (ev: { payload: unknown }) => aEvents.push(ev.payload))
    h.broker.subscribe('b', (ev: { payload: unknown }) => bEvents.push(ev.payload))

    h.pushSseEvent('a', '{"x":1}', 'evt-1', 'message')
    await h.flushAsync(10)

    expect(aEvents.length).toBe(1)
    expect(aEvents[0]).toEqual({ x: 1 })
    expect(bEvents.length).toBe(0)

    h.pushSseEvent('b', '{"y":2}', 'evt-2', 'message')
    await h.flushAsync(10)

    expect(bEvents.length).toBe(1)
    expect(bEvents[0]).toEqual({ y: 2 })
    // 'a' subscriber non ha ricevuto altri eventi (no cross-pollution).
    expect(aEvents.length).toBe(1)
  })

  it('B-2 closure: throw esplicito se name non matcha — indicates test setup error', async () => {
    await h.broker.connectRealtime({
      name: 'known',
      mode: 'sse',
      url: 'http://x/?_channel=known',
    })

    expect(() => h.pushSseEvent('unknown', '{}', 'id-1', 'msg')).toThrowError(
      /No SSE channel found for name='unknown'/,
    )
  })
})
