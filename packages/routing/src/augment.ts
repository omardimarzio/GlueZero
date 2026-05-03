// augment.ts — TS declaration merging per estendere @sembridge/core e @sembridge/mapper con i tipi F3.
// (D-83, D-93, D-94, D-95 in 03-CONTEXT.md)
//
// Vincolo D-83: NESSUNA modifica a packages/core/src/ né packages/mapper/src/ runtime.
// Questo file è il PUNTO UNICO di chiusura dei `unknown` placeholder F1 per le sezioni
// routing F3 (PluginDescriptor.routes, BrokerConfig.routes, BrokerConfig.routing).
//
// Cosa estende:
//   - PluginDescriptor (interface, da @sembridge/core) — aggiunge `routes?: RouteDefinition[]`
//     come campo opzionale readonly (D-94, ROUTE-01). Chiude il commento placeholder F1
//     in `packages/core/src/types/plugin.ts:49` ("F3 will add: routes").
//   - BrokerConfig (interface, da @sembridge/core) — sostituisce il commento placeholder
//     F1 con tipi specifici per le sezioni `routes` (array di RouteDefinition pre-registrate
//     al boot — D-93 / D-62) e `routing` (RoutingConfig — multipleRoutesPolicy / D-66).
//     NB: `BrokerConfig.gateway` (D-93) NON viene augmentato qui per evitare un ciclo
//     workspace `@sembridge/routing` → `@sembridge/gateway` (gateway già dipende da
//     routing): l'augmentation di `BrokerConfig.gateway?: GatewayConfig` è demandata a
//     `packages/gateway/src/augment.ts` (plan 03-04 — pattern simmetrico).
//   - CanonicalSchema (interface, da @sembridge/mapper) — aggiunge `requiresRoute?: boolean`
//     per chiusura PRD §39 #5 / ROUTE-16 (D-95, D-67). Se `true`, topic con questo schema
//     senza route registrata → BrokerError 'route.required.missing' (plan 03-12 RouterBroker).
//
// Cosa NON estende qui:
//   - PipelineStep (type alias literal): TS NON supporta declaration merging di type alias.
//     Strategia: il barrel `@sembridge/routing` ri-esporta `F3PipelineStep` come literal
//     union additive con i 3 nuovi step pipeline §28 di F3 (D-85). Il consumer che usa i
//     tap F3 dichiara `step: PipelineStep | F2PipelineStep | F3PipelineStep`. Pattern
//     identico a `F2PipelineStep` di mapper/src/index.ts:176-181.
//
// Side-effect import: `packages/routing/src/index.ts` importa questo file PRIMA degli export
// (`export { __augmentLoaded, type F3PipelineStep } from './augment'`). Il `package.json` ha
// `sideEffects: ["./dist/augment.js", ...]` (array) per evitare tree-shaking accidentale del
// side-effect file da bundler aggressivi (Pattern S1 — T-02-09-01 mitigation pattern F2).
// La `tsup.config.ts` deve avere `entry` con `src/augment.ts` come entry separata per
// emettere `dist/augment.js` (path referenziato nel `sideEffects`).
//
// Audit-able: `__augmentLoaded` const fornisce una runtime check che il modulo è stato
// caricato (utile per test e debugging consumer-side).
//
// Threat coverage:
// - T-03-03-01 (Tampering — tree-shaker elimina dist/augment.js): mitigate via
//   `sideEffects: ["./dist/augment.js"]` array nel package.json + `__augmentLoaded`
//   export const ri-esportato dal barrel `src/index.ts`.
// - T-03-03-02 (Spoofing — declaration merging accidentale collisioni con F2): mitigate.
//   Il routing augment modifica SOLO `PluginDescriptor.routes`, `BrokerConfig.routes`,
//   `BrokerConfig.routing`, `CanonicalSchema.requiresRoute` — campi NON usati né
//   augmentati da F2. F2 augmentava `inputMap`/`outputMap`/`canonicalSchemaId` su
//   PluginDescriptor e `canonicalModel`/`aliasRegistry`/`transforms` su BrokerConfig.
//   Test backward-compat verifica che i campi F2 + F3 coesistano.
// - T-03-03-03 (Tampering — augment estende interface non-additive): mitigate. TS
//   interface merging è additive per costruzione. F1 PluginDescriptor con i suoi field
//   (id/version/displayName/onRegister/onMount/onUnmount/onDestroy) + F2 augment
//   (inputMap/outputMap/canonicalSchemaId) rimangono intatti; F3 aggiunge SOLO il field
//   opzionale `routes`. Test backward-compat verifica.
// - T-03-03-04 (Repudiation — augment scope ambiguous): mitigate via JSDoc esplicita
//   "F3 augmentation" + reference D-93/D-94/D-95 + reference ai placeholder F1
//   (commento `F3 will add: routes` in core/types/plugin.ts:49).

import type { RouteDefinition } from './types/route-definition'
import type { RoutingConfig } from './types/routing-config'

declare module '@sembridge/core' {
  /**
   * F3 augmentation (D-94, ROUTE-01): aggiunge il campo opzionale `routes` al
   * PluginDescriptor pubblico di `@sembridge/core`.
   *
   * Chiude il placeholder F1 in `packages/core/src/types/plugin.ts:49` (commento
   * "F3 will add: routes").
   *
   * Le route dichiarate nel descriptor vengono auto-registrate al `registerPlugin`
   * con `ownerId = pluginId` (cascade D-26 ext F3, plan 03-12 / 03-13). Il field è
   * opzionale e readonly per backward-compat con F1+F2 (T-03-03-03 mitigation):
   * descriptor minimali `{ id: 'x' }` continuano a essere validi dopo l'augmentation.
   */
  interface PluginDescriptor {
    /** Route auto-registrate al `registerPlugin` con `ownerId = pluginId` (D-94, ROUTE-01). */
    readonly routes?: readonly RouteDefinition[]
  }

