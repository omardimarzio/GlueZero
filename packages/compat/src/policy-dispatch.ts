/**
 * F12 Policy Dispatch — matrix 5-policy × 3-phase (PRD §20.6, MF-COMPAT-04).
 *
 * Cover REQ-IDs: MF-COMPAT-04 (5 policy dispatch + 2 topic emit PRIMA del throw).
 *
 * Pattern carryover F11 `capability-checker.enforceCapabilityPolicy` (4 valori)
 * + estensione `'block-registration'` NUOVO per F12 (D-12-03).
 *
 * **OQ-3 RESOLUTION (planner W2 ratify):**
 *
 * `block-load` è FUNZIONALE in F12 (NON solo alias di `block-mount` come in F11
 * dove F9 NON espone seam pre-fetch). F12 lifecycle FSM F8 distingue trigger
 * load vs mount: `service.load(id)` è patchabile (monkey-patch in plan 12-03),
 * quindi `phase=load` con `policy='block-load'` triggera throw VERO.
 *
 * Su `phase=mount`, `policy='block-load'` continua a triggherare il throw (alias
 * mount behavior carryover F11 — il check fail-fast in mount include block-load).
 *
 * Documentazione cross-ref:
 * - JSDoc qui (questo file).
 * - W2 SUMMARY sezione "OQ Resolution Outcomes".
 * - README W3 sezione "Policy semantics" (plan 12-05).
 *
 * **Topic emit ORDER (D-12-05 + carryover F11 `publishDeniedTopics`):**
 * 1. Warnings populated o policy=`'warn'` → emit `microfrontend.compatibility.warning`.
 * 2. Errors populated (any policy ≠ 'off') → emit `microfrontend.compatibility.failed`.
 * 3. Block triggered → throw `CompatError` (emit PRIMA del throw per devtools/telemetry).
 *
 * **Policy semantics:**
 *
 * | Policy | report.ok=true | report.warnings | report.errors |
 * |--------|----------------|-----------------|---------------|
 * | `'off'` | no-op | no-op | no-op |
 * | `'warn'` | emit warning se warnings | emit warning | emit warning + failed + console.warn (NO throw) |
 * | `'block-registration'` | no-op | emit warning | emit failed + throw se phase==='registration' |
 * | `'block-load'` | no-op | emit warning | emit failed + throw se phase==='load' OR 'mount' |
 * | `'block-mount'` | no-op | emit warning | emit failed + throw se phase==='mount' |
 *
 * @see prd_2.0.0.md §20.6 — 5 policy values
 * @see D-12-02 — default `'warn'`
 * @see D-12-03 — `block-registration` NEW F12
 * @see D-12-04 — phase trigger matrix
 * @see D-12-05 — emit topic on block PRIMA del throw
 * @see plan 12-02 OQ-3 ratify (block-load funzionale F12)
 * @see packages/permissions/src/capability-checker.ts (TEMPLATE F11 — 4-policy carryover)
 */
import type { Broker } from '@gluezero/core'
import {
  createCompatError,
  publishCompatTopics,
  type CompatibilityPhase,
} from './compat-error'
import type { CompatibilityPolicy } from './types/policy'
import type { CompatibilityReport } from './types/report'

/**
 * Mapping phase → policy che bloccano in quella phase.
 *
 * - `registration`: `'block-registration'` only.
 * - `load`: `'block-load'` (OQ-3 funzionale F12 — `service.load` patchabile in plan 12-03).
 * - `mount`: `'block-mount'` + `'block-load'` (alias mount carryover F11 — fail-fast incluso).
 *
 * @internal
 */
const BLOCKING_MATRIX: Readonly<
  Record<CompatibilityPhase, ReadonlyArray<CompatibilityPolicy>>
> = {
  registration: ['block-registration'],
  load: ['block-load'],
  mount: ['block-mount', 'block-load'],
}

