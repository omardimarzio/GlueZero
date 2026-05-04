// test-utils/worker-harness.ts — fixture per integration test F5 Worker Runtime
// (Wave 4 plan 05-06 — D-151 10 scenari Tier-1 jsdom + D-150 3-tier strategy).
//
// Pattern analog `realtime-harness.ts` di F4 — collect events via subscribe
// wildcard multi-depth + MockWorker injection + reset deterministico per test
// isolation. NON è production code (escluso da coverage in `vitest.config.ts`
// plan 05-01 via `'src/test-utils/**'`).
//
// **Approccio collect events (W-3 closure F4 carryover)**: usa `subscribe(<pattern>)`
// per pattern di profondità multipla — il F1 topic-matcher
// (`packages/core/src/core/topic-matcher.ts` PATTERN_REGEX) supporta `*` come
// segment wildcard ma il match avviene per profondità esatta. Per coprire eventi
// single-segment (`'orders'`), 2-segment (`'system.warn'`, `'orders.created'`),
// 3-segment (`'system.realtime.connected'`), 4-segment, l'harness subscribe a 4
// pattern di profondità (`'*'`, `'*.*'`, `'*.*.*'`, `'*.*.*.*'`). Niente
// monkey-patch di `broker.publish` — la pipeline §28 viene esercitata interamente.
//
// **Approccio injection MockWorker**: il `WorkerBroker` accetta `WorkerCtor`
// come DI (plan 05-04 carryover). L'harness lo passa al constructor — il
// `WorkerBridge` consumer del pool usa `desc.factory()` direttamente; quando
// la factory è scritta dal test per ritornare un MockWorker, il bridge lo wrappa
// con Comlink (stub adapter). Il WorkerBroker non patch globalThis.Worker.

import { createWorkerBroker } from '../public-factory'
import type { WorkerBroker, WorkerBrokerConfig } from '../worker-broker'
import { MockWorker } from './mock-worker'
import type { BrokerEvent } from '@sembridge/core'

/** Pattern subscribe `'*'`, `'*.*'`, `'*.*.*'`, `'*.*.*.*'` per coprire eventi 1-4 segmenti. */
const COLLECT_PATTERNS: readonly string[] = ['*', '*.*', '*.*.*', '*.*.*.*']

/**
 * Evento raccolto via subscribe wildcard (W-3 closure — niente monkey-patch).
 */
export interface CollectedEvent {
  readonly topic: string
  readonly payload: unknown
  readonly source?: BrokerEvent['source']
  readonly correlationId?: string
  readonly id?: string
  readonly timestamp: number
}

/**
 * Opzioni `createWorkerHarness`. Estende `WorkerBrokerConfig` (passa-through al
 * factory) + opzioni harness-specifiche. Default: `WorkerCtor: MockWorker` se
 * non fornito (test Tier-1 jsdom).
 */
export interface WorkerHarnessOptions extends WorkerBrokerConfig {
  // Nessun extra V1 — config passa intero al factory.
  readonly _placeholder?: never
}

/**
 * Harness ritornato da `createWorkerHarness`.
 */
export interface WorkerHarness {
  /** Broker creato via `createWorkerBroker` con MockWorker già wired. */
  readonly broker: WorkerBroker
  /** Eventi raccolti via `subscribe('*' | '*.*' | '*.*.*' | '*.*.*.*')`. */
  readonly events: CollectedEvent[]
  /** Reset completo: clear events + drop MockWorker static state. */
  reset(): void
  /** Flush microtask + N ms (default 0) per dispatch async F1 deliveryMode='async'. */
  flushAsync(ms?: number): Promise<void>
}

/**
 * Crea harness F5 con MockWorker injected come DI WorkerCtor.
 *
 * @example
 * ```ts
 * const h = createWorkerHarness()
 * h.broker.registerWorker({
 *   id: 'w1',
 *   factory: () => new MockWorker('about:blank') as unknown as Worker,
 *   tasks: ['fetch'],
 * })
 * h.broker.registerWorkerRoute({
 *   type: 'worker', id: 'r1', topic: 'weather.requested',
 *   worker: 'w1', task: 'fetch',
 * })
 * await h.broker.publish('weather.requested', { city: 'Roma' })
 * await h.flushAsync()
 * expect(h.events.find((e) => e.topic === 'weather.completed')).toBeDefined()
 * h.reset()
 * ```
 */
export function createWorkerHarness(opts: WorkerHarnessOptions = {}): WorkerHarness {
  // Reset MockWorker static state al boot — assicura test isolation se il
  // consumer non chiama reset() prima di ri-creare l'harness.
  MockWorker.reset()

  const events: CollectedEvent[] = []

  // Strip opzione harness-only prima di passare al factory.
  const { _placeholder: _ignored, ...brokerConfig } = opts
  const config: WorkerBrokerConfig = {
    ...brokerConfig,
    // DI MockWorker come WorkerCtor default (test Tier-1 jsdom).
    WorkerCtor: brokerConfig.WorkerCtor ?? (MockWorker as unknown as typeof Worker),
  }
  const broker = createWorkerBroker(config)

  // W-3 fix carryover F4 — niente monkey-patch di `broker.publish`. Subscribe a
  // pattern di profondità multipla per catturare TUTTI gli eventi (single→4
  // segmenti) senza mutare l'API pubblica del broker. Il path
  // `handler.publishFn → inner.publish` resta invariato e la pipeline §28 viene
  // esercitata interamente.
  for (const pattern of COLLECT_PATTERNS) {
    broker.subscribe(pattern, (ev) => {
      const e = ev as BrokerEvent & { correlationId?: string }
      const collected: CollectedEvent = {
        topic: e.topic,
        payload: e.payload,
        timestamp: Date.now(),
        ...(e.source !== undefined && { source: e.source }),
        ...(e.correlationId !== undefined && { correlationId: e.correlationId }),
        ...(e.id !== undefined && { id: e.id }),
      }
      events.push(collected)
    })
  }

  return {
    broker,
    events,
    reset() {
      events.length = 0
      MockWorker.reset()
    },
    async flushAsync(ms = 0): Promise<void> {
      // Microtask flush + macrotask delay per dispatch async F1.
      await Promise.resolve()
      if (ms > 0) {
        await new Promise<void>((res) => setTimeout(res, ms))
      } else {
        await new Promise<void>((res) => setTimeout(res, 0))
      }
    },
  }
}
