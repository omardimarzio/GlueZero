/**
 * `createTheme()` — public factory orchestratore (W4 plan 07-08, Task 3).
 *
 * Entry point principale di `@gluezero/theme`. Compone in singolo handle:
 * - `ThemeManager` (W2 plan 07-03 + W4 plan 07-08 broker injection D-F7-01 Opzione B)
 * - `DomApplier` Strategia A (W3 plan 07-07): MutationObserver + ClassesTracker
 * - `StyleSheetGenerator` Strategia B (W3 plan 07-07): `<style>@layer adapter`
 * - `ClassesTracker` (W3 plan 07-06): WeakMap cleanup non-destructive
 *
 * Hot-swap automatico (UI-ROLE-05): `setActiveAdapter(id)` invoca
 * `manager.setAdapter(id)` (cascade `ui.adapter.changed` se broker fornito) +
 * mount/remount delle Strategie A/B in base alla shape dell'adapter
 * (`roleMap` → A; `cssRules` → B; entrambi → A+B contemporanee).
 *
 * Subpath separato (`@gluezero/theme/factory`): per restare entro 7 KB cap +
 * abilitare consumer barrel-only (es. server-side render senza DOM) ad
 * importare solo i building block W2 senza pagare DomApplier+StyleSheetGenerator
 * (~1.7 KB).
 *
 * @example
 * ```ts
 * import { createTheme } from '@gluezero/theme/factory'
 * import { createBroker } from '@gluezero/core'
 *
 * const broker = createBroker()
 * const theme = createTheme({ broker, persistence: 'localStorage' })
 * theme.register({
 *   id: 'tailwind',
 *   roleMap: { 'action.primary': 'bg-indigo-600 text-white' }
 * })
 * theme.setActiveAdapter('tailwind') // → ui.adapter.changed publish
 * theme.manager.setMode('dark')      // → ui.theme.changed publish
 * ```
 *
 * @see UI-ROLE-04 (3 strategie applicazione DOM)
 * @see UI-ROLE-05 (hot-swap atomico)
 * @see D-F7-01 Opzione B (broker injection opt-in)
 * @see D-F7-06 (LIFE-02 ext F7 cascade automatico via ThemeManager)
 */

import { createDomApplier, type DomApplier } from './dom-applier'
import {
  createClassesTracker,
  type ClassesTracker,
} from './internal/weakmap-classes'
import {
  createStyleSheetGenerator,
  type StyleSheetGenerator,
} from './stylesheet-generator'
import { createThemeManager, type ThemeManager } from './theme-manager'
import type {
  RegisterAdapterOptions,
  ThemeAdapter,
} from './types/theme-adapter'
import type { ThemeConfig } from './types/theme-config'
import type { ThemeSnapshot } from './types/theme-snapshot'

/** Configurazione `createTheme()`: estende `ThemeConfig` (broker, persistence, scope, ecc.). */
// biome-ignore lint/suspicious/noEmptyInterface: alias semantico esplicito per ergonomia API
export interface CreateThemeOptions extends ThemeConfig {}

