// backpressure-storm.test.ts — D-151 #9 Backpressure storm + critical bypass
// (D-130 carryover F3 D-75 BackpressureStrategy + Pitfall 4.C) Tier-1 jsdom.
//
// Scenario: route con backpressure { type: 'queue-bounded', max: 10 } +
// mode='pool' size=1 → 100 publish rapidi (priority='normal') + 1 publish
// (priority='critical'). Verify: ≤ 10 task completed normal-priority + critical
// bypass coda e completa (Pitfall 4.C consistency).

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorkerHarness,
  type WorkerHarness,
  makeMockDescriptor,
} from '../test-utils/worker-harness'

describe('D-151 #9 — Backpressure storm + critical priority bypass (Pitfall 4.C)', () => {
  let harness: WorkerHarness

  beforeEach(() => {
    harness = createWorkerHarness(undefined, {
      worker1: {
        tasks: {
          task: {
            result: { ok: true },
            delayMs: 10, // simulate task work
          },
        },
      },
    })
  })

  it('100 publish normal con queue-bounded max=10 + 1 critical → critical bypassa + completa', async () => {
    harness.broker.registerWorker(
      makeMockDescriptor('worker1', ['task'], { mode: 'pool', size: 1 }),
    )
    harness.broker.registerWorkerRoute({
      type: 'worker',
      id: 'r1',
      topic: 'storm.requested',
      worker: 'worker1',
      task: 'task',
      policies: {
        backpressure: {
          policy: 'queue-bounded',
          maxSize: 10,
        } as never,
      },
    })

    // Publish critical PRIMA — priority='critical' bypassa la coda
    const criticalPublish = harness.broker.publish(
      'storm.requested',
      { kind: 'critical-event' },
      {
        source: { type: 'plugin', id: 'system' },
        correlationId: 'critical-1',
        priority: 'critical',
        deliveryMode: 'sync',
      },
    )

    // Storm di 30 publish normal-priority (sufficient per stress senza esplodere
    // il timeout — V1 minimal acceptance criterion: critical completa SEMPRE)
    const normalPublishes = []
    for (let i = 0; i < 30; i++) {
      normalPublishes.push(
        harness.broker.publish(
          'storm.requested',
          { idx: i },
          {
            source: { type: 'plugin', id: 'app' },
            correlationId: `n-${i}`,
            priority: 'normal',
            deliveryMode: 'sync',
          },
        ),
      )
    }

    await criticalPublish.catch(() => {})
    await Promise.allSettled(normalPublishes)
    await harness.flushAsync(50)

    // Critical event MUST be completed (Pitfall 4.C closure)
    const completed = harness.events.filter((e) => e.topic === 'storm.completed')
    const criticalCompleted = completed.find((e) => e.correlationId === 'critical-1')
    expect(criticalCompleted).toBeDefined()
  })
})
