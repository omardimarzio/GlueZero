// cascade-cleanup.test.ts — D-151 #8 Cascade cleanup multi-worker
// (LIFE-02 ext F5 D-126) Tier-1 jsdom.
//
// Scenario: registerPlugin con 5 worker → registry.workerCount === 5 →
// unregisterPlugin → registry.workerCount === 0 + pool.activeBridges === 0;
// nuovo publish stesso topic → `worker.unknown` failure (no dispatch).

import { beforeEach, describe, expect, it } from 'vitest'
import {
  createWorkerHarness,
  makeMockDescriptor,
  type WorkerHarness,
} from '../test-utils/worker-harness'

describe('D-151 #8 — Cascade cleanup multi-worker (LIFE-02 ext F5 D-126)', () => {
  let harness: WorkerHarness

  beforeEach(() => {
    harness = createWorkerHarness(undefined, {
      w1: { tasks: { task1: { result: { id: 1 } } } },
      w2: { tasks: { task1: { result: { id: 2 } } } },
      w3: { tasks: { task1: { result: { id: 3 } } } },
      w4: { tasks: { task1: { result: { id: 4 } } } },
      w5: { tasks: { task1: { result: { id: 5 } } } },
    })
  })

  it('registerPlugin 5 worker → unregisterPlugin → cleanup completo + worker.unknown post', async () => {
    await harness.broker.registerPlugin({
      id: 'big-plugin',
      workers: [
        makeMockDescriptor('w1', ['task1']),
        makeMockDescriptor('w2', ['task1']),
        makeMockDescriptor('w3', ['task1']),
        makeMockDescriptor('w4', ['task1']),
        makeMockDescriptor('w5', ['task1']),
      ],
    })

    expect(harness.broker.getDebugSnapshot().registry.workerCount).toBe(5)

    // Register route + dispatch per spawn bridge
    harness.broker.registerWorkerRoute({
      type: 'worker',
      id: 'r1',
      topic: 'multi.work.requested',
      worker: 'w1',
      task: 'task1',
    })
    await harness.broker.publish(
      'multi.work.requested',
      {},
      { source: { type: 'plugin', id: 'app' }, deliveryMode: 'sync' },
    )
    await harness.flushAsync()

    // Cascade cleanup
    await harness.broker.unregisterPlugin('big-plugin')

    const snap = harness.broker.getDebugSnapshot()
    expect(snap.registry.workerCount).toBe(0)
    expect(snap.pool.activeBridges).toBe(0)

    // Successivo publish stesso topic → worker.unknown failure (route ancora
    // registrata, ma worker non più nel registry).
    harness.reset()
    await harness.broker.publish(
      'multi.work.requested',
      {},
      { source: { type: 'plugin', id: 'app' }, deliveryMode: 'sync' },
    )
    await harness.flushAsync()

    const failed = harness.events.find((e) => e.topic === 'multi.work.failed')
    expect(failed).toBeDefined()
    expect((failed!.payload as { code: string }).code).toBe('worker.unknown')
  })
})
