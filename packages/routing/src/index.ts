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
 * Vincolo architetturale (D-83): il package NON modifica `bus.ts` di F1 né
 * `broker-mapper-wrapper.ts` di F2. Estende:
 * - composition wrapper (`router-broker-wrapper.ts`, plan 03-12)
 * - TS declaration merging (`./augment`, plan 03-03) di `PluginDescriptor` e
 *   `BrokerConfig` (D-93/D-94/D-95)
 *
 * Side-effect import: `import './augment'` PRIMA degli export per attivare il
 * declaration merging. `package.json` ha `sideEffects: ["./dist/augment.js"]` per
 * evitare tree-shaking accidentale del file (Pattern S1).
 *
 * Per la documentazione utente completa (scenario meteo HTTP PRD §29, retry policy
 * 4xx/5xx, idempotency token, URL allowlist, multipleRoutes policy, LIFE-02 cascade),
 * vedi `packages/routing/README.md`.
 *
 * @packageDocumentation
 */

// Plan 03-02 riempirà i type exports (RouteDefinition, RoutePolicies, RouteOutcome,
//             RoutingConfig).
// Plan 03-03 aggiungerà il side-effect import './augment' per il declaration merging
//             di PluginDescriptor.routes? e BrokerConfig.routing?.
// Plan 03-12 aggiungerà il runtime export RouterBroker + createRouterBroker (factory
//             pubblico + Valibot validation).

export {}
