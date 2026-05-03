// route-executor.ts — Dispatch by type per CompiledRoute (D-65, ROUTE-02..05).
//
// F3 supporta 4 type:
// - 'local'     SYNC  → localHandler passthrough
// - 'http'      ASYNC → httpHandler (plan 03-08 fornisce implementazione effettiva;
//                       qui dependency injection via constructor)
// - 'cache'     STUB  → cacheHandler ritorna 'cache.not-implemented' (deferred F6)
// - 'composite' ASYNC → compositeHandler (createCompositeHandler factory) delega a httpHandler;
//                       cache step è skippato in F3 con warning UNA SOLA volta (Q3 opzione b)
//
// AbortController tracking per ROUTE-13 (cancellazione user-level) + LIFE-02 ext F3
// (cascade abort plugin-scoped, D-86):
// - `inFlight: Map<eventId, InFlightEntry>` — registry delle request HTTP/composite
//   in volo. Local/cache sono SYNC → entry brevissima vita (creata + cleanup nel `finally`).
// - `abortInFlight(eventId)` — abort puntuale via `AbortController.abort(reason)`.
// - `abortInFlightByOwner(ownerId)` — cascade abort per LIFE-02 ext F3 (D-76, D-86).
//
// EventTap step 9 (`event.route.executed`) emesso post-dispatch con metadata
// {routeId, routeType, ok}. Pattern try/catch swallow analogo a F2 `emitF2Tap`
// (broker-mapper-wrapper.ts:325) — `safeTapStep` di core non è esposto al barrel.
//
// Vincolo D-83: ZERO modifiche a packages/core/ + packages/mapper/ runtime. Tutti
// gli step di pipeline §28 estensione F3 sono emessi nel package `@sembridge/routing`.
//
// Threat coverage:
// - T-03-06-01 (Tampering — RouteOutcome mutation): outcome è readonly per costruzione,
//   ogni dispatch produce un nuovo literal.
// - T-03-06-02 (DoS — inFlight unbounded): `finally { this.inFlight.delete(eventId) }`
//   garantisce cleanup. Timeout/abort policy gestiti da plan 03-09 (timeout-strategy).
// - T-03-06-03 (Spoofing — route.type sconosciuto): switch default branch ritorna
//   `RouteOutcome.error 'route.type.unknown'` (config error) invece di throw.
// - T-03-06-04 (Information Disclosure): `BrokerError.details` NON include payload —
//   solo routeId+topic+eventId (sanitize a livello createBrokerError).

import type { BrokerEvent, EventTap, PipelineSnapshot, PipelineStep } from '@sembridge/core'
import { createBrokerError } from '@sembridge/core'
import { cacheHandler } from './route-handlers/cache-handler'
import { createCompositeHandler } from './route-handlers/composite-handler'
import { localHandler } from './route-handlers/local-handler'
import type { CompiledRoute } from './route-resolver'
import type { RouteOutcome } from './types/route-outcome'

/**
 * Dependency injection per `RouteExecutor` (D-65).
 *
 * - `httpHandler` — invoca il gateway HTTP per route `type: 'http'`. Plan 03-08
 *   fornisce l'implementazione vera; qui ammette qualunque async function compatibile
 *   per dev/test (mock).
 * - `resolveSubRoute` — risolve sub-route by id per il composite workflow (delegate
 *   al `RouteResolver`).
 * - `tap` — opzionale; se presente, emette step 9 `event.route.executed` ad ogni
 *   `execute()`. Default: no-op (nessuna emissione).
 * - `onCacheDeferred` — callback opt-in dev-mode per warning composite con cache step
 *   (Q3 opzione b). Plan 03-12 RouterBroker farà il bind a
 *   `publish('routing.composite.cache-deferred', ...)`.
 */
export interface RouteExecutorDeps {
  readonly httpHandler: (
    event: BrokerEvent,
    route: CompiledRoute,
    signal: AbortSignal,
  ) => Promise<RouteOutcome>
  readonly resolveSubRoute: (id: string) => CompiledRoute | undefined
  readonly tap?: EventTap
  readonly onCacheDeferred?: (event: { topic: string; routeId: string }) => void
}

/**
 * Entry interna del registry `inFlight` — traccia controller + ownership per cascade.
 */
interface InFlightEntry {
  readonly controller: AbortController
  readonly ownerId: string | undefined
  readonly routeId: string
}

/**
 * RouteExecutor — dispatch by type per CompiledRoute (D-65).
 *
 * Costruisce un `compositeHandler` istanza-bound al constructor (closure su deps).
 * Mantiene `Map<eventId, InFlightEntry>` per O(1) lookup di abort puntuale + cascade.
 *
 * @example
 * ```ts
 * const executor = new RouteExecutor({
 *   httpHandler: async (e, r, signal) => httpGateway.fetch(e, r, signal),
 *   resolveSubRoute: (id) => resolver.list().find((r) => r.id === id),
 *   tap: inspectorTap,
 *   onCacheDeferred: (ev) => broker.publish('routing.composite.cache-deferred', ev),
 * })
 * const outcome = await executor.execute(compiledRoute, event)
 * ```
 */
export class RouteExecutor {
  private readonly inFlight = new Map<string, InFlightEntry>()
  private readonly composite: (event: BrokerEvent, route: CompiledRoute) => Promise<RouteOutcome>
  private readonly tap: EventTap | undefined
  private readonly httpHandler: RouteExecutorDeps['httpHandler']

