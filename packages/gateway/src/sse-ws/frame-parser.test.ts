// frame-parser.test.ts — TDD coverage per `parseFrame` + `isInternalTopic` (D-106 + D-111).
//
// Pattern test deterministici tier-1 jsdom (no async setup, no fixtures esterne) —
// stessa shape di `retry-after-parser.test.ts` di F3. Test numerati per traceability
// con `<behavior>` del plan 04-02-PLAN.md.
//
// Behavior coperti (15 test):
//   parseFrame:
//   1.  envelope valido `{ topic, data }` → { ok: true, envelope } (no id)
//   2.  envelope con id → envelope.id propagato
//   3.  missing topic → reason 'missing-topic'
//   4.  topic empty string → reason 'missing-topic'
//   5.  malformed JSON → reason 'malformed-json'
//   6.  input non-string (number) → reason 'malformed-json'
//   7.  JSON array → reason 'invalid-shape'
//   8.  JSON null → reason 'invalid-shape'
//   9.  JSON primitive number → reason 'invalid-shape'
//   10. id non-string → ignorato (envelope.id undefined, NO crash)
//   isInternalTopic (PITFALL §11.7 chiusura anti-AP-6):
//   11. '__ping__' → true
//   12. '__pong__' → true
//   13. 'weather.__ping__' → false (strict match, NOT prefix)
//   14. '__other__' → false (no wildcard)
//   15. INTERNAL_TOPICS è freezed.

import { describe, expect, it } from 'vitest'
import { INTERNAL_TOPICS, isInternalTopic, parseFrame } from './frame-parser'

describe('parseFrame (D-106 — WebSocket envelope JSON)', () => {
  it('Test 1: envelope valido { topic, data } → { ok: true, envelope }', () => {
    const result = parseFrame('{"topic":"weather.update","data":{"city":"Roma"}}')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.envelope.topic).toBe('weather.update')
      expect(result.envelope.data).toEqual({ city: 'Roma' })
      expect(result.envelope.id).toBeUndefined()
    }
  })

  it('Test 2: envelope con id → envelope.id propagato', () => {
    const result = parseFrame('{"topic":"x","data":1,"id":"evt-123"}')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.envelope.id).toBe('evt-123')
    }
  })

  it('Test 3: missing topic → { ok: false, reason: "missing-topic" }', () => {
    const result = parseFrame('{"data":{"x":1}}')
    expect(result).toEqual({
      ok: false,
      reason: 'missing-topic',
      raw: '{"data":{"x":1}}',
    })
  })

  it('Test 4: topic empty string → missing-topic', () => {
    const result = parseFrame('{"topic":"","data":1}')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('missing-topic')
    }
  })

  it('Test 5: malformed JSON → reason malformed-json', () => {
    const result = parseFrame('not json')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('malformed-json')
      expect(result.raw).toBe('not json')
    }
  })

  it('Test 6: input non-string (number) → malformed-json', () => {
    // Cast deliberato: il parser è `(raw: unknown) => FrameParseResult` per gestire
    // input difensivamente — `MessageEvent.data` è tipato `any` da DOM lib.
    const result = parseFrame(42 as unknown as string)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('malformed-json')
    }
  })

  it('Test 7: JSON array → invalid-shape', () => {
    const result = parseFrame('[1,2,3]')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid-shape')
    }
  })

  it('Test 8: JSON null → invalid-shape', () => {
    const result = parseFrame('null')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid-shape')
    }
  })

  it('Test 9: JSON primitive number → invalid-shape', () => {
    const result = parseFrame('42')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid-shape')
    }
  })

  it('Test 10: id non-string → ignorato (envelope.id undefined)', () => {
    const result = parseFrame('{"topic":"x","data":1,"id":42}')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.envelope.id).toBeUndefined()
      expect(result.envelope.topic).toBe('x')
      expect(result.envelope.data).toBe(1)
    }
  })
})

describe('isInternalTopic (D-111 + PITFALL §11.7 strict match — anti-AP-6)', () => {
  it("Test 11: '__ping__' → true", () => {
    expect(isInternalTopic('__ping__')).toBe(true)
  })

  it("Test 12: '__pong__' → true", () => {
    expect(isInternalTopic('__pong__')).toBe(true)
  })

  it("Test 13: 'weather.__ping__' → false (strict match, NOT prefix — chiave anti-AP-6)", () => {
    // PITFALL §11.7 chiusura: topic legittimi consumer come `weather.__ping__`
    // (raro ma legittimo) NON devono essere filtrati come internal. Questo è il
    // comportamento esatto specificato dal closure Q1 di 04-CONTEXT.md.
    expect(isInternalTopic('weather.__ping__')).toBe(false)
  })

  it("Test 14: '__other__' → false (no wildcard, no prefix)", () => {
    expect(isInternalTopic('__other__')).toBe(false)
  })

  it('Test 15: INTERNAL_TOPICS è freezed', () => {
    expect(Object.isFrozen(INTERNAL_TOPICS)).toBe(true)
  })
})