/** Surface API ergonomica esposta da `createTheme()`. */
export interface Theme {
  /** ThemeManager sottostante (broker-aware se `opts.broker` fornito). */
  readonly manager: ThemeManager
  /**
   * Registra un adapter nel registry interno. Throw `theme.adapter.duplicate`
   * su id collisione (override esplicito via `{ override: true }`).
   * `ownerPluginId` propagato per LIFE-02 ext F7 cascade automatico.
   *
   * @example
   * ```ts
   * theme.register({
   *   id: 'tailwind',
   *   roleMap: { 'action.primary': 'bg-indigo-600 text-white px-4 py-2 rounded' },
   * })
   * ```
   *
   * @example Plugin-scoped adapter (cascade su unregister, LIFE-02 ext F7)
   * ```ts
   * theme.register(meteoAdapter, { ownerPluginId: 'meteo' })
   * // gz.plugins.unregister('meteo') → adapter cleanup automatico
   * ```
   *
   * @see {@link RegisterAdapterOptions}
   * @see UI-ROLE-09 + D-F7-09 (collision throw)
   */
  register(adapter: ThemeAdapter, opts?: RegisterAdapterOptions): void
  /**
   * Cambia adapter attivo (`null` = deactivate). Hot-swap atomico (UI-ROLE-05):
   * Strategia A re-apply classi via DomApplier; Strategia B remount `<style>`
   * con CSS rules nuove. Pubblica `ui.adapter.changed` se broker fornito.
   *
   * @example Hot-swap atomico cross-DS
   * ```ts
   * theme.setActiveAdapter('tailwind')   // utility classes via DomApplier
   * theme.setActiveAdapter('tokens-only')// cssRules via StyleSheetGenerator
   * theme.setActiveAdapter(null)         // deactivate (cleanup non-destructive)
   * ```
   *
   * @see UI-ROLE-05 (hot-swap atomico via queueMicrotask)
   */
  setActiveAdapter(adapterId: string | null): void
  /**
   * Applica token deltas via `manager.tokens.apply`.
   *
   * @example Brand swap atomico
   * ```ts
   * theme.applyTokens({ 'color-primary': '#FF6B35', 'color-on-primary': '#FFFFFF' })
   * // Tutti i nodi che leggono var(--gz-color-primary) si aggiornano in 1 paint
   * ```
   *
   * @example Multi-scope (D-F7-05)
   * ```ts
   * const dashboard = document.querySelector<HTMLElement>('.dashboard')!
   * theme.applyTokens({ 'color-primary': '#0EA5E9' }, { scope: dashboard })
   * ```
   */
  applyTokens(
    tokens: Record<string, string>,
    opts?: { scope?: HTMLElement; allowMore?: boolean },
  ): void
  /** Snapshot deep-frozen dello stato corrente (D-F7-08). */
  getActiveTheme(): ThemeSnapshot
  /** Cleanup completo: dispose DomApplier + StyleSheetGenerator + manager. Idempotent. */
  destroy(): void
}

/**
 * Crea un nuovo {@link Theme} (D-30 anti-singleton).
 *
 * @param opts - Configurazione opzionale (broker, persistence, scope, observerRoot).
 * @returns Theme handle ergonomico.
 *
 * @example Standalone — token override runtime senza broker
 * ```ts
 * import { createTheme } from '@gluezero/theme'
 * const theme = createTheme()
 * theme.applyTokens({ 'color-primary': '#FF6B35' })
 * ```
 *
 * @example Aggregate composition (D-F7-07)
 * ```ts
 * import { createGlueZero } from '@gluezero/gluezero'
 * import { createTheme } from '@gluezero/theme'
 * const gz = createGlueZero({ theme: createTheme({ persistence: 'localStorage' }) })
 * gz.theme?.manager.setMode('auto')
 * ```
 *
 * @see {@link Theme}
 * @see UI-ROLE-04 (3 strategie applicazione DOM)
 */
export function createTheme(opts: CreateThemeOptions = {}): Theme {
  const manager = createThemeManager(opts)
  const tracker: ClassesTracker = createClassesTracker()
  let domApplier: DomApplier | null = null
  let styleGen: StyleSheetGenerator | null = null
  let destroyed = false

  function activateStrategies(adapter: ThemeAdapter | null): void {
    if (domApplier) {
      domApplier.dispose()
      domApplier = null
    }
    if (styleGen) {
      styleGen.dispose()
      styleGen = null
    }
    if (adapter == null) return
    if (adapter.roleMap) {
      domApplier = createDomApplier(
        opts.observerRoot !== undefined
          ? { adapter, classesTracker: tracker, observerRoot: opts.observerRoot }
          : { adapter, classesTracker: tracker },
      )
    }
    if (adapter.cssRules) {
      styleGen = createStyleSheetGenerator(
        opts.scope !== undefined ? { adapter, scope: opts.scope } : { adapter },
      )
      styleGen.mount()
    }
  }

  function register(
    adapter: ThemeAdapter,
    regOpts: RegisterAdapterOptions = {},
  ): void {
    if (destroyed) return
    manager.adapters.register(adapter, regOpts)
  }

  function setActiveAdapter(adapterId: string | null): void {
    if (destroyed) return
    manager.setAdapter(adapterId)
    const adapter = adapterId != null ? manager.adapters.get(adapterId) ?? null : null
    activateStrategies(adapter)
  }

  function applyTokens(
    tokens: Record<string, string>,
    applyOpts: { scope?: HTMLElement; allowMore?: boolean } = {},
  ): void {
    if (destroyed) return
    manager.tokens.apply(tokens, applyOpts)
  }

  function getActiveTheme(): ThemeSnapshot {
    return manager.getActiveTheme()
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true
    if (domApplier) domApplier.dispose()
    if (styleGen) styleGen.dispose()
    tracker.destroy()
    manager.destroy()
  }

  return {
    manager,
    register,
    setActiveAdapter,
    applyTokens,
    getActiveTheme,
    destroy,
  }
}
