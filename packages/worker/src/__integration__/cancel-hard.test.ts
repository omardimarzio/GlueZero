// cancel-hard.test.ts — D-151 #5 Cancellation hard via unregisterPlugin
// (LIFE-02 ext F5 cascade) Tier-1 jsdom.
//
// Scenario: registerPlugin → publish dispatch in volo → unregisterPlugin
// causa cascade pool.terminateByOwner → bridge.terminate() chiamato (hard).

import { beforeEach, describe, expect, it } from 'vitest'
import {
  createWorkerHarness,
  MockBridge,
  makeMockDescriptor,
  type WorkerHarness,
} from '../test-utils/worker-harness'

describe('D-151 #5 — Cancellation hard via unregisterPlugin cascade (LIFE-02 ext F5)', () => {
  let harness: WorkerHarness

  beforeEach(() => {
    // Bridge slow per consentire dispatch in volo durante unregister
    harness = createWorkerHarness(undefined, {
      'p1-worker': {
        tasks: {
          longTask: { result: { ok: true }, delayMs: 500 },
        },
      },
    })
  })

  it('unregisterPlugin → cascade terminate hardKill su bridge in flight', async () => {
    await harness.broker.registerPlugin({
      id: 'p1',
      workers: [makeMockDescriptor('p1-worker', ['longTask'])],
    })

    harness.broker.registerWorkerRoute({
      type: 'worker',
      id: 'r1',
      topic: 'p1.work.requested',
      worker: 'p1-worker',
      task: 'longTask',
    })

    // Publish con timeout breve così se cascade fallisse, scatta il timeout (defensive)
    const publishPromise = harness.broker.publish(
      'p1.work.requested',
      {},
      {
        source: { type: 'plugin', id: 'app' },
        correlationId: 'c-pre',
        deliveryMode: 'sync',
      },
    )

    // Attendi che bridge sia spawned + dispatch iniziato
    await new Promise((r) => setTimeout(r, 10))

    // Cascade unregister
    await harness.broker.unregisterPlugin('p1')

    // Verifica bridge.terminated
    const bridges = MockBridge.byWorkerId.get('p1-worker') ?? []
    expect(bridges.length).toBeGreaterThanOrEqual(1)
    expect(bridges.every((b) => b.terminated)).toBe(true)

    // Cleanup state — pool e registry vuoti
    const snap = harness.broker.getDebugSnapshot()
    expect(snap.registry.workerCount).toBe(0)
    expect(snap.pool.activeBridges).toBe(0)

    // Cleanup pendant publish (non blocca il test)
    await publishPromise.catch(() => {})
  })
})
