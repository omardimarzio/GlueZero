/**
 * F15 topics literal `as const` per `@gluezero/mf-iframe` (D-V2-F15-01..04 + REQ MF-SEC-01).
 *
 * Cardinality W1: 4 NEW locali iframe security observability — coverage D-V2-09 closure
 * BLOCKING.
 *
 * Topic-naming pattern coerente F8 lifecycle + F14 fallback topics:
 * - `microfrontend.iframe.bridge.rate-limited` — Emit 1×/window quando 101st msg in 1s
 *   per mfId (D-V2-F15-04 drop + emit policy).
 * - `microfrontend.iframe.origin-mismatch` — Emit quando `event.origin ≠ expectedOrigin`
 *   (REQ MF-IFRAME-04 enforcement).
 * - `microfrontend.iframe.schema-invalid` — Emit quando Valibot `v.strictObject()` reject
 *   message (D-V2-F15-01 — campo extra o tipo sbagliato).
 * - `microfrontend.iframe.replay-detected` — Emit quando LRU dedup hit OR timestamp
 *   window > 30s (D-V2-F15-03 dual-defense).
 *
 * Pattern carryover F14 fallbacks `MF_FALLBACK_TOPICS` + F13 isolation topics.
 *
 * @see prd_2.0.0.md §26 — Iframe Loader + Bridge
 * @see prd_2.0.0.md §44 — Security (Renwa Mar 2026 + CVE-2024-49038)
 * @see D-V2-F15-01..04 — Security gates D-V2-09 closure
 */

/**
 * 4 topics literal locali F15 iframe security.
 *
 * NON sovrapposti con F8 governance topics (verifica via grep
 * `packages/microfrontends/src/topics.ts` — F8 governance NON include `iframe.*`).
 */
export const MF_IFRAME_TOPICS = [
  'microfrontend.iframe.bridge.rate-limited',
  'microfrontend.iframe.origin-mismatch',
  'microfrontend.iframe.schema-invalid',
  'microfrontend.iframe.replay-detected',
] as const

/**
 * Type literal union derivato — IDE autocomplete + narrowing per consumer subscribe.
 */
export type MfIframeTopic = (typeof MF_IFRAME_TOPICS)[number]
