// Test TDD per TransformPipeline (REQ MAP-12, VAL-09 — chiude PRD §39 #4).
//
// Coverage:
// - register/has/get (idempotent + duplicate throw + ownerId tracking)
// - apply (D-44 onFailure 'block'/'skip'/'fallback' + D-45 cause wrapping)
// - apply (transform.not-found + non-Error throw values)
// - list/unregister/unregisterByOwner (cascade D-26 ext F2)

import { isBrokerError, silentLogger } from '@gluezero/core'
import { describe, expect, it } from 'vitest'
import { TransformPipeline } from './transform-pipeline'
import type { TransformContext, TransformFn } from './types/transform'

const makeCtx = (overrides: Partial<TransformContext> = {}): TransformContext => ({
  logger: silentLogger,
  pluginId: 'test-plugin',
  fieldName: 'testField',
  ...overrides,
})

describe('TransformPipeline', () => {
  describe('register / has / get', () => {
    it('register succeeds; duplicate throws transform.id.duplicate', () => {
      const tp = new TransformPipeline()
      tp.register('toUpper', (s) => String(s).toUpperCase())
      expect(tp.has('toUpper')).toBe(true)

      let caught: unknown
      try {
        tp.register('toUpper', (s) => String(s).toLowerCase())
      } catch (e) {
        caught = e
      }
      expect(isBrokerError(caught)).toBe(true)
      expect((caught as { code: string }).code).toBe('transform.id.duplicate')
      expect((caught as { details: Record<string, unknown> }).details.name).toBe('toUpper')
    })

    it('register accepts ownerId for cascade tracking', () => {
      const tp = new TransformPipeline()
      tp.register('foo', (x) => x, { ownerId: 'plugin-a' })
      expect(tp.has('foo')).toBe(true)
    })

    it('get returns descriptor or undefined', () => {
      const tp = new TransformPipeline()
      const fn: TransformFn = (s) => String(s).toUpperCase()
      tp.register('toUpper', fn, { description: 'uppercase a string' })
      const desc = tp.get('toUpper')
      expect(desc?.name).toBe('toUpper')
      expect(desc?.fn).toBe(fn)
      expect(desc?.description).toBe('uppercase a string')
      expect(tp.get('missing')).toBeUndefined()
    })
  })

  describe('apply (D-44 onFailure policy)', () => {
    it('successful transform returns the result', () => {
      const tp = new TransformPipeline()
      tp.register('toUpper', (s) => String(s).toUpperCase())
      expect(tp.apply('toUpper', 'hello', makeCtx(), 'block')).toBe('HELLO')
    })

    it('block: throw wraps in mapping.transform.failed with cause + details (D-45)', () => {
      const tp = new TransformPipeline()
      const original = new Error('inner boom')
      tp.register('boom', () => {
        throw original
      })

      let caught: unknown
      try {
        tp.apply('boom', 'x', makeCtx({ pluginId: 'p1', fieldName: 'fld' }), 'block')
      } catch (e) {
        caught = e
      }
      expect(isBrokerError(caught)).toBe(true)
      expect((caught as { code: string }).code).toBe('mapping.transform.failed')
      expect((caught as { category: string }).category).toBe('mapping')
      expect((caught as { originalError: Error }).originalError).toBe(original)
      // ES2022 cause set by createBrokerError
      expect((caught as { cause: unknown }).cause).toBe(original)
      const details = (caught as { details: Record<string, unknown> }).details
      expect(details.pluginId).toBe('p1')
      expect(details.fieldName).toBe('fld')
      expect(details.transformName).toBe('boom')
    })

    it('skip: throw returns undefined, NO throw', () => {
      const tp = new TransformPipeline()
      tp.register('boom', () => {
        throw new Error('inner')
      })
      expect(tp.apply('boom', 'x', makeCtx(), 'skip')).toBeUndefined()
    })

    it('fallback with default value: returns default', () => {
      const tp = new TransformPipeline()
      tp.register('boom', () => {
        throw new Error('inner')
      })
      expect(tp.apply('boom', 'x', makeCtx(), 'fallback', 'default-val')).toBe('default-val')
    })

    it('fallback without default: returns undefined (downgrade to skip per D-44)', () => {
      const tp = new TransformPipeline()
      tp.register('boom', () => {
        throw new Error('inner')
      })
      expect(tp.apply('boom', 'x', makeCtx(), 'fallback')).toBeUndefined()
    })

    it('unknown transform: throws transform.not-found regardless of onFailure', () => {
      const tp = new TransformPipeline()
      let caught: unknown
      try {
        tp.apply('nope', 'x', makeCtx(), 'skip')
      } catch (e) {
        caught = e
      }
      expect(isBrokerError(caught)).toBe(true)
      expect((caught as { code: string }).code).toBe('transform.not-found')
      expect((caught as { details: Record<string, unknown> }).details.name).toBe('nope')
    })

    it('non-Error thrown values still wrap into BrokerError', () => {
      const tp = new TransformPipeline()
      tp.register('boomString', () => {
        throw 'string error'
      })
      let caught: unknown
      try {
        tp.apply('boomString', 'x', makeCtx(), 'block')
      } catch (e) {
        caught = e
      }
      expect(isBrokerError(caught)).toBe(true)
      expect((caught as { code: string }).code).toBe('mapping.transform.failed')
      expect((caught as { message: string }).message).toBe('string error')
    })
  })

  describe('list / unregister / unregisterByOwner', () => {
    it('list returns sorted names + fresh copy', () => {
      const tp = new TransformPipeline()
      tp.register('zeta', (x) => x)
      tp.register('alpha', (x) => x)
      tp.register('beta', (x) => x)
      expect(tp.list()).toEqual(['alpha', 'beta', 'zeta'])

      const copy = tp.list()
      copy.push('mutated')
      expect(tp.list()).toEqual(['alpha', 'beta', 'zeta'])
    })

    it('unregister returns true on first call, false thereafter', () => {
      const tp = new TransformPipeline()
      tp.register('foo', (x) => x)
      expect(tp.unregister('foo')).toBe(true)
      expect(tp.unregister('foo')).toBe(false)
      expect(tp.has('foo')).toBe(false)
    })

    it('unregisterByOwner removes only transforms owned by plugin', () => {
      const tp = new TransformPipeline()
      tp.register('a', (x) => x, { ownerId: 'plugin-a' })
      tp.register('b', (x) => x, { ownerId: 'plugin-a' })
      tp.register('c', (x) => x, { ownerId: 'plugin-b' })
      tp.register('d', (x) => x) // no owner

      const removed = tp.unregisterByOwner('plugin-a')
      expect(removed).toBe(2)
      expect(tp.has('a')).toBe(false)
      expect(tp.has('b')).toBe(false)
      expect(tp.has('c')).toBe(true)
      expect(tp.has('d')).toBe(true)
    })

    it('unregisterByOwner returns 0 when no transforms owned', () => {
      const tp = new TransformPipeline()
      tp.register('a', (x) => x)
      expect(tp.unregisterByOwner('plugin-z')).toBe(0)
    })
  })
})
