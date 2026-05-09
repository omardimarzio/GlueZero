/**
 * ThemeManager — closure factory orchestratore mode/density/direction su
 * `<html>` + auto-mode mirror OS prefs (D-F7-13). Front door pubblico di
 * `@gluezero/theme`.
 *
 * **W2 scope (plan 07-03):** standalone — composizione `TokenRegistry` +
 * `OsPreferenceWatcher` + Persistence opt-in.
 *
 * **W4 ext F7 (plan 07-08, D-F7-01 Opzione B):** broker injection opt-in per
 * emettere `ui.*` events (UI-EVENT-01..05) + LIFE-02 ext F7 cascade subscribe
 * a `system.plugin.unregistered` (D-F7-06). Surface estesa con `adapters` +
 * `roles` + `setAdapter`.
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
 * input fuori whitelist throw `ThemeError` con code dedicato.
 *
 * **Lifecycle (T-F7-04 mitigation):** `destroy()` rimuove matchMedia listener
 * + cascade subscriber + adapter/role registry; flag `destroyed` blocca
 * successive setter. Idempotent.
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-01 (broker injection), D-F7-06 (LIFE-02 cascade),
 *   D-F7-08 (deep-frozen snapshot), D-F7-13 (default auto)
 * - 07-08-PLAN.md Task 2
 * - THEME-04..09, UI-EVENT-01..06, LIFE-02 ext F7
 */

import { nanoid } from 'nanoid'
import {
  createAdapterRegistry,
  type AdapterRegistry,
} from './adapter-registry'
import {
  createOsPreferenceWatcher,
  type OsPreferenceWatcher,
} from './os-preference'
import {
  createThemePersistence,
  type ThemePersistence,
} from './persistence'
import { createRoleRegistry, type RoleRegistry } from './role-registry'
import { createSnapshot } from './snapshot'
import { createThemeError } from './theme-error'
import { createTokenRegistry, type TokenRegistry } from './token-registry'
import type { ThemeConfig } from './types/theme-config'
import type { ThemeSnapshot } from './types/theme-snapshot'
import type { BrokerLike } from './types/ui-events'

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

/** Surface API esposta da `createThemeManager()` (W4 estesa con adapters/roles/setAdapter). */
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
  /**
   * W4 ext F7: imposta l'adapter attivo (`null` = deactivate). Pubblica
   * `ui.adapter.changed` cause='manual' se broker fornito.
   * @throws {ThemeError} `theme.adapter.unknown` su id non registrato.
   */
  setAdapter(adapterId: string | null): void
  /** Ritorna snapshot deep-frozen dello stato corrente (D-F7-08). */
  getActiveTheme(): ThemeSnapshot
  /** TokenRegistry composto internamente (THEME-01..02). */
  readonly tokens: TokenRegistry
  /** W4 ext F7: AdapterRegistry composto internamente (UI-ROLE-03/09). */
  readonly adapters: AdapterRegistry
  /** W4 ext F7: RoleRegistry composto internamente (UI-ROLE-01/06/07). */
  readonly roles: RoleRegistry
  /** Cleanup matchMedia listener + cascade subscriber + sub-registry. Idempotent. */
  destroy(): void
}

/**
 * Crea un nuovo {@link ThemeManager} (D-30 anti-singleton).
 *
 * **W4 ext F7:** se `config.broker` fornito → emette `ui.*` events su ogni
 * setter + sottoscrive `system.plugin.unregistered` per cascade unregister
 * adapter (LIFE-02 ext F7). Senza broker behavior pre-W4 preservato.
 *
 * @param config - Configurazione opzionale (themeId, scope, persistence, broker).
 * @returns Nuova istanza indipendente.
 *
 * @example
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * const broker = createBroker()
 * const tm = createThemeManager({ broker, persistence: 'localStorage' })
 * tm.setMode('auto')              // → publish ui.theme.changed
 * tm.adapters.register({ id: 'tailwind', roleMap: {...} }, { ownerPluginId: 'p' })
 * tm.setAdapter('tailwind')       // → publish ui.adapter.changed
 * // … later
 * tm.destroy()
 * ```
 *
 * @see THEME-04..09
 * @see UI-EVENT-01..06
 * @see LIFE-02 ext F7
 */
