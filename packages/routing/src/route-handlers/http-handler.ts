// http-handler.ts — Route handler `'http'` (D-60, ROUTE-03, ROUTE-06).
//
// Pipeline interna del handler (PRD §17.4 + §28 step 7-full / 8-full):
// 1. Build HttpRequestSpec via `mapper.mapToShape(canonical, route.request.queryMap/bodyMap)`
//    (D-96 — riuso del MapperEngine F2).
// 2. Delegate a `httpGateway.execute(request, route, event, signal, strategies)` che
//    applica policy chain (allowlist + auth + idempotency + retry + ...).
// 3. Parse response.body → applica `mapper.mapToCanonical(response.body, route.response.canonical)`
//    (D-97 — server flat → canonical).
// 4. `validator.validate(canonicalSchemaId, mapped)` (VAL-05 / D-78).
// 5. Wrap in `RouteOutcome` con metadata `{ httpStatus, attemptCount, origin: 'remote' }`.
//
// Errori → `RouteOutcome.error` con shape D-80 (BrokerError code/category):
// - `gateway.4xx`/`gateway.5xx` da response.ok=false (HTTP status non 2xx).
// - `gateway.url.forbidden`/`gateway.timeout`/`gateway.aborted`/`gateway.network` da
//   gateway.execute throw (BrokerError già confezionato dal gateway).
// - `response.validation.failed` da validator.validate ok=false (VAL-05).
//
// Vincolo D-83: ZERO modifiche a packages/core/ + packages/mapper/ runtime. Le dependencies
// (gateway/mapper/validator/strategies) sono dependency injection structural-typed —
// il RouterBroker plan 03-12 fornirà le implementazioni concrete (HttpGateway,
// MapperEngine adapter, valibotAdapter).
//
// Threat coverage:
// - T-03-08-04 (Spoofing — Idempotency-Key replay): mitigato dal gateway, qui passthrough.
// - T-03-08-05 (Information Disclosure — error stack trace): originalError preservato in
//   BrokerError; OutcomeCollector plan 03-07 sanitizza prima del publish.
// - VAL-05 contract: server response invalid → handler emette outcome.error che il
//   RouteExecutor mappa a `<topic>.failed` (D-80).

import type { BrokerError, BrokerEvent } from '@sembridge/core'
import { createBrokerError, isBrokerError } from '@sembridge/core'
import type { CompiledRoute } from '../route-resolver'
import type { RouteHttpDefinition } from '../types/route-definition'
import type { RouteOutcome } from '../types/route-outcome'

/**
 * Spec HTTP request che il gateway riceve.
 *
 * Definito qui come duplicato strutturale di `HttpRequestSpec` di `@sembridge/gateway/http`
 * per evitare cyclic dependency tra `@sembridge/routing` e `@sembridge/gateway` —
 * entrambi i package dichiarano lo stesso shape ma il routing engine non depende
 * runtime sul gateway runtime (only structural protocol). Il RouterBroker plan 03-12
 * cabla il vero `HttpGateway` come dependency injection.
 */
export interface HttpHandlerRequestSpec {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  readonly url: string
  readonly headers: Record<string, string>
  readonly body?: BodyInit
}

/**
 * Spec HTTP response normalizzata che il gateway ritorna.
 *
 * Stesso pattern strutturale di `HttpResponseSpec` di `@sembridge/gateway/http`.
 */
export interface HttpHandlerResponseSpec {
  readonly ok: boolean
  readonly status: number
  readonly headers: Record<string, string>
  readonly body: unknown
}

/**
 * Strategy bundle iniettato al gateway. Structural-typed: il RouterBroker plan 03-12
 * fornirà il vero `HttpGatewayStrategies` di `@sembridge/gateway/http`.
 */
export interface HttpHandlerStrategies {
  readonly retry?: unknown
  readonly timeout?: unknown
  readonly dedupe?: unknown
  readonly backpressure?: unknown
  readonly auth?: unknown
  readonly idempotency?: unknown
  readonly circuitBreaker?: unknown
}

/**
 * Subset di `HttpGateway` consumato dal handler. Definito strutturalmente per evitare
 * cyclic dependency. Il RouterBroker plan 03-12 fornirà la vera istanza di
 * `HttpGateway` (compatible structural).
 */
