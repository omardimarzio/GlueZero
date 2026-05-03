/**
 * @sembridge/routing — Routing engine dichiarativo per SemBridge.
 *
 * Phase 3 di SemBridge V1. Estende `@sembridge/core` (Phase 1) e `@sembridge/mapper`
 * (Phase 2) con:
 * - **`RouteDefinition`** discriminata via `type`: `'local' | 'http' | 'cache' | 'composite'`
 *   (worker aggiunto in F5 via declaration merging)
 * - **`RouteResolver`** — dispatch table pre-compilata con wildcard trie segmentato (riusa
 *   `TopicTrie` di F1 D-08) per O(1) lookup runtime
 * - **`RouteExecutor`** — dispatch by type. Handler `local` sync (pipeline F1 invariata),
 *   `http`/`cache`/`composite` async (`Promise<RouteOutcome>`)
 * - **`RouterBroker`** — composition wrapper di `MapperBroker` (D-83): estende l'API
 *   con `registerRoute` / `unregisterRoute` e cascade su `unregisterPlugin` (LIFE-02 ext F3)
 * - **Strategie multipleRoutes (D-66):** `'first-match'` (default), `'priority-ordered'`,
 *   `'all'` (broadcast fan-out)
 * - **Pipeline §28 step 7-full / 8 / 9 / 10** — dedupe checked, route resolved, route
 *   executed, outcome collected
 *
 * Estende via TS declaration merging (D-93/D-94/D-95, plan 03-03):
 * - `PluginDescriptor.routes` (D-94, ROUTE-01)
 * - `BrokerConfig.routes` + `BrokerConfig.routing` (D-93)
 * - `CanonicalSchema.requiresRoute` (D-95, ROUTE-16, chiusura PRD §39 #5)
 *
 * Vincolo architetturale (D-83): il package NON modifica `bus.ts` di F1 né
 * `broker-mapper-wrapper.ts` di F2. Estende:
 * - composition wrapper (`router-broker-wrapper.ts`, plan 03-12)
 * - TS declaration merging (`./augment`, plan 03-03)
 *
 * Side-effect import: `import './augment'` PRIMA degli export per attivare il
 * declaration merging. `package.json` ha `sideEffects: ["./dist/augment.js"]` per
 * evitare tree-shaking accidentale del file (Pattern S1 — T-03-03-01).
 *
 * Per la documentazione utente completa (scenario meteo HTTP PRD §29, retry policy
 * 4xx/5xx, idempotency token, URL allowlist, multipleRoutes policy, LIFE-02 cascade),
 * vedi `packages/routing/README.md`.
 *
 * @packageDocumentation
 */

// Plan 03-02 popola i type exports (RouteDefinition, RoutePolicies, RouteOutcome,
//             RoutingConfig).
// Plan 03-03 aggiunge il side-effect import './augment' per il declaration merging
//             di PluginDescriptor.routes?, BrokerConfig.routes?/routing?,
//             CanonicalSchema.requiresRoute? + esporta F3PipelineStep literal union.
// Plan 03-12 aggiungerà il runtime export RouterBroker + createRouterBroker (factory
//             pubblico + Valibot validation).

// Side-effect import — abilita TS declaration merging per @sembridge/core
// (PluginDescriptor.routes, BrokerConfig.routes/routing) e @sembridge/mapper
// (CanonicalSchema.requiresRoute). Vedi `packages/routing/src/augment.ts`
// (D-83/D-93/D-94/D-95). Ri-esportiamo `__augmentLoaded` come simbolo pubblico per
// evitare il tree-shaking del side-effect import (Pattern S1, T-03-03-01 mitigation).
// Il `package.json` ha `sideEffects: ["./dist/augment.js", ...]` array per double-safety
// in ambienti consumer (Vite/webpack/esbuild).
export { __augmentLoaded, type F3PipelineStep } from './augment'

// Type re-export espliciti per discoverability — il barrel `./types` aggrega i 4 file
// di tipo del routing engine. I blocchi `export type` sotto sono i tipi pubblici del
// package F3 (26 type totali esportati — vedi plan 03-02 SUMMARY).

// RouteDefinition discriminated union (4 variants) + spec http (D-60, ROUTE-01..05).
export type {
  RouteCacheDefinition,
  RouteCacheStrategy,
  RouteCompositeDefinition,
  RouteCompositeStep,
  RouteDefinition,
  RouteDefinitionBase,
  RouteHttpDefinition,
  RouteHttpPublishesSpec,
  RouteHttpRequestSpec,
  RouteHttpResponseSpec,
  RouteLocalDefinition,
} from './types/route-definition'

// RoutePolicies + 7 sub-config types (D-68/D-69/D-70/D-72/D-73/D-74/D-75 + ROUTE-08/10/11/13 + SEC-01/03).
export type {
  AuthPolicyConfig,
  BackpressurePolicyConfig,
  ConcurrencyPolicy,
  DedupePolicyConfig,
  ErrorPolicyConfig,
  IdempotencyPolicyConfig,
  RetryPolicyConfig,
  RoutePolicies,
  TimeoutPolicyConfig,
} from './types/route-policies'

// RouteOutcome discriminated + alias (D-80, D-82 — pattern ValidationResult F2).
export type {
  RouteError,
  RouteOutcome,
  RouteOutcomeMetadata,
  RouteResult,
} from './types/route-outcome'

// RoutingConfig + MultipleRoutesPolicy (D-66/D-67/D-100, ROUTE-15/ROUTE-16).
export type {
  MultipleRoutesPolicy,
  RoutingConfig,
} from './types/routing-config'

// ---------- Runtime exports F3 (Plan 03-12 Task 3) ----------
//
// Plan 03-12 popola i runtime export del package: RouterBroker class + createRouterBroker
// factory (Valibot validation + composition wrapper di MapperBroker D-83).
//
// Ri-esportiamo anche RouteResolver per consumer avanzati (test, dev tools F6) che
// vogliono iterare le route registrate (`resolver.list()`) o introspect via
// `countByOwner`. Il RouteExecutor / OutcomeCollector / HttpGateway sono incapsulati
// nel RouterEngine privato del RouterBroker — non ri-esportati al barrel pubblico
// (consumer interagiscono via RouterBroker.registerRoute / publish / unregisterPlugin).

/** RouterBroker class — composition wrapper di MapperBroker (D-83 — Plan 03-12 Task 2). */
export { RouterBroker } from './router-broker-wrapper'
export type { RouterBrokerConfig } from './router-broker-wrapper'
/** Factory pubblica con Valibot validation della RouterBrokerConfig (Plan 03-12 Task 3). */
export { createRouterBroker } from './public-factory'
/** RouteResolver — dispatch table pre-compilata (Plan 03-05). Ri-esportata per dev tools / test. */
export { RouteResolver } from './route-resolver'
export type {
  AmbiguousRouteEvent,
  CompiledRoute,
  RouteRegistration,
} from './route-resolver'
