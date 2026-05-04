// timeout-strict.test.ts — D-151 #3 Timeout strict + Pitfall 2C closure
// (state machine atomico) Tier-1 jsdom.
//
// Scenario: route policies.timeout=50ms + MockBridge che NON risponde (delay
// infinito che onora signal) → `<topic>.failed` con code='worker.timeout' E
// NESSUN `<topic>.completed`. lateResponses counter incrementato se il bridge
// risponde late.

import { beforeEach, describe, expect, it } from 'vitest'
import {
  createWorkerHarness,
  makeMockDescriptor,
  type WorkerHarness,
} from '../test-utils/worker-harness'

describe('D-151 #3 — Timeout strict + Pitfall 2C closure (state atomico)', () => {
  let harness: WorkerHarness

  beforeEach(() => {
    // MockBridge con delay > timeout (worker che non risponde mai entro 50ms)
    harness = createWorkerHarness(undefined, {
      slow: {
        tasks: {
          longTask: {
            result: { neverArrives: true },
            delayMs: 5_000, // > timeout
          },
        },
      },
    })
  })

  it('timeout=50ms + bridge slow → publica `<topic>.failed` code=worker.timeout, NO `<topic>.completed`', async () => {
    harness.broker.registerWorker(makeMockDescriptor('slow', ['longTask']))
    harness.broker.registerWorkerRoute({
      type: 'worker',
      id: 'r-slow',
      topic: 'long.work.requested',
      worker: 'slow',
      task: 'longTask',
      policies: { timeout: 50 },
    })

    await harness.broker.publish(
      'long.work.requested',
      {},
      {
        source: { type: 'plugin', id: 'app' },
        correlationId: 'corr-timeout',
        deliveryMode: 'sync',
      },
    )

    await harness.flushAsync(20) // wait extra for any late responses

    const completedEvents = harness.events.filter((e) => e.topic === 'long.work.completed')
    expect(completedEvents.length).toBe(0)

    const failedEvents = harness.events.filter((e) => e.topic === 'long.work.failed')
    expect(failedEvents.length).toBe(1)
    const sanitized = failedEvents[0]!.payload as { code: string; category: string }
    expect(sanitized.code).toBe('worker.timeout')
    expect(sanitized.category).toBe('worker')

    // ERR-02 ext F5 — worker.error topic ext emesso (per audit telemetria)
    const workerErrorEvents = harness.events.filter((e) => e.topic === 'worker.error')
    expect(workerErrorEvents.length).toBe(1)

    // Verifica state machine atomico: snapshot tracker mostra il task transitionato
    const snap = harness.broker.getDebugSnapshot()
    expect(snap.tracker.tasksCompleted).toBeGreaterThanOrEqual(1)

    // Note: lateResponses counter è interno al tracker — qui verifichiamo solo
    // che NESSUN successivo `<topic>.completed` sia stato pubblicato (la prova
    // forte di Pitfall 2C closure è la verifica che `completedEvents.length === 0`).
  })
})
