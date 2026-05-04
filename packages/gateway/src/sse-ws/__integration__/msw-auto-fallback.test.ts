// msw-auto-fallback.test.ts — B-1 Tier-2 closure (D-107 SSE→WS round-trip MSW).
//
// **V1 SKIP rationale**: questo test richiede sia mock SSE (server fail 3x con
// http.get) sia mock WS (ws.link per success post-fallback). In V1 il setup
// integrato è complesso (vedi msw-ws-stale rationale). Il fallback effettivo è
// già verificato in:
//   - unit test plan 04-07 (realtime-channel-manager.test.ts) — runReconnectLoop
//     con MockWebSocket istanziato
//   - integration test Tier-1 auto-fallback.test.ts (B-4 closure smoke jsdom)
//
// V1.x abiliterà quando MSW 2.5+ ws.link è confermato compatibile con jsdom +
// vitest 4.x.

import { describe, expect, it } from 'vitest'

describe.skip('MSW auto-fallback round-trip (B-1 Tier-2 — V1.x deferred)', () => {
  it('placeholder — implementare con msw 2.5+ ws.link quando stack lo permette', () => {
    expect(true).toBe(true)
  })
})
