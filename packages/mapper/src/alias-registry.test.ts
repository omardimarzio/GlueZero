// Test suite per AliasRegistry (REQ MAP-16, MAP-17 — chiusura PRD §39 #1).
//
// Coverage:
// - registerGlobal idempotent + conflict throw
// - registerScoped idempotent + conflict throw + scope isolation
// - resolve D-40 resolution order: scoped > global > name-match
// - resolve D-41 ambiguity flag: true per alias automatici, false per name-match
// - unregisterScopedAll D-26 ext F2 cascade plugin unregister
// - listGlobal / listScoped ordinati deterministicamente

import { describe, expect, it } from 'vitest'
import { AliasRegistry } from './alias-registry'

describe('AliasRegistry', () => {
  describe('registerGlobal', () => {
    it('returns true on new alias, false on duplicate (idempotent)', () => {
      const reg = new AliasRegistry()
      expect(reg.registerGlobal('city', 'location')).toBe(true)
      expect(reg.registerGlobal('city', 'location')).toBe(false)
    })

    it('throws on conflict (same localField → different canonical)', () => {
      const reg = new AliasRegistry()
      reg.registerGlobal('city', 'location')
      expect(() => reg.registerGlobal('city', 'location-different')).toThrow(
        /alias\.global\.conflict/,
      )
    })
  })

  describe('registerScoped', () => {
    it('registers scoped alias for one plugin only', () => {
      const reg = new AliasRegistry()
      expect(reg.registerScoped('plugin-a', 'city', 'location')).toBe(true)
      expect(reg.registerScoped('plugin-a', 'city', 'location')).toBe(false)
    })

    it('throws on conflict within same plugin scope', () => {
      const reg = new AliasRegistry()
      reg.registerScoped('plugin-a', 'city', 'location')
      expect(() => reg.registerScoped('plugin-a', 'city', 'place')).toThrow(
        /alias\.scoped\.conflict/,
      )
    })

    it('different plugins can register conflicting scoped aliases (scope isolation)', () => {
      const reg = new AliasRegistry()
      expect(reg.registerScoped('plugin-a', 'city', 'location')).toBe(true)
      expect(reg.registerScoped('plugin-b', 'city', 'place')).toBe(true)
    })
  })

  describe('resolve (D-40 resolution order)', () => {
    it('scoped alias resolution → ambiguous: true, source: scoped', () => {
      const reg = new AliasRegistry()
      reg.registerScoped('plugin-a', 'city', 'location')
      expect(reg.resolve('plugin-a', 'city')).toEqual({
        canonical: 'location',
        ambiguous: true,
        source: 'scoped',
      })
    })

    it('global alias resolution → ambiguous: true, source: global', () => {
      const reg = new AliasRegistry()
      reg.registerGlobal('city', 'location')
      expect(reg.resolve('plugin-a', 'city')).toEqual({
        canonical: 'location',
        ambiguous: true,
        source: 'global',
      })
    })

    it('scoped wins over global when both registered (D-40 priority)', () => {
      const reg = new AliasRegistry()
      reg.registerGlobal('city', 'location-global')
      reg.registerScoped('plugin-a', 'city', 'location-scoped')
      const result = reg.resolve('plugin-a', 'city')
      expect(result.canonical).toBe('location-scoped')
      expect(result.source).toBe('scoped')
    })

    it('plugin-b does NOT see scoped alias of plugin-a (isolation)', () => {
      const reg = new AliasRegistry()
      reg.registerScoped('plugin-a', 'city', 'location-a')
      reg.registerGlobal('city', 'location-global')
      const result = reg.resolve('plugin-b', 'city')
      expect(result.canonical).toBe('location-global')
      expect(result.source).toBe('global')
    })

    it('name match (no alias) → ambiguous: false, source: name-match', () => {
      const reg = new AliasRegistry()
      // No alias registered. The mapper-engine will pass localField that already
      // equals the canonical name (or treat it as a candidate for name-match).
      expect(reg.resolve('plugin-a', 'location')).toEqual({
        canonical: 'location',
        ambiguous: false,
        source: 'name-match',
      })
    })

    it('truly unresolved → name-match default (mapper-engine resolves to unresolved)', () => {
      // resolve always returns SOME canonical (defaulting to localField as name-match).
      // The 'unresolved' source is not produced by this registry alone — it's reserved
      // for the mapper-engine when consulting CanonicalRegistry to verify the field
      // actually exists. Here we test that the surface contract is consistent.
      const reg = new AliasRegistry()
      const result = reg.resolve('plugin-a', 'unknown')
      // No alias → name-match assumption (mapper-engine will then check canonical existence)
      expect(result.canonical).toBe('unknown')
      expect(result.source).toBe('name-match')
      expect(result.ambiguous).toBe(false)
    })

    it('throws on empty localField', () => {
      const reg = new AliasRegistry()
      expect(() => reg.resolve('plugin-a', '')).toThrow(/alias\.localField\.empty/)
    })
  })

  describe('unregisterScopedAll (D-26 ext F2 cascade)', () => {
    it('removes all scoped aliases for a plugin; global and other-plugin aliases intact', () => {
      const reg = new AliasRegistry()
      reg.registerGlobal('city', 'location')
      reg.registerScoped('plugin-a', 'foo', 'bar')
      reg.registerScoped('plugin-a', 'baz', 'qux')
      reg.registerScoped('plugin-b', 'lorem', 'ipsum')

      const removed = reg.unregisterScopedAll('plugin-a')
      expect(removed).toBe(2)

      // plugin-a scoped gone → cade su name-match
      expect(reg.resolve('plugin-a', 'foo').source).toBe('name-match')
      // global still there
      expect(reg.resolve('plugin-a', 'city').source).toBe('global')
      // plugin-b untouched
      expect(reg.resolve('plugin-b', 'lorem').canonical).toBe('ipsum')
    })

    it('returns 0 if plugin had no scoped aliases', () => {
      const reg = new AliasRegistry()
      expect(reg.unregisterScopedAll('plugin-x')).toBe(0)
    })
  })

  describe('WR-03 iter3 — prototype pollution guard', () => {
    // Iter1 WR-03 ha aggiunto RESERVED_KEYS check in mapper-engine.ts (compileRules +
    // readPath). AliasRegistry restava aperto: localField o canonicalField === '__proto__'
    // veniva accettato silenziosamente, e applyAliasResolution avrebbe fatto
    // result['__proto__'] = value → POLLUTION.
    // Iter3 fix: registerGlobal/registerScoped throw 'alias.field.reserved' su
    // localField o canonicalField in {'__proto__', 'constructor', 'prototype'}.

    it('registerGlobal throws on reserved canonicalField (__proto__)', () => {
      const reg = new AliasRegistry()
      expect(() => reg.registerGlobal('safeKey', '__proto__')).toThrow(/alias\.field\.reserved/)
    })

    it('registerGlobal throws on reserved localField (constructor)', () => {
      const reg = new AliasRegistry()
      expect(() => reg.registerGlobal('constructor', 'safeCanonical')).toThrow(
        /alias\.field\.reserved/,
      )
    })

    it('registerGlobal throws on reserved canonicalField (prototype)', () => {
      const reg = new AliasRegistry()
      expect(() => reg.registerGlobal('safe', 'prototype')).toThrow(/alias\.field\.reserved/)
    })

    it('registerScoped throws on reserved localField/canonicalField', () => {
      const reg = new AliasRegistry()
      expect(() => reg.registerScoped('plugin-a', '__proto__', 'safe')).toThrow(
        /alias\.field\.reserved/,
      )
      expect(() => reg.registerScoped('plugin-a', 'safe', 'constructor')).toThrow(
        /alias\.field\.reserved/,
      )
    })

    it('resolve throws on reserved localField (defense in depth)', () => {
      const reg = new AliasRegistry()
      // Anche se register è bloccato, resolve è chiamabile direttamente: difesa in
      // profondità contro caller che potrebbero passare un nome riservato.
      expect(() => reg.resolve('plugin-a', '__proto__')).toThrow(/alias\.field\.reserved/)
    })
  })

  describe('list', () => {
    it('listGlobal returns sorted [localField, canonical][] entries', () => {
      const reg = new AliasRegistry()
      reg.registerGlobal('zeta', 'z')
      reg.registerGlobal('alpha', 'a')
      reg.registerGlobal('beta', 'b')
      expect(reg.listGlobal()).toEqual([
        ['alpha', 'a'],
        ['beta', 'b'],
        ['zeta', 'z'],
      ])
    })

    it('listScoped(pluginId) returns sorted entries for that plugin only', () => {
      const reg = new AliasRegistry()
      reg.registerScoped('plugin-a', 'foo', 'bar')
      reg.registerScoped('plugin-a', 'baz', 'qux')
      reg.registerScoped('plugin-b', 'lorem', 'ipsum')
      expect(reg.listScoped('plugin-a')).toEqual([
        ['baz', 'qux'],
        ['foo', 'bar'],
      ])
      expect(reg.listScoped('plugin-b')).toEqual([['lorem', 'ipsum']])
      expect(reg.listScoped('plugin-z')).toEqual([])
    })
  })
})
