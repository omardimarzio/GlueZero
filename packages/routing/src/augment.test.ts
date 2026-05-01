// augment.test.ts — verifica TS declaration merging F3 (D-83/D-93/D-94/D-95).
//
// Test prevalentemente compile-time: se `augment.ts` non esegue correttamente il
// declaration merging, il typecheck di questo file fallisce (TS error 2339 "Property X
// does not exist on type Y" o 2322 "Type X is not assignable to Y").
//
// Test runtime minimal: `__augmentLoaded` const verifica che il side-effect import
// non venga tree-shaken e non lanci errori a load time (T-03-03-01 mitigation).
//
// Pattern F2 replicato (vedi packages/mapper/src/augment.test.ts).

import type { BrokerConfig, PluginDescriptor } from '@sembridge/core'
import type { CanonicalSchema, CanonicalSchemaId } from '@sembridge/mapper'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { __augmentLoaded, type F3PipelineStep } from './augment'
import type { RouteDefinition } from './types/route-definition'

describe('augment.ts (F3 TS declaration merging)', () => {
  it('runtime side-effect import is safe (no throw + tree-shake guard)', () => {
    expect(__augmentLoaded).toBe(true)
  })

  it('PluginDescriptor has routes? field (compile-time, D-94/ROUTE-01)', () => {
    // Type-level assertion: questo deve compilare senza errori dopo l'augmentation F3.
    // Se augment.ts non fa il merging, TS fallisce con "Object literal may only specify
    // known properties, and 'routes' does not exist in type 'PluginDescriptor'".
    expectTypeOf<PluginDescriptor>().toHaveProperty('routes')

    const routeLocal: RouteDefinition = {
      id: 'r-1',
      type: 'local',
      topic: 'weather.loaded',
    }
    const routeHttp: RouteDefinition = {
      id: 'r-2',
      type: 'http',
      topic: 'weather.requested',
      request: { method: 'GET', url: '/api/weather' },
      response: { canonical: 'weather' as CanonicalSchemaId },
    }

    const desc: PluginDescriptor = {
      id: 'test-plugin',
      routes: [routeLocal, routeHttp],
    }

    expect(desc.id).toBe('test-plugin')
    expect(desc.routes).toHaveLength(2)
    expect(desc.routes?.[0]?.id).toBe('r-1')
    expect(desc.routes?.[1]?.type).toBe('http')
  })

  it('BrokerConfig has typed routes/routing fields (compile-time, D-93)', () => {
    // Type-level assertion: dopo l'augmentation F3, queste sezioni sono tipi specifici
    // (`readonly RouteDefinition[]` e `RoutingConfig`) — chiude i placeholder F1/F2.
    expectTypeOf<BrokerConfig>().toHaveProperty('routes')
    expectTypeOf<BrokerConfig>().toHaveProperty('routing')

    const routeLocal: RouteDefinition = { id: 'boot-r', type: 'local', topic: 'audit.*' }

    const cfg: BrokerConfig = {
      routes: [routeLocal],
      routing: {
        multipleRoutesPolicy: 'priority-ordered',
        emitAmbiguousWarning: true,
        requiresRouteTopics: ['payment.charge.requested'],
      },
    }

    expect(cfg.routes).toHaveLength(1)
    expect(cfg.routes?.[0]?.id).toBe('boot-r')
    expect(cfg.routing?.multipleRoutesPolicy).toBe('priority-ordered')
    expect(cfg.routing?.emitAmbiguousWarning).toBe(true)
    expect(cfg.routing?.requiresRouteTopics).toEqual(['payment.charge.requested'])
  })

  it('CanonicalSchema has requiresRoute? field (compile-time, D-95/ROUTE-16)', () => {
    // Type-level assertion: l'augmentation F3 chiude PRD §39 #5 (ROUTE-16).
    // Il campo è opzionale readonly — schemi F2 esistenti senza requiresRoute restano
    // validi (backward-compat).
    expectTypeOf<CanonicalSchema>().toHaveProperty('requiresRoute')

    const schemaWithFlag: CanonicalSchema = {
      id: 'payment' as CanonicalSchemaId,
      fields: { amount: { type: 'number', required: true } },
      requiresRoute: true,
    }
    const schemaWithoutFlag: CanonicalSchema = {
      id: 'weather' as CanonicalSchemaId,
      fields: { location: { type: 'string', required: true } },
    }

    expect(schemaWithFlag.requiresRoute).toBe(true)
    expect(schemaWithoutFlag.requiresRoute).toBeUndefined()
  })

  it('F3PipelineStep literal union includes the 3 new pipeline steps (D-85)', () => {
    // Verifica che il literal union F3PipelineStep sia esattamente i 3 step F3 (D-85).
    expectTypeOf<F3PipelineStep>().toEqualTypeOf<
      'event.route.resolved' | 'event.route.executed' | 'event.outcome.collected'
    >()

    // Smoke runtime: i literal sono assegnabili (puro type-check).
    const step1: F3PipelineStep = 'event.route.resolved'
    const step2: F3PipelineStep = 'event.route.executed'
    const step3: F3PipelineStep = 'event.outcome.collected'
    expect([step1, step2, step3]).toEqual([
      'event.route.resolved',
      'event.route.executed',
      'event.outcome.collected',
    ])
  })

  it('PluginDescriptor without F3 routes still valid (backward-compat F1+F2)', () => {
    // Test backward-compat: F1 PluginDescriptor minimale con solo `id` deve continuare
    // a essere valido. F2 augment (inputMap/outputMap/canonicalSchemaId) e F3 augment
    // (routes) sono entrambi additive (T-03-03-03 mitigation).
    const minimal: PluginDescriptor = { id: 'min' }
    expect(minimal.id).toBe('min')
    expect(minimal.routes).toBeUndefined()
  })

  it('BrokerConfig without F3 sections still valid (backward-compat F1+F2)', () => {
    // Le sezioni F3 sono opzionali — F1+F2 BrokerConfig senza routes/routing
    // continua a essere valido (T-03-03-03 mitigation).
    const cfg: BrokerConfig = {
      runtime: { debug: false },
      canonicalModel: { schemas: [] },
    }
    expect(cfg.routes).toBeUndefined()
    expect(cfg.routing).toBeUndefined()
  })

  it('F2 + F3 augmentations coexist on PluginDescriptor (no collision, T-03-03-02)', () => {
    // Verifica che l'augment F3 non collida con l'augment F2 sullo stesso interface.
    // Un plugin può dichiarare CONTEMPORANEAMENTE inputMap/outputMap (F2) e routes (F3).
    const descBoth: PluginDescriptor = {
      id: 'multi-phase',
      canonicalSchemaId: 'weather' as CanonicalSchemaId,
      inputMap: { x: { source: 'y' } },
      outputMap: { a: { source: 'b' } },
      routes: [{ id: 'r-multi', type: 'local', topic: 'weather.loaded' }],
    }
    expect(descBoth.id).toBe('multi-phase')
    expect(descBoth.canonicalSchemaId).toBe('weather')
    expect(descBoth.inputMap).toBeDefined()
    expect(descBoth.outputMap).toBeDefined()
    expect(descBoth.routes).toHaveLength(1)
  })

  it('F2 + F3 augmentations coexist on BrokerConfig (no collision, T-03-03-02)', () => {
    // Verifica che le sezioni F2 (canonicalModel/aliasRegistry/transforms) e F3
    // (routes/routing) coesistano senza conflitti nello stesso config.
    const cfgBoth: BrokerConfig = {
      runtime: { debug: false },
      canonicalModel: {
        schemas: [
          {
            id: 'weather' as CanonicalSchemaId,
            fields: { location: { type: 'string', required: true } },
            requiresRoute: true,
          },
        ],
      },
      routes: [{ id: 'weather-local', type: 'local', topic: 'weather.requested' }],
      routing: { multipleRoutesPolicy: 'first-match' },
    }
    expect(cfgBoth.canonicalModel?.schemas?.[0]?.id).toBe('weather')
    expect(cfgBoth.canonicalModel?.schemas?.[0]?.requiresRoute).toBe(true)
    expect(cfgBoth.routes?.[0]?.id).toBe('weather-local')
    expect(cfgBoth.routing?.multipleRoutesPolicy).toBe('first-match')
  })
})
