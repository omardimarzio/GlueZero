/**
 * Tipi pubblici di `@gluezero/web-components`.
 *
 * Re-export dai package peer (`@gluezero/core`, `@gluezero/microfrontends`) per
 * convenienza dei consumer dell'adapter: niente import statico dei sub-package
 * dei peer, solo type re-export tree-shakable.
 *
 * @packageDocumentation
 */

import type {
  Broker,
  BrokerEvent,
  EventSource,
  SubscribeOptions,
  Subscription,
} from '@gluezero/core'
import type { MicroFrontendRuntimeContext } from '@gluezero/microfrontends'

/** Re-export per convenienza pubblica. */
export type {
  Broker,
  BrokerEvent,
  EventSource,
  MicroFrontendRuntimeContext,
  SubscribeOptions,
  Subscription,
}

/**
 * Opzioni accettate dal wrapper `publish` di `GlueZeroElement` / `GlueZeroController`.
 *
 * Subset esplicito dei parametri di {@link Broker.publish} (riproduce
 * `PublishParams` interno di `@gluezero/core` senza importarlo cross-package):
 * - `source` — originator descriptor (default auto-iniettato da MF context se assente)
 * - `metadata` — bag di properties propagate (auto-merge `microFrontendId` da context.id)
 * - `correlationId` / `causationId` / `traceId` — tracing
 * - `schemaVersion` — versione schema payload
 * - `deliveryMode` — `'sync' | 'async' | 'worker' | 'remote'`
 * - `priority` — `'low' | 'normal' | 'high' | 'critical'`
 * - `ttlMs` / `dedupeKey` — control fields
 *
 * Tipo strutturale (no `import` cross-package) per evitare dipendenza statica.
 */
export interface WcPublishOptions {
  /** Originator descriptor — se omesso il wrapper inietta `{ type: 'component', id: <mfId|'wc'> }`. */
  source?: EventSource
  /** Bag di properties — auto-merge `microFrontendId` da `glueZeroContext.id` (MF-OBS-01). */
  metadata?: Record<string, unknown>
  correlationId?: string
  causationId?: string
  traceId?: string
  schemaVersion?: string
  deliveryMode?: 'sync' | 'async' | 'worker' | 'remote'
  priority?: 'low' | 'normal' | 'high' | 'critical'
  ttlMs?: number
  dedupeKey?: string
}
