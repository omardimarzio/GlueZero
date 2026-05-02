// router-engine.ts — Glue object che compone i 5 sub-componenti F3 (D-83 + D-84).
//
// Composition root invocato da `RouterBroker` constructor:
//   - RouteResolver (dispatch table pre-compilata, plan 03-05)
//   - RouteExecutor (dispatch by type, plan 03-06)
//   - HttpGateway (centralized fetch + policy chain, plan 03-08)
//   - OutcomeCollector (step 10 pipeline §28, plan 03-07)
//   - HttpGatewayStrategies (6/7 default Strategy primitives — auth e circuitBreaker
//     instantiate solo se la config gateway le dichiara)
//
// Tipo "engine" è un piccolo namespace; non è una class semantica ma un oggetto
// immutabile con 5 readonly field. RouterBroker (plan 03-12 Task 2) compone questa
// istanza + MapperBroker (privato) per orchestrare la pipeline §28 step 7-full → 8 → 9 → 10.
//
// Vincolo D-83: ZERO modifiche a packages/core/ + packages/mapper/ runtime. Tutti i
// sub-componenti vengono costruiti a partire da config locale. Le strategy 6/7 sono
// invocate via le factory `createXxxStrategy` di `@sembridge/gateway/http/strategies`
// (plan 03-09/10/11). Il http-handler factory (`createHttpHandler`, plan 03-08) lega
// gateway + mapper + validator + strategies in un unico async handler.

import type { EventTap } from '@sembridge/core'
import {
  createAuthStrategy,
  createBackpressureStrategy,
  createCircuitBreakerStrategy,
  createDedupeStrategy,
  createIdempotencyStrategy,
  createRetryStrategy,
  createTimeoutStrategy,
  HttpGateway,
} from '@sembridge/gateway/http'
import type { GatewayConfig, HttpGatewayStrategies } from '@sembridge/gateway/http'
import { OutcomeCollector, type PublishFn } from './outcome-collector'
import { RouteExecutor } from './route-executor'
import { type AmbiguousRouteEvent, RouteResolver } from './route-resolver'
import { createHttpHandler } from './route-handlers/http-handler'
import type { RoutingConfig } from './types/routing-config'

/**
 * Adapter strutturale del MapperEngine F2 consumato dal http-handler (plan 03-08).
 *
 * Replica `HttpHandlerMapper` (route-handlers/http-handler.ts:103) per evitare
 * cyclic dependency. Il `RouterBroker` plan 03-12 Task 2 fornisce un adapter che
 * bind a `inner.mapper` del `MapperBroker` privato.
 */
export interface RouterEngineMapperAdapter {
  mapToShape(canonical: unknown, outputMap: unknown): unknown
  mapToCanonical(shape: unknown, schemaId: string): unknown
}

/**
 * Adapter strutturale del ValidatorAdapter F2 consumato dal http-handler (VAL-05).
 *
 * Replica `HttpHandlerValidator` (route-handlers/http-handler.ts:131) per evitare
 * cyclic dependency. Default per RouterBroker plan 03-12 Task 2: `valibotAdapter` di F2.
 */
export interface RouterEngineValidatorAdapter {
  validate(
    schemaId: string,
    payload: unknown,
  ):
    | { readonly ok: true }
    | {
        readonly ok: false
        readonly issues: ReadonlyArray<{ readonly message: string; readonly path?: ReadonlyArray<string> }>
      }
}

/**
 * Dependency injection per `RouterEngine`.
 *
 * - `mapper` — adapter MapperEngine (D-96/D-97); il RouterBroker bind a `inner.mapper`.
 * - `validator` — adapter validator (VAL-05); default `valibotAdapter` F2.
 * - `gatewayConfig` — config HttpGateway (allowlist, auth, defaults, circuitBreaker).
 * - `routingConfig` — config routing (multipleRoutesPolicy, requiresRouteTopics).
 *   Riservato a estensioni F4+; in F3 le strategie multipleRoutes vengono applicate dal
 *   resolver al momento del `resolve(topic, policy)` invocato dal RouterBroker.
 * - `publishFn` — callback iniettato nel OutcomeCollector per `inner.publish`.
 * - `tap` — opzionale; propagato al RouteExecutor (step 9) e OutcomeCollector (step 10).
 * - `onAmbiguousRoutes` — callback dev-mode per `routing.ambiguous` (D-66).
 * - `onCacheDeferred` — callback dev-mode per composite con cache step (Q3 opzione b).
 *   Plan 03-12 Task 2 farà il bind a `publish('routing.composite.deferred', ...)`.
 */
export interface RouterEngineDeps {
  readonly mapper: RouterEngineMapperAdapter
  readonly validator?: RouterEngineValidatorAdapter
  readonly gatewayConfig?: GatewayConfig
  readonly routingConfig?: RoutingConfig
  readonly publishFn: PublishFn
  readonly tap?: EventTap
  readonly onAmbiguousRoutes?: (event: AmbiguousRouteEvent) => void
  readonly onCacheDeferred?: (event: { topic: string; routeId: string }) => void
}

