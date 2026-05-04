// assert-serializable.test.ts — TDD coverage per `assertSerializable` (D-139, D-140, D-142).
//
// Pattern test deterministici tier-1 jsdom (no async setup, no fixtures esterne) —
// stessa shape di `frame-parser.test.ts` di F4 / `retry-after-parser.test.ts` di F3.
// Test numerati per traceability con `<behavior>` del plan 05-02-PLAN.md.
//
// Behavior coperti (15 test):
//   Valid types (SCA-supported — no throw):
//   1.  plain object → no throw
//   2.  Date → no throw
//   3.  Map → no throw
//   4.  Set → no throw
//   5.  ArrayBuffer → no throw
//   6.  TypedArray (Uint8Array) → no throw
//   7.  RegExp → no throw
//   Throws (path tracking + sub-codes D-140):
//   8.  function → code worker.serialization.failed.function + fieldPath
//   9.  symbol → code worker.serialization.failed.symbol
//   10. nested function → fieldPath dotted (deep.nested.fn)
//   11. function in array → fieldPath bracketed (list[2])
//   13. DOM node → code worker.serialization.failed.dom-node
//   14. custom class → code worker.serialization.failed.custom-class
//   Cycle + edge:
//   12. cycle detection (a.self = a) → no throw via WeakSet
//   15. undefined accepted → no throw (SCA supports)

import type { BrokerError } from '@sembridge/core'
import { describe, expect, it } from 'vitest'
import { assertSerializable } from './assert-serializable'

describe('assertSerializable — deep-walk SCA validator (D-139, D-140, D-142)', () => {
  describe('valid SCA-supported types — no throw', () => {
    it('Test 1: plain object → no throw', () => {
      expect(() => assertSerializable({ a: 1, b: 'x', c: true, d: null })).not.toThrow()
    })

    it('Test 2: Date → no throw', () => {
      expect(() => assertSerializable({ when: new Date('2026-05-04') })).not.toThrow()
    })

    it('Test 3: Map → no throw', () => {
      expect(() => assertSerializable({ m: new Map([['k', 'v']]) })).not.toThrow()
    })

    it('Test 4: Set → no throw', () => {
      expect(() => assertSerializable({ s: new Set([1, 2, 3]) })).not.toThrow()
    })

    it('Test 5: ArrayBuffer → no throw', () => {
      expect(() => assertSerializable({ buf: new ArrayBuffer(8) })).not.toThrow()
    })

    it('Test 6: TypedArray (Uint8Array) → no throw', () => {
      expect(() => assertSerializable({ ta: new Uint8Array([1, 2, 3, 4]) })).not.toThrow()
    })

    it('Test 7: RegExp → no throw', () => {
      expect(() => assertSerializable({ re: /^abc$/i })).not.toThrow()
    })
  })

  describe('throws BrokerError with sub-code + fieldPath (D-140)', () => {
    it('Test 8: function → throws code worker.serialization.failed.function with fieldPath', () => {
      try {
        assertSerializable({ fn: () => 42 })
        throw new Error('expected throw')
      } catch (e) {
        const err = e as BrokerError
        expect(err.code).toBe('worker.serialization.failed.function')
        expect(err.category).toBe('worker')
        expect(err.details?.['fieldPath']).toBe('fn')
        expect(err.details?.['fieldType']).toBe('function')
      }
    })

    it('Test 9: symbol → throws code worker.serialization.failed.symbol', () => {
      try {
        assertSerializable({ sym: Symbol('s') })
        throw new Error('expected throw')
      } catch (e) {
        const err = e as BrokerError
        expect(err.code).toBe('worker.serialization.failed.symbol')
        expect(err.category).toBe('worker')
        expect(err.details?.['fieldPath']).toBe('sym')
        expect(err.details?.['fieldType']).toBe('symbol')
      }
    })

    it('Test 10: nested function → fieldPath dotted (deep.nested.fn)', () => {
      try {
        assertSerializable({ deep: { nested: { fn: () => 1 } } })
        throw new Error('expected throw')
      } catch (e) {
        const err = e as BrokerError
        expect(err.code).toBe('worker.serialization.failed.function')
        expect(err.details?.['fieldPath']).toBe('deep.nested.fn')
      }
    })

    it('Test 11: function in array → fieldPath bracketed (list[2])', () => {
      try {
        assertSerializable({ list: [1, 2, () => 3, 4] })
        throw new Error('expected throw')
      } catch (e) {
        const err = e as BrokerError
        expect(err.code).toBe('worker.serialization.failed.function')
        expect(err.details?.['fieldPath']).toBe('list[2]')
      }
    })

    it('Test 13: DOM node → throws code worker.serialization.failed.dom-node', () => {
      const div = document.createElement('div')
      try {
        assertSerializable({ el: div })
        throw new Error('expected throw')
      } catch (e) {
        const err = e as BrokerError
        expect(err.code).toBe('worker.serialization.failed.dom-node')
        expect(err.category).toBe('worker')
        expect(err.details?.['fieldPath']).toBe('el')
        expect(err.details?.['fieldType']).toBe('dom-node')
      }
    })

    it('Test 14: custom class with prototype → throws code worker.serialization.failed.custom-class', () => {
      class Order {
        constructor(public id: string) {}
      }
      try {
        assertSerializable({ order: new Order('o-1') })
        throw new Error('expected throw')
      } catch (e) {
        const err = e as BrokerError
        expect(err.code).toBe('worker.serialization.failed.custom-class')
        expect(err.category).toBe('worker')
        expect(err.details?.['fieldPath']).toBe('order')
        expect(err.details?.['fieldType']).toBe('custom-class')
        expect(err.details?.['constructorName']).toBe('Order')
      }
    })
  })

  describe('cycle detection + edge cases', () => {
    it('Test 12: cyclic reference (a.self = a) → no throw via WeakSet', () => {
      const a: Record<string, unknown> = { x: 1 }
      a['self'] = a
      expect(() => assertSerializable(a)).not.toThrow()
    })

    it('Test 15: undefined accepted (SCA supports) → no throw', () => {
      expect(() => assertSerializable(undefined)).not.toThrow()
      expect(() => assertSerializable({ a: undefined })).not.toThrow()
    })
  })
})
