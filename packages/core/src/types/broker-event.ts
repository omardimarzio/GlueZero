// BrokerEvent — modello evento canonico (PRD §11, REQ CORE-05/06/07).
//
// Riferimento decisioni (CONTEXT 01):
// - D-04/D-07: deep-freeze runtime + DeepReadonly<TPayload> type-level
// - D-21: id generato dal broker (nanoid 21-char) se assente
// - D-22: timestamp valorizzato dal broker (Date.now()) se assente
// - D-23: source obbligatorio — validazione fail al publish se missing
// - D-03: deliveryMode include 'worker' e 'remote' ma sono no-op in F1 (mappati su 'async')

import type { DeepReadonly } from './deep-readonly'

export type DeliveryMode = 'sync' | 'async' | 'worker' | 'remote'

export type Priority = 'low' | 'normal' | 'high' | 'critical'

export interface EventSource {
  readonly type: 'plugin' | 'component' | 'server' | 'worker' | 'system'
  readonly id: string
  readonly name?: string
  readonly version?: string
}

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
export type EventId = string & { readonly [__eventIdBrand]: true }
