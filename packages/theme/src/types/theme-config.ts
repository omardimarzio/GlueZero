/**
 * Configurazione opt-in per `createGlueZeroTheme()` (W2+ Aggregate plan 10).
 *
 * Tutti i campi sono opzionali (D-F7-12 default OFF totale). I plan W2-W6
 * estendono questa interfaccia con campi addizionali (initial mode/density,
 * adapter pre-registration, ecc.).
 */
export interface ThemeConfig {
  /** Identifier theme (default nanoid). Esposto in `ThemeSnapshot.themeId`. */
  themeId?: string
  /**
   * Persistenza opt-in (D-F7-12 default OFF).
   * - `false`: nessuna persistenza (default).
   * - `'localStorage'`: legge/scrive 4 chiavi separate `gluezero.theme.{mode,density,direction,adapter}` (Open Q3).
   */
  persistence?: false | 'localStorage'
  /**
   * Scope DOM per multi-scope theming (D-F7-05). Default `null` (root mode su `<html>`).
   * Plan W2/W7 estendono con apply-theme su scope element.
   */
  scope?: HTMLElement
  /**
   * ObserverRoot Q1 — root node per `MutationObserver` adapter ergonomic check.
   * Default `document.body` (resilienza shadow DOM upgrade).
   */
  observerRoot?: HTMLElement
  /**
   * Cardinality cap override (D-F7-14 + THEME-11).
   * Default cap = 200 token + 50 role; override ammesso solo via opt-in esplicito.
   */
  allowMore?: {
    tokens?: boolean
    roles?: boolean
  }
}