export interface HttpHandlerGateway {
  execute(
    request: HttpHandlerRequestSpec,
    route: { id: string; ownerId?: string },
    event: BrokerEvent,
    signal: AbortSignal | undefined,
    strategies: HttpHandlerStrategies,
  ): Promise<HttpHandlerResponseSpec>
}

/**
 * Subset minimal del `MapperEngine` F2 consumato dal handler (D-96/D-97).
 *
 * - `mapToShape(canonical, outputMap)` — canonico → server flat (request build).
 * - `mapToCanonical(shape, schemaId)` — server flat → canonico (response parse).
 *
 * Il RouterBroker plan 03-12 fornisce un adapter che espone questi metodi sopra il
 * `MapperEngine.applyOutputMap`/`applyInputMap` reale.
 */
export interface HttpHandlerMapper {
  mapToShape(canonical: unknown, outputMap: unknown): unknown
  mapToCanonical(shape: unknown, schemaId: string): unknown
}

/**
 * Singolo issue ritornato dal validator (VAL-05).
 */
export interface HttpHandlerValidationIssue {
  readonly message: string
  readonly path?: readonly string[]
}

/**
 * Risultato della response validation (VAL-05 / D-78).
 *
 * Pattern coerente con `ValidationResult` di F2 (`valibotAdapter.validate` ritorna lo
 * stesso shape).
 */
export type HttpHandlerValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly HttpHandlerValidationIssue[] }

/**
 * Subset minimal del `ValidatorAdapter` F2 consumato dal handler (VAL-05).
 *
 * Il RouterBroker plan 03-12 inietta `valibotAdapter` (F2) come default.
 */
export interface HttpHandlerValidator {
  validate(schemaId: string, payload: unknown): HttpHandlerValidationResult
}

/**
 * Dependencies per `createHttpHandler` (factory pattern coerente con `createCompositeHandler`).
 *
 * Tutte le dependencies sono structural-typed — il RouterBroker plan 03-12 cabla le
 * implementazioni concrete (HttpGateway + MapperEngine adapter + valibotAdapter).
 */
export interface HttpHandlerDeps {
  readonly gateway: HttpHandlerGateway
  readonly mapper: HttpHandlerMapper
  /** Validator opt-in: se assente, response validation è skippata (best-effort). */
  readonly validator?: HttpHandlerValidator
  readonly strategies: HttpHandlerStrategies
}

/**
 * Crea il route handler per `RouteDefinition.type === 'http'` (D-60, ROUTE-03).
 *
 * Il handler è una `async function` che riceve `(event, route, signal)` e ritorna
 * `Promise<RouteOutcome>`. È il "ponte" tra il `RouteExecutor` (che dispatcha per
 * type) e il `HttpGateway` (che esegue fetch + policy chain).
 *
 * Pipeline:
 * 1. Build `HttpRequestSpec` via `mapper.mapToShape(event.payload, route.request.queryMap)`
 *    + `mapper.mapToShape(event.payload, route.request.bodyMap)`.
 * 2. `gateway.execute(request, ...)` → `HttpResponseSpec`.
 * 3. Se response.ok=false → `RouteOutcome.error` (gateway.4xx/5xx).
 * 4. Altrimenti `mapper.mapToCanonical(response.body, route.response.canonical)`.
 * 5. Se `validator` presente → `validator.validate(schemaId, canonical)`.
 * 6. Wrap in `RouteOutcome.ok` con metadata.
 *
 * Errori thrown dal gateway (BrokerError) sono catturati e wrappati in `RouteOutcome.error`.
 *
 * @param deps - Dependencies (gateway, mapper, validator opt-in, strategies).
 * @returns Async handler `(event, route, signal) => Promise<RouteOutcome>`.
 *
 * @example
 * ```ts
 * const handler = createHttpHandler({
 *   gateway: httpGateway,
 *   mapper: mapperAdapter,
 *   validator: valibotAdapter,
 *   strategies: { retry: defaultRetry, auth: bearerAuth },
 * })
 * const outcome = await handler(event, compiledRoute, signal)
 * if (outcome.ok) console.log(outcome.canonicalPayload)
 * ```
 */
