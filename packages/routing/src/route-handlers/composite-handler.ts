// composite-handler.ts — Handler per route `'composite'` workflow F3 (ROUTE-05, D-60).
//
// Open Question Q3 (RESEARCH): F3 implementa l'opzione (b) — skip cache check + warning
// UNA volta in dev mode (`routing.composite.cache-deferred`). Composite F3 = alias per
// http route — il vero workflow check-cache → http → update-cache arriva con F6.
// Documentato in DOC-04 (plan 03-14) come behavior locked.
//
// Workflow F3:
// 1. Trova il primo step `'http'` nella `RouteCompositeDefinition.steps`.
// 2. Se assente → `RouteOutcome.error code='route.composite.no-http'` (config error).
// 3. Se presente uno step `'cache'` → emette callback `onCacheDeferred` UNA volta sola
//    (warning dev mode; il RouterBroker plan 03-12 farà il bind a `publish('routing.composite.deferred', ...)`).
// 4. Risolve il sub-route via `resolveSubRoute(httpStep.route)`.
// 5. Se sub-route NON esiste → `RouteOutcome.error code='route.composite.subroute-missing'`.
// 6. Delega all'`httpHandler` (dependency injection — il vero http-handler è plan 03-08).
//
// Vincolo D-83: ZERO modifiche a packages/core/ + packages/mapper/ runtime. Il
// composite-handler è una pure factory — riceve l'http-handler come dependency injection.
//
// Threat coverage:
// - T-03-06-04 (Information Disclosure): `BrokerError.details` NON include payload —
//   solo `routeId` come metadato sicuro.

import { createBrokerError } from '@sembridge/core'
import type { BrokerEvent } from '@sembridge/core'
import type { CompiledRoute } from '../route-resolver'
import type { RouteCompositeDefinition } from '../types/route-definition'
import type { RouteOutcome } from '../types/route-outcome'

/**
 * Dependency injection per il composite handler (ROUTE-05, Open Question Q3).
 *
 * - `httpHandler` — invocato sul sub-route http del workflow. In F3 è il vero
 *   http-handler del plan 03-08 (declaration-only qui). In test/dev può essere
 *   un mock.
 * - `resolveSubRoute` — risolve il sub-route per id (delegate al RouteResolver).
 * - `onCacheDeferred` — callback opt-in per dev-mode warning quando il workflow
 *   include uno step `'cache'`. Default no-op (silent). Plan 03-12 RouterBroker
 *   farà il bind effettivo a `publish('routing.composite.cache-deferred', ...)`.
 */
export interface CompositeHandlerDeps {
  readonly httpHandler: (event: BrokerEvent, subRoute: CompiledRoute) => Promise<RouteOutcome>
  readonly resolveSubRoute: (id: string) => CompiledRoute | undefined
  readonly onCacheDeferred?: (event: { topic: string; routeId: string }) => void
}

/**
 * Crea un handler `composite` con dipendenze iniettate.
 *
 * Il flag `cacheWarnEmitted` è chiuso nella closure per garantire warning UNA SOLA
 * volta per istanza handler (Q3 opzione b). Una nuova istanza handler resetta il
 * flag — pattern coerente con la creazione 1:1 handler:executor.
 *
 * @param deps - Dependency injection (httpHandler + resolveSubRoute + onCacheDeferred).
 * @returns Funzione async che accetta `(event, route)` e ritorna `Promise<RouteOutcome>`.
 *
 * @example
 * ```ts
 * const composite = createCompositeHandler({
 *   httpHandler: async (e, r) => httpGateway.fetch(e, r),
 *   resolveSubRoute: (id) => resolver.list().find((r) => r.id === id),
 *   onCacheDeferred: (e) => broker.publish('routing.composite.cache-deferred', e),
 * })
 * await composite(event, compositeRoute)
 * ```
 */
export function createCompositeHandler(
  deps: CompositeHandlerDeps,
): (event: BrokerEvent, route: CompiledRoute) => Promise<RouteOutcome> {
  let cacheWarnEmitted = false

  return async function compositeHandler(
    event: BrokerEvent,
    route: CompiledRoute,
  ): Promise<RouteOutcome> {
    const def = route.definition as RouteCompositeDefinition
    const httpStep = def.steps.find((s) => s.type === 'http')
    if (!httpStep || httpStep.route === undefined) {
      return {
        ok: false,
        error: createBrokerError({
          code: 'route.composite.no-http',
          category: 'config',
          message:
            'Composite route requires at least one http step in F3 (cache adapter F6 deferred)',
          routeId: route.id,
          topic: event.topic,
          eventId: event.id,
        }),
        routeId: route.id,
      }
    }

    // Q3 opzione b: warning UNA SOLA volta se workflow include cache step (deferred F6).
    if (def.steps.some((s) => s.type === 'cache') && !cacheWarnEmitted) {
      cacheWarnEmitted = true
      deps.onCacheDeferred?.({ topic: event.topic, routeId: route.id })
    }

    const subRoute = deps.resolveSubRoute(httpStep.route)
    if (!subRoute) {
      return {
        ok: false,
        error: createBrokerError({
          code: 'route.composite.subroute-missing',
          category: 'config',
          message: `Composite step refers to unknown route "${httpStep.route}"`,
          routeId: route.id,
          topic: event.topic,
          eventId: event.id,
        }),
        routeId: route.id,
      }
    }

    return await deps.httpHandler(event, subRoute)
  }
}
