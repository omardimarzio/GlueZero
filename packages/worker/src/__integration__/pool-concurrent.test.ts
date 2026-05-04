// pool-concurrent.test.ts — D-151 #2 Pool concurrent dispatch Tier-1 jsdom.
//
// Scenario: worker mode='pool' size=2 + 4 publish in parallel → cap rispettato
// (≤ 2 bridge spawned), tutti i 4 task completano (4 event `<topic>.completed`).

import { beforeEach, describe, expect, it } from 'vitest'
import {
  createWorkerHarness,
  MockBridge,
  makeMockDescriptor,
  type WorkerHarness,
} from '../test-utils/worker-harness'

describe('D-151 #2 — Pool concurrent — cap rispettato + tutti i task completano', () => {
  let harness: WorkerHarness

  beforeEach(() => {
    harness = createWorkerHarness(undefined, {
      'csv-parser': {
        tasks: {
          parse: {
            result: { ok: true },
            delayMs: 30, // simulate IO-bound task
          },
        },
      },
    })
  })

  it('mode=pool size=2 con 4 publish parallel — 2 bridge spawned + 4 completed', async () => {
    harness.broker.registerWorker(
      makeMockDescriptor('csv-parser', ['parse'], { mode: 'pool', size: 2 }),
    )
    harness.broker.registerWorkerRoute({
      type: 'worker',
      id: 'r-csv',
      topic: 'csv.parse.requested',
      worker: 'csv-parser',
      task: 'parse',
    })

    // Fire 4 publish in parallel — pool size=2, cap rispettato
    await Promise.all([
      harness.broker.publish(
        'csv.parse.requested',
        { batch: 1 },
        { source: { type: 'plugin', id: 'app' }, correlationId: 'c1', deliveryMode: 'sync' },
      ),
      harness.broker.publish(
        'csv.parse.requested',
        { batch: 2 },
        { source: { type: 'plugin', id: 'app' }, correlationId: 'c2', deliveryMode: 'sync' },
      ),
      harness.broker.publish(
        'csv.parse.requested',
        { batch: 3 },
        { source: { type: 'plugin', id: 'app' }, correlationId: 'c3', deliveryMode: 'sync' },
      ),
      harness.broker.publish(
        'csv.parse.requested',
        { batch: 4 },
        { source: { type: 'plugin', id: 'app' }, correlationId: 'c4', deliveryMode: 'sync' },
      ),
    ])

    await harness.flushAsync()

    const completed = harness.events.filter((e) => e.topic === 'csv.parse.completed')
    expect(completed.length).toBe(4)

    // Pool cap rispettato — max 2 bridge spawned (size=2)
    const bridges = MockBridge.byWorkerId.get('csv-parser') ?? []
    expect(bridges.length).toBeLessThanOrEqual(2)
    expect(bridges.length).toBeGreaterThanOrEqual(1)

    // Tutti i correlationId presenti
    const correlationIds = new Set(completed.map((e) => e.correlationId))
    expect(correlationIds.has('c1')).toBe(true)
    expect(correlationIds.has('c2')).toBe(true)
    expect(correlationIds.has('c3')).toBe(true)
    expect(correlationIds.has('c4')).toBe(true)
  })
})
