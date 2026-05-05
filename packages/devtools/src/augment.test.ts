// augment.test.ts — verifica TS declaration merging F6 Devtools (D-159, D-160,
// D-161, D-163, D-165, D-167, D-168, D-170, Pattern S1).
//
// Test prevalentemente compile-time: se `augment.ts` non esegue correttamente
// il declaration merging, il typecheck di questo file fallisce (TS error 2339
// o 2322).
//
// Test runtime minimal: `__augmentDevtoolsLoaded` const verifica che il
// side-effect import non venga tree-shaken (T-06-01-01 mitigation).
//
// Pattern role-match con `packages/cache/src/augment.test.ts` (analog cache F6
// stesso plan) + `packages/worker/src/augment.test.ts` (analog F5).

import type { BrokerConfig, EventTap } from '@sembridge/core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { __augmentDevtoolsLoaded, type F6PipelineStep } from './augment'
import type {
  DevtoolsConfig,
  HistogramSummary,
  MetricsSnapshot,
  PauseAction,
} from './types'

describe('augment.ts (F6 Devtools TS declaration merging — plan 06-01)', () => {
  it('Test 1: __augmentDevtoolsLoaded const true exported (Pattern S1 anti tree-shake — T-06-01-01)', () => {
    expect(__augmentDevtoolsLoaded).toBe(true)
  })

  it('Test 2: F6PipelineStep literal union has 5 exact members (D-161 step 14 + system audit)', () => {
    const steps: readonly F6PipelineStep[] = [
      'event.observed',
      'system.queue.flushed',
      'system.queue.overflow',
      'system.metrics.cardinality-overflow',
      'system.cache.scope-missing',
    ] as const
    expect(steps).toHaveLength(5)
    expect(steps[0]).toBe('event.observed')
    expect(steps[4]).toBe('system.cache.scope-missing')
  })

  it('Test 3: BrokerConfig.taps field accepts readonly EventTap[] (D-159 multiplex registry)', () => {
    expectTypeOf<BrokerConfig>().toHaveProperty('taps')
    expectTypeOf<BrokerConfig['taps']>().toMatchTypeOf<readonly EventTap[] | undefined>()

    const tap: EventTap = {
      onPipelineStep: () => undefined,
    }
    const config: BrokerConfig = {
      taps: [tap, tap] as const,
    }
    expect(config.taps).toHaveLength(2)
  })

  it('Test 4: BrokerConfig.devtools accetta DevtoolsConfig shape (D-160/D-167/D-170)', () => {
    expectTypeOf<BrokerConfig>().toHaveProperty('devtools')
    expectTypeOf<BrokerConfig['devtools']>().toMatchTypeOf<DevtoolsConfig | undefined>()

    const config: BrokerConfig = {
      devtools: {
        enableByDefault: true,
        eventBufferSize: 500,
        routeBufferSize: 500,
        histogramSamples: 1024,
        maxLabelCombinations: 100,
        pauseQueueMaxSize: 1000,
      },
    }
    expect(config.devtools?.enableByDefault).toBe(true)
    expect(config.devtools?.pauseQueueMaxSize).toBe(1000)
  })

  it('Test 5: Coexistence con BrokerConfig.cache (F6 cache stesso plan — campi disgiunti)', () => {
    // Type-level: cache + devtools simultanei in BrokerConfig (T-06-01-03).
    const config: BrokerConfig = {
      cache: { maxEntries: 500 },
      devtools: { eventBufferSize: 100 },
      taps: [],
    }
    expect(config.cache?.maxEntries).toBe(500)
    expect(config.devtools?.eventBufferSize).toBe(100)
    expect(config.taps).toEqual([])
  })

  it('Test 6: Coexistence con F2-F5 augmentations (cumulative decl merging — T-06-01-03)', () => {
    // canonicalModel/aliasRegistry/transforms F2 + routes/routing/gateway F3 +
    // realtime F4 + workers F5 + cache+devtools+taps F6.
    const config: BrokerConfig = {
      taps: [],
      devtools: { enableByDefault: false },
      cache: { maxEntries: 1000 },
      workers: { assertSerializable: 'off' },
      realtime: { channels: [] },
      gateway: { auth: { getToken: async () => 'tok' } },
      canonicalModel: { schemas: [] },
      routes: [],
    }
    expect(config.taps).toEqual([])
    expect(config.devtools?.enableByDefault).toBe(false)
    expect(config.workers?.assertSerializable).toBe('off')
  })

  it('Test 7: MetricsSnapshot + HistogramSummary readonly enforcement (D-163/D-165)', () => {
    const summary: HistogramSummary = {
      count: 100,
      sum: 1234.5,
      p50: 10,
      p90: 25,
      p99: 95,
    }
    const snapshot: MetricsSnapshot = {
      counters: { 'sembridge.broker.events_published_total': 42 },
      gauges: { 'sembridge.cache.entries_count': 17 },
      histograms: { 'sembridge.http.duration_ms': summary },
    }
    expect(snapshot.counters['sembridge.broker.events_published_total']).toBe(42)
    expect(snapshot.gauges['sembridge.cache.entries_count']).toBe(17)
    expect(snapshot.histograms['sembridge.http.duration_ms']?.p99).toBe(95)
    expectTypeOf<HistogramSummary>().toMatchTypeOf<{
      readonly count: number
      readonly sum: number
      readonly p50: number
      readonly p90: number
      readonly p99: number
    }>()
  })

  it('Test 8: PauseAction discriminated union 3 valori (D-168/D-170)', () => {
    const actions: readonly PauseAction[] = ['pass', 'queued', 'dropped'] as const
    expect(actions).toHaveLength(3)
    expect(actions[0]).toBe('pass')
    expect(actions[1]).toBe('queued')
    expect(actions[2]).toBe('dropped')
  })
})
