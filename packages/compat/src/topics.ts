/**
 * F12 topics locale literal readonly `as const` (carryover D-V2-F11-04 pattern).
 *
 * **2 topic NUOVI F12** (literal locale, NON aggiunti a F8 `MF_GOVERNANCE_TOPICS` —
 * D-83 strict triple esteso v2.0):
 *
 * - `'microfrontend.compatibility.warning'`:
 *   emesso da `enforceCompatPolicy` quando `policy === 'warn'` OR `report.warnings.length > 0`
 *   (D-12-05). Payload = `CompatibilityReport` completo.
 *
 * - `'microfrontend.compatibility.version.changed'`:
 *   emesso da `register*Version()` su overwrite di un value esistente (D-12-08).
 *   Payload = `{dimension, key, oldVersion, newVersion, timestamp}`. Informational,
 *   abilita devtools F16 timeline view.
 *
 *   **Rule 1 fix (W2)**: nome topic rinominato `version-changed` → `version.changed`
 *   per conformare al broker validator regex `^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$`
 *   che vieta `-` (dash) nei segmenti. Pattern carryover F8 `microfrontend.load.failed`
 *   (4-segment dot-only). Rationale ampia in 12-02-SUMMARY.md sezione "Deviations".
 *
 * **1 topic RIUSATO da F8** (NO duplicate literal, import diretto in `compat-error.ts`):
 *
 * - `'microfrontend.compatibility.failed'`: index `[1]` in F8 `MF_GOVERNANCE_TOPICS`
 *   array (`packages/microfrontends/src/topics.ts:67-73`). Riusato da
 *   `compat-error.ts publishCompatTopics(level='failed')`.
 *
 * **Pitfall 7 ACK + D-83 strict block** (carryover F11 D-V2-F11-22):
 * NON aggiungere literal `'microfrontend.compatibility.failed'` qui — duplicate
 * literal genera audit-grep FAIL. Sempre import da `@gluezero/microfrontends`.
 *
 * @see packages/microfrontends/src/topics.ts:67-73 — F8 `MF_GOVERNANCE_TOPICS` array
 * @see D-83 strict triple esteso v2.0 — NO append a F8 array
 * @see prd_2.0.0.md §20 — Compatibility topics
 * @see plan 12-02 task 1 — topics.ts shape
 */

/**
 * F12 compatibility topics NUOVI literal locale (NON in F8 `MF_GOVERNANCE_TOPICS`).
 *
 * - `'microfrontend.compatibility.warning'`: warnings populated or policy `'warn'`.
 * - `'microfrontend.compatibility.version-changed'`: register*Version() overwrite.
 */
export const MF_COMPAT_TOPICS = [
  'microfrontend.compatibility.warning',
  'microfrontend.compatibility.version.changed',
] as const

/**
 * Type union dei 2 topic locale F12 — IDE autocomplete + type narrowing + tree-shake.
 */
export type CompatTopic = (typeof MF_COMPAT_TOPICS)[number]
