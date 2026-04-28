// Factory createBrokerEvent — costruisce un BrokerEvent canonico applicando
// i default richiesti dal broker (CORE-07, D-21..D-23).
//
// Riferimento decisioni (CONTEXT 01):
// - D-21: id generato dal broker via nanoid (21-char URL-safe) se assente.
// - D-22: timestamp = Date.now() (epoch ms) se assente.
// - D-23: source OBBLIGATORIO. Se params.source assente E defaultSource undefined,
//   throw BrokerError code='event.source.missing' (validation category).
// - D-01: deliveryMode default = 'async' (event-driven a posteriori). Sync è opt-in
//   esplicito da publisher consapevole.
//
// Threat coverage:
// - T-05-02 (Spoofing — plugin spoofa source.id): F1 NON enforce ownership a livello
//   di factory. Il defaultSource (passato dal call-site del broker) è il fallback;
//   i plugin scoped (F2+) overrideranno il source con la loro identità reale.
//
// `exactOptionalPropertyTypes: true` policy: i campi opzionali NON vengono valorizzati
// come `undefined` se non forniti. Spread conditional `...(x && { x })` produce
// proprietà assente vs proprietà undefined (consumer può fare `'foo' in event` check).
//
// Cast `payload as never` (e `metadata as never`): il tipo `BrokerEvent.payload` è
// `DeepReadonly<TPayload>` (compile-time), ma il `deepFreeze` viene applicato al
// delivery (broker → subscriber), NON alla creation. Quindi al costruzione il
// runtime payload è ancora mutabile; il cast bypassa il compile-time check senza
// alterare runtime semantics. Audit-able via grep di `as never`.

import { nanoid } from 'nanoid'
import type { BrokerEvent, EventSource } from '../types/broker-event'
import { createBrokerError } from './broker-error'

export interface PublishParams<T> {
  topic: string
  payload: T
  source?: EventSource
  metadata?: Record<string, unknown>
  correlationId?: string
  causationId?: string
  traceId?: string
  schemaVersion?: string
  deliveryMode?: BrokerEvent['deliveryMode']
  priority?: BrokerEvent['priority']
  ttlMs?: number
  dedupeKey?: string
  id?: string
  timestamp?: number
}

export function createBrokerEvent<T>(
  params: PublishParams<T>,
  defaultSource: EventSource | undefined,
): BrokerEvent<T> {
  const source = params.source ?? defaultSource
  if (!source) {
    throw createBrokerError({
      code: 'event.source.missing',
      category: 'validation',
      message:
        'BrokerEvent requires a source descriptor (D-23). None provided and no default available.',
      topic: params.topic,
    })
  }
  return {
    id: params.id ?? nanoid(),
    topic: params.topic,
    timestamp: params.timestamp ?? Date.now(),
    source,
    payload: params.payload as never,
    ...(params.metadata && { metadata: params.metadata as never }),
    ...(params.correlationId && { correlationId: params.correlationId }),
    ...(params.causationId && { causationId: params.causationId }),
    ...(params.traceId && { traceId: params.traceId }),
    ...(params.schemaVersion && { schemaVersion: params.schemaVersion }),
    deliveryMode: params.deliveryMode ?? 'async',
    priority: params.priority ?? 'normal',
    ...(params.ttlMs !== undefined && { ttlMs: params.ttlMs }),
    ...(params.dedupeKey && { dedupeKey: params.dedupeKey }),
  }
}