  constructor(deps: RouteExecutorDeps) {
    this.httpHandler = deps.httpHandler
    this.tap = deps.tap
    // Composite handler riceve un wrapper di httpHandler che inietta il signal corretto
    // dal registry inFlight (l'eventId del composite è lo stesso del sub-http step).
    this.composite = createCompositeHandler({
      httpHandler: (e, subRoute) => {
        const signal = this.getOrCreateController(e.id, subRoute).signal
        return this.httpHandler(e, subRoute, signal)
      },
      resolveSubRoute: deps.resolveSubRoute,
      ...(deps.onCacheDeferred !== undefined && { onCacheDeferred: deps.onCacheDeferred }),
    })
  }

  /**
   * Esegue il dispatch della CompiledRoute sul tipo della definition (D-65).
   *
   * Cleanup `inFlight` garantito via `finally` per evitare leak su throw o abort
   * (T-03-06-02 mitigation). Tap step 9 emesso al ritorno con metadata strutturata.
   *
   * @param route - CompiledRoute da eseguire (definition.type discrimina handler).
   * @param event - BrokerEvent originating dal broker.
   * @returns Promise<RouteOutcome> — ok success o error per ogni branch.
   */
  async execute(route: CompiledRoute, event: BrokerEvent): Promise<RouteOutcome> {
    const startTime = performance.now()
    const controller = this.getOrCreateController(event.id, route)
    let outcome: RouteOutcome
    try {
      switch (route.definition.type) {
        case 'local':
          outcome = localHandler(event, route)
          break
        case 'http':
          outcome = await this.httpHandler(event, route, controller.signal)
          break
        case 'cache':
          outcome = cacheHandler(event, route)
          break
        case 'composite':
          outcome = await this.composite(event, route)
          break
        default: {
          const unknownType = (route.definition as { type: string }).type
          outcome = {
            ok: false,
            routeId: route.id,
            error: createBrokerError({
              code: 'route.type.unknown',
              category: 'config',
              message: `Unknown route type: "${unknownType}"`,
              routeId: route.id,
              topic: event.topic,
              eventId: event.id,
              details: { unknownType },
            }),
          }
        }
      }
    } finally {
      this.inFlight.delete(event.id)
    }
    this.emitTap(startTime, event, route, outcome)
    return outcome
  }

  /**
   * Abort puntuale di una request HTTP/composite in volo (ROUTE-13).
   *
   * @param eventId - id dell'evento che ha originato la request.
   * @param reason - motivo abort (default `'gateway.aborted'`). Propagato a
   *   `AbortController.abort(reason)` e visibile via `signal.reason` nel handler.
   * @returns `true` se l'abort è stato eseguito, `false` se l'eventId non era in volo.
   */
  abortInFlight(eventId: string, reason: string = 'gateway.aborted'): boolean {
    const entry = this.inFlight.get(eventId)
    if (!entry) return false
    entry.controller.abort(reason)
    return true
  }

  /**
   * Cascade abort per ALL request bound al `ownerId` (LIFE-02 ext F3, D-76, D-86).
   *
   * Invocato dal `RouterBroker.unregisterPlugin` plan 03-12 per chiudere la chiusura
   * PRD §39 #7 (cascade unregister di subscription + canonical/alias/transform + route +
   * inflight HTTP).
   *
   * @param ownerId - id del plugin/owner che ha registrato le route.
   * @param reason - motivo abort (default `'plugin.unregistered'`).
   * @returns Numero di request abortite (0 se nessuna request bound a ownerId).
   */
  abortInFlightByOwner(ownerId: string, reason: string = 'plugin.unregistered'): number {
    let count = 0
    for (const entry of this.inFlight.values()) {
      if (entry.ownerId === ownerId) {
        entry.controller.abort(reason)
        count++
      }
    }
    return count
  }

  /**
   * Conta le request attualmente in volo (debug helper, riusato da Inspector F6).
   */
  inFlightCount(): number {
    return this.inFlight.size
  }

  /**
   * Crea (o riusa) il `AbortController` per il dato eventId.
   *
   * Riuso: utile per il composite handler, che deve condividere il signal tra il
   * dispatch del composite e il dispatch del sub-http step (stesso eventId).
   */
  private getOrCreateController(eventId: string, route: CompiledRoute): AbortController {
    const existing = this.inFlight.get(eventId)
    if (existing) return existing.controller
    const controller = new AbortController()
    this.inFlight.set(eventId, {
      controller,
      ownerId: route.ownerId,
      routeId: route.id,
    })
    return controller
  }

  /**
   * Emette tap step 9 `event.route.executed` con metadata strutturata.
   *
   * Pattern F2 `emitF2Tap` (broker-mapper-wrapper.ts:325) — try/catch swallow per
   * non rompere la pipeline se un tap di terze parti throw (T-04-01 invariato).
   * `safeTapStep` di core non è esposto al barrel; replichiamo inline.
   */
  private emitTap(
    startTime: number,
    event: BrokerEvent,
    route: CompiledRoute,
    outcome: RouteOutcome,
  ): void {
    if (this.tap === undefined) return
    const snapshot: PipelineSnapshot = {
      eventId: event.id,
      topic: event.topic,
      step: 'event.route.executed' as PipelineStep,
      timestamp: Date.now(),
      durationMs: performance.now() - startTime,
      metadata: {
        routeId: route.id,
        routeType: route.definition.type,
        ok: outcome.ok,
      },
    }
    try {
      this.tap.onPipelineStep('event.route.executed' as PipelineStep, snapshot)
    } catch {
      // Pattern F1 safeTapStep: swallow per non rompere il chain (T-04-01 mitigation).
    }
  }
}
