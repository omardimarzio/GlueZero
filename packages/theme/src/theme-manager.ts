/**
 * ThemeManager — closure factory orchestratore mode/density/direction su
 * `<html>` + auto-mode mirror OS prefs (D-F7-13). Front door pubblico di
 * `@gluezero/theme`.
 *
 * **W2 scope (questo plan 07-03):** standalone — NON inietta broker. Composizione
 * interna `TokenRegistry` + `OsPreferenceWatcher`. Il broker injection per emit
 * `ui.*` events arriva in W4 plan 07-08.
 *
 * **Anti-singleton (D-30):** ogni call a `createThemeManager()` ritorna istanza
 * indipendente con stato isolato. Pattern role-match con
 * `createPluginRegistry`/`createMetricsCollector`/`createTokenRegistry`.
 *
 * **DOM contract (THEME-04..07):**
 * - `setMode('light'|'dark')` → `<html data-gz-theme='light|dark' data-gz-mode='light|dark'>`
 * - `setMode('auto')` → resolve `prefers-color-scheme` → `<html data-gz-theme='light|dark' data-gz-mode='auto'>`
 *   + subscribe matchMedia change → aggiorna `data-gz-theme` on-OS-change
 * - `setDensity('compact'|'comfortable'|'spacious')` → `<html data-gz-density='...'>`
 * - `setDirection('ltr'|'rtl')` → `<html dir='...' data-gz-direction='...'>`
 *
 * **Validation (T-F7-01 mitigation):** whitelist enum `Set` check pre-apply;
 * input fuori whitelist throw `ThemeError` con code dedicato:
 * - `theme.mode.invalid` / `theme.density.invalid` / `theme.direction.invalid`
 *
 * **Lifecycle (T-F7-04 mitigation):** `destroy()` rimuove matchMedia listener
 * via `osWatcher.destroy()` + `tokens.destroy()`; flag `destroyed` blocca
 * successive `setMode/setDensity/setDirection` con throw `theme.snapshot.frozen`.
 * Idempotent.
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-13 (default auto), D-F7-08 (deep-frozen snapshot),
 *   D-F7-12 (persistence default OFF — placeholder qui)
 * - 07-03-PLAN.md Task 2
 * - THEME-04, THEME-05, THEME-06, THEME-07, THEME-09
 */

import { nanoid } from 'nanoid'
import {
  createOsPreferenceWatcher,
  type OsPreferenceWatcher,
} from './os-preference'
import { createSnapshot } from './snapshot'
import { createThemeError } from './theme-error'
import { createTokenRegistry, type TokenRegistry } from './token-registry'
import type { ThemeConfig } from './types/theme-config'
import type { ThemeSnapshot } from './types/theme-snapshot'

/** Mode utente: 'auto' segue OS, 'light'/'dark' override esplicito (THEME-04). */
export type ThemeMode = 'auto' | 'light' | 'dark'

/** Density semantic — affect spacing/font scale via density tokens (THEME-06). */
export type ThemeDensity = 'compact' | 'comfortable' | 'spacious'

/** Direction — i18n RTL/LTR (THEME-07). */
export type ThemeDirection = 'ltr' | 'rtl'

/** Whitelist mode (T-F7-01 mitigation). */
const VALID_MODES: ReadonlySet<ThemeMode> = new Set<ThemeMode>([
  'auto',
  'light',
  'dark',
])

/** Whitelist density (T-F7-01 mitigation). */
const VALID_DENSITIES: ReadonlySet<ThemeDensity> = new Set<ThemeDensity>([
  'compact',
  'comfortable',
  'spacious',
])

/** Whitelist direction (T-F7-01 mitigation). */
const VALID_DIRECTIONS: ReadonlySet<ThemeDirection> = new Set<ThemeDirection>([
  'ltr',
  'rtl',
])

/** Surface API esposta da `createThemeManager()`. */
export interface ThemeManager {
  /**
   * Imposta il mode. `'auto'` mirror OS via matchMedia (D-F7-13).
   * @throws {ThemeError} `theme.mode.invalid` su input fuori whitelist.
   * @throws {ThemeError} `theme.snapshot.frozen` post-destroy.
   */
  setMode(mode: ThemeMode): void
  /**
   * Imposta la density semantic.
   * @throws {ThemeError} `theme.density.invalid` su input fuori whitelist.
   * @throws {ThemeError} `theme.snapshot.frozen` post-destroy.
   */
  setDensity(density: ThemeDensity): void
  /**
   * Imposta la direction (LTR/RTL); scrive sia `dir` attribute nativo HTML che
   * `data-gz-direction` per coerenza con altri data-attr GlueZero.
   * @throws {ThemeError} `theme.direction.invalid` su input fuori whitelist.
   * @throws {ThemeError} `theme.snapshot.frozen` post-destroy.
   */
  setDirection(direction: ThemeDirection): void
  /** Ritorna snapshot deep-frozen dello stato corrente (D-F7-08). */
  getActiveTheme(): ThemeSnapshot
  /** TokenRegistry composto internamente (THEME-01..02). */
  readonly tokens: TokenRegistry
  /** Cleanup matchMedia listener + tokens registry. Idempotent. */
  destroy(): void
}

