/**
 * Contracts Validator tests (MF-CONTRACT-02).
 *
 * Tier-1 jsdom coverage: positive + negative + policy combinations.
 * F8 placeholder shape check only — effective check vs registry state in F11/F13.
 */
import { describe, expect, it, vi } from 'vitest'
import { validateContracts } from './contracts-validator'

describe('validateContracts — F8 placeholder shape check + policy', () => {
  it('contracts undefined → ok, no warnings/errors', () => {
    const result = validateContracts(undefined, {
      mfId: 'test',
      phase: 'register',
    })
    expect(result.ok).toBe(true)
    expect(result.warnings.length).toBe(0)
    expect(result.errors.length).toBe(0)
  })

  it('contracts valid shape → ok, no errors', () => {
    const result = validateContracts(
      {
        topics: [{ topic: 'customer.created', direction: 'publish' }],
        routes: [],
        workers: [],
        contexts: [],
        theme: { provides: ['primary-color'] },
      },
      { mfId: 'test', phase: 'register' },
    )
    expect(result.ok).toBe(true)
    expect(result.errors.length).toBe(0)
  })

  it('topics non-array → error + policy warn (degrade to warnings)', () => {
    const result = validateContracts(
      // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid shape
      { topics: 'not-array' as any, validation: 'warn' },
      { mfId: 'test', phase: 'register' },
    )
    // policy warn: errors merged into warnings, ok forced true
    expect(result.ok).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings.some((w) => w.contractType === 'topics')).toBe(true)
  })

  it('topics non-array + policy fail-registration → throw MF_DESCRIPTOR_INVALID', () => {
    try {
      validateContracts(
        // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid shape
        { topics: 'not-array' as any, validation: 'fail-registration' },
        { mfId: 'test', phase: 'register' },
      )
      expect.fail('should have thrown')
    } catch (err: unknown) {
      const e = err as { code: string }
      expect(e.code).toBe('MF_DESCRIPTOR_INVALID')
    }
  })

  it('topics non-array + policy fail-mount on register phase → no throw (degrade)', () => {
    const result = validateContracts(
      // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid shape
      { topics: 'not-array' as any, validation: 'fail-mount' },
      { mfId: 'test', phase: 'register' },
    )
    // fail-mount triggers solo su phase: 'mount'; su 'register' degrade
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.ok).toBe(false) // structural errors detected, ma no throw
  })

  it('topics non-array + policy fail-mount on mount phase → throw MF_DESCRIPTOR_INVALID', () => {
    try {
      validateContracts(
        // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid shape
        { topics: 'not-array' as any, validation: 'fail-mount' },
        { mfId: 'test', phase: 'mount' },
      )
      expect.fail('should have thrown')
    } catch (err: unknown) {
      const e = err as { code: string }
      expect(e.code).toBe('MF_DESCRIPTOR_INVALID')
    }
  })

  it('topic con direction invalida → warning (no throw default policy warn)', () => {
    const result = validateContracts(
      // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid shape
      { topics: [{ topic: 'x', direction: 'invalid' } as any] },
      { mfId: 'test', phase: 'register' },
    )
    expect(result.ok).toBe(true) // policy warn default
    expect(result.warnings.some((w) => w.message.includes('direction'))).toBe(true)
  })

  it('topic con stringa vuota → warning', () => {
    const result = validateContracts(
      { topics: [{ topic: '', direction: 'publish' }] },
      { mfId: 'test', phase: 'register' },
    )
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('routes non-array → error', () => {
    const result = validateContracts(
      // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid shape
      { routes: 'not-array' as any, validation: 'fail-registration' },
      { mfId: 'test', phase: 'mount' }, // mount phase: fail-registration NON applica → degrade
    )
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.ok).toBe(false)
  })

  it('workers non-array → error', () => {
    const result = validateContracts(
      // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid shape
      { workers: 'not-array' as any },
      { mfId: 'test', phase: 'register' },
    )
    // policy default warn → ok forced true ma warnings popolate da errors merge
    expect(result.warnings.some((w) => w.contractType === 'workers')).toBe(true)
  })

  it('contexts non-array + policy fail-mount on mount phase → throw MF_DESCRIPTOR_INVALID', () => {
    try {
      validateContracts(
        // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid shape
        { contexts: 'not-array' as any, validation: 'fail-mount' },
        { mfId: 'test', phase: 'mount' },
      )
      expect.fail('should have thrown')
    } catch (err: unknown) {
      const e = err as { code: string; details: { contractType: string } }
      expect(e.code).toBe('MF_DESCRIPTOR_INVALID')
      expect(e.details.contractType).toBe('contexts')
    }
  })

  it('theme non-object → error', () => {
    const result = validateContracts(
      // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid shape
      { theme: 'not-object' as any },
      { mfId: 'test', phase: 'register' },
    )
    expect(result.warnings.some((w) => w.contractType === 'theme')).toBe(true)
  })

  it('logger.warn chiamato per ogni warning/error in policy warn', () => {
    const warnSpy = vi.fn()
    validateContracts(
      { topics: [{ topic: '', direction: 'publish' }] },
      {
        mfId: 'test',
        phase: 'register',
        logger: { warn: warnSpy },
      },
    )
    expect(warnSpy).toHaveBeenCalled()
  })

  it('policy default è "warn" se non specificata', () => {
    const result = validateContracts(
      // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid shape
      { topics: 'not-array' as any },
      { mfId: 'test', phase: 'register' },
    )
    // policy default warn → ok forced true
    expect(result.ok).toBe(true)
  })

  it('error details contengono mfId + phase + policy + errors list', () => {
    try {
      validateContracts(
        // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid shape
        { topics: 'not-array' as any, validation: 'fail-registration' },
        { mfId: 'cust-dashboard', phase: 'register' },
      )
      expect.fail('should have thrown')
    } catch (err: unknown) {
      const e = err as {
        code: string
        details: {
          mfId: string
          phase: string
          policy: string
          contractType: string
          errors: Array<{ type: string; message: string }>
        }
      }
      expect(e.code).toBe('MF_DESCRIPTOR_INVALID')
      expect(e.details.mfId).toBe('cust-dashboard')
      expect(e.details.phase).toBe('register')
      expect(e.details.policy).toBe('fail-registration')
      expect(e.details.errors.length).toBeGreaterThan(0)
    }
  })
})
