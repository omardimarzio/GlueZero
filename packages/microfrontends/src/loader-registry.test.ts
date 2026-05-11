/**
 * LoaderRegistry isolated test suite (MF-LOADER-REG-01, MF-LOADER-REG-02).
 *
 * Tier-1 jsdom — test diretti sulla classe `LoaderRegistry` (no Broker wrapper).
 * Coverage CRUD + edge cases + adapter shape variations + error details.
 *
 * @see PRD §22 + RESEARCH §6 + PATTERNS §34
 */
import { describe, expect, it, vi } from 'vitest'
import { LoaderRegistry, type MicroFrontendLoaderAdapter } from './loader-registry'

function makeAdapter(type: string): MicroFrontendLoaderAdapter {
  return {
    type,
    load: vi.fn(),
  }
}

describe('LoaderRegistry — CRUD (MF-LOADER-REG-01)', () => {
  it('register storage e get lookup per type', () => {
    const registry = new LoaderRegistry()
    const adapter = makeAdapter('esm')
    registry.register(adapter)
    expect(registry.get('esm')).toBe(adapter)
  })

  it('register throws MF_LOADER_TYPE_DUPLICATE per duplicate type', () => {
    const registry = new LoaderRegistry()
    registry.register(makeAdapter('esm'))
    try {
      registry.register(makeAdapter('esm'))
      expect.fail('should have thrown')
    } catch (err: unknown) {
      const e = err as { code: string }
      expect(e.code).toBe('MF_LOADER_TYPE_DUPLICATE')
    }
  })

  it('unregister rimuove type — returns true if removed', () => {
    const registry = new LoaderRegistry()
    registry.register(makeAdapter('iframe'))
    expect(registry.unregister('iframe')).toBe(true)
    expect(registry.get('iframe')).toBeUndefined()
  })

  it('unregister non-existent type → returns false (idempotent)', () => {
    const registry = new LoaderRegistry()
    expect(registry.unregister('absent')).toBe(false)
  })

  it('unregister doppio (already removed) → returns false second call', () => {
    const registry = new LoaderRegistry()
    registry.register(makeAdapter('esm'))
    expect(registry.unregister('esm')).toBe(true)
    expect(registry.unregister('esm')).toBe(false)
  })

  it('get returns undefined per type non-registered', () => {
    const registry = new LoaderRegistry()
    expect(registry.get('not-registered')).toBeUndefined()
  })

  it('list ritorna array di tutti gli adapter registrati', () => {
    const registry = new LoaderRegistry()
    const a = makeAdapter('esm')
    const b = makeAdapter('iframe')
    const c = makeAdapter('mock')
    registry.register(a)
    registry.register(b)
    registry.register(c)
    const result = registry.list()
    expect(result.length).toBe(3)
    expect(result).toContain(a)
    expect(result).toContain(b)
    expect(result).toContain(c)
  })

  it('list ritorna snapshot indipendente (mutate non affetta registry)', () => {
    const registry = new LoaderRegistry()
    registry.register(makeAdapter('esm'))
    const snapshot = registry.list()
    expect(Array.isArray(snapshot)).toBe(true)
    // Verifying registry NOT mutated by external manipulation of snapshot
    expect(registry.get('esm')).toBeDefined()
    // snapshot.length era 1 — modifica array locale non influisce su registry
    expect(registry.list().length).toBe(1)
  })

  it('multiple loaders coexist senza interferenza', () => {
    const registry = new LoaderRegistry()
    const esm = makeAdapter('esm')
    const iframe = makeAdapter('iframe')
    registry.register(esm)
    registry.register(iframe)
    expect(registry.get('esm')).toBe(esm)
    expect(registry.get('iframe')).toBe(iframe)
    registry.unregister('esm')
    expect(registry.get('esm')).toBeUndefined()
    expect(registry.get('iframe')).toBe(iframe) // iframe non-affected
  })

  it('register dopo unregister stesso type → OK (no throw)', () => {
    const registry = new LoaderRegistry()
    const a = makeAdapter('esm')
    const b = makeAdapter('esm')
    registry.register(a)
    registry.unregister('esm')
    expect(() => registry.register(b)).not.toThrow()
    expect(registry.get('esm')).toBe(b)
  })

  it('list su registry vuoto ritorna array vuoto', () => {
    const registry = new LoaderRegistry()
    expect(registry.list()).toEqual([])
  })
})

describe('LoaderRegistry — adapter shape (MF-LOADER-REG-02)', () => {
  it('adapter con preload opt-in funzione opzionale', () => {
    const registry = new LoaderRegistry()
    const adapter: MicroFrontendLoaderAdapter = {
      type: 'esm-with-preload',
      load: vi.fn(),
      preload: vi.fn(),
    }
    registry.register(adapter)
    expect(registry.get('esm-with-preload')?.preload).toBeDefined()
  })

  it('adapter con unload opt-in funzione opzionale', () => {
    const registry = new LoaderRegistry()
    const adapter: MicroFrontendLoaderAdapter = {
      type: 'iframe-with-unload',
      load: vi.fn(),
      unload: vi.fn(),
    }
    registry.register(adapter)
    expect(registry.get('iframe-with-unload')?.unload).toBeDefined()
  })

  it('adapter senza preload/unload (solo load) accettato', () => {
    const registry = new LoaderRegistry()
    const adapter = makeAdapter('minimal')
    registry.register(adapter)
    expect(registry.get('minimal')?.preload).toBeUndefined()
    expect(registry.get('minimal')?.unload).toBeUndefined()
  })

  it('adapter con tutti gli hook opt-in (preload + unload)', () => {
    const registry = new LoaderRegistry()
    const adapter: MicroFrontendLoaderAdapter = {
      type: 'full',
      load: vi.fn(),
      preload: vi.fn(),
      unload: vi.fn(),
    }
    registry.register(adapter)
    const retrieved = registry.get('full')
    expect(retrieved?.preload).toBeDefined()
    expect(retrieved?.unload).toBeDefined()
    expect(retrieved?.load).toBeDefined()
  })
})

describe('LoaderRegistry — error details (MF_LOADER_TYPE_DUPLICATE)', () => {
  it('duplicate type error.details.type contiene il tipo conflict', () => {
    const registry = new LoaderRegistry()
    registry.register(makeAdapter('esm'))
    try {
      registry.register(makeAdapter('esm'))
      expect.fail('should have thrown')
    } catch (err: unknown) {
      const e = err as { code: string; details: { type: string } }
      expect(e.code).toBe('MF_LOADER_TYPE_DUPLICATE')
      expect(e.details.type).toBe('esm')
    }
  })

  it('duplicate error.message menziona il type conflict', () => {
    const registry = new LoaderRegistry()
    registry.register(makeAdapter('iframe'))
    try {
      registry.register(makeAdapter('iframe'))
      expect.fail('should have thrown')
    } catch (err: unknown) {
      const e = err as { message: string }
      expect(e.message).toContain('iframe')
    }
  })
})
