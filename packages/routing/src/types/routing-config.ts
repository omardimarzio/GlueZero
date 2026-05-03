// RoutingConfig — configurazione opzionale del routing engine F3 (PRD §17, §27,
// REQ ROUTE-15/ROUTE-16, chiusura PRD §39 #5/#6).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-66: `multipleRoutesPolicy` chiude PRD §39 #6 (ROUTE-15) — `'first-match'`
//         (default), `'priority-ordered'` (usa `priority` numerico), `'all'` (broadcast
//         fan-out a tutte le route applicabili).
// - D-67: `requiresRouteTopics` (BLOCKER 4 fix Plan 03-12) — opt-in esplicito per topic
//         che richiedono route. Bypassa il lookup canonical-registry quando il consumer
//         NON usa la convenzione `<entity>.<action>.<status>` di PRD §11.
// - D-93/D-100: `RoutingConfig` viene declaration-merged in `BrokerConfig.routing?` da
//         plan 03-03; `RouterBroker` (plan 03-12) bind il registry F2 una volta sola.
//
// Vincolo `exactOptionalPropertyTypes: true`: tutti i campi opzionali sono
// `readonly X?: T` (mai `readonly X: T | undefined`).

/**
 * Strategia di selezione quando più route matchano lo stesso topic (D-66, ROUTE-15,
 * chiusura PRD §39 #6).
 *
 * - `'first-match'` (DEFAULT) — prima route registrata vince. In dev mode emette
 *   `routing.ambiguous` come BrokerEvent CORE per audit.
 * - `'priority-ordered'` — usa `RouteDefinition.priority` (più alto = priorità maggiore).
 * - `'all'` — broadcast fan-out: TUTTE le route applicabili eseguono in parallelo.
 *   Utile per side-effect multipli (audit log + cache + server).
 */
export type MultipleRoutesPolicy = 'first-match' | 'priority-ordered' | 'all'

/**
 * Configurazione opzionale del routing engine (D-66, D-67).
 *
 * Si dichiara nel `BrokerConfig.routing` (declaration merging in plan 03-03). Tutti i
 * campi sono opzionali — il routing engine applica i default D-66/D-67.
 *
 * - `multipleRoutesPolicy` — default `'first-match'`.
 * - `emitAmbiguousWarning` — default `true` in dev mode, `false` in prod. Quando
 *   `true` + più route matchano lo stesso topic, emette `routing.ambiguous` con
 *   payload `{ topic, candidateRouteIds, selectedRouteId }`.
 * - `requiresRouteTopics` — opt-in esplicito (BLOCKER 4 fix Plan 03-12, D-100): lista
 *   di topic che DEVONO avere una route registrata; senza route → `BrokerError`
 *   `route.required.missing`. Bypassa la convenzione PRD §11 quando il consumer NON
 *   usa il pattern `<entity>.<action>.<status>` per derivare schemaId dal topic.
 *
 * @example
 * ```ts
 * const config: RoutingConfig = {
 *   multipleRoutesPolicy: 'priority-ordered',
 *   requiresRouteTopics: ['payment.charge.requested', 'order.submit.requested'],
 * }
 * ```
 */
export interface RoutingConfig {
  readonly multipleRoutesPolicy?: MultipleRoutesPolicy
  readonly emitAmbiguousWarning?: boolean
  readonly requiresRouteTopics?: readonly string[]
}
