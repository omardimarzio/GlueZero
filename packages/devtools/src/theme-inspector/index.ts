/**
 * `@gluezero/devtools/theme-inspector` — subpath additivo (D-F7-04).
 *
 * Esposto via `packages/devtools/package.json#exports['./theme-inspector']`.
 * Pattern F6 (Inspector ring buffer + lazy mode + structuredClone) applicato al
 * namespace `ui.*` (F7 plan 07-09 W5a).
 *
 * **D-F7-04 D-83 strict:** zero modifiche a `packages/devtools/src/index.ts` o
 * ai file top-level esistenti di `devtools/src/`. Il subpath è additivo —
 * source vive in NUOVA sub-folder `packages/devtools/src/theme-inspector/` con
 * 4 moduli (theme-inspector, role-coverage-report, live-token-editor, snapshot-tokens).
 *
 * **Peer dependency optional:** `@gluezero/theme` è `peerDependenciesMeta.optional: true`.
 * Consumer che NON usa il subpath theme-inspector NON ha install warning.
 *
 * @example Quick start
 * ```ts
 * import { createTheme } from '@gluezero/theme/factory'
 * import {
 *   createThemeInspector,
 *   createRoleCoverageReport,
 *   createLiveTokenEditor,
 *   snapshotTokens,
 *   diffSnapshots,
 * } from '@gluezero/devtools/theme-inspector'
 *
 * const theme = createTheme({ broker })
 * const inspector = createThemeInspector(broker, { initiallyEnabled: true })
 * theme.manager.setMode('dark')
 * console.log(inspector.getBuffer())
 * // [{ topic: 'ui.theme.changed', payload: { ... }, timestamp: 1234567890 }]
 * ```
 *
 * @packageDocumentation
 */

// UI-DEVTOOLS-01 — Subscriber passivo `ui.*` + ring buffer 500 (D-167) + hot-path early-return (D-160).
export {
  createThemeInspector,
  type ThemeInspector,
} from './theme-inspector'

// UI-DEVTOOLS-02 — Coverage report DOM scan + diff vs adapter.roleMap.
export {
  createRoleCoverageReport,
  type CoverageEntry,
  type CoverageScanResult,
  type CreateRoleCoverageReportOptions,
  type RoleCoverageReport,
} from './role-coverage-report'

// UI-DEVTOOLS-03 — Form HTML applyTokens (NODE_ENV gate D-160; production no-op).
export {
  createLiveTokenEditor,
  type CreateLiveTokenEditorOptions,
  type LiveTokenEditor,
} from './live-token-editor'

// UI-DEVTOOLS-04 + UI-DEVTOOLS-05 — Snapshot tokens + diff (re-export da @gluezero/theme).
export {
  diffSnapshots,
  snapshotTokens,
} from './snapshot-tokens'

// Types pubblici del subpath (re-export from `./types/inspector`).
export type {
  ThemeInspectorOptions,
  ThemeInspectorSnapshot,
  UiEventEntry,
} from './types/inspector'
