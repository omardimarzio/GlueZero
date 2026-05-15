/**
 * Tier-3 Scenario Iframe #1 (Chromium reale): Bridge `BridgeMessageSchema` Valibot
 * `v.strictObject` reject malformed `{noTimestamp}` + LRU dedup replay attack
 * (stesso messageId 2× → drop) (D-V2-09 BLOCKING closure).
 *
 * **Strategia**: testiamo le primitive di security policy del bridge in browser nativo
 * (Chromium) — Valibot validator + DedupRegistry LRU 500 + replay-guard 30s — senza
 * dipendere da iframe cross-origin reale (impossibile in CI senza dev server con HTTPS
 * + 2 origin). Pattern carryover SUMMARY 15-03 — coerente con Tier-1 jsdom (same code
 * path), valida in Chromium real che structuredClone + Date.now precision + Map perf
 * matchino lo jsdom path.
 *
 * Coverage REQ MF-IFRAME-03 + MF-SEC-04 + D-V2-F15-01..03 (Valibot strict + LRU dedup +
 * replay timestamp 30s dual-defense).
 *
 * @see PLAN 15-05 Phase A — Tier-3 Playwright Chromium 8 scenari (2 iframe — security)
 * @see SUMMARY 15-03 — 10 STRIDE T-15-01..03 implementation
 */
import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { BridgeMessageSchema } from '../src/bridge-schemas.js'
import { DedupRegistry, TIMESTAMP_WINDOW_MS } from '../src/lru-dedup.js'

describe('Tier-3 Iframe #1: bridge Valibot strict + LRU dedup replay', () => {
  it('Valibot v.strictObject accept valid gz:handshake (happy path)', () => {
    const valid = {
      id: 'msg-001',
      microFrontendId: 'mf-test',
      timestamp: Date.now(),
      type: 'gz:handshake',
      payload: {
        protocolVersion: 'gz:bridge/1.0',
        expectedHostOrigin: 'https://host.example.com',
      },
    }
    const parsed = v.safeParse(BridgeMessageSchema, valid)
    expect(parsed.success).toBe(true)
  })

  it('Valibot v.strictObject reject malformed gz:handshake senza timestamp (D-V2-F15-01 T-15-01)', () => {
    const malformed = {
      id: 'msg-002',
      microFrontendId: 'mf-test',
      // timestamp MANCANTE — Valibot v.strictObject reject
      type: 'gz:handshake',
      payload: {
        protocolVersion: 'gz:bridge/1.0',
        expectedHostOrigin: 'https://host.example.com',
      },
    }
    const rejected = v.safeParse(BridgeMessageSchema, malformed)
    expect(rejected.success).toBe(false)
  })

  it('Valibot v.strictObject reject unknown field (schema injection T-15-01)', () => {
    const withUnknown = {
      id: 'msg-003',
      microFrontendId: 'mf-test',
      timestamp: Date.now(),
      type: 'gz:handshake',
      payload: {
        protocolVersion: 'gz:bridge/1.0',
        expectedHostOrigin: 'https://host.example.com',
      },
      injected: 'xss-payload-attempt', // unknown field — strict reject
    }
    const rejected = v.safeParse(BridgeMessageSchema, withUnknown)
    expect(rejected.success).toBe(false)
  })

  it('LRU dedup replay attack: stesso messageId 2× → drop (D-V2-F15-02 T-15-02)', () => {
    const dedup = new DedupRegistry()
    const origin = 'https://mf.example.com'
    const mfId = 'mf-replay-test'
    const messageId = 'msg-replay-001'
    const now = Date.now()

    // Prima volta: NOT replay → register internamente → false
    expect(dedup.isReplay(origin, mfId, messageId, now, now)).toBe(false)

    // Seconda volta: seen → replay → true
    expect(dedup.isReplay(origin, mfId, messageId, now, now)).toBe(true)

    // Cross-origin scoping: stesso messageId ma origin diversa → NOT replay
    expect(dedup.isReplay('https://attacker.example.com', mfId, messageId, now, now)).toBe(false)
    // Stesso origin ma mfId diverso → NOT replay
    expect(dedup.isReplay(origin, 'mf-other', messageId, now, now)).toBe(false)
  })

  it('Replay-guard 30s window: stale timestamp future-dating rejected (D-V2-F15-03 T-15-03)', () => {
    const dedup = new DedupRegistry()
    const origin = 'https://mf.example.com'
    const mfId = 'mf-stale'
    const now = Date.now()

    // staleFuture: 60s in futuro — fuori 30s window
    expect(dedup.isReplay(origin, mfId, 'm-future', now + 60_000, now)).toBe(true)
    // staleOld: 60s nel passato — fuori 30s window
    expect(dedup.isReplay(origin, mfId, 'm-old', now - 60_000, now)).toBe(true)
    // Inside window: dentro 30s tollerance
    expect(dedup.isReplay(origin, mfId, 'm-fresh', now - 20_000, now)).toBe(false)

    // TIMESTAMP_WINDOW_MS export check (governance constant)
    expect(TIMESTAMP_WINDOW_MS).toBe(30000)
  })

  it('LRU dedup tuple isolation: clearForMf removes only target tuple', () => {
    const dedup = new DedupRegistry()
    const now = Date.now()
    dedup.isReplay('https://a.com', 'mf-1', 'msg-A', now, now)
    dedup.isReplay('https://a.com', 'mf-2', 'msg-B', now, now)
    expect(dedup.tupleCount).toBe(2)

    dedup.clearForMf('https://a.com', 'mf-1')
    expect(dedup.tupleCount).toBe(1)
    // mf-1 msg-A ora di nuovo non-seen
    expect(dedup.isReplay('https://a.com', 'mf-1', 'msg-A', now, now)).toBe(false)
  })
})
