/**
 * Cardinality cap helper — pattern D-166 replicato locale (NON import da
 * `packages/devtools/src/`). Vincolo D-83 strict carryover esteso: F7 NON
 * dipende a runtime dai package F1-F6+devtools/src/.
 *
 * Differenza con `packages/devtools/src/cardinality-cap.ts`: quello è una
 * factory stateful (`Map<baseName, Set<labelSig>>`) per metric labels; questo
 * è una pure function utility per token/role count → soglia.
 *
 * Usage:
 * - TokenRegistry.apply: `checkCap(projectedSize, TOKEN_CAP, 'token', allowMore)`
 * - RoleRegistry.register (W3): `checkCap(activeRoles.size, ROLE_CAP, 'role', allowMore)`
 *
 * Refs:
 * - 07-RESEARCH.md "Pattern 7: Cardinality Cap D-166 Re-use"
 * - 07-CONTEXT.md D-F7-11 (cap 200 default + soft-warn 50%)
 * - THEME-11 (token cardinality), D-F7-14 (role cardinality)
 */

/** Token cardinality cap (D-F7-11 + THEME-11). */
export const TOKEN_CAP = 200 as const

/** Role cardinality cap (D-F7-14). */
export const ROLE_CAP = 100 as const

/** Soft-warn ratio — emit warn quando count ≥ cap × 0.5. */
export const SOFT_WARN_RATIO = 0.5 as const

/** Risultato del cap-check: allow + optional warn message. */
export interface CapCheckResult {
  /** `true` se l'inserimento è consentito (sotto cap o `allowMore=true`). */
  readonly allow: boolean
  /**
   * Messaggio human-readable da loggare via `console.warn`. Presente:
   * - In zona soft-warn (count ≥ cap × 0.5 ma sotto cap): allow=true + suggestion
   * - In zona deny (count ≥ cap senza allowMore): allow=false + override hint
   *
   * Assente quando count è ben sotto soft-warn o `allowMore=true`.
   */
  readonly warn?: string
}

/**
 * Verifica se l'inserimento di un nuovo elemento è consentito rispetto al cap.
 *
 * Tre zone:
 * 1. **Under soft-warn** (count < cap × 0.5): `{ allow: true }` (no warn).
 * 2. **Soft-warn** (cap × 0.5 ≤ count < cap): `{ allow: true, warn }` (audit hint).
 * 3. **Deny** (count ≥ cap): `{ allow: false, warn }` se `allowMore=false`,
 *    altrimenti `{ allow: true }` (override esplicito utente).
 *
 * Pure function — nessuno stato interno, nessun side effect. Il caller decide
 * se loggare `warn` (es. `console.warn`) o trasformare `!allow` in throw via
 * `createThemeError({ code: 'theme.token.cap-exceeded' })`.
 *
 * @param current - Conteggio corrente proiettato post-inserimento.
 * @param cap - Limite massimo (`TOKEN_CAP=200` o `ROLE_CAP=100`).
 * @param type - 'token' | 'role' — usato per il prefix del messaggio.
 * @param allowMore - Se `true`, bypassa il deny (override consapevole).
 * @returns `CapCheckResult` con `allow` boolean + `warn` opzionale.
 *
 * @example
 * ```ts
 * const res = checkCap(150, TOKEN_CAP, 'token')
 * if (!res.allow) throw createThemeError({ code: 'theme.token.cap-exceeded', message: res.warn ?? '' })
 * if (res.warn) console.warn(`[gluezero/theme] ${res.warn}`)
 * ```
 *
 * @see 07-RESEARCH.md "Pattern 7"
 * @see THEME-11
 */
export function checkCap(
  current: number,
  cap: number,
  type: 'token' | 'role',
  allowMore: boolean = false,
): CapCheckResult {
  if (current >= cap && !allowMore) {
    return {
      allow: false,
      warn: `${type} cap reached (${cap}); pass { allowMore: true } to override.`,
    }
  }
  if (allowMore) {
    return { allow: true }
  }
  const softThreshold = Math.floor(cap * SOFT_WARN_RATIO)
  if (current >= softThreshold) {
    return {
      allow: true,
      warn: `${type} count ${current}/${cap} — over 50% of cap.`,
    }
  }
  return { allow: true }
}
