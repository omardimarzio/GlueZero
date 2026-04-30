// MappingInspector unit tests (TDD RED → GREEN per plan 02-08).
//
// Copre:
// - Constructor con dependency injection (CanonicalRegistry, AliasRegistry, TransformPipeline)
// - recordSnapshot accetta i 5 step F1 + 5 step F2 senza throw (D-46/D-50)
// - recordError aggiunge al ring buffer; lastErrors() ritorna copia (T-02-08-04)
// - Ring buffer bounded con FIFO drop (T-02-08-01)
// - getSnapshot() ritorna { canonicalSchemas, registeredAliases, registeredTransforms,
//   lastMappingErrors } (D-48)
// - clearErrors() svuota il ring buffer
// - wrapTap composition: tap originale + recordSnapshot inspector
// - wrapTap swallow errori del tap originale (T-02-08-03)

import type { EventTap, PipelineSnapshot, PipelineStep } from '@sembridge/core'
import { createBrokerError } from '@sembridge/core'
import { describe, expect, it, vi } from 'vitest'
import { AliasRegistry } from './alias-registry'
import { CanonicalRegistry } from './canonical-registry'
import { MappingInspector, wrapTap } from './inspector'
import { TransformPipeline } from './transform-pipeline'
import type { CanonicalSchemaId } from './types/canonical-schema'

const makeSnap = (step: PipelineStep): PipelineSnapshot => ({
  eventId: 'evt-1',
  topic: 'test.topic',
  step,
  timestamp: Date.now(),
  durationMs: 0,
})

interface InspectorBundle {
  inspector: MappingInspector
  canonical: CanonicalRegistry
  alias: AliasRegistry
  transform: TransformPipeline
}

const makeInspector = (errorBufferSize = 10): InspectorBundle => {
  const canonical = new CanonicalRegistry()
  const alias = new AliasRegistry()
  const transform = new TransformPipeline()
  const inspector = new MappingInspector({
    canonicalRegistry: canonical,
    aliasRegistry: alias,
    transformPipeline: transform,
    errorBufferSize,
  })
  return { inspector, canonical, alias, transform }
}

