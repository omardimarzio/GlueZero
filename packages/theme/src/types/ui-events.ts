/**
 * Payload types per `ui.*` broker events (UI-EVENT-01..05) + duck-typed
 * `BrokerLike` shape per ThemeManager broker injection (D-F7-01 Opzione B).
 *
 * **Perché duck-typed?** Il package `@gluezero/theme` NON dipende dalla classe
 * `Broker` concreta di `@gluezero/core` (D-83 strict carryover). L'interface
 * `BrokerLike` cattura i 2 metodi che ThemeManager utilizza (publish/subscribe);
 * il consumer passa la propria istanza Broker (workspace `@gluezero/core` o
 * mock test) senza coupling a-livello di tipo.
 *
 * Refs:
 * - 07-CONTEXT.md UI-EVENT-01..06, D-F7-01 Opzione B (broker injection opt-in)
 * - 07-08-PLAN.md Task 1
 * - PRD §13 (broker events catalog)
 */

/**
 * Duck-typed broker shape — F7 NON dipende dalla classe `Broker` concreta di
 * `@gluezero/core`. Cattura le 2 operazioni utilizzate da ThemeManager:
 * `publish` (per emettere `ui.*` events) e `subscribe` (per LIFE-02 ext F7
 * cascade `system.plugin.unregistered`).
 */
export interface BrokerLike {
  publish<P>(
    topic: string,
    payload: P,
    options?: { source?: { type: string; id: string } },
  ): unknown
  subscribe<P>(
    topic: string,
    handler: (event: {
      topic: string
      payload: P
      source?: unknown
      timestamp?: number
    }) => void,
  ): () => void
}

/** Payload UI-EVENT-01 `ui.theme.changed` — emesso su `setMode()` + OS change auto. */
export interface UiThemeChangedPayload {
  readonly themeId: string
  readonly tokens: Readonly<Record<string, string>>
  readonly mode: 'auto' | 'light' | 'dark'
  readonly resolvedMode: 'light' | 'dark'
  readonly scope: 'root' | 'scoped'
}

/** Payload UI-EVENT-02 `ui.density.changed` — emesso su `setDensity()`. */
export interface UiDensityChangedPayload {
  readonly density: 'compact' | 'comfortable' | 'spacious'
  readonly previous?: 'compact' | 'comfortable' | 'spacious'
}

/** Payload UI-EVENT-03 `ui.direction.changed` — emesso su `setDirection()`. */
export interface UiDirectionChangedPayload {
  readonly dir: 'ltr' | 'rtl'
  readonly previous?: 'ltr' | 'rtl'
}

/** Payload UI-EVENT-04 `ui.adapter.changed` — emesso su `setAdapter()` + cascade. */
export interface UiAdapterChangedPayload {
  readonly current: string | null
  readonly previous: string | null
  readonly cause: 'manual' | 'plugin-cascade' | 'unregister'
}

/** Payload UI-EVENT-05 `ui.osPreference.changed` — emesso su matchMedia change in auto-mode. */
export interface UiOsPreferenceChangedPayload {
  readonly kind: 'color-scheme' | 'reduced-motion' | 'contrast'
  readonly value: string
}

/** Aggregate map per type narrowing in `subscribe('ui.*')`. */
export interface UiEventMap {
  'ui.theme.changed': UiThemeChangedPayload
  'ui.density.changed': UiDensityChangedPayload
  'ui.direction.changed': UiDirectionChangedPayload
  'ui.adapter.changed': UiAdapterChangedPayload
  'ui.osPreference.changed': UiOsPreferenceChangedPayload
}
