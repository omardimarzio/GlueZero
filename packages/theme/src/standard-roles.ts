/**
 * STANDARD_ROLES — vocabolario canonico v1.1.0 lockato (D-F7-15).
 *
 * 14 ruoli totali = 4 action + 4 feedback + 2 surface + 2 input + 2 navigation.
 *
 * Convention naming: dot-notation `category.subname` (D-F7-16). I role names
 * sono enforcati a runtime da `RoleSetSchema` Valibot regex
 * `^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$` (vedi `internal/valibot-schemas.ts`).
 *
 * Pseudo-state (disabled, hover, focus) si gestiscono via CSS pseudo-classes
 * standard sul selettore `[data-gz-role="..."]` — NON sono ruoli espliciti
 * (D-F7-18). Esempio: `[data-gz-role="action.primary"]:disabled { ... }`.
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-15 (lista lockata) + D-F7-16 (dot-notation) + D-F7-18
 *   (no pseudo-state ruoli)
 * - UI-ROLE-07
 *
 * @example
 * <button data-gz-role="action.primary">Salva</button>
 * <input data-gz-role="input.text" />
 * <div data-gz-role="feedback.error">Errore validazione</div>
 */
/**
 * Tuple letterale dei 14 ruoli canonici. Annotata esplicitamente per soddisfare
 * `--isolatedDeclarations` (non possiamo inferire la tuple `as const` dietro
 * `Object.freeze` senza annotation).
 */
export type StandardRole =
  | 'action.primary'
  | 'action.secondary'
  | 'action.danger'
  | 'action.ghost'
  | 'feedback.error'
  | 'feedback.success'
  | 'feedback.warning'
  | 'feedback.info'
  | 'surface.base'
  | 'surface.elevated'
  | 'input.text'
  | 'input.invalid'
  | 'navigation.link'
  | 'navigation.active'

export const STANDARD_ROLES: ReadonlyArray<StandardRole> = Object.freeze([
  'action.primary',
  'action.secondary',
  'action.danger',
  'action.ghost',
  'feedback.error',
  'feedback.success',
  'feedback.warning',
  'feedback.info',
  'surface.base',
  'surface.elevated',
  'input.text',
  'input.invalid',
  'navigation.link',
  'navigation.active',
] as const)

// `STANDARD_ROLE_DEFINITIONS` (descrizioni IT human-readable) è esposto via
// subpath separato `@gluezero/theme/standard-role-definitions` per NON
// gravare sul bundle runtime principale (~250 B di stringhe inutili a
// runtime, utili solo a Inspector W5a / docs UI).
//
// Consumer:
//   import { STANDARD_ROLE_DEFINITIONS } from '@gluezero/theme/standard-role-definitions'
//
// Refs: 07-CONTEXT.md D-F7-04 (subpath additivo); 07-06-PLAN.md mitigation.
