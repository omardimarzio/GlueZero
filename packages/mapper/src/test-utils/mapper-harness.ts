// mapper-harness.ts — fixture condivisa per integration test del package
// `@sembridge/mapper` (PRD §29 D-53 scenario meteo end-to-end, REQ TEST-01/TEST-02).
//
// Razionale (02-PATTERNS.md §2.4 + plan 02-11):
// I test integration di Phase 2 verificano end-to-end i 5 success criteria del
// ROADMAP attraverso il `MapperBroker` reale (composition root) — NON via mock dei
// moduli interni F2 (`MapperEngine`, `CanonicalRegistry`, `AliasRegistry`,
// `TransformPipeline`, `ValibotAdapter`). La fixture istanzia un `MapperBroker` con
// un `EventTap` custom che cattura ogni `(step, snapshot)` invocazione in un array
// `steps`, esponendo:
//   - `broker`     — istanza reale `createMapperBroker({ runtime: { tap, ... }, ... })`
//   - `steps`      — array `Array<{ step, snapshot }>` accumulato per ogni publish
//   - `reset()`    — svuota `steps` (utile in beforeEach pattern)
//   - `byStep(s)`  — filtra `steps` per uno step specifico, ritornando solo gli snapshot
//   - `defineCanonicalSchema(schema)` — helper pre-register schema canonico
//   - `defineTransform(name, fn)` — helper pre-register transform
//
// `createMapperHarness({ debug?, schemas?, transforms?, aliases? })`:
//   - `debug: false` di default (riproduce production behavior — no `payloadAfter`)
//   - `schemas` opzionale: lista di `CanonicalSchema` registrati al boot
//   - `transforms` opzionale: record `{ name: TransformFn }` registrati al boot
//   - `aliases` opzionale: record `{ local: canonical }` registrati come global aliases
//
// Pattern F1 replicato (vedi packages/core/src/test-utils/pipeline-harness.ts riga
// 1-76): la fixture wrappa la factory pubblica per fornire un `EventTap` osservabile
// + helper di setup. NON modifica l'API runtime — è solo zucchero per i test.
//
// Ownership: file vive sotto `src/test-utils/` (NON sotto `__integration__/`)
// perché può essere riusato da future fasi (F3 routing test, F4 realtime test, F5
// worker test che useranno `@sembridge/mapper`). Esclusione dal bundle pubblico è
// garantita dal tsup entry `src/index.ts` (vedi tsup.config.ts) che re-esporta solo
// i simboli del public surface (NON `test-utils/`).
//
// Note D-49: la fixture USA `createMapperBroker(config)` (non `createBroker` di F1)
// per fedeltà al composition wrapper plan 02-10 — gli integration test verificano la
// pipeline §28 estesa F2 attraverso il broker pubblico, non via mock dei moduli
// interni.

import type { EventTap, PipelineSnapshot, PipelineStep } from '@sembridge/core'
import type { MapperBroker } from '../broker-mapper-wrapper'
import { createMapperBroker } from '../public-factory'
import type { CanonicalSchema } from '../types/canonical-schema'
import type { TransformFn } from '../types/transform'

/**
 * Opzioni per `createMapperHarness({ ... })`.
 *
 * Tutti i campi opzionali — la harness genera default ragionevoli per riprodurre
 * il behavior di production con tap osservabile.
 */
export interface MapperHarnessOptions {
  /** `true` abilita debug mode del Broker (`payloadAfter` snapshots, deep-freeze). */
  readonly debug?: boolean
  /** Schemas canonici registrati al boot via `canonicalModel.schemas` (D-56). */
  readonly schemas?: readonly CanonicalSchema[]
  /** Transforms registrati al boot via `transforms` (D-56). */
  readonly transforms?: Readonly<Record<string, TransformFn>>
  /** Alias globali registrati al boot via `aliasRegistry.global` (D-56). */
  readonly aliases?: Readonly<Record<string, string>>
}

/**
 * Harness ritornata da `createMapperHarness`. Espone il broker reale + array di
 * step osservati + helper per setup.
 */
export interface MapperHarness {
  readonly broker: MapperBroker
  readonly steps: Array<{ step: PipelineStep; snapshot: PipelineSnapshot }>
  reset(): void
  byStep(step: PipelineStep): PipelineSnapshot[]
  defineCanonicalSchema(schema: CanonicalSchema): void
  defineTransform(name: string, fn: TransformFn): void
}

/**
 * Crea un `MapperHarness` per integration test.
 *
 * Pattern F1 replicato (vedi `createPipelineHarness` di `@sembridge/core`).
 *
 * @example
 * ```ts
 * const h = createMapperHarness({
 *   schemas: [{ id: 'weather' as CanonicalSchemaId, fields: { location: { type: 'string' } } }],
 *   transforms: { upper: (s) => String(s).toUpperCase() },
 * })
 * await h.broker.registerPlugin({ id: 'p', outputMap: { ... } })
 * h.broker.publish('topic', { ... }, { source: { type: 'plugin', id: 'p' } })
 * expect(h.byStep('event.delivered')).toHaveLength(1)
 * ```
 */
export function createMapperHarness(options: MapperHarnessOptions = {}): MapperHarness {
  const steps: MapperHarness['steps'] = []
  const tap: EventTap = {
    onPipelineStep(step, snapshot): void {
      steps.push({ step, snapshot })
    },
  }

  // Build config con conditional spread (exactOptionalPropertyTypes compliance) —
  // i field opzionali assenti NON sono `undefined` espliciti.
  const broker = createMapperBroker({
    runtime: {
      tap,
      logLevel: 'silent',
      ...(options.debug !== undefined && { debug: options.debug }),
    },
    ...(options.schemas && { canonicalModel: { schemas: [...options.schemas] } }),
    ...(options.transforms && { transforms: { ...options.transforms } }),
    ...(options.aliases && { aliasRegistry: { global: { ...options.aliases } } }),
  })

  return {
    broker,
    steps,
    reset(): void {
      steps.length = 0
    },
    byStep(step): PipelineSnapshot[] {
      return steps.filter((s) => s.step === step).map((s) => s.snapshot)
    },
    defineCanonicalSchema(schema): void {
      broker.registerCanonicalSchema(schema)
    },
    defineTransform(name, fn): void {
      broker.registerTransform(name, fn)
    },
  }
}
