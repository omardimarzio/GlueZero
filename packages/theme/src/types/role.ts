/**
 * Standard role registry — vocabolario semantic-role intercambiabile cross-DS
 * (D-F7-23). Plan W4 implementa role-registry; plan W5 implementa apply via
 * adapter mapping.
 *
 * 14 role canonici lockati v1.1.0 (mapping a 4-component categoria):
 * - action: 4 (primary/secondary/danger/ghost)
 * - feedback: 4 (error/success/warning/info)
 * - surface: 2 (base/elevated)
 * - input: 2 (text/invalid)
 * - navigation: 2 (link/active)
 *
 * I plugin possono estendere con custom role (cap THEME-12 = 50; override via
 * `ThemeConfig.allowMore.roles`).
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

/**
 * Definizione meta del role (esposta da role-registry W4).
 * Documentation-only campi — nessun runtime use cross-package.
 */
export interface RoleDefinition {
  description?: string
}

/** Map role-name → definition. Plugin estendono con custom keys. */
export type RoleSet = Record<string, RoleDefinition>
