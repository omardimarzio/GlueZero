/**
 * `@gluezero/devtools/mf-inspector/topics` — Re-export 29 standard topics F8 (D-V2-F16-07).
 *
 * Convenience aggregator per `module.ts` subscribe loop:
 * - 17 lifecycle topics (`MF_LIFECYCLE_TOPICS`)
 * - 7 error topics (`MF_ERROR_TOPICS`)
 * - 5 governance topics (`MF_GOVERNANCE_TOPICS`)
 * - 29 totali via `ALL_MF_TOPICS` helper concatenato.
 *
 * Cardinality lockata 17+7+5=29 (F8 PRD §31). NON ampliare/ridurre senza re-discuss F8.
 *
 * @see D-V2-F16-07 — Subscribe 29 standard topics + wildcard `*`
 * @see packages/microfrontends/src/topics.ts — F8 standard topics origine
 * @packageDocumentation
 */

import { MF_ERROR_TOPICS, MF_GOVERNANCE_TOPICS, MF_LIFECYCLE_TOPICS } from '@gluezero/microfrontends'

export { MF_LIFECYCLE_TOPICS, MF_ERROR_TOPICS, MF_GOVERNANCE_TOPICS }

/**
 * Array dei 29 standard topics F8 (concatenazione 17+7+5).
 *
 * Usato da `mfInspectorModule.install()` per subscribe loop. NON include
 * il wildcard `*` (gestito separatamente per attribution `metadata.microFrontendId`
 * MF-OBS-01).
 *
 * @example Subscribe loop
 * ```ts
 * for (const topic of ALL_MF_TOPICS) {
 *   broker.subscribe(topic, (event) => aggregator.handleEvent(topic, event))
 * }
 * ```
 *
 * @see D-V2-F16-07
 */
export const ALL_MF_TOPICS: readonly string[] = [
  ...MF_LIFECYCLE_TOPICS,
  ...MF_ERROR_TOPICS,
  ...MF_GOVERNANCE_TOPICS,
]

/**
 * Type union dei 29 standard topics F8.
 *
 * NOTE: derivata da union dei 3 array F8 origine — `ALL_MF_TOPICS` ha tipo
 * `readonly string[]` per `isolatedDeclarations` compat (spread arrays cannot
 * be inferred). Il narrowing literal viene da F8 origine.
 */
export type AllMfTopic =
  | (typeof MF_LIFECYCLE_TOPICS)[number]
  | (typeof MF_ERROR_TOPICS)[number]
  | (typeof MF_GOVERNANCE_TOPICS)[number]
