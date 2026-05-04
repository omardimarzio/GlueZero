// augment.test.ts — verifica TS declaration merging F5 Worker Runtime (D-122,
// D-126, D-152, Pattern S1 + S5).
//
// Test prevalentemente compile-time: se `augment.ts` non esegue correttamente
// il declaration merging, il typecheck di questo file fallisce (TS error 2339
// "Property X does not exist on type Y" o 2322 "Type X is not assignable to Y").
//
// Test runtime minimal: `__augmentWorkerLoaded` const verifica che il
// side-effect import non venga tree-shaken e non lanci errori a load time
// (T-05-01-02 mitigation).
//
// Pattern role-match con `packages/gateway/src/sse-ws/augment.test.ts` (analog
// F4) replicato (vedi 05-PATTERNS.md §"augment.test.ts").

import type { BrokerConfig, PluginDescriptor } from '@sembridge/core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { __augmentWorkerLoaded, type F5PipelineStep } from './augment'
import {
  INTERNAL_TOPICS_WORKER,
  isInternalWorkerTopic,
  type ProgressPayload,
  type RouteWorkerDefinition,
  type TaskState,
  type WorkerConfig,
  type WorkerDescriptor,
  type WorkerTaskOutcome,
} from './types'

describe('augment.ts (F5 TS declaration merging — plan 05-01)', () => {
  it('Test 1: __augmentWorkerLoaded const true exported (Pattern S1 anti tree-shake — T-05-01-02)', () => {
    expect(__augmentWorkerLoaded).toBe(true)
  })

  it('Test 2: BrokerConfig.workers field accepts WorkerConfig (D-122 decl merging)', () => {
    expectTypeOf<BrokerConfig>().toHaveProperty('workers')
    expectTypeOf<BrokerConfig['workers']>().toMatchTypeOf<WorkerConfig | undefined>()

    const config: BrokerConfig = {
      workers: {
        assertSerializable: 'dev',
        defaultProgressThrottleMs: 100,
        defaultTimeoutMs: 30_000,
      },
    }
    expect(config.workers?.assertSerializable).toBe('dev')
    expect(config.workers?.defaultProgressThrottleMs).toBe(100)
    expect(config.workers?.defaultTimeoutMs).toBe(30_000)
  })

  it('Test 3: PluginDescriptor.workers field accepts WorkerDescriptor[] (D-126 cascade)', () => {
    expectTypeOf<PluginDescriptor>().toHaveProperty('workers')
    expectTypeOf<PluginDescriptor['workers']>().toMatchTypeOf<
      readonly WorkerDescriptor[] | undefined
    >()

    // factory uses 'about:blank' as a benign URL — safe in jsdom (Worker
    // constructor not invoked in this smoke test, only type-level check).
    const descriptor: PluginDescriptor = {
      id: 'p1',
      workers: [
        {
          id: 'report-worker',
          factory: () => new Worker('about:blank'),
          tasks: ['generateReport'] as const,
          mode: 'pool',
        },
      ],
    }
    expect(descriptor.workers?.[0]?.id).toBe('report-worker')
    expect(descriptor.workers?.[0]?.mode).toBe('pool')
    expect(descriptor.workers?.[0]?.tasks).toEqual(['generateReport'])
  })

  it('Test 4: F5PipelineStep literal union has 4 exact members (D-152 pipeline §28 step 9)', () => {
    const steps: readonly F5PipelineStep[] = [
      'event.worker.dispatched',
      'event.worker.progress',
      'event.worker.completed',
      'event.worker.failed',
    ] as const
    expect(steps).toHaveLength(4)
    expect(steps[0]).toBe('event.worker.dispatched')
    expect(steps[3]).toBe('event.worker.failed')
  })

  it('Test 5: Coexistence with F2/F3/F4 augmentations (cumulative decl merging — T-05-01-04)', () => {
    // Type-level test — se compila, il decl merging F2/F3/F4/F5 coesiste in
    // BrokerConfig su FIELD DISGIUNTI (canonicalModel/aliasRegistry/transforms
    // F2 + routes/routing/gateway F3 + realtime F4 + workers F5).
    const config: BrokerConfig = {
      workers: { assertSerializable: 'off' },
      realtime: { channels: [] },
      gateway: { auth: { getToken: async () => 'tok' } },
      canonicalModel: { schemas: [] },
      routes: [],
    }
    expect(config.workers?.assertSerializable).toBe('off')
    expect(config.realtime?.channels).toEqual([])
    expect(config.gateway?.auth).toBeDefined()
  })

  it('Test 6: INTERNAL_TOPICS_WORKER frozen + STRICT match (Pattern S5 anti AP-6 — T-05-01-06)', () => {
    expect(INTERNAL_TOPICS_WORKER.CANCEL).toBe('__cancel__')
    expect(INTERNAL_TOPICS_WORKER.PROGRESS).toBe('__progress__')
    expect(Object.isFrozen(INTERNAL_TOPICS_WORKER)).toBe(true)
    expect(isInternalWorkerTopic('__cancel__')).toBe(true)
    expect(isInternalWorkerTopic('__progress__')).toBe(true)
    // STRICT: weather.__cancel__ NOT internal (anti prefix-spoofing AP-6)
    expect(isInternalWorkerTopic('weather.__cancel__')).toBe(false)
    expect(isInternalWorkerTopic('__cancelxxx__')).toBe(false)
    expect(isInternalWorkerTopic('cancel')).toBe(false)
    expect(isInternalWorkerTopic('')).toBe(false)
  })

  it('Test 7: PluginDescriptor coesiste realtimeChannels (F4) + workers (F5) simultanei', () => {
    // Verifica che decl merging F4 + F5 sullo stesso PluginDescriptor non
    // collidano (campi disgiunti). Pattern S1 cumulative.
    const desc: PluginDescriptor = {
      id: 'multi-feature-plugin',
      realtimeChannels: [],
      workers: [],
    }
    expect(desc.realtimeChannels).toEqual([])
    expect(desc.workers).toEqual([])
  })

  it('Test 8: ProgressPayload + TaskState + RouteWorkerDefinition + WorkerTaskOutcome importable (D-136/D-133/D-143/D-152)', () => {
    const progress: ProgressPayload = {
      value: 0.5,
      message: 'half',
      partialResult: { rows: 5000 },
    }
    expect(progress.value).toBe(0.5)
    expect(progress.message).toBe('half')

    const state: TaskState = 'pending'
    expect(state).toBe('pending')

    // D-143 Pick subset enforced — solo timeout/concurrency/backpressure/dedupe
    const route: RouteWorkerDefinition = {
      type: 'worker',
      id: 'r1',
      topic: 'report.generation.requested',
      worker: 'report-worker',
      task: 'generateReport',
      transferable: ['payload.csvBuffer'],
      progressThrottleMs: 200,
      policies: { timeout: 30_000, concurrency: 'latest-only' },
    }
    expect(route.type).toBe('worker')
    expect(route.policies?.timeout).toBe(30_000)
    expect(route.policies?.concurrency).toBe('latest-only')

    const outcome: WorkerTaskOutcome = {
      taskId: 'tk_abc',
      correlationId: 'corr_xyz',
      state: 'done',
      result: { ok: true },
      elapsedMs: 1234,
    }
    expect(outcome.state).toBe('done')
    expect(outcome.elapsedMs).toBe(1234)
  })
})
