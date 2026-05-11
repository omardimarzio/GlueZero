/**
 * Tier-1 jsdom test suite — `inspector-wrapper.ts` Proxy composition D-46 (MF-MAP-03 +
 * MF-INT-MAP-02).
 *
 * Test coverage:
 * - recordError enrich con microFrontendId quando mfId defined
 * - recordError passthrough (no enrich) quando mfId undefined
 * - Ring buffer F2 contiene microFrontendId in details
 * - Passthrough preserva tutti gli altri metodi (lastErrors, clearErrors, getSnapshot)
 * - back-compat: details preservato + microFrontendId aggiunto (no overwrite)
 * - mfId dynamic: getMfIdFromContext invocata ad ogni recordError call
 *
 * @see D-V2-F10-10 (Inspector EventTap wrapper)
 * @see D-46 (composition wrapper pattern)
 * @see T-F10-W2-P04-01 (Proxy escape mitigation)
 * @see T-F10-W2-P04-02 (BrokerError mutation mitigation)
 */
import { type ErrorCategory, createBrokerError } from '@gluezero/core'
import {
  AliasRegistry,
  CanonicalRegistry,
  MappingInspector,
  TransformPipeline,
} from '@gluezero/mapper'
import { describe, expect, it, vi } from 'vitest'
import { wrapInspectorWithMfAttribution } from '../inspector-wrapper'

function makeInspector(): MappingInspector {
  return new MappingInspector({
    canonicalRegistry: new CanonicalRegistry(),
    aliasRegistry: new AliasRegistry(),
    transformPipeline: new TransformPipeline(),
    errorBufferSize: 50,
  })
}

function makeError(code: string, details?: Record<string, unknown>): ReturnType<typeof createBrokerError> {
  return createBrokerError({
    code,
    category: 'mapping' as ErrorCategory,
    message: 'test error',
    ...(details !== undefined && { details }),
  })
}

describe('wrapInspectorWithMfAttribution — Proxy composition (MF-MAP-03 + MF-INT-MAP-02)', () => {
  it('recordError enrich con microFrontendId quando mfId defined', () => {
    const inspector = makeInspector()
    const recordSpy = vi.spyOn(inspector, 'recordError')
    const wrapped = wrapInspectorWithMfAttribution(inspector, () => 'mf-customer')
    wrapped.recordError(makeError('TEST_ERR'))
    expect(recordSpy).toHaveBeenCalledTimes(1)
    const recorded = recordSpy.mock.calls[0]![0] as { details?: Record<string, unknown> }
    expect(recorded.details?.['microFrontendId']).toBe('mf-customer')
  })

  it('recordError passthrough (no enrich) quando mfId undefined', () => {
    const inspector = makeInspector()
    const recordSpy = vi.spyOn(inspector, 'recordError')
    const wrapped = wrapInspectorWithMfAttribution(inspector, () => undefined)
    const err = makeError('TEST_ERR')
    wrapped.recordError(err)
    // Passthrough — recordSpy chiamato con ERR ORIGINALE (stesso ref)
    expect(recordSpy.mock.calls[0]![0]).toBe(err)
  })

  it('ring buffer F2 contiene microFrontendId in details (MF-INT-MAP-02)', () => {
    const inspector = makeInspector()
    const wrapped = wrapInspectorWithMfAttribution(inspector, () => 'mf-x')
    wrapped.recordError(makeError('ERR_1'))
    wrapped.recordError(makeError('ERR_2'))
    const errors = inspector.lastErrors()
    expect(errors).toHaveLength(2)
    expect((errors[0]!.details as Record<string, unknown>)['microFrontendId']).toBe('mf-x')
    expect((errors[1]!.details as Record<string, unknown>)['microFrontendId']).toBe('mf-x')
  })

  it('passthrough preserva tutti gli altri metodi (lastErrors, clearErrors, getSnapshot)', () => {
    const inspector = makeInspector()
    const wrapped = wrapInspectorWithMfAttribution(inspector, () => 'mf-x')
    expect(typeof wrapped.lastErrors).toBe('function')
    expect(typeof wrapped.clearErrors).toBe('function')
    expect(typeof wrapped.getSnapshot).toBe('function')
    // lastErrors funziona normalmente
    wrapped.recordError(makeError('ERR'))
    expect(wrapped.lastErrors()).toHaveLength(1)
    // clearErrors funziona normalmente
    wrapped.clearErrors()
    expect(wrapped.lastErrors()).toHaveLength(0)
  })

  it('back-compat: details preservato + microFrontendId aggiunto (no overwrite — T-F10-W2-P04-02)', () => {
    const inspector = makeInspector()
    const wrapped = wrapInspectorWithMfAttribution(inspector, () => 'mf-x')
    const err = makeError('ERR', { existingField: 'preserved', anotherField: 42 })
    wrapped.recordError(err)
    const recorded = inspector.lastErrors()[0]!.details as Record<string, unknown>
    expect(recorded['existingField']).toBe('preserved')
    expect(recorded['anotherField']).toBe(42)
    expect(recorded['microFrontendId']).toBe('mf-x')
  })

  it('mfId dynamic: getMfIdFromContext invocata ad ogni recordError call', () => {
    const inspector = makeInspector()
    let currentMfId: string | undefined = 'mf-A'
    const wrapped = wrapInspectorWithMfAttribution(inspector, () => currentMfId)
    wrapped.recordError(makeError('E1'))
    currentMfId = 'mf-B'
    wrapped.recordError(makeError('E2'))
    const errs = inspector.lastErrors()
    expect((errs[0]!.details as Record<string, unknown>)['microFrontendId']).toBe('mf-A')
    expect((errs[1]!.details as Record<string, unknown>)['microFrontendId']).toBe('mf-B')
  })

  it('NO mutation di err originale (T-F10-W2-P04-02): err.details intatto', () => {
    const inspector = makeInspector()
    const wrapped = wrapInspectorWithMfAttribution(inspector, () => 'mf-x')
    const err = makeError('ERR', { existingField: 'X' })
    wrapped.recordError(err)
    // err originale NON mutato — microFrontendId presente solo nel clone
    expect(err.details).toEqual({ existingField: 'X' })
    expect(err.details?.['microFrontendId']).toBeUndefined()
  })
})
