/**
 * `CompatibilityIssueType` — enum union 9 valori (PRD §20.5).
 *
 * Una `CompatibilityIssue` per dimensione (D-12-19) — sub-key disambiguation
 * via campo `context?` additivo (es. `context: { subKey: 'customer' }` per
 * dimensione `canonicalModels` con multiple chiavi).
 *
 * Default conservativo: 9 issue max per report (uno per dimensione dichiarata
 * con mismatch).
 *
 * @see prd_2.0.0.md §20.5 — Report shape + 9-valori enum
 */
export type CompatibilityIssueType =
  | 'gluezero-version'
  | 'canonical-model-version'
  | 'topic-version'
  | 'route-version'
  | 'worker-version'
  | 'theme-version'
  | 'loader-version'
  | 'framework-version'
  | 'dependency-version'

/**
 * Issue singola in `CompatibilityReport.errors` o `.warnings`.
 *
 * - `type` — quale dimensione ha mismatch.
 * - `required?` — range dichiarato dall'MF (es. `'^2.0.0'`); `undefined` se issue
 *   semantico senza range associato (es. "framework non installato").
 * - `actual?` — version corrente runtime (es. `'2.0.0'`); `undefined` se "missing
 *   version" warning (D-12-09: dichiarata ma non registrata → warning).
 * - `message` — testo descrittivo italiano per devtools/log; può includere sub-key
 *   testuale (es. `"canonicalModels.customer: ^1.0.0 NOT satisfied by 2.0.0"`).
 * - `context?` — additivo (D-12-19) per disambiguazione sub-key
 *   (es. dimensione `canonicalModels` con multiple chiavi: `context.subKey: 'customer'`).
 *
 * @see prd_2.0.0.md §20.5 — CompatibilityIssue shape
 */
export interface CompatibilityIssue {
  readonly type: CompatibilityIssueType
  readonly required?: string
  readonly actual?: string
  readonly message: string
  readonly context?: Readonly<Record<string, unknown>>
}

/**
 * Report di compatibilità completo (PRD §20.5).
 *
 * - `ok: boolean` — `true` sse `errors.length === 0` (warnings non bloccano).
 * - `microFrontendId: string` — id dell'MF a cui il report si riferisce.
 * - `checkedAt: number` — `Date.now()` epoch ms (D-12-18, carryover
 *   `MicroFrontendTimings` shape MF-DEVTOOLS-03).
 * - `errors` — issue bloccanti (semver `satisfies()` returns `false`).
 * - `warnings` — issue non bloccanti (es. version non registrata per D-12-09).
 *
 * Stessa shape ritornata da `getCompatibilityReport(id)` e payload topic
 * `microfrontend.compatibility.failed` / `.warning` (D-12-16: consistency 1:1
 * topic ↔ API).
 *
 * @see prd_2.0.0.md §20.5 — CompatibilityReport shape
 * @see prd_2.0.0.md §20.4 — `getCompatibilityReport(id?)` API
 */
export interface CompatibilityReport {
  readonly ok: boolean
  readonly microFrontendId: string
  readonly checkedAt: number
  readonly errors: readonly CompatibilityIssue[]
  readonly warnings: readonly CompatibilityIssue[]
}