export function createThemeManager(config: ThemeConfig = {}): ThemeManager {
  const themeId = config.themeId ?? nanoid()
  const tokens = createTokenRegistry()
  const adapters = createAdapterRegistry()
  const roles = createRoleRegistry()
  const osWatcher: OsPreferenceWatcher = createOsPreferenceWatcher()
  const persistence: ThemePersistence = createThemePersistence({
    enabled: config.persistence === 'localStorage',
  })
  const broker: BrokerLike | null = config.broker ?? null
  const subscriptions: Array<() => void> = []
  let destroyed = false
  let suppressWrite = false

  const state = {
    mode: 'auto' as ThemeMode,
    resolvedMode: osWatcher.getColorScheme() as 'light' | 'dark',
    density: 'comfortable' as ThemeDensity,
    direction: 'ltr' as ThemeDirection,
    activeAdapterId: null as string | null,
    scope: (config.scope ? 'scoped' : 'root') as 'root' | 'scoped',
  }

  let osUnsub: (() => void) | null = null
  let persistenceUnsub: (() => void) | null = null

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

  // Single shared publish helper (mitigation: inline reduces footprint vs 5
  // separate functions). Tipi inference via call site (zero runtime cost).
  function pub(topic: string, payload: unknown): void {
    if (broker != null) broker.publish(topic, payload)
  }

  function publishThemeChanged(): void {
    pub('ui.theme.changed', {
      themeId,
      tokens: { ...tokens.getActive() },
      mode: state.mode,
      resolvedMode: state.resolvedMode,
      scope: state.scope,
    })
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
      if (!osUnsub) {
        osUnsub = osWatcher.subscribe('color-scheme', (value) => {
          if (state.mode === 'auto') {
            state.resolvedMode = value === 'dark' ? 'dark' : 'light'
            applyDomMode()
            pub('ui.osPreference.changed', {
              kind: 'color-scheme',
              value: state.resolvedMode,
            })
            publishThemeChanged()
          }
        })
      }
    } else {
      state.resolvedMode = mode
      if (osUnsub) {
        osUnsub()
        osUnsub = null
      }
    }
    applyDomMode()
    if (!suppressWrite) persistence.write({ mode })
    publishThemeChanged()
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
    const previous = state.density
    state.density = density
    targetEl().setAttribute('data-gz-density', density)
    if (!suppressWrite) persistence.write({ density })
    pub('ui.density.changed', { density, previous })
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
    const previous = state.direction
    state.direction = direction
    const el = targetEl()
    el.setAttribute('dir', direction)
    el.setAttribute('data-gz-direction', direction)
    if (!suppressWrite) persistence.write({ direction })
    pub('ui.direction.changed', { dir: direction, previous })
  }

  function setAdapter(adapterId: string | null): void {
    ensureLive()
    const { previous, current } = adapters.setActive(adapterId)
    state.activeAdapterId = current
    if (!suppressWrite) persistence.write({ adapter: current ?? '' })
    pub('ui.adapter.changed', { previous, current, cause: 'manual' })
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
    for (const unsub of subscriptions) unsub()
    subscriptions.length = 0
    if (persistenceUnsub) {
      persistenceUnsub()
      persistenceUnsub = null
    }
    persistence.destroy()
    if (osUnsub) {
      osUnsub()
      osUnsub = null
    }
    osWatcher.destroy()
    adapters.destroy()
    roles.destroy()
    tokens.destroy()
  }

  // LIFE-02 ext F7 cascade (D-F7-06): subscribe a system.plugin.unregistered.
  // Per ogni adapter `ownerPluginId === event.payload.id` → unregister + emit
  // ui.adapter.changed cause='plugin-cascade' se l'adapter era ATTIVO.
  if (broker != null) {
    subscriptions.push(
      broker.subscribe<{ id: unknown }>('system.plugin.unregistered', (event) => {
        if (destroyed) return
        const pid = event?.payload?.id
        if (typeof pid !== 'string') return
        for (const aid of [...adapters.list()]) {
          if (adapters.getOwnerPluginId(aid) !== pid) continue
          const wasActive = adapters.getActiveId() === aid
          adapters.unregister(aid)
          if (wasActive) {
            state.activeAdapterId = null
            pub('ui.adapter.changed', { previous: aid, current: null, cause: 'plugin-cascade' })
          }
        }
      }),
    )
  }

  // Boot-time: legge stato pre-esistente in localStorage e applica al boot
  // (usando i setter standard per riutilizzare validation + DOM apply, ma con
  // `suppressWrite` per evitare di ri-scrivere subito ciò che abbiamo letto).
  if (persistence.enabled) {
    const persisted = persistence.read()
    if (persisted) {
      suppressWrite = true
      try {
        if (persisted.mode) setMode(persisted.mode)
        if (persisted.density) setDensity(persisted.density)
        if (persisted.direction) setDirection(persisted.direction)
      } finally {
        suppressWrite = false
      }
    }

    persistenceUnsub = persistence.subscribe((partial) => {
      if (destroyed) return
      suppressWrite = true
      try {
        if (partial.mode) setMode(partial.mode)
        if (partial.density) setDensity(partial.density)
        if (partial.direction) setDirection(partial.direction)
      } finally {
        suppressWrite = false
      }
    })
  }

  return {
    setMode,
    setDensity,
    setDirection,
    setAdapter,
    getActiveTheme,
    tokens,
    adapters,
    roles,
    destroy,
  }
}
