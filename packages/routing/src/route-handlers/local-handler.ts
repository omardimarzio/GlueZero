// local-handler.ts — Handler per route `'local'` (D-60, ROUTE-02). Pura passthrough.
// Vincolo D-83: ZERO modifiche core/mapper. Threat T-03-06-01 mitigated by readonly literal.

import type { BrokerEvent } from '@gluezero/core'
import type { CompiledRoute } from '../route-resolver'
import type { RouteOutcome } from '../types/route-outcome'

/**
 * Handler per route `'local'` (D-60, ROUTE-02). Pura passthrough.
 *
 * F3 default: topic senza route esplicita ricevono consegna locale via `inner.publish`
 * del RouterBroker (plan 03-12). Questo handler è invocato SOLO quando
 * `RouteDefinition.type === 'local'` è dichiarato esplicitamente.
 *
 * @returns RouteOutcome.ok con `canonicalPayload === event.payload`.
 */
export function localHandler(event: BrokerEvent, route: CompiledRoute): RouteOutcome {
  return {
    ok: true,
    canonicalPayload: event.payload,
    routeId: route.id,
  }
}
