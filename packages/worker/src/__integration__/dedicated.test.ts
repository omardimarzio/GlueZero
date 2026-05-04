// dedicated.test.ts — D-151 #1 Dedicated worker happy path Tier-1 jsdom.
//
// Scenario: worker mode='dedicated' + publish 'report.requested' →
// `<topic>.completed` con correlationId === source event id.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  createWorkerHarness,
  MockBridge,
  makeMockDescriptor,
  type WorkerHarness,
} from '../test-utils/worker-harness'

describe('D-151 #1 — Dedicated worker happy path', () => {
  let harness: WorkerHarness

  beforeEach(() => {
    harness = createWorkerHarness(undefined, {
      report: { tasks: { generate: { result: { rows: 100 } } } },
    })
  })

  it('publish dispatch dedicated → publica `<topic>.completed` + correlationId propagato', async () => {
    harness.broker.registerWorker(makeMockDescriptor('report', ['generate']))
    harness.broker.registerWorkerRoute({
      type: 'worker',
      id: 'r1',
      topic: 'report.generation.requested',
      worker: 'report',
      task: 'generate',
    })

    await harness.broker.publish(
      'report.generation.requested',
      { format: 'pdf' },
      {
        source: { type: 'plugin', id: 'reports-app' },
        correlationId: 'corr-42',
        deliveryMode: 'sync',
      },
    )

    await harness.flushAsync()

    const completed = harness.events.find((e) => e.topic === 'report.generation.completed')
    expect(completed).toBeDefined()
    expect(completed!.payload).toEqual({ rows: 100 })
    expect(completed!.correlationId).toBe('corr-42')

    // mode='dedicated' → 1 bridge spawned
    const bridges = MockBridge.byWorkerId.get('report') ?? []
    expect(bridges.length).toBe(1)
  })
})
