/**
 * Tier-3 Scenario MF #2 (Chromium reale): 5 error codes literal union (REQ MF-MF-02)
 * + normalize.ts 4-step priority error fallthrough (D-V2-F15 carryover F9).
 *
 * **Strategia**: validiamo le primitive di errore — `MfModuleFederationError` class
 * + `createMfModuleFederationError` factory + `normalizeModule` 4-step priority
 * fallthrough (MF_REMOTE_FACTORY_FAILED) — in Chromium reale per certificare che
 * il bundle finale + l'ES2022 `cause` chain funzioni correttamente.
 *
 * Coverage REQ MF-MF-02 (5 error codes) + D-V2-F15-12 (class custom per-package).
 *
 * @see PLAN 15-05 Phase A — Tier-3 Playwright Chromium 8 scenari (2 MF — error)
 * @see SUMMARY 15-04 — errors.test.ts Tier-1 6 PASS + normalize.test.ts 7 PASS
 */
import { describe, expect, it } from 'vitest'
import { MfModuleFederationError } from '../src/errors.js'
import { normalizeModule } from '../src/normalize.js'

describe('Tier-3 MF #2: 5 error codes + normalize 4-step priority', () => {
  it('MfModuleFederationError extends Error + BrokerError shape inline', () => {
    const err = new MfModuleFederationError({
      code: 'MF_REMOTE_ENTRY_LOAD_FAILED',
      message: 'fetch 404',
      microFrontendId: 'mf-x',
      details: { url: 'https://404.test/remoteEntry.js' },
    })
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(MfModuleFederationError)
    expect(err.code).toBe('MF_REMOTE_ENTRY_LOAD_FAILED')
    expect(err.category).toBeDefined() // BrokerError shape
    expect(err.microFrontendId).toBe('mf-x')
    expect(err.details?.['url']).toBe('https://404.test/remoteEntry.js')
  })

  it('ES2022 cause chain preservation', () => {
    const originalError = new TypeError('factory invocation undefined()')
    const err = new MfModuleFederationError({
      code: 'MF_REMOTE_FACTORY_FAILED',
      message: 'factory failed',
      microFrontendId: 'mf-y',
      cause: originalError,
    })
    expect((err as Error & { cause?: unknown }).cause).toBe(originalError)
  })

  it('5 literal codes union compliance: each instantiable', () => {
    const codes = [
      'MF_REMOTE_ENTRY_LOAD_FAILED',
      'MF_REMOTE_SCOPE_NOT_FOUND',
      'MF_REMOTE_MODULE_NOT_FOUND',
      'MF_REMOTE_FACTORY_FAILED',
      'MF_SHARE_SCOPE_FAILED',
    ] as const

    for (const code of codes) {
      const err = new MfModuleFederationError({
        code,
        message: `test ${code}`,
        microFrontendId: 'mf-test',
      })
      expect(err.code).toBe(code)
      expect(err.message).toContain(code)
    }
  })

  it('normalizeModule Strategy 1 (exportName): factoryResult.exportName found', () => {
    const mountFn = async () => undefined
    const bootstrapFn = async () => undefined
    const unmountFn = async () => undefined
    const customExport = {
      bootstrap: bootstrapFn,
      mount: mountFn,
      unmount: unmountFn,
    }
    const factoryResult = { customExport }
    const result = normalizeModule(factoryResult, {
      exportName: 'customExport',
      url: 'https://mf.test/remoteEntry.js',
      microFrontendId: 'mf-export',
    })
    // extractLifecycle costruisce un wrapper preservando le function refs (D-V2-F9-06)
    expect(typeof result.mount).toBe('function')
    expect(result.mount).toBe(mountFn)
    expect(result.bootstrap).toBe(bootstrapFn)
    expect(result.unmount).toBe(unmountFn)
  })

  it('normalizeModule Strategy 2 (default): factoryResult.default fallback', () => {
    const mountFn = async () => undefined
    const defaultMod = {
      mount: mountFn,
    }
    const factoryResult = { default: defaultMod }
    const result = normalizeModule(factoryResult, {
      url: 'https://mf.test/remoteEntry.js',
      microFrontendId: 'mf-default',
    })
    expect(typeof result.mount).toBe('function')
    expect(result.mount).toBe(mountFn)
  })

  it('normalizeModule Strategy 4 fallthrough → MF_REMOTE_FACTORY_FAILED throw', () => {
    // Nessun matching key — Strategy 4 throw
    const factoryResult = { foo: 'bar', baz: 42 }
    expect(() =>
      normalizeModule(factoryResult, {
        url: 'https://mf.test/remoteEntry.js',
        microFrontendId: 'mf-invalid',
      }),
    ).toThrow(MfModuleFederationError)

    try {
      normalizeModule(factoryResult, {
        url: 'https://mf.test/remoteEntry.js',
        microFrontendId: 'mf-invalid',
      })
    } catch (err) {
      expect((err as MfModuleFederationError).code).toBe('MF_REMOTE_FACTORY_FAILED')
      expect((err as MfModuleFederationError).details?.['url']).toBe(
        'https://mf.test/remoteEntry.js',
      )
    }
  })
})
