/**
 * Types interni del subpath `@gluezero/devtools/theme-inspector` (W5a plan 07-09).
 *
 * Pattern role-match con `packages/devtools/src/types/inspector-entry.ts` (F6
 * EventInspector). Vive in NUOVA sub-folder `packages/devtools/src/theme-inspector/`
 * per rispettare D-F7-04 D-83 strict (zero modifiche a `packages/devtools/src/index.ts`
 * o ai file top-level esistenti).
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-04 (subpath additivo)
 * - 07-09-PLAN.md Task 1
 * - UI-DEVTOOLS-01..05
 */

/** Singola entry catturata dal ring buffer 500 di {@link createThemeInspector}. */
export interface UiEventEntry {
  /** Topic broker (es. 'ui.theme.changed', 'ui.density.changed', ...). */
  readonly topic: string
  /** Payload deep-frozen del broker event (snapshot deep-clone via `structuredClone`). */
  readonly payload: unknown
  /** Timestamp epoch ms del publish broker (fallback `Date.now()` se assente). */
  readonly timestamp: number
}

/** Opzioni `createThemeInspector` (D-160 + D-167 pattern F6). */
export interface ThemeInspectorOptions {
  /**
   * Toggle iniziale (default: `NODE_ENV !== 'production'`, D-160).
   * Production → `false` (zero overhead). Browser/dev → `true` (DX dev-friendly).
   */
  readonly initiallyEnabled?: boolean
  /** Cap ring buffer (default 500, D-167 — pattern F6 createEventInspector). */
  readonly bufferSize?: number
}

/** Snapshot stato runtime di {@link createThemeInspector} (immutable). */
export interface ThemeInspectorSnapshot {
  /** Cap configurato. */
  readonly bufferSize: number
  /** Stato lazy-mode corrente. */
  readonly enabled: boolean
  /** Numero di entries attualmente nel buffer. */
  readonly entryCount: number
}
