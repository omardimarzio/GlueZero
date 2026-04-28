// BrokerEvent — modello evento canonico (PRD §11, REQ CORE-05/06/07).
//
// Riferimento decisioni (CONTEXT 01):
// - D-04/D-07: deep-freeze runtime + DeepReadonly<TPayload> type-level
// - D-21: id generato dal broker (nanoid 21-char) se assente
// - D-22: timestamp valorizzato dal broker (Date.now()) se assente
// - D-23: source obbligatorio — validazione fail al publish se missing
// - D-03: deliveryMode include 'worker' e 'remote' ma sono no-op in F1 (mappati su 'async')

import type { DeepReadonly } from './deep-readonly'

/** Delivery semantics: `sync` | `async` (F1 default) | `worker` | `remote` (F1 fallback to async via warn). */
export type DeliveryMode = 'sync' | 'async' | 'worker' | 'remote'

/** Event priority. `'critical'` is reserved for event-level (publisher), not subscriber-level. */
export type Priority = 'low' | 'normal' | 'high' | 'critical'

/**
 * Originator descriptor of a {@link BrokerEvent}. Required at publish (D-23) —
 * `event.source.missing` `BrokerError` is thrown if absent.
 */
export interface EventSource {
  readonly type: 'plugin' | 'component' | 'server' | 'worker' | 'system'
  readonly id: string
  readonly name?: string
  readonly version?: string
}

/**
 * Event envelope flowing through the pipeline (PRD §11).
 *
 * `payload` is `DeepReadonly<TPayload>` (D-07) and frozen recursively in dev mode (D-04).
 * `id`/`timestamp` are populated by the broker if absent (D-21, D-22).
 *
 * @typeParam TPayload - Payload shape; defaults to `unknown`.
 */
export interface BrokerEvent<TPayload = unknown> {
  readonly id: string
  readonly topic: string
  readonly timestamp: number
  readonly source: EventSource
  readonly payload: DeepReadonly<TPayload>
  readonly metadata?: DeepReadonly<Record<string, unknown>>
  readonly correlationId?: string
  readonly causationId?: string
  readonly traceId?: string
  readonly schemaVersion?: string
  readonly deliveryMode?: DeliveryMode
  readonly priority?: Priority
  readonly ttlMs?: number
  readonly dedupeKey?: string
}

// Branded type per ID evento (PRD §11.3 + Pitfall #12 — type confusion prevention).
// Solo cast esplicito `as EventId` permette di "instanziare" il tipo, audit-able via grep.
declare const __eventIdBrand: unique symbol
/**
 * Branded type for unique event IDs (PRD §11.3, Pitfall #12 — type confusion prevention).
 * Only explicit cast `as EventId` lets you "instantiate" the type, audit-able via grep.
 */
export type EventId = string & { readonly [__eventIdBrand]: true }