export function createHttpHandler(
  deps: HttpHandlerDeps,
): (event: BrokerEvent, route: CompiledRoute, signal: AbortSignal) => Promise<RouteOutcome> {
  return async function httpHandler(
    event: BrokerEvent,
    route: CompiledRoute,
    signal: AbortSignal,
  ): Promise<RouteOutcome> {
    const def = route.definition as RouteHttpDefinition
    try {
      // ----- Step 1: build request via mapper.mapToShape (D-96) -----
      const queryShape =
        def.request.queryMap !== undefined
          ? (deps.mapper.mapToShape(event.payload, def.request.queryMap) as Record<string, unknown>)
          : {}
      const bodyShape =
        def.request.bodyMap !== undefined
          ? deps.mapper.mapToShape(event.payload, def.request.bodyMap)
          : undefined

      // Build query string (skip undefined/null values)
      const queryEntries: [string, string][] = []
      for (const [k, v] of Object.entries(queryShape ?? {})) {
        if (v !== undefined && v !== null) queryEntries.push([k, String(v)])
      }
      const queryString =
        queryEntries.length > 0 ? new URLSearchParams(queryEntries).toString() : ''
      const fullUrl = queryString ? `${def.request.url}?${queryString}` : def.request.url

      const httpRequest: HttpHandlerRequestSpec = {
        method: def.request.method,
        url: fullUrl,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        ...(bodyShape !== undefined && { body: JSON.stringify(bodyShape) }),
      }

      // ----- Step 2: delegate al gateway -----
      const routeInfo: { id: string; ownerId?: string } = {
        id: route.id,
        ...(route.ownerId !== undefined && { ownerId: route.ownerId }),
      }
      const response = await deps.gateway.execute(
        httpRequest,
        routeInfo,
        event,
        signal,
        deps.strategies,
      )

      // ----- Step 3: response.ok=false → RouteOutcome.error -----
      if (!response.ok) {
        const code: 'gateway.4xx' | 'gateway.5xx' =
          response.status >= 500 ? 'gateway.5xx' : 'gateway.4xx'
        const error = createBrokerError({
          code,
          category: 'network',
          message: `HTTP ${response.status}`,
          routeId: route.id,
          topic: event.topic,
          eventId: event.id,
          details: { httpStatus: response.status, body: response.body },
        })
        return { ok: false, routeId: route.id, error }
      }

      // ----- Step 4: mapper response → canonical (D-97) -----
      const canonicalResponse = deps.mapper.mapToCanonical(response.body, def.response.canonical)

      // ----- Step 5: response validation opt-in (VAL-05 / D-78) -----
      if (deps.validator) {
        const validationResult = deps.validator.validate(def.response.canonical, canonicalResponse)
        if (!validationResult.ok) {
          const error = createBrokerError({
            code: 'response.validation.failed',
            category: 'validation',
            message: 'Server response failed canonical schema validation',
            routeId: route.id,
            topic: event.topic,
            eventId: event.id,
            details: {
              schemaId: def.response.canonical,
              issues: validationResult.issues,
            },
          })
          return { ok: false, routeId: route.id, error }
        }
      }

      // ----- Step 6: wrap in RouteOutcome.ok -----
      return {
        ok: true,
        canonicalPayload: canonicalResponse,
        routeId: route.id,
        metadata: {
          httpStatus: response.status,
          attemptCount: 1,
          origin: 'remote',
        },
      }
    } catch (err) {
      // BrokerError dal gateway (gateway.url.forbidden / gateway.timeout / gateway.aborted /
      // gateway.network / circuit.open) — preservati as-is.
      if (isBrokerError(err)) {
        return { ok: false, routeId: route.id, error: err as BrokerError }
      }
      // Errori inattesi (non-BrokerError) → wrappa in gateway.network preservando originalError.
      const error = createBrokerError({
        code: 'gateway.network',
        category: 'network',
        message: (err as Error)?.message ?? 'Unknown gateway error',
        routeId: route.id,
        topic: event.topic,
        eventId: event.id,
        ...(err instanceof Error && { originalError: err }),
      })
      return { ok: false, routeId: route.id, error }
    }
  }
}