/**
 * Crea un nuovo {@link ThemeManager} (D-30 anti-singleton).
 *
 * **W2 scope:** standalone — NESSUNA `broker` injection. L'estensione W4 plan
 * 07-08 aggiungerà il parametro `broker` per emit `ui.theme.changed` etc.
 *
 * @param config - Configurazione opzionale (themeId, scope, persistence,
 *                 cardinality cap override).
 * @returns Nuova istanza indipendente.
 *
 * @example
 * ```ts
 * const tm = createThemeManager({ themeId: 'app-theme' })
 * tm.setMode('auto')              // Mirror OS prefers-color-scheme
 * tm.setDensity('comfortable')
 * tm.setDirection('ltr')
 * const snap = tm.getActiveTheme() // deep-frozen ThemeSnapshot
 * // … later
 * tm.destroy()
 * ```
 *
 * @see THEME-04
 * @see THEME-05
 * @see THEME-06
 * @see THEME-07
 * @see THEME-09
 */
export function createThemeManager(config: ThemeConfig = {}): ThemeManager {
  const themeId = config.themeId ?? nanoid()
  const tokens = createTokenRegistry()
  const osWatcher: OsPreferenceWatcher = createOsPreferenceWatcher()
  let destroyed = false

  const state = {
    mode: 'auto' as ThemeMode,
    resolvedMode: osWatcher.getColorScheme() as 'light' | 'dark',
    density: 'comfortable' as ThemeDensity,
    direction: 'ltr' as ThemeDirection,
    activeAdapterId: null as string | null,
    scope: (config.scope ? 'scoped' : 'root') as 'root' | 'scoped',
  }

  let osUnsub: (() => void) | null = null

  function targetEl(): HTMLElement {
    if (config.scope) return config.scope
    if (typeof document !== 'undefined') return document.documentElement
    throw createThemeError({
      code: 'theme.snapshot.frozen',
      message:
        'Document is not available (SSR?). ThemeManager requires a browser environment.',
    })
  }

  function ensureLive(): void {
    if (destroyed) {
      throw createThemeError({
        code: 'theme.snapshot.frozen',
        message: 'ThemeManager has been destroyed',
      })
    }
  }

  function applyDomMode(): void {
    const el = targetEl()
    el.setAttribute('data-gz-theme', state.resolvedMode)
    el.setAttribute('data-gz-mode', state.mode)
  }

  function setMode(mode: ThemeMode): void {
    ensureLive()
    if (!VALID_MODES.has(mode)) {
      throw createThemeError({
        code: 'theme.mode.invalid',
        message: `Invalid mode "${String(mode)}". Expected: 'auto' | 'light' | 'dark'.`,
        details: { received: mode },
      })
    }
    state.mode = mode
    if (mode === 'auto') {
      state.resolvedMode = osWatcher.getColorScheme()
      // Subscribe lazily on first auto enter
      if (!osUnsub) {
        osUnsub = osWatcher.subscribe('color-scheme', (value) => {
          if (state.mode === 'auto') {
            state.resolvedMode = value === 'dark' ? 'dark' : 'light'
            applyDomMode()
          }
        })
      }
    } else {
      state.resolvedMode = mode
      // Unsubscribe from auto-mode listener if leaving auto
      if (osUnsub) {
        osUnsub()
        osUnsub = null
      }
    }
    applyDomMode()
  }

  function setDensity(density: ThemeDensity): void {
    ensureLive()
    if (!VALID_DENSITIES.has(density)) {
      throw createThemeError({
        code: 'theme.density.invalid',
        message: `Invalid density "${String(density)}". Expected: 'compact' | 'comfortable' | 'spacious'.`,
        details: { received: density },
      })
    }
    state.density = density
    targetEl().setAttribute('data-gz-density', density)
  }

  function setDirection(direction: ThemeDirection): void {
    ensureLive()
    if (!VALID_DIRECTIONS.has(direction)) {
      throw createThemeError({
        code: 'theme.direction.invalid',
        message: `Invalid direction "${String(direction)}". Expected: 'ltr' | 'rtl'.`,
        details: { received: direction },
      })
    }
    state.direction = direction
    const el = targetEl()
    el.setAttribute('dir', direction)
    el.setAttribute('data-gz-direction', direction)
  }

  function getActiveTheme(): ThemeSnapshot {
    return createSnapshot({
      themeId,
      tokens: { ...tokens.getActive() },
      mode: state.mode,
      resolvedMode: state.resolvedMode,
      density: state.density,
      direction: state.direction,
      activeAdapterId: state.activeAdapterId,
      scope: state.scope,
    })
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true
    if (osUnsub) {
      osUnsub()
      osUnsub = null
    }
    osWatcher.destroy()
    tokens.destroy()
  }

  return {
    setMode,
    setDensity,
    setDirection,
    getActiveTheme,
    tokens,
    destroy,
  }
}