  /**
   * F3 augmentation (D-93): aggiunge le sezioni `routes` e `routing` a `BrokerConfig`.
   *
   * - `routes`: array di RouteDefinition pre-registrate al boot via `createRouterBroker`
   *   (D-62 / D-93). Pattern identico a `BrokerConfig.canonicalModel.schemas` di F2.
   * - `routing`: configurazione del routing engine (multipleRoutesPolicy /
   *   emitAmbiguousWarning / requiresRouteTopics — D-66 / D-67 / D-100).
   *
   * NB: `BrokerConfig.gateway` (D-62 / D-93 parte 2) NON è augmentato qui per evitare
   * un ciclo workspace `@sembridge/routing` → `@sembridge/gateway`. L'augmentation di
   * `BrokerConfig.gateway?: GatewayConfig` è in `packages/gateway/src/augment.ts`
   * (plan 03-04 — declaration merging additive separato).
   */
  interface BrokerConfig {
    /** Sezione `routes` (D-93, D-62, PRD §27): array di RouteDefinition pre-registrate al boot. */
    routes?: readonly RouteDefinition[]
    /** Sezione `routing` (D-66, D-67, ROUTE-15/ROUTE-16): config del routing engine. */
    routing?: RoutingConfig
  }
}

declare module '@sembridge/mapper' {
  /**
   * F3 augmentation (D-95, ROUTE-16, chiusura PRD §39 #5).
   *
   * Aggiunge `requiresRoute?: boolean` al CanonicalSchema di F2. Default `false` /
   * `undefined`: topic con questo schema senza route registrata → consegna locale ai
   * subscriber (`'local'` implicit, no error — D-67 / ROUTE-16). Opt-in `requiresRoute:
   * true`: topic senza route → throw `BrokerError 'route.required.missing'` (plan
   * 03-12 RouterBroker via canonical-registry lookup).
   *
   * Pattern declaration merging additive: campi F2 originali (id, fields, requires,
   * description, transforms) restano intatti. Test backward-compat verifica che schemi
   * F2 esistenti continuino a essere validi dopo l'augmentation.
   */
  interface CanonicalSchema {
    /** Se `true`, topic con questo schema senza route registrata → BrokerError 'route.required.missing' (D-95, ROUTE-16). */
    readonly requiresRoute?: boolean
  }
}

/**
 * Step pipeline §28 introdotti da F3 (D-84, D-85).
 *
 * **Limitazione TS**: `PipelineStep` di `@sembridge/core` è un type alias literal union,
 * NON un'interface — TS non supporta declaration merging di type alias. Soluzione: il
 * consumer che dichiara tap F3 importa questo super-set:
 *
 * ```ts
 * import type { PipelineStep } from '@sembridge/core'
 * import type { F2PipelineStep } from '@sembridge/mapper'
 * import type { F3PipelineStep } from '@sembridge/routing'
 *
 * type AllSteps = PipelineStep | F2PipelineStep | F3PipelineStep
 * const tap: EventTap = {
 *   onPipelineStep(step: AllSteps, snapshot) { ... }
 * }
 * ```
 *
 * I 3 step F3 sono inseriti dopo step 7 (`event.dedupe.checked` di F1+F3-full) e prima
 * di step 11 (`event.mapped.consumer` di F2):
 * - `event.route.resolved` (step 8) — risolve `RouteDefinition` per topic via dispatch
 *   table; applica `multipleRoutesPolicy` `first-match`/`priority-ordered`/`all`.
 * - `event.route.executed` (step 9) — esegue route by type (`local` → bus.deliver,
 *   `http` → fetch via gateway con retry/timeout/dedupe, `cache`/`composite` → adapter).
 * - `event.outcome.collected` (step 10) — raccoglie `RouteOutcome` → trasforma in
 *   `<topic>.loaded` o `<topic>.failed` BrokerEvent (D-80).
 *
 * F1 step da `@sembridge/core` (subset 5 step) e F2 step da `@sembridge/mapper`
 * (subset 5 step) restano validi senza modifiche. F6 potrà refactor `PipelineStep` da
 * type alias a interface union per veri declaration merging (T-02-09-05 disposition F2).
 */
export type F3PipelineStep =
  | 'event.route.resolved'
  | 'event.route.executed'
  | 'event.outcome.collected'

/**
 * Marker const esportato per detection runtime del side-effect import.
 *
 * Esistenza:
 * 1. Forza il file a essere considerato un "module" (vs ambient declarations) — già
 *    soddisfatto dagli `import type` sopra ma double-safety.
 * 2. Permette ai test (`augment.test.ts`) di verificare che `import './augment'` non
 *    venga tree-shaken dal bundler (T-03-03-01 mitigation diretta).
 * 3. Audit-able: `grep "__augmentLoaded" dist/` permette di confermare il side-effect è
 *    presente nel bundle distribuito.
 *
 * Pattern S1 (mapper/src/augment.ts:109): export const literal `true` ri-esportato dal
 * barrel `src/index.ts` per evitare tree-shaking accidentale.
 */
export const __augmentLoaded: true = true
