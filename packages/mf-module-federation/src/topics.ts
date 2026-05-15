/**
 * F15 topics literal `as const` per `@gluezero/mf-module-federation` (D-V2-F15-10).
 *
 * Cardinality W1: 1 NEW locale Module Federation share scope observability.
 *
 * Topic-naming pattern coerente F8 lifecycle + F14 fallback topics:
 * - `microfrontend.mf.share.version-mismatch` — Emit quando `shared: {pkg: {requiredVersion}}`
 *   non matcha host shared scope (D-V2-F15-10 warn + proceed policy — NO throw, payload
 *   `{mfId, sharedKey, required, provided, timestamp}`).
 *
 * @see prd_2.0.0.md §24 — Module Federation Loader
 * @see D-V2-F15-10 — Share scope conflict warn + proceed (NO throw)
 */

/**
 * 1 topic literal locale F15 Module Federation share scope.
 *
 * NON sovrapposto con F8 governance topics o iframe topics.
 */
export const MF_MODULE_FEDERATION_TOPICS = [
  'microfrontend.mf.share.version-mismatch',
] as const

/**
 * Type literal derivato — IDE autocomplete + narrowing per consumer subscribe.
 */
export type MfModuleFederationTopic = (typeof MF_MODULE_FEDERATION_TOPICS)[number]
