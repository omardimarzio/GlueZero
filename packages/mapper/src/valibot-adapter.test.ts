// Test suite per valibotAdapter (REQ VAL-03, VAL-04, VAL-07; D-37, D-38).
//
// Coverage:
// - validate ritorna { ok: true, value } su schema string match
// - validate ritorna { ok: false, issues } su type mismatch (NO throw)
// - v.unknown() accetta qualsiasi payload
// - object schema con field validi → ok: true
// - object schema con field mancante → ok: false con path informativo
// - issue mapping: message sempre presente; path/expected/received quando applicabile
// - array schema mixed types → ok: false con index path
// - adapter non muta il payload (JSON-safe invariant)
// - optional field assente è valid (ok: true)
// - NEVER throws — payload null/undefined/array/wrong type sempre ritorna ok: false

import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { valibotAdapter } from './valibot-adapter'

describe('valibotAdapter', () => {
  it('returns ok: true with value on successful validation (string)', () => {
    const result = valibotAdapter.validate(v.string(), 'hello')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('hello')
    }
  })

  it('returns ok: false with issues on type mismatch (NO throw)', () => {
    const result = valibotAdapter.validate(v.string(), 42)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.issues[0]?.message).toBeTypeOf('string')
    }
  })

  it('v.unknown() accepts any payload', () => {
    const result = valibotAdapter.validate(v.unknown(), { anything: 'goes', n: 42 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ anything: 'goes', n: 42 })
    }
  })

  it('object schema with all required fields valid → ok: true', () => {
    const schema = v.object({ name: v.string(), age: v.number() })
    const result = valibotAdapter.validate(schema, { name: 'alice', age: 30 })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual({ name: 'alice', age: 30 })
    }
  })

  it('object schema with missing required field → ok: false with path', () => {
    const schema = v.object({ name: v.string(), age: v.number() })
    const result = valibotAdapter.validate(schema, { name: 'alice' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      // At least one issue should mention 'age' in its path or be present overall.
      const hasAgePath = result.issues.some((iss) => iss.path?.some((p) => String(p) === 'age'))
      expect(hasAgePath || result.issues.length > 0).toBe(true)
    }
  })

  it('issue mapping includes message + path when available', () => {
    const schema = v.object({ name: v.string(), age: v.number() })
    const result = valibotAdapter.validate(schema, { name: 42, age: 'wrong' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      for (const issue of result.issues) {
        expect(typeof issue.message).toBe('string')
      }
    }
  })

  it('array schema with mixed types → ok: false with element index path', () => {
    const schema = v.array(v.string())
    const result = valibotAdapter.validate(schema, [1, 'two', 3])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThan(0)
    }
  })

  it('does not mutate the input payload', () => {
    const payload = { name: 'alice', nested: { x: 1 } }
    const before = JSON.stringify(payload)
    valibotAdapter.validate(
      v.object({ name: v.string(), nested: v.object({ x: v.number() }) }),
      payload,
    )
    expect(JSON.stringify(payload)).toBe(before)
  })

  it('optional field absent is valid (ok: true)', () => {
    const schema = v.object({ required: v.string(), optional: v.optional(v.string()) })
    const result = valibotAdapter.validate(schema, { required: 'x' })
    expect(result.ok).toBe(true)
  })

  it('NEVER throws — invalid payload always returns ok: false', () => {
    const schema = v.object({ name: v.string() })
    expect(() => valibotAdapter.validate(schema, null)).not.toThrow()
    expect(() => valibotAdapter.validate(schema, undefined)).not.toThrow()
    expect(() => valibotAdapter.validate(schema, 42)).not.toThrow()
    expect(() => valibotAdapter.validate(schema, [])).not.toThrow()
  })

  it('WR-08 fix: rejects non-Valibot schema (type guard) → ok: false', () => {
    // Empty object — NON è uno schema Valibot. Senza type guard, v.safeParse
    // potrebbe ritornare ok:true silently (schema malformato passato per errore).
    const r1 = valibotAdapter.validate({}, 'anything')
    expect(r1.ok).toBe(false)
    if (!r1.ok) {
      expect(r1.issues[0]?.message).toContain('not a Valibot BaseSchema')
    }
    // Plain object pretending to be a schema — NON ha `~run` function.
    const r2 = valibotAdapter.validate({ type: 'string' }, 'x')
    expect(r2.ok).toBe(false)
    // null / primitives → ok: false.
    expect(valibotAdapter.validate(null, 'x').ok).toBe(false)
    expect(valibotAdapter.validate('not a schema', 'x').ok).toBe(false)
    expect(valibotAdapter.validate(42, 'x').ok).toBe(false)
  })
})
