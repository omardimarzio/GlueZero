// serialization-fail.test.ts — D-151 #6 Serialization failure pre-postMessage
// (D-139/D-140) Tier-1 jsdom.
//
// Scenario: payload con `{ fn: () => 'x' }` con assertSerializable='always' →
// `<topic>.failed` code='worker.serialization.failed.function' E
// `worker.error` topic ext (ERR-02 ext F5).
//
// Note: il MockBridge harness non esegue `assertSerializable` (è il `WorkerBridge`
// reale di 05-04 che lo fa PRE-postMessage). Per esercitare lo scenario su
// MockBridge usiamo un custom bridgeFactory che simula il throw `assertSerializable`.

import { describe, it, expect, beforeEach } from 'vitest'
import { createWorkerHarness, type WorkerHarness } from '../test-utils/worker-harness'
import { createBrokerError } from '@sembridge/core'
import type { WorkerBridgeLike } from '../worker-pool'
import type { WorkerDescriptor } from '../types'

describe('D-151 #6 — Serialization failure throw PRE-postMessage (D-139/D-140)', () => {
  let harness: WorkerHarness

  beforeEach(() => {
    // Custom bridgeFactory che simula `assertSerializable` failure su payload
    // con `function` value (replica behavior `WorkerBridge` reale 05-04 dispatch
    // step 2).
    harness = createWorkerHarness({
      bridgeFactory: (_desc: WorkerDescriptor): WorkerBridgeLike => ({
        async dispatch(_taskName, payload): Promise<unknown> {
          // Simula il check `assertSerializable` interno al bridge reale
          if (payload !== null && typeof payload === 'object') {
            for (const key of Object.keys(payload)) {
              const v = (payload as Record<string, unknown>)[key]
              if (typeof v === 'function') {
                throw createBrokerError({
                  code: 'worker.serialization.failed.function',
                  message: `Field '${key}' is a function — not SCA-serializable (D-139/D-140)`,
                  category: 'worker',
                  details: { fieldPath: key, fieldType: 'function' },
                })
              }
            }
          }
          return { ok: true }
        },
        terminate(): void {},
      }),
    })
  })

  it('publish payload con `function` field → publica `<topic>.failed` code=worker.serialization.failed.function + `worker.error`', async () => {
    harness.broker.registerWorker({
      id: 'safe',
      factory: () => null as unknown as Worker,
      tasks: ['process'],
      mode: 'dedicated',
    })
    harness.broker.registerWorkerRoute({
      type: 'worker',
      id: 'r1',
      topic: 'safe.work.requested',
      worker: 'safe',
      task: 'process',
    })

    await harness.broker.publish(
      'safe.work.requested',
      { fn: () => 'x' as unknown },
      {
        source: { type: 'plugin', id: 'app' },
        correlationId: 'c-fail',
        deliveryMode: 'sync',
      },
    )

    await harness.flushAsync()

    const failed = harness.events.find((e) => e.topic === 'safe.work.failed')
    expect(failed).toBeDefined()
    const sanitized = failed!.payload as { code: string; category: string }
    expect(sanitized.code).toBe('worker.serialization.failed.function')
    expect(sanitized.category).toBe('worker')

    // ERR-02 ext F5 — worker.error topic
    const workerErr = harness.events.find((e) => e.topic === 'worker.error')
    expect(workerErr).toBeDefined()

    // Sanitization audit — niente originalError/stack
    expect(sanitized).not.toHaveProperty('originalError')
    expect(sanitized).not.toHaveProperty('stack')
  })
})
