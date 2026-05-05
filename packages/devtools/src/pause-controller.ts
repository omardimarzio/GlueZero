/**
 * F6 PauseController — flow controller `pauseTopic/resumeTopic/flushQueue`
 * (D-168/D-169/D-170).
 *
 * **Pattern primario carryover**: F3 `backpressure-strategy.ts:127-160` (D-75
 * queue-bounded + drop-oldest + critical bypass) + F5 `worker-pool.ts:39`
 * (D-130 critical bypass). Replica algoritmica inline (semantica diversa: F6
 * = explicit user pause vs F3 = automatic load shedding).
 *
 * **D-168 pauseTopic**: blocca publish del topic. Eventi accodati FIFO in
 * `Map<topic, BrokerEvent[]>`. Subscriber + route NON triggherano (consistency
 * SC-4 wording).
 *
 * **D-168 resumeTopic**: flush FIFO + delete topic dalla paused Map. Replay
 * via `publishFn` iniettato. **T-06-07-04 mitigation**: `paused.delete(topic)`
 * PRIMA del replay → replay events vedono `paused.has(topic) === false` →
 * pass-through (anti infinite-loop).
 *
 * **D-169 flushQueue**: drop silenzioso + emit `system.queue.flushed { topic,
 * droppedCount, droppedEventIds }` SENZA re-publish (replay solo via
 * resumeTopic). Retain paused state (queue empty ma topic ancora paused).
 *
 * **D-170 critical bypass**: `event.priority === 'critical'` → return 'pass'
 * (consistency Pitfall 4.C cross-fase F3+F5+F6).
 *
 * **D-170 cap drop-oldest**: `maxQueueSize: 1000` default. Cap raggiunto →
 * drop oldest via `queue.shift()` + emit `system.queue.overflow { topic,
 * droppedEventId }`.
 *
 * **Vincolo D-83 strict**: zero modifiche fuori `packages/devtools/src/`.
 *
 * @see packages/gateway/src/http/strategies/backpressure-strategy.ts:127-160
 *      (analog F3 D-75 — pattern algoritmico identico, semantica diversa)
 * @see packages/worker/src/worker-pool.ts (analog F5 D-130 critical bypass)
 * @see RESEARCH §10 pauseTopic queue impl + §10.2 critical bypass D-170
 */

import type { BrokerEvent } from '@gluezero/core'
import type { FlushQueueResult, PauseAction, PauseControllerSnapshot } from './types/pause-state'

const DEFAULT_MAX_QUEUE_SIZE = 1000 // D-170

/**
 * Funzione di publish iniettata. Il caller (es. `createDevtoolsBroker` Wave 4)
 * tipicamente passa `broker.publish.bind(broker)` adattato a `(topic, payload) =>
 * void`.
 */
export type PausePublishFn = (topic: string, payload: unknown) => void | Promise<void>

/**
 * API pubblica del controller.
 */
export interface PauseController {
  /** D-168 — blocca publish del topic. Idempotent. */
  pauseTopic(topic: string): void
  /**
   * D-168 — flush queue FIFO + delete topic dalla paused Map. Replay via
   * `publishFn`. T-06-07-04 mitigation: delete PRIMA di replay.
   */
  resumeTopic(topic: string): void
  /**
   * D-169 — drop silenzioso + emit audit. NIENTE re-publish.
   *
   * @param topic Optional. Undefined → flush TUTTE le queue paused.
   * @returns Array di FlushQueueResult per ogni topic effettivamente flushed.
   */
  flushQueue(topic?: string): readonly FlushQueueResult[]
  /** True se il topic è paused (anche con queue vuota post-flushQueue). */
  isPaused(topic: string): boolean
  /**
   * Determinazione dispositional dell'evento.
   * @returns
   *  - `'pass'` — topic non paused o priority='critical' (D-170 bypass)
   *  - `'queued'` — accodato in pause + cap not reached
   *  - `'dropped'` — cap raggiunto, oldest droppato (drop-oldest FIFO)
   */
  intercept(event: BrokerEvent): PauseAction
  /** Stato corrente per Inspector / debug snapshot. */
  getSnapshot(): PauseControllerSnapshot
}

/**
 * Opzioni costruttore.
 */
