// Integration test — getDebugSnapshot().mappings counters (D-48)
// (Phase 2 ROADMAP success criterion #2 — Mapping Inspector espone counter, REQ MAP-15).
//
// Verifica end-to-end:
//   - `broker.getDebugSnapshot().mappings` espone counter per canonicalSchemas/aliases/transforms
//   - I counter aggiornano dinamicamente al register/unregister
//   - `lastMappingErrors` è array (vuoto baseline; popolato da mapping errors — vedi
//     mapping-error-event test)
//
// **NO mock dei moduli interni F2** (D-49 + plan 02-11 vincolo): usa `createMapperBroker`
// reale tramite `createMapperHarness`. I counter leggono `list().length` dei tre registry.

import { describe, expect, it } from 'vitest'
import { createMapperHarness } from '../test-utils/mapper-harness'
import type { CanonicalSchemaId } from '../types/canonical-schema'

describe('getDebugSnapshot.mappings counters (D-48, success criterion #2)', () => {
  it('exposes counters for canonicalSchemas, registeredAliases, registeredTransforms', () => {
    const harness = createMapperHarness({
      schemas: [
        { id: 'a' as CanonicalSchemaId, fields: { x: { type: 'string' } } },
        { id: 'b' as CanonicalSchemaId, fields: { y: { type: 'string' } } },
      ],
      transforms: {
        t1: (x) => x,
        t2: (x) => x,
      },
      aliases: {
        city: 'location',
      },
    })

    const snap = harness.broker.getDebugSnapshot()
    expect(snap.mappings).toBeDefined()
    expect(snap.mappings.canonicalSchemas).toBe(2)
    expect(snap.mappings.registeredTransforms).toBe(2)
    expect(snap.mappings.registeredAliases).toBe(1)
    expect(Array.isArray(snap.mappings.lastMappingErrors)).toBe(true)
    expect(snap.mappings.lastMappingErrors).toHaveLength(0)
  })

  it('counters update on dynamic register', () => {
    const harness = createMapperHarness()
    const before = harness.broker.getDebugSnapshot().mappings
    expect(before.canonicalSchemas).toBe(0)
    expect(before.registeredTransforms).toBe(0)
    expect(before.registeredAliases).toBe(0)

    // Dynamic register
    harness.broker.registerCanonicalSchema({
      id: 'dyn' as CanonicalSchemaId,
      fields: { z: { type: 'string' } },
    })
    harness.broker.registerTransform('dynT', (x) => x)
    harness.broker.registerAlias('foo', 'bar')

    const after = harness.broker.getDebugSnapshot().mappings
    expect(after.canonicalSchemas).toBe(1)
    expect(after.registeredTransforms).toBe(1)
    expect(after.registeredAliases).toBe(1)
  })

  it('inspector instance accessible via getMappingInspector()', () => {
    const harness = createMapperHarness({
      schemas: [{ id: 's1' as CanonicalSchemaId, fields: { x: { type: 'string' } } }],
      transforms: { t1: (x) => x },
    })

    const inspector = harness.broker.getMappingInspector()
    expect(inspector).toBeDefined()
    expect(typeof inspector.recordError).toBe('function')
    expect(typeof inspector.lastErrors).toBe('function')
    expect(typeof inspector.getSnapshot).toBe('function')
    expect(typeof inspector.clearErrors).toBe('function')

    const inspectorSnap = inspector.getSnapshot()
    expect(inspectorSnap.canonicalSchemas).toBe(1)
    expect(inspectorSnap.registeredTransforms).toBe(1)
  })

  it('snapshot includes F1 fields and F2 mappings section', () => {
    const harness = createMapperHarness()
    const snap = harness.broker.getDebugSnapshot()

    // F1 fields presenti
    expect(snap).toHaveProperty('topics')
    expect(snap).toHaveProperty('subscriberCount')
    expect(snap).toHaveProperty('pluginIds')
    expect(snap).toHaveProperty('pendingAsyncDelivery')
    expect(snap).toHaveProperty('logLevel')
    expect(snap).toHaveProperty('pipelineSteps')

    // F2 mappings section (D-48)
    expect(snap).toHaveProperty('mappings')
    expect(snap.mappings).toHaveProperty('canonicalSchemas')
    expect(snap.mappings).toHaveProperty('registeredAliases')
    expect(snap.mappings).toHaveProperty('registeredTransforms')
    expect(snap.mappings).toHaveProperty('lastMappingErrors')
  })

  it('snapshot is independent from internal state (no mutation leak)', () => {
    const harness = createMapperHarness()
    harness.broker.registerCanonicalSchema({
      id: 'mut' as CanonicalSchemaId,
      fields: { x: { type: 'string' } },
    })

    const snap1 = harness.broker.getDebugSnapshot()
    const errArray = snap1.mappings.lastMappingErrors
    // Mutation locale del result NON deve corrompere lo state interno (T-02-08-04)
    errArray.push({} as never)

    const snap2 = harness.broker.getDebugSnapshot()
    expect(snap2.mappings.lastMappingErrors).toHaveLength(0)
  })
})
