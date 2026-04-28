// Robustness test — Storm (TEST-03 subset).
//
// Verifica end-to-end che il Broker regga un carico realistico di 10000
// publish async su singolo topic con 5 subscriber:
//   - Tutti i 5 subscriber ricevono tutti i 10000 eventi (50000 total deliveries)
//   - Ordine FIFO preservato per-subscriber (D-01 queueMicrotask FIFO)
//   - `pendingAsyncDelivery` torna a 0 dopo flush completo (no leak counter)
//
// Pattern flushAll: ripetuto 10 volte per drenare la coda microtask multipla
// (dispatchAsync usa `queueMicrotask` per ogni delivery; T-07-03 anti-recursion
// può aggiungere ulteriori microtask per system.error defer — qui assente per
// design del test, ma il pattern è ridondante per safety).
//
// Performance budget: RESEARCH dichiara < 5s in jsdom; il test allowance è
// 10000ms (10s) per assorbire variance CI. Il timeout vitest è 30000ms (30s)
// per evitare flakiness in scenari pathologici.
//
// Ownership pattern: questo file usa `*.test.ts` non-integration per
// disambiguazione da plan 09 (che possiede `*.integration.test.ts`). Il vitest
// pattern `src/**/*.test.ts` cattura entrambi i pattern senza conflitto.
//
// Pattern per-subscriber state: invece di array indicizzati (che richiedono
// non-null assertion sotto `noUncheckedIndexedAccess`), ogni subscriber detiene
// la sua state via closure (count + lastSeen catturati come variabili locali).
// Lo stato finale è esposto via callback `getState()` raccolto in un array.

import { describe, expect, it } from 'vitest'
import { createPipelineHarness } from '../test-utils/pipeline-harness'

const flushAll = async (): Promise<void> => {
  // Drain microtask queue multiple times to ensure all async deliveries complete.
  for (let i = 0; i < 10; i++) {
    await new Promise<void>((r) => {
      queueMicrotask(() => {
        r()
      })
    })
  }
}

interface SubscriberState {
  getCount: () => number
  getFifoOk: () => boolean
}

const createSubscriber = (
  broker: ReturnType<typeof createPipelineHarness>['broker'],
  topic: string,
): SubscriberState => {
  let count = 0
  let lastSeen = -1
  let fifoOk = true
  broker.subscribe(topic, (e) => {
    const n = (e.payload as { n: number }).n
    if (n !== lastSeen + 1) fifoOk = false
    lastSeen = n
    count++
  })
  return {
    getCount: () => count,
    getFifoOk: () => fifoOk,
  }
}

describe('Storm test (TEST-03 subset)', () => {
  it('10000 async publishes deliver FIFO to 5 subscribers; pendingAsyncDelivery returns to 0', async () => {
    const h = createPipelineHarness()
    const subs: SubscriberState[] = []
    for (let i = 0; i < 5; i++) {
      subs.push(createSubscriber(h.broker, 'storm.topic'))
    }

    const start = performance.now()
    for (let n = 0; n < 10000; n++) {
      h.broker.publish(
        'storm.topic',
        { n },
        {
          source: { type: 'plugin', id: 'storm-plugin' },
          deliveryMode: 'async',
        },
      )
    }
    await flushAll()
    const elapsed = performance.now() - start

    // All 5 subscribers received all 10000 events.
    expect(subs.map((s) => s.getCount())).toEqual([10000, 10000, 10000, 10000, 10000])
    expect(subs.every((s) => s.getFifoOk())).toBe(true)

    // Pending counter back to 0 (no async delivery leak).
    expect(h.broker.getDebugSnapshot().pendingAsyncDelivery).toBe(0)

    // Wall-clock budget — RESEARCH says < 5s in jsdom; allow up to 10s for CI variance.
    expect(elapsed).toBeLessThan(10000)
  }, 30000) // 30s timeout for this single test

  it('Storm with mixed sync + async preserves separate FIFO order per mode', async () => {
    const h = createPipelineHarness()
    const syncLog: number[] = []
    const asyncLog: number[] = []

    h.broker.subscribe('mixed.topic', (e) => {
      const { mode, n } = e.payload as { mode: string; n: number }
      if (mode === 'sync') syncLog.push(n)
      else asyncLog.push(n)
    })

    for (let n = 0; n < 100; n++) {
      h.broker.publish(
        'mixed.topic',
        { mode: 'sync', n },
        {
          source: { type: 'plugin', id: 'p' },
          deliveryMode: 'sync',
        },
      )
    }
    for (let n = 0; n < 100; n++) {
      h.broker.publish(
        'mixed.topic',
        { mode: 'async', n },
        {
          source: { type: 'plugin', id: 'p' },
          deliveryMode: 'async',
        },
      )
    }
    await flushAll()

    expect(syncLog).toEqual(Array.from({ length: 100 }, (_, i) => i))
    expect(asyncLog).toEqual(Array.from({ length: 100 }, (_, i) => i))
  })
})
