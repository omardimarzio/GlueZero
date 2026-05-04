// msw-ws-stale.test.ts — B-1 Tier-2 closure (D-111 WS stale detection MSW).
//
// **V1 SKIP rationale**: MSW 2.x ha supporto nativo `ws.link()` per mocking WebSocket
// dal 2.5+, ma in V1 il setup richiede integrazione con jsdom WebSocket polyfill che
// non è straightforward. Il pattern stale-detection è già coperto da:
//   - unit test plan 04-06 (websocket-adapter.test.ts) con `MockWebSocket` + fake timers
//   - integration test Tier-1 ws-stale-detection.test.ts (smoke jsdom)
//
// V1.x potrà attivare questo Tier-2 quando:
//   1. MSW 2.5+ confermato installato
//   2. Setup jsdom + ws.link compatibile

import { describe, expect, it } from 'vitest'

describe.skip('MSW WS stale detection (B-1 Tier-2 — V1.x deferred)', () => {
  it('placeholder — implementare con msw 2.5+ ws.link quando stack lo permette', () => {
    expect(true).toBe(true)
  })
})
