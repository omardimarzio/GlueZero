/**
 * Tier-1 jsdom — `normalize.ts` factory result normalize (carryover F9 D-V2-F9-05
 * 4-step priority adattato per MF factory shape).
 */
import { describe, expect, it } from 'vitest'
import { MfModuleFederationError } from '../errors'
import { normalizeModule } from '../normalize'

describe('normalizeModule — D-V2-F9-05 4-step priority (carryover F9 MF adapted)', () => {
  it('Strategy 1 — exportName explicit lifecycle prevale', () => {
    const factoryResult = {
      app: { mount: () => Promise.resolve(), unmount: () => Promise.resolve() },
      default: { mount: () => Promise.resolve() },
    }
    const lifecycle = normalizeModule(factoryResult, {
      url: 'https://cdn/remoteEntry.js',
      exportName: 'app',
      scope: 's',
      module: 'm',
    })
    expect(typeof lifecycle.mount).toBe('function')
    expect(typeof lifecycle.unmount).toBe('function')
  })

  it('Strategy 2 — default export lifecycle (priority 2)', () => {
    const factoryResult = {
      default: {
        bootstrap: () => Promise.resolve(),
        mount: () => Promise.resolve(),
        unmount: () => Promise.resolve(),
      },
    }
    const lifecycle = normalizeModule(factoryResult, {
      url: 'https://cdn/remoteEntry.js',
      scope: 'analytics',
      module: 'Dashboard',
    })
    expect(typeof lifecycle.bootstrap).toBe('function')
    expect(typeof lifecycle.mount).toBe('function')
    expect(typeof lifecycle.unmount).toBe('function')
  })

  it('Strategy 3 — named exports flat (priority 3)', () => {
    const factoryResult = {
      mount: () => Promise.resolve(),
      unmount: () => Promise.resolve(),
    }
    const lifecycle = normalizeModule(factoryResult, { url: 'https://cdn/remoteEntry.js' })
    expect(typeof lifecycle.mount).toBe('function')
    expect(typeof lifecycle.unmount).toBe('function')
  })

  it('Strategy 4 — throw MF_REMOTE_FACTORY_FAILED su modulo invalid (no mount)', () => {
    const factoryResult = { someOther: () => 1 }
    expect(() => {
      normalizeModule(factoryResult, {
        url: 'https://cdn/remoteEntry.js',
        scope: 's',
        module: 'm',
        microFrontendId: 'mf-x',
      })
    }).toThrow(MfModuleFederationError)
    try {
      normalizeModule(factoryResult, {
        url: 'https://cdn/remoteEntry.js',
        scope: 's',
        module: 'm',
      })
    } catch (err) {
      expect(err).toBeInstanceOf(MfModuleFederationError)
      const e = err as MfModuleFederationError
      expect(e.code).toBe('MF_REMOTE_FACTORY_FAILED')
      expect(e.details).toMatchObject({
        url: 'https://cdn/remoteEntry.js',
        hasDefault: false,
        namedKeys: ['someOther'],
      })
    }
  })

  it('Strategy 1 explicit — throw se exportName non valido (no fallback a default)', () => {
    const factoryResult = {
      app: 'not-a-lifecycle-object', // non oggetto con mount function
      default: { mount: () => Promise.resolve() }, // fallback NON triggerato per all-or-nothing
    }
    expect(() => {
      normalizeModule(factoryResult, {
        url: 'https://cdn/remoteEntry.js',
        exportName: 'app',
      })
    }).toThrow(MfModuleFederationError)
  })

  it('factory result null/undefined/primitive → throw MF_REMOTE_FACTORY_FAILED', () => {
    expect(() => {
      normalizeModule(null, { url: 'u' })
    }).toThrow(MfModuleFederationError)
    expect(() => {
      normalizeModule(undefined, { url: 'u' })
    }).toThrow(MfModuleFederationError)
    expect(() => {
      normalizeModule(42, { url: 'u' })
    }).toThrow(MfModuleFederationError)
  })

  it('typeof strict (D-V2-F9-07) — bootstrap=null escluso senza throw', () => {
    const factoryResult = {
      default: {
        bootstrap: null, // null → escluso
        mount: () => Promise.resolve(),
        unmount: 'string', // non function → escluso
      },
    }
    const lifecycle = normalizeModule(factoryResult, { url: 'u' })
    expect(typeof lifecycle.mount).toBe('function')
    expect(lifecycle.bootstrap).toBeUndefined()
    expect(lifecycle.unmount).toBeUndefined()
  })
})