/**
 * RouterEngine — glue object che compone i 5 sub-componenti F3 (D-83 + D-84).
 *
 * Costruito UNA volta dal `RouterBroker` constructor (plan 03-12 Task 2). Ogni field è
 * `readonly` — l'engine è effectively immutable post-construct.
 *
 * Strategy bundling:
 * - 5 strategy default sempre instanziate: retry, timeout, idempotency, dedupe, backpressure
 * - 2 strategy opt-in (config-derived): auth (solo se `gatewayConfig.auth` presente),
 *   circuitBreaker (solo se `gatewayConfig.circuitBreaker !== undefined && !== false`).
 *
 * Conditional spread per `exactOptionalPropertyTypes: true` compliance — i field opzionali
 * assenti NON sono `undefined` espliciti.
 *
 * @example
 * ```ts
 * const engine = new RouterEngine({
 *   mapper: { mapToShape: (c, m) => ..., mapToCanonical: (s, id) => ... },
 *   publishFn: (topic, payload, options) => mapperBroker.publish(topic, payload, options),
 *   gatewayConfig: { allowlist: ['https://api.example.com'] },
 *   routingConfig: { multipleRoutesPolicy: 'first-match' },
 * })
 * engine.resolver.register({ id: 'r1', type: 'http', topic: 'weather.requested', ... })
 * ```
 */
export class RouterEngine {
  readonly resolver: RouteResolver
  readonly executor: RouteExecutor
  readonly httpGateway: HttpGateway
  readonly collector: OutcomeCollector
  readonly strategies: HttpGatewayStrategies

  constructor(deps: RouterEngineDeps) {
    const cfg: GatewayConfig = deps.gatewayConfig ?? {}

    // ---------- Strategy bundle (config-derived defaults) ----------
    const baseStrategies: HttpGatewayStrategies = {
      retry: createRetryStrategy({
        maxAttempts: cfg.defaults?.retry?.maxAttempts ?? 3,
        baseDelayMs: cfg.defaults?.retry?.baseDelayMs ?? 300,
        maxDelayMs: cfg.defaults?.retry?.maxDelayMs ?? 10_000,
      }),
      timeout: createTimeoutStrategy(),
      idempotency: createIdempotencyStrategy({
        headerName: cfg.defaults?.idempotency?.headerName ?? 'Idempotency-Key',
      }),
      dedupe: createDedupeStrategy(),
      backpressure: createBackpressureStrategy({
        defaultPolicy: cfg.defaults?.backpressure ?? { type: 'queue-bounded', max: 100 },
      }),
    }

    // Opt-in strategies (auth + circuitBreaker) — instantiate solo se config dichiara.
    // Conditional spread per `exactOptionalPropertyTypes: true`.
    this.strategies = {
      ...baseStrategies,
      ...(cfg.auth !== undefined && { auth: createAuthStrategy({ config: cfg.auth }) }),
      ...(cfg.circuitBreaker !== undefined &&
        cfg.circuitBreaker !== false && {
          circuitBreaker: createCircuitBreakerStrategy({ config: cfg.circuitBreaker }),
        }),
    }

    // ---------- HttpGateway ----------
    this.httpGateway = new HttpGateway(cfg)

    // ---------- RouteResolver ----------
    const resolverOptions: { onAmbiguousRoutes?: (event: AmbiguousRouteEvent) => void } = {}
    if (deps.onAmbiguousRoutes !== undefined) {
      resolverOptions.onAmbiguousRoutes = deps.onAmbiguousRoutes
    }
    this.resolver = new RouteResolver(resolverOptions)

    // ---------- HTTP handler (gateway + mapper + validator + strategies) ----------
    const httpHandler = createHttpHandler({
      gateway: this.httpGateway,
      mapper: deps.mapper,
      ...(deps.validator !== undefined && { validator: deps.validator }),
      strategies: this.strategies,
    })

    // ---------- RouteExecutor (dispatch by type) ----------
    this.executor = new RouteExecutor({
      httpHandler: (event, route, signal) => httpHandler(event, route, signal),
      resolveSubRoute: (id) => this.resolver.list().find((r) => r.id === id),
      ...(deps.tap !== undefined && { tap: deps.tap }),
      ...(deps.onCacheDeferred !== undefined && { onCacheDeferred: deps.onCacheDeferred }),
    })

    // ---------- OutcomeCollector (step 10 pipeline §28) ----------
    this.collector = new OutcomeCollector({
      publishFn: deps.publishFn,
      ...(deps.tap !== undefined && { tap: deps.tap }),
    })

    // routingConfig is currently consumed by the RouterBroker wrapper (plan 03-12 Task 2)
    // for `multipleRoutesPolicy` selection at resolve-time. Stored here only for parity
    // with future F4+ extensions; no current sub-component reads it from the engine.
    void deps.routingConfig
  }
}