/**
 * Enforcement policy dispatch — invocato dai lifecycle hooks (plan 12-03) dopo aver
 * computato `CompatibilityReport` via `engine.check(mfId)`.
 *
 * Logica:
 * 1. `policy === 'off'` → return immediato (no compute side-effect, no emit, no throw).
 * 2. Se `report.warnings.length > 0` o (`policy === 'warn'` + `!report.ok`) → emit `warning`.
 * 3. Se `report.ok === true` → return (nessun error → nessun block).
 * 4. emit `failed` (telemetry — anche per policy='warn').
 * 5. `policy === 'warn'` → `console.warn` + return (NO throw).
 * 6. Se `BLOCKING_MATRIX[phase].includes(policy)` → throw `createCompatError(COMPAT_INCOMPATIBLE)`.
 *
 * @param broker Broker reference per publish topics.
 * @param mfId ID del MF check-target.
 * @param report `CompatibilityReport` shape PRD §20.5 dal `check-engine`.
 * @param policy Effective policy (per-MF override già risolto in caller — D-12-11).
 * @param phase Phase lifecycle (`'registration' | 'load' | 'mount'`).
 *
 * @throws `BrokerError({code: 'COMPAT_INCOMPATIBLE'})` se policy block-* matches phase.
 *
 * @example Policy block-mount throws CompatError
 * ```ts
 * const report = engine.check('mf-x')
 * enforceCompatPolicy(broker, 'mf-x', report, 'block-mount', 'mount')
 * // → emit 'microfrontend.compatibility.failed' + throw COMPAT_INCOMPATIBLE
 * ```
 *
 * @example Policy warn — emit + console.warn, NO throw
 * ```ts
 * enforceCompatPolicy(broker, 'mf-x', report, 'warn', 'mount')
 * // → emit failed + console.warn, mount procede
 * ```
 *
 * @example block-load su phase=load FUNZIONALE F12 (OQ-3 ratify)
 * ```ts
 * enforceCompatPolicy(broker, 'mf-x', report, 'block-load', 'load')
 * // → emit failed + throw (phase=load triggera con block-load)
 * ```
 *
 * @example block-load su phase=mount alias F11 carryover
 * ```ts
 * enforceCompatPolicy(broker, 'mf-x', report, 'block-load', 'mount')
 * // → emit failed + throw (block-load aliases mount behavior)
 * ```
 *
 * @see prd_2.0.0.md §20.6 — 5 policy values
 * @see D-12-02..D-12-05 — semantics + emit order
 * @see plan 12-02 OQ-3 ratify (block-load funzionale F12)
 */
export function enforceCompatPolicy(
  broker: Broker,
  mfId: string,
  report: CompatibilityReport,
  policy: CompatibilityPolicy,
  phase: CompatibilityPhase,
): void {
  if (policy === 'off') return

  // Emit warning topic per warnings populated O policy='warn' su errors (D-12-05).
  if (report.warnings.length > 0 || (policy === 'warn' && !report.ok)) {
    publishCompatTopics(broker, report, 'warning')
  }

  if (report.ok) return // nessun error → nessun block possibile

  // Topic 'failed' emesso per OGNI scenario error (telemetry, anche se policy='warn').
  publishCompatTopics(broker, report, 'failed')

  if (policy === 'warn') {
    // warn: emit + console.warn, NO throw (lifecycle FSM procede normalmente).
    console.warn(
      `[compat] MF "${mfId}" incompatible at ${phase}: ${report.errors.map((e) => e.type).join(', ')}`,
    )
    return
  }

  // Phase ↔ policy dispatch matrix:
  // - 'block-registration' triggera solo su phase='registration'.
  // - 'block-load' triggera su phase='load' (OQ-3 funzionale F12) OR phase='mount' (alias F11).
  // - 'block-mount' triggera solo su phase='mount'.
  if (BLOCKING_MATRIX[phase].includes(policy)) {
    throw createCompatError({
      code: 'COMPAT_INCOMPATIBLE',
      message:
        `MicroFrontend "${mfId}" incompatible at ${phase}: ` +
        report.errors.map((e) => e.type).join(', '),
      phase,
      microFrontendId: mfId,
      report,
    })
  }
}
