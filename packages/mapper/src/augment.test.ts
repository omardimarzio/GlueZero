// augment.test.ts — verifica TS declaration merging di @sembridge/core (D-49/D-56/D-57).
//
// Test prevalentemente compile-time: se `augment.ts` non esegue correttamente il
// declaration merging, il typecheck di questo file fallisce (TS error 2339 "Property X
// does not exist on type Y" o 2322 "Type X is not assignable to Y").
//
// Test runtime minimal: `__augmentLoaded` const verifica che il side-effect import
// non venga tree-shaken e non lanci errori a load time (T-02-09-01 mitigation).
//
// Pattern F1 replicato: discriminated test cases con expect statements (vedi
// validator-adapter.test.ts pattern co-locato).

import type { BrokerConfig, PluginDescriptor } from '@sembridge/core'
import { describe, expect, it } from 'vitest'
import { __augmentLoaded } from './augment'
import type { CanonicalSchemaId } from './types/canonical-schema'
import type { InputMap, OutputMap } from './types/input-output-map'
import type { TransformFn } from './types/transform'

describe('augment.ts (TS declaration merging)', () => {
  it('runtime side-effect import is safe (no throw + tree-shake guard)', () => {
    expect(__augmentLoaded).toBe(true)
  })

  it('PluginDescriptor has inputMap/outputMap/canonicalSchemaId fields (compile-time)', () => {
    // Type-level assertion: questo deve compilare senza errori dopo l'augmentation.
    // Se augment.ts non fa il merging, TS fallisce con "Object literal may only specify
    // known properties, and 'inputMap' does not exist in type 'PluginDescriptor'".
    const inputMap: InputMap = { x: { source: 'y' } }
    const outputMap: OutputMap = { a: { source: 'b' } }
    const canonicalSchemaId = 'weather' as CanonicalSchemaId

    const desc: PluginDescriptor = {
      id: 'test',
      inputMap,
      outputMap,
      canonicalSchemaId,
    }

    expect(desc.id).toBe('test')
    expect(desc.inputMap).toBe(inputMap)
    expect(desc.outputMap).toBe(outputMap)
    expect(desc.canonicalSchemaId).toBe(canonicalSchemaId)
  })

  it('BrokerConfig has typed canonicalModel/aliasRegistry/transforms fields (compile-time)', () => {
    // Type-level assertion: dopo l'augmentation, queste sezioni NON sono più `unknown`
    // ma hanno la shape specifica definita in augment.ts (D-56 — chiude i placeholder F1).
    const fn: TransformFn = (input) => input

    const cfg: BrokerConfig = {
      canonicalModel: {
        schemas: [
          {
            id: 'a' as CanonicalSchemaId,
            fields: { x: { type: 'string' } },
          },
        ],
      },
      aliasRegistry: {
        global: { city: 'location' },
        scoped: { 'plugin-a': { foo: 'bar' } },
      },
      transforms: {
        myTransform: fn,
      },
    }

    expect(cfg.canonicalModel?.schemas).toHaveLength(1)
    expect(cfg.canonicalModel?.schemas?.[0]?.id).toBe('a')
    expect(cfg.aliasRegistry?.global?.city).toBe('location')
    expect(cfg.aliasRegistry?.scoped?.['plugin-a']?.foo).toBe('bar')
    expect(cfg.transforms?.myTransform).toBe(fn)
  })

  it('PluginDescriptor without F2 fields still valid (backward-compat F1)', () => {
    // Test backward-compat: F1 PluginDescriptor minimale con solo `id` deve continuare
    // a essere valido. L'augmentation è additive (T-02-09-03 mitigation).
    const minimal: PluginDescriptor = { id: 'min' }
    expect(minimal.id).toBe('min')
    expect(minimal.inputMap).toBeUndefined()
    expect(minimal.outputMap).toBeUndefined()
    expect(minimal.canonicalSchemaId).toBeUndefined()
  })

  it('BrokerConfig without F2 sections still valid (backward-compat F1)', () => {
    // Le sezioni F2 sono opzionali — F1 BrokerConfig senza canonicalModel/aliasRegistry/transforms
    // continua a essere valido (T-02-09-03 mitigation).
    const cfg: BrokerConfig = {
      runtime: { debug: false },
    }
    expect(cfg.canonicalModel).toBeUndefined()
    expect(cfg.aliasRegistry).toBeUndefined()
    expect(cfg.transforms).toBeUndefined()
  })

  it('BrokerConfig.canonicalModel.schemas accepts readonly array (CanonicalSchema[])', () => {
    // Verifica che il tipo accetta un array di CanonicalSchema completi con tutti i field.
    const cfg: BrokerConfig = {
      canonicalModel: {
        schemas: [
          {
            id: 'weather' as CanonicalSchemaId,
            requires: [],
            fields: {
              location: { type: 'string', required: true },
              forecast_date: { type: 'string', required: true, onFailure: 'block' },
              temperature_celsius: { type: 'number', required: false, default: 0 },
            },
            description: 'Weather canonical schema',
          },
        ],
      },
    }
    expect(cfg.canonicalModel?.schemas?.[0]?.fields.location?.required).toBe(true)
  })
})
