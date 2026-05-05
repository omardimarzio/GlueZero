// Test RED per createMapperBroker — public factory di @gluezero/mapper.
// Coverage del PLAN 02-10 Task 2: 6 acceptance criteria.

import { describe, expect, it } from 'vitest'
import { createMapperBroker, MapperBroker } from './public-factory'
import type { CanonicalSchemaId } from './types/canonical-schema'
import type { TransformFn } from './types/transform'

describe('createMapperBroker', () => {
  it('Test 1: returns a MapperBroker instance with no config', () => {
    const broker = createMapperBroker()
    expect(broker).toBeInstanceOf(MapperBroker)
  })

  it('Test 2: bootstraps canonicalModel.schemas from config', () => {
    const broker = createMapperBroker({
      runtime: { logLevel: 'silent' },
      canonicalModel: {
        schemas: [
          { id: 'a' as CanonicalSchemaId, fields: { x: { type: 'string' } } },
          { id: 'b' as CanonicalSchemaId, fields: { y: { type: 'string' } } },
        ],
      },
    })
    expect(broker.getDebugSnapshot().mappings.canonicalSchemas).toBe(2)
  })

  it('Test 3: bootstraps aliasRegistry.global from config', () => {
    const broker = createMapperBroker({
      runtime: { logLevel: 'silent' },
      aliasRegistry: {
        global: { city: 'location', day: 'date' },
      },
    })
    expect(broker.getDebugSnapshot().mappings.registeredAliases).toBe(2)
  })

  it('Test 4: bootstraps transforms from config', () => {
    const fn: TransformFn = (x) => x
    const broker = createMapperBroker({
      runtime: { logLevel: 'silent' },
      transforms: { t1: fn, t2: fn, t3: fn },
    })
    expect(broker.getDebugSnapshot().mappings.registeredTransforms).toBe(3)
  })

  it('Test 5: throws on invalid canonicalModel shape (Valibot validation)', () => {
    expect(() =>
      createMapperBroker({
        // @ts-expect-error — wrong shape (string instead of array)
        canonicalModel: { schemas: 'not-an-array' },
      }),
    ).toThrow(/Invalid MapperBrokerConfig/)
  })

  it('Test 6: returns independent instances (D-30 no singleton)', () => {
    const b1 = createMapperBroker()
    const b2 = createMapperBroker()
    expect(b1).not.toBe(b2)
  })

  it('Bonus Test 7: bootstraps aliasRegistry.scoped from config', () => {
    const broker = createMapperBroker({
      runtime: { logLevel: 'silent' },
      aliasRegistry: {
        global: {},
        scoped: {
          'plugin-a': { city: 'location' },
          'plugin-b': { temp: 'temperature_celsius' },
        },
      },
    })
    // Counter globale = 0 (solo scoped)
    expect(broker.getDebugSnapshot().mappings.registeredAliases).toBe(0)
  })

  it('Bonus Test 8: empty config still works (no-op bootstrap)', () => {
    const broker = createMapperBroker({})
    expect(broker).toBeInstanceOf(MapperBroker)
    const snap = broker.getDebugSnapshot()
    expect(snap.mappings.canonicalSchemas).toBe(0)
    expect(snap.mappings.registeredAliases).toBe(0)
    expect(snap.mappings.registeredTransforms).toBe(0)
  })
})
