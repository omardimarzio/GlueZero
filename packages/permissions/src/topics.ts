/**
 * F11 topics locale literal readonly (D-V2-F11-04).
 *
 * **NON aggiunti a F8 MF_GOVERNANCE_TOPICS/MF_ERROR_TOPICS arrays** (D-V2-F11-22
 * strict block diff packages/microfrontends/src/topics.ts).
 *
 * **Pitfall 7 ACK** — i topics governance gia presenti in F8 MF_GOVERNANCE_TOPICS
 * sono RIUSATI via import diretto da @gluezero/microfrontends (NO duplica literal
 * qui):
 *
 * - Governance topic permission denied (F8 index [2]) — riusato in permission-error.
 * - Governance topic capability missing (F8 index [0]) — riusato in W2-P04 capability registry.
 *
 * F11 NEW topics qui (literal NON in F8):
 *
 * - permission denied locale — non-MF-prefixed application-wide.
 * - permissions updated runtime — invalidation cache LRU event-driven.
 * - capability registered / unregistered — capability dynamic registry.
 *
 * @see prd_2.0.0.md §19.6 — topics standard PermissionError
 * @see prd_2.0.0.md §31.3 — topics governance F8 (D-V2-F8-12)
 * @see D-V2-F11-04 (topics literal locale)
 * @see D-V2-F11-22 (strict triple — NO diff F8 topics)
 */

/**
 * 2 F11 permission topics (locale, NON duplicano F8).
 *
 * - `permission.denied`: locale F11 application-wide (non-MF-prefixed). Emesso da
 *   `publishDeniedTopics` PRIMA del throw `PERMISSION_DENIED` in mode `enforce`/`warn`.
 * - `microfrontend.permissions.updated`: invalidation cache LRU runtime — F11
 *   lifecycle hooks (W2-P04) subscribe per `clearByMfId(mfId)` event-driven.
 */
export const MF_PERMISSION_TOPICS = [
  'permission.denied',
  'microfrontend.permissions.updated',
] as const

/**
 * 2 F11 capability topics (locale, NON duplicano F8).
 *
 * - `capability.registered`: capability registry add hook.
 * - `capability.unregistered`: capability registry remove hook.
 */
export const MF_CAPABILITY_TOPICS = [
  'capability.registered',
  'capability.unregistered',
] as const

/** Type union dei 2 F11 permission topics — IDE autocomplete + type narrowing. */
export type PermissionTopic = (typeof MF_PERMISSION_TOPICS)[number]

/** Type union dei 2 F11 capability topics. */
export type CapabilityTopic = (typeof MF_CAPABILITY_TOPICS)[number]
