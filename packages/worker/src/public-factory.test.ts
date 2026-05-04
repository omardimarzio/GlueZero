// public-factory.test.ts — 6 unit test per `createWorkerBroker` factory + Valibot
// safeParse + D-30 anti-singleton (analog F4 public-factory.test.ts).

import { describe, expect, it } from 'vitest'
import { createWorkerBroker } from './public-factory'
import { MockWorker } from './test-utils/mock-worker'
import { WorkerBroker } from './worker-broker'

describe('createWorkerBroker (D-30 + D-122 Valibot validation)', () => {
  it('Test 1: config vuoto → instance valida WorkerBroker', () => {
    const broker = createWorkerBroker()
    expect(broker).toBeInstanceOf(WorkerBroker)
  })

  it('Test 2: workers.assertSerializable="dev" → ok (literal valid)', () => {
    const broker = createWorkerBroker({
      workers: { assertSerializable: 'dev' },
    })
    expect(broker).toBeInstanceOf(WorkerBroker)
  })

  it('Test 3: workers.assertSerializable invalid → throw "Invalid WorkerBrokerConfig:"', () => {
    expect(() =>
      createWorkerBroker({
        // @ts-expect-error intentional invalid for runtime validation test
        workers: { assertSerializable: 'invalid-mode' },
      }),
    ).toThrowError(/Invalid WorkerBrokerConfig:/)
  })

  it('Test 4: workerRoutes con 1 route valida → broker bootstrappa correttamente', () => {
    const broker = createWorkerBroker({
      WorkerCtor: MockWorker as unknown as typeof Worker,
      workerRoutes: [
        {
          type: 'worker',
          id: 'r1',
          topic: 'weather.requested',
          worker: 'w1',
          task: 'fetch',
        },
      ],
    })
    expect(broker.getDebugSnapshot().workerRoutes).toBe(1)
  })

  it('Test 5: workerRoutes con route invalida (id vuoto) → throw "Invalid WorkerBrokerConfig:"', () => {
    expect(() =>
      createWorkerBroker({
        // @ts-expect-error intentional: id empty string violates v.minLength(1)
        workerRoutes: [{ type: 'worker', id: '', topic: 't', worker: 'w', task: 'fetch' }],
      }),
    ).toThrowError(/Invalid WorkerBrokerConfig:/)
  })

  it('Test 6 (D-30 anti-singleton): due chiamate consecutive ritornano istanze diverse', () => {
    const a = createWorkerBroker()
    const b = createWorkerBroker()
    expect(a).not.toBe(b)
    expect(a).toBeInstanceOf(WorkerBroker)
    expect(b).toBeInstanceOf(WorkerBroker)
  })
})
