/**
 * Deep-frozen snapshot dello stato corrente del theme manager (D-F7-08).
 *
 * Pubblicato come `payload` di `ui.theme.changed` / `ui.density.changed` / ecc.
 * (UI-EVENT-06). Tutti i campi readonly + `Object.freeze` deep su `tokens` map
 * — nessun mutation runtime per garantire snapshot immutable cross-subscriber.
 *
 * I campi vengono estesi da plan W3 (theme-manager) e W6 (devtools inspector).
 */
export interface ThemeSnapshot {
  /** Identifier theme (nanoid o user-provided via `ThemeConfig.themeId`). */
  readonly themeId: string
  /** Map readonly token canonici applicati allo scope (D-F7-22 ~35 + custom). */
  readonly tokens: Readonly<Record<string, string>>
  /** Mode user-selected: 'auto' segue OS, 'light'/'dark' override esplicito. */
  readonly mode: 'auto' | 'light' | 'dark'
  /** Mode risolto post-OS-detection: sempre 'light' o 'dark' (mai 'auto'). */
  readonly resolvedMode: 'light' | 'dark'
  /** Density semantic — affect spacing/font scale via density tokens (W3). */
  readonly density: 'compact' | 'comfortable' | 'spacious'
  /** Direction — i18n RTL/LTR scope-aware (W3). */
  readonly direction: 'ltr' | 'rtl'
  /** ID adapter attivo (Tailwind/Bootstrap/Material/shadcn) o null se none. */
  readonly activeAdapterId: string | null
  /** Scope: 'root' = applica su `<html>`; 'scoped' = element specifico. */
  readonly scope: 'root' | 'scoped'
}