describe('MappingInspector', () => {
  it('constructor accepts dependencies', () => {
    const { inspector } = makeInspector()
    expect(inspector).toBeInstanceOf(MappingInspector)
  })

  it('recordSnapshot accepts F1 + F2 pipeline steps without throwing', () => {
    const { inspector } = makeInspector()
    const f1Steps: PipelineStep[] = [
      'event.received',
      'event.metadata.enriched',
      'event.validated',
      'event.dedupe.checked',
      'event.delivered',
    ]
    for (const step of f1Steps) {
      expect(() => inspector.recordSnapshot(step, makeSnap(step))).not.toThrow()
    }
    const f2Steps: PipelineStep[] = [
      'event.source.resolved' as PipelineStep,
      'event.mapped.canonical' as PipelineStep,
      'event.canonical.validated' as PipelineStep,
      'event.mapped.consumer' as PipelineStep,
      'event.final.validated' as PipelineStep,
    ]
    for (const step of f2Steps) {
      expect(() => inspector.recordSnapshot(step, makeSnap(step))).not.toThrow()
    }
  })

  it('recordError appends error to ring buffer; lastErrors returns copy', () => {
    const { inspector } = makeInspector()
    const err1 = createBrokerError({
      code: 'mapping.field.missing',
      category: 'mapping',
      message: 'm1',
    })
    const err2 = createBrokerError({
      code: 'mapping.transform.failed',
      category: 'mapping',
      message: 'm2',
    })
    inspector.recordError(err1)
    inspector.recordError(err2)
    const errors = inspector.lastErrors()
    expect(errors).toHaveLength(2)
    expect(errors[0]?.code).toBe('mapping.field.missing')
    expect(errors[1]?.code).toBe('mapping.transform.failed')

    // Mutation esterna non altera state interno (T-02-08-04)
    errors.length = 0
    expect(inspector.lastErrors()).toHaveLength(2)
  })

  it('ring buffer bounded: keeps last N errors (FIFO drop)', () => {
    const { inspector } = makeInspector(3)
    for (let i = 0; i < 5; i++) {
      inspector.recordError(
        createBrokerError({
          code: 'mapping.field.missing',
          category: 'mapping',
          message: `m${i}`,
        }),
      )
    }
    const errors = inspector.lastErrors()
    expect(errors).toHaveLength(3)
    expect(errors[0]?.message).toBe('m2')
    expect(errors[1]?.message).toBe('m3')
    expect(errors[2]?.message).toBe('m4')
  })

  it('getSnapshot returns counts from registries (D-48)', () => {
    const { inspector, canonical, alias, transform } = makeInspector()
    canonical.register({
      id: 'a' as CanonicalSchemaId,
      fields: { x: { type: 'string' } },
    })
    canonical.register({
      id: 'b' as CanonicalSchemaId,
      fields: { y: { type: 'string' } },
    })
    alias.registerGlobal('city', 'location')
    transform.register('t1', (x) => x)
    transform.register('t2', (x) => x)
    transform.register('t3', (x) => x)

    const snap = inspector.getSnapshot()
    expect(snap.canonicalSchemas).toBe(2)
    expect(snap.registeredAliases).toBe(1)
    expect(snap.registeredTransforms).toBe(3)
    expect(snap.lastMappingErrors).toEqual([])
  })

  it('getSnapshot includes recorded mapping errors', () => {
    const { inspector } = makeInspector()
    const err = createBrokerError({
      code: 'mapping.field.missing',
      category: 'mapping',
      message: 'missing required field',
    })
    inspector.recordError(err)
    const snap = inspector.getSnapshot()
    expect(snap.lastMappingErrors).toHaveLength(1)
    expect(snap.lastMappingErrors[0]?.code).toBe('mapping.field.missing')
  })

  it('clearErrors empties the buffer', () => {
    const { inspector } = makeInspector()
    inspector.recordError(
      createBrokerError({
        code: 'mapping.field.missing',
        category: 'mapping',
        message: 'm',
      }),
    )
    expect(inspector.lastErrors()).toHaveLength(1)
    inspector.clearErrors()
    expect(inspector.lastErrors()).toHaveLength(0)
  })

  it('default errorBufferSize is 10', () => {
    const canonical = new CanonicalRegistry()
    const alias = new AliasRegistry()
    const transform = new TransformPipeline()
    const inspector = new MappingInspector({
      canonicalRegistry: canonical,
      aliasRegistry: alias,
      transformPipeline: transform,
    })
    for (let i = 0; i < 15; i++) {
      inspector.recordError(
        createBrokerError({
          code: 'mapping.field.missing',
          category: 'mapping',
          message: `m${i}`,
        }),
      )
    }
    expect(inspector.lastErrors()).toHaveLength(10)
    expect(inspector.lastErrors()[0]?.message).toBe('m5')
    expect(inspector.lastErrors()[9]?.message).toBe('m14')
  })
})

describe('wrapTap', () => {
  it('wraps original tap + inspector recordSnapshot (composition)', () => {
    const { inspector } = makeInspector()
    const recordSpy = vi.spyOn(inspector, 'recordSnapshot')
    const originalTap: EventTap = { onPipelineStep: vi.fn() }
    const wrapped = wrapTap(originalTap, inspector)
    const snap = makeSnap('event.received')
    wrapped.onPipelineStep('event.received', snap)
    expect(originalTap.onPipelineStep).toHaveBeenCalledWith('event.received', snap)
    expect(recordSpy).toHaveBeenCalledWith('event.received', snap)
  })

  it('original tap throw is swallowed; recordSnapshot still invoked (T-02-08-03)', () => {
    const { inspector } = makeInspector()
    const recordSpy = vi.spyOn(inspector, 'recordSnapshot')
    const originalTap: EventTap = {
      onPipelineStep: vi.fn(() => {
        throw new Error('original tap boom')
      }),
    }
    const wrapped = wrapTap(originalTap, inspector)
    expect(() => wrapped.onPipelineStep('event.received', makeSnap('event.received'))).not.toThrow()
    expect(recordSpy).toHaveBeenCalled()
  })
})
