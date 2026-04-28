// Validazione sintattica BrokerEvent shape (VAL-01) via Valibot (VAL-06).
//
// Riferimento decisioni (CONTEXT 01):
// - D-18: Valibot scelto per la validazione sintattica al posto di Zod (tree-shakable
//   ~1-3 KB per schema, vs Zod ~13 KB minimum import). Schema co-locato con il
//   modulo che lo consuma per facilitare il bundling.
// - VAL-01: validazione MINIMA della shape — id non vuoto, topic regex, timestamp
//   ≥ 0, source.type in picklist, source.id non vuoto. NON valida payload (territorio
//   F2 canonical model — VAL-02).
// - VAL-06: Valibot 1.x come dipendenza locked.
//
// Threat coverage:
// - T-05-04 (Information disclosure — Valibot issues leak schema info): ACCEPT.
//   `details.issues` esposto al developer per diagnostic; NON contiene PII (la
//   shape è meta-info, non payload reali). Valibot issues sono sicuri da loggare
//   (path + message); TODO F6: filtro Inspector per redaction se serve.
// - T-05-05 (DoS — timestamp Number.MAX_SAFE): ACCEPT. Schema accetta tutti i numeri
//   ≥ 0; check semantici (es. clamp future timestamp) deferred a F2 canonical model.
//
// Error contract: throw BrokerError code='event.validation.failed' category='validation'
// con details.issues = array di Valibot issues. Consumer (es. publish hot-path)
// può ispezionare details.issues per generare diagnostic UI/log.

import * as v from 'valibot'
import { createBrokerError } from './broker-error'

// EventSource schema — picklist allinea con types/broker-event.ts (5 valori), id minLength 1.
const EventSourceSchema = v.object({
  type: v.picklist(['plugin', 'component', 'server', 'worker', 'system']),
  id: v.pipe(v.string(), v.minLength(1)),
  name: v.optional(v.string()),
  version: v.optional(v.string()),
})

// BrokerEvent schema — la regex topic è la STESSA del topic-matcher (D-24) per
// coerenza tra publish-time e validation. payload è `v.unknown()` perché VAL-02
// (validazione payload schema) è territorio F2 canonical model.
const BrokerEventSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  topic: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$/)),
  timestamp: v.pipe(v.number(), v.integer(), v.minValue(0)),
  source: EventSourceSchema,
  payload: v.unknown(),
  metadata: v.optional(v.record(v.string(), v.unknown())),
  correlationId: v.optional(v.string()),
  causationId: v.optional(v.string()),
  traceId: v.optional(v.string()),
  schemaVersion: v.optional(v.string()),
  deliveryMode: v.optional(v.picklist(['sync', 'async', 'worker', 'remote'])),
  priority: v.optional(v.picklist(['low', 'normal', 'high', 'critical'])),
  ttlMs: v.optional(v.pipe(v.number(), v.minValue(0))),
  dedupeKey: v.optional(v.string()),
})

export function validateEvent(event: unknown): void {
  const result = v.safeParse(BrokerEventSchema, event)
  if (!result.success) {
    throw createBrokerError({
      code: 'event.validation.failed',
      category: 'validation',
      message: `BrokerEvent validation failed: ${result.issues.map((i) => i.message).join('; ')}`,
      details: { issues: result.issues },
    })
  }
}
