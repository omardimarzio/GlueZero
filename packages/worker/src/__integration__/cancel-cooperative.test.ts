// cancel-cooperative.test.ts — D-151 #4 Cancellation cooperative (mode='pool',
// concurrency='latest-only') Tier-1 jsdom.
//
// Scenario: 2 publish consecutive con stesso topic in mode='pool' → primo task
// riceve abort (timeout breve simula la concurrency cooperative cancellation),
// solo 1 publica `<topic>.completed`.
//
// Nota V1: il broker V1 non implementa concurrency='latest-only' a livello di
// route policy — la cancellation cooperative è esercitata via timeout esplicito
// che simula la stessa semantica (Pitfall 2C closure verifica state machine
// atomico).

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createWorkerHarness,
  type WorkerHarness,
  MockBridge,
  makeMockDescriptor,
} from '../test-utils/worker-harness'

describe('D-151 #4 — Cancellation cooperative (signal abort onorato)', () => {
  let harness: WorkerHarness

  beforeEach(() => {
    // Bridge slow che onora il signal cooperativo
    harness = createWorkerHarness(undefined, {
      processor: {
        tasks: {
          process: {
            result: { ok: true },
            delayMs: 200,
          },
        },
      },
    })
  })

  it('publish con timeout breve → bridge dispatch riceve abort signal cooperativo', async () => {
    harness.broker.registerWorker(
      makeMockDescriptor('processor', ['process'], { mode: 'pool', size: 1 }),
    )
    harness.broker.registerWorkerRoute({
      type: 'worker',
      id: 'r-proc',
      topic: 'data.process.requested',
      worker: 'processor',
      task: 'process',
      policies: { timeout: 30 }, // timeout < delayMs → cancellation
    })

    await harness.broker.publish(
      'data.process.requested',
      { batch: 1 },
      { source: { type: 'plugin', id: 'app' }, correlationId: 'c1', deliveryMode: 'sync' },
    )

    await harness.flushAsync(20)

    // Il bridge ha ricevuto il signal abort (cooperative cancel) — verifica via tracking
    const bridges = MockBridge.byWorkerId.get('processor') ?? []
    expect(bridges.length).toBeGreaterThanOrEqual(1)
    const totalCancelled = bridges.reduce((acc, b) => acc + b.cancelledCount, 0)
    expect(totalCancelled).toBeGreaterThanOrEqual(1)

    // Outcome: failed con timeout (NON completed)
    const completed = harness.events.filter((e) => e.topic === 'data.process.completed')
    expect(completed.length).toBe(0)
    const failed = harness.events.filter((e) => e.topic === 'data.process.failed')
    expect(failed.length).toBe(1)
    expect((failed[0]!.payload as { code: string }).code).toBe('worker.timeout')
  })
})
