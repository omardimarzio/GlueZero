// cache-handler.ts — Handler per route `'cache'` STUB F3 (D-60, ROUTE-04).
//
// Adapter cache reale arriva con Phase 6 (F6 — vedi RouteCacheDefinition note in
// types/route-definition.ts). F3 ritorna sempre `RouteOutcome.error` con
// `code='cache.not-implemented'`, `category='config'` e messaggio esplicito.
//
// Decisione: il type system F3 (RouteCacheStrategy = 'cache-first' | 'network-first'
// | 'cache-then-network') è già completo — solo il runtime adapter (in-memory +
// IndexedDB) è deferred. Composer F3 può registrare route 'cache' senza errore di
// validazione del config; runtime fail-fast con BrokerError parlante.
//
// Vincolo D-83: ZERO modifiche a packages/core/ + packages/mapper/ runtime.
//
// Threat coverage:
// - T-03-06-04 (Information Disclosure): `BrokerError.details` NON include payload —
//   solo `phase: 'F6-pending'` come metadato sicuro.

import { createBrokerError } from '@sembridge/core'
import type { BrokerEvent } from '@sembridge/core'
import type { CompiledRoute } from '../route-resolver'
import type { RouteOutcome } from '../types/route-outcome'

/**
 * Handler per route `'cache'` — STUB F3 (D-60, ROUTE-04, deferred F6).
 *
 * Ritorna sempre `RouteOutcome.error` con `code='cache.not-implemented'`. F6
 * sostituirà questa funzione con l'adapter cache reale (in-memory + IndexedDB).
 *
 * @param event - BrokerEvent (per popolare `error.eventId` + `error.topic`).
 * @param route - CompiledRoute con `definition.type === 'cache'`.
 * @returns RouteOutcome.error con BrokerError shape D-80.
 */
export function cacheHandler(event: BrokerEvent, route: CompiledRoute): RouteOutcome {
  const error = createBrokerError({
    code: 'cache.not-implemented',
    category: 'config',
    message:
      'Cache adapter is implemented in Phase 6 (F6). Route type "cache" is type-only in F3.',
    routeId: route.id,
    topic: event.topic,
    eventId: event.id,
    details: { phase: 'F6-pending' },
  })
  return { ok: false, error, routeId: route.id }
}
