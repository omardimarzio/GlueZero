/**
 * Tier-1 unit suite per `createMfEsmError` (factory locale D-V2-F9-12).
 *
 * Copertura:
 * - Code preservation per ciascuno dei 3 codes (MF_LOADER_TIMEOUT, MF_LOADER_ABORTED, MF_LOADER_INVALID_MODULE).
 * - Category cast costante `'microfrontend'` (literal cast pattern D-V2-F9-12).
 * - Details shape opzionale + serializzazione strict rich diagnostic D-V2-F9-08.
 * - OriginalError propagation (Error.cause ES2022 inherited da createBrokerError).
 * - Type-only check union `MfEsmErrorCode` cardinality.
 *
 * Convention: identificatori inglesi, descrizioni `describe`/`it` italiane (CLAUDE.md).
 */
import { describe, expect, it } from 'vitest'
import { createMfEsmError, type MfEsmErrorCode } from '../mf-esm-error'

describe('createMfEsmError — factory locale (D-V2-F9-12)', () => {
  it('produce BrokerError con code MF_LOADER_TIMEOUT preservato', () => {
    const err = createMfEsmError({
      code: 'MF_LOADER_TIMEOUT',
      message: 'Loader timeout su "https://cdn.example/mf.js"',
      details: { url: 'https://cdn.example/mf.js', timeoutMs: 15000, elapsedMs: 15012 },
    })
    expect(err.code).toBe('MF_LOADER_TIMEOUT')
    expect(err.category).toBe('microfrontend')
    expect(err.message).toContain('https://cdn.example/mf.js')
  })

  it('produce BrokerError con code MF_LOADER_ABORTED preservato', () => {
    const err = createMfEsmError({
      code: 'MF_LOADER_ABORTED',
      message: 'Loader aborted via consumer signal',
    })
    expect(err.code).toBe('MF_LOADER_ABORTED')
    expect(err.category).toBe('microfrontend')
  })

  it('produce BrokerError con code MF_LOADER_INVALID_MODULE preservato', () => {
    const err = createMfEsmError({
      code: 'MF_LOADER_INVALID_MODULE',
      message: 'No valid lifecycle hooks in module',
      details: {
        url: 'https://cdn.example/mf.js',
        hasDefault: true,
        defaultKeys: ['name', 'version'],
        namedKeys: ['mount'],
        reason: 'mount missing in default export',
      },
    })
    expect(err.code).toBe('MF_LOADER_INVALID_MODULE')
    expect(err.details).toMatchObject({
      url: 'https://cdn.example/mf.js',
      hasDefault: true,
      defaultKeys: ['name', 'version'],
      namedKeys: ['mount'],
      reason: 'mount missing in default export',
    })
  })

  it('omette details se non passato (exactOptionalPropertyTypes-friendly)', () => {
    const err = createMfEsmError({ code: 'MF_LOADER_TIMEOUT', message: 'x' })
    expect(err.details).toBeUndefined()
    // Verifica conditional assignment ereditato da createBrokerError: la proprietà NON è settata.
    expect('details' in err).toBe(false)
  })

  it('omette originalError se non passato', () => {
    const err = createMfEsmError({ code: 'MF_LOADER_TIMEOUT', message: 'x' })
    expect(err.originalError).toBeUndefined()
    expect('originalError' in err).toBe(false)
  })

  it('propaga originalError se passato e setta Error.cause (ES2022)', () => {
    const cause = new TypeError('Failed to fetch module')
    const err = createMfEsmError({
      code: 'MF_LOADER_INVALID_MODULE',
      message: 'parse error',
      originalError: cause,
    })
    expect(err.originalError).toBe(cause)
    expect(err.cause).toBe(cause)
  })

  it('category sempre "microfrontend" via literal cast (D-V2-F9-12)', () => {
    const codes: MfEsmErrorCode[] = [
      'MF_LOADER_TIMEOUT',
      'MF_LOADER_ABORTED',
      'MF_LOADER_INVALID_MODULE',
    ]
    for (const code of codes) {
      const err = createMfEsmError({ code, message: 'test' })
      expect(err.category).toBe('microfrontend')
    }
  })

  it('details shape MF_LOADER_TIMEOUT richiede url/timeoutMs/elapsedMs (D-V2-F9-08)', () => {
    const err = createMfEsmError({
      code: 'MF_LOADER_TIMEOUT',
      message: 'timeout',
      details: { url: 'x', timeoutMs: 100, elapsedMs: 101 },
    })
    expect(err.details).toEqual({ url: 'x', timeoutMs: 100, elapsedMs: 101 })
  })

  it('details shape MF_LOADER_INVALID_MODULE include rich diagnostic (D-V2-F9-08)', () => {
    const details = {
      url: 'x',
      exportName: 'lifecycle',
      hasDefault: false,
      defaultKeys: [] as string[],
      namedKeys: ['foo', 'bar'],
      reason: 'exportName "lifecycle" not found in module',
    }
    const err = createMfEsmError({
      code: 'MF_LOADER_INVALID_MODULE',
      message: 'invalid',
      details,
    })
    expect(err.details).toEqual(details)
  })

  it('istanza è BrokerError ed Error nativo (instanceof Error preserved)', () => {
    const err = createMfEsmError({ code: 'MF_LOADER_TIMEOUT', message: 'x' })
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('BrokerError')
  })

  it('message è descrittivo italiano (convention CLAUDE.md)', () => {
    const err = createMfEsmError({
      code: 'MF_LOADER_TIMEOUT',
      message: 'Loader ESM timeout dopo 15000 ms su "https://cdn.example/mf.js"',
      details: { url: 'https://cdn.example/mf.js', timeoutMs: 15000, elapsedMs: 15012 },
    })
    expect(err.message).toMatch(/timeout/i)
    expect(err.message).toContain('15000')
  })
})

describe('MfEsmErrorCode — type-only checks', () => {
  it('union locale include esattamente 3 codes', () => {
    const codes: MfEsmErrorCode[] = [
      'MF_LOADER_TIMEOUT',
      'MF_LOADER_ABORTED',
      'MF_LOADER_INVALID_MODULE',
    ]
    expect(codes).toHaveLength(3)
    // Sanity: nessuna duplicazione del literal.
    expect(new Set(codes).size).toBe(3)
  })

  it('codes sono tutti SCREAMING_SNAKE_CASE prefisso MF_LOADER_', () => {
    const codes: MfEsmErrorCode[] = [
      'MF_LOADER_TIMEOUT',
      'MF_LOADER_ABORTED',
      'MF_LOADER_INVALID_MODULE',
    ]
    for (const code of codes) {
      expect(code).toMatch(/^MF_LOADER_[A-Z_]+$/)
    }
  })
})
