/**
 * Design tokens canonici v1.1.0 (D-F7-19/D-F7-20/D-F7-22).
 *
 * Vocabolario lean target ~35 token = 13 color semantic + 6 spacing + 5 radius
 * + 4 elevation + 3 font + 3 motion + 2 z-index. Cap THEME-11 = 200; margine
 * ~165 per estensioni custom downstream.
 *
 * Mappabile a qualunque DS sottostante (Tailwind/Bootstrap/Material/shadcn) via
 * theme adapter — gli adapter possono fare mapping interno verso scale 50-900.
 */
export interface DesignTokens {
  // Color semantic 13 (D-F7-20)
  'color-primary'?: string
  'color-on-primary'?: string
  'color-secondary'?: string
  'color-on-secondary'?: string
  'color-surface'?: string
  'color-surface-elevated'?: string
  'color-text'?: string
  'color-text-muted'?: string
  'color-border'?: string
  'color-error'?: string
  'color-success'?: string
  'color-warning'?: string
  'color-info'?: string
  // Spacing 6
  'spacing-xs'?: string
  'spacing-sm'?: string
  'spacing-md'?: string
  'spacing-lg'?: string
  'spacing-xl'?: string
  'spacing-2xl'?: string
  // Radius 5
  'radius-none'?: string
  'radius-sm'?: string
  'radius-md'?: string
  'radius-lg'?: string
  'radius-full'?: string
  // Elevation 4
  'elevation-0'?: string
  'elevation-1'?: string
  'elevation-2'?: string
  'elevation-3'?: string
  // Font 3
  'font-size-base'?: string
  'font-size-lg'?: string
  'font-size-xl'?: string
  // Motion 3
  'motion-short'?: string
  'motion-medium'?: string
  'motion-long'?: string
  // Z-index 2
  'z-overlay'?: string
  'z-modal'?: string
  // Estensione custom downstream consentita (cap 200 — THEME-11)
  [key: string]: string | undefined
}

/**
 * 10 branded core token (D-F7-21) per IDE autocomplete + compile-time check
 * su typo per i token più usati (95% dei plugin).
 */
export type CoreTokenName =
  | 'color-primary'
  | 'color-on-primary'
  | 'color-surface'
  | 'color-text'
  | 'color-text-muted'
  | 'color-error'
  | 'color-success'
  | 'spacing-md'
  | 'radius-md'
  | 'motion-medium'