export interface PauseControllerOptions {
  /** Cap per topic queue (D-170). Default 1000. */
  readonly maxQueueSize?: number
  /** Publish function iniettata per replay (resumeTopic) + audit (flushQueue/overflow). */
  readonly publishFn: PausePublishFn
}

/**
 * Factory `createPauseController` (D-168/D-169/D-170).
 *
 * @example
 * ```ts
 * const ctrl = createPauseController({
 *   publishFn: (topic, payload) => broker.publish({ topic, payload, source: ... }),
 *   maxQueueSize: 1000,
 * })
 * ctrl.pauseTopic('weather.requested')
 * const action = ctrl.intercept(event) // 'queued' | 'dropped' | 'pass'
 * ctrl.resumeTopic('weather.requested') // replay FIFO
 * ```
 *
 * @example Critical bypass (D-170 — Pitfall 4.C carryover F3+F5+F6)
 * ```ts
 * ctrl.pauseTopic('user.notify')
 * const evCritical = { ...event, priority: 'critical' as const }
 * ctrl.intercept(evCritical) // → 'pass' (bypass cap E queue)
 * ```
 *
 * @example flushQueue audit (D-169)
 * ```ts
 * ctrl.pauseTopic('chat.message')
 * ctrl.intercept(event1) // → queued
 * ctrl.intercept(event2) // → queued
 * const flushed = ctrl.flushQueue('chat.message')
 * // → [{ topic: 'chat.message', droppedCount: 2, droppedEventIds: [...] }]
 * // → emit 'system.queue.flushed' audit (NIENTE re-publish)
 * ```
 */
export function createPauseController(opts: PauseControllerOptions): PauseController {
  const cap = opts.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE
  const paused = new Map<string, BrokerEvent[]>()

  return {
    pauseTopic(topic) {
      if (!paused.has(topic)) paused.set(topic, [])
    },

    resumeTopic(topic) {
      const queue = paused.get(topic)
      if (!queue) return
      // T-06-07-04 mitigation: delete BEFORE replay → replay events vedono topic
      // non-paused (no infinite loop di re-intercept).
      paused.delete(topic)
      // Replay FIFO order via injected publishFn.
      for (const event of queue) {
        opts.publishFn(event.topic, event.payload)
      }
    },

    flushQueue(topic): readonly FlushQueueResult[] {
      const result: FlushQueueResult[] = []
      const topics = topic !== undefined ? [topic] : Array.from(paused.keys())
      for (const t of topics) {
        const queue = paused.get(t)
        if (!queue) continue // T-06-07-05: topic non-paused → no-op silente
        const droppedEventIds = queue.map((e) => e.id)
        // Empty queue ma retain paused state (D-169 retain).
        paused.set(t, [])
        const entry: FlushQueueResult = {
          topic: t,
          droppedCount: droppedEventIds.length,
          droppedEventIds,
        }
        result.push(entry)
        // D-169 emit audit (NIENTE re-publish degli eventi droppati).
        opts.publishFn('system.queue.flushed', entry)
      }
      return result
    },

    isPaused(topic) {
      return paused.has(topic)
    },

    intercept(event): PauseAction {
      const queue = paused.get(event.topic)
      // Topic non paused → pass-through immediato.
      if (!queue) return 'pass'
      // D-170 critical bypass — Pitfall 4.C carryover F3 D-75 + F5 D-130.
      // Critical events bypassano cap E queue (NO accodamento, NO drop, NO audit).
      if (event.priority === 'critical') return 'pass'
      // D-170 cap + drop-oldest FIFO.
      let action: PauseAction = 'queued'
      if (queue.length >= cap) {
        const oldest = queue.shift()
        if (oldest) {
          opts.publishFn('system.queue.overflow', {
            topic: event.topic,
            droppedEventId: oldest.id,
          })
          action = 'dropped'
        }
      }
      queue.push(event)
      return action
    },

    getSnapshot(): PauseControllerSnapshot {
      const queueSizes: Record<string, number> = {}
      for (const [topic, queue] of paused) {
        queueSizes[topic] = queue.length
      }
      return {
        pausedTopics: Array.from(paused.keys()),
        queueSizes,
        maxQueueSize: cap,
      }
    },
  }
}
