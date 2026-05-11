import { describe, expect, it } from 'vitest'
import { validateDescriptor } from './descriptor-validator'

/**
 * Helper: assert che `fn` throws un errore con `code === expectedCode`.
 *
 * Pattern necessario perché `code` è una property strutturata del BrokerError,
 * non parte del `message` human-readable. `.toThrow(/CODE/)` matcherebbe solo
 * il message, non il code field.
 */
function expectThrowWithCode(fn: () => unknown, expectedCode: string): void {
  try {
    fn()
    throw new Error(`expected to throw ${expectedCode}, but did not throw`)
  } catch (err: unknown) {
    const e = err as { code?: string }
    expect(e.code).toBe(expectedCode)
  }
}

describe('validateDescriptor — register-time strict (D-V2-11)', () => {
  it('accetta descriptor minimo valido (id/name/version)', () => {
    const valid = validateDescriptor({
      id: 'customer-dashboard',
      name: 'Customer Dashboard',
      version: '1.0.0',
    })
    expect(valid.id).toBe('customer-dashboard')
    expect(valid.name).toBe('Customer Dashboard')
    expect(valid.version).toBe('1.0.0')
  })

  it('accetta descriptor completo con tutti i field opzionali', () => {
    const valid = validateDescriptor({
      id: 'mf.example',
      name: 'Example',
      version: '2.1.0-beta.1+build.123',
      description: 'Test MF',
      owner: { team: 'platform', contact: 'platform@example.com' },
      loader: { type: 'esm', url: '/mfs/example.js', timeoutMs: 15000 },
      mount: { strategy: 'shadow-dom', selector: '#mount' },
      contracts: { validation: 'warn', topics: [], routes: [] },
      mapping: { namespace: 'example', strict: false },
      metadata: { foo: 'bar', count: 42 },
    })
    expect(valid.owner?.team).toBe('platform')
    expect(valid.loader?.type).toBe('esm')
  })

  it('rejects id con uppercase → MF_DESCRIPTOR_INVALID', () => {
    expectThrowWithCode(
      () => validateDescriptor({ id: 'INVALID', name: 'X', version: '1.0.0' }),
      'MF_DESCRIPTOR_INVALID',
    )
  })

  it('rejects id con spazi → MF_DESCRIPTOR_INVALID + field "id"', () => {
    try {
      validateDescriptor({ id: 'has spaces', name: 'X', version: '1.0.0' })
      expect.fail('should have thrown')
    } catch (err: unknown) {
      const e = err as { code: string; details: { field: string; reason: string } }
      expect(e.code).toBe('MF_DESCRIPTOR_INVALID')
      expect(e.details.field).toBe('id')
      expect(e.details.reason).toContain('id must match')
    }
  })

  it('rejects version non-SemVer → MF_DESCRIPTOR_INVALID', () => {
    expectThrowWithCode(
      () => validateDescriptor({ id: 'x', name: 'X', version: '1.0' }),
      'MF_DESCRIPTOR_INVALID',
    )
  })

  it('rejects name vuoto → MF_DESCRIPTOR_INVALID', () => {
    expectThrowWithCode(
      () => validateDescriptor({ id: 'x', name: '', version: '1.0.0' }),
      'MF_DESCRIPTOR_INVALID',
    )
  })

  it('rejects descriptor senza id → MF_DESCRIPTOR_INVALID', () => {
    expectThrowWithCode(
      () => validateDescriptor({ name: 'X', version: '1.0.0' }),
      'MF_DESCRIPTOR_INVALID',
    )
  })

  it('accetta mount strategy enum valido', () => {
    const valid = validateDescriptor({
      id: 'x',
      name: 'X',
      version: '1.0.0',
      mount: { strategy: 'iframe' },
    })
    expect(valid.mount?.strategy).toBe('iframe')
  })

  it('rejects mount strategy invalida → MF_DESCRIPTOR_INVALID', () => {
    expectThrowWithCode(
      () =>
        validateDescriptor({
          id: 'x',
          name: 'X',
          version: '1.0.0',
          mount: { strategy: 'invalid-strategy' },
        }),
      'MF_DESCRIPTOR_INVALID',
    )
  })

  it('accetta metadata open-ended Record<string, unknown>', () => {
    const valid = validateDescriptor({
      id: 'x',
      name: 'X',
      version: '1.0.0',
      metadata: { anyKey: { nested: ['data'] }, count: 42, flag: true },
    })
    expect(valid.metadata?.anyKey).toEqual({ nested: ['data'] })
  })
})
