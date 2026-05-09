/**
 * Topic constants type-safe per UI namespace (UI-EVENT-06).
 *
 * I 5 broker events `ui.*` pubblicati dal theme manager (W3-W6) sono esposti
 * come `as const` literal per type-safe subscribe:
 *
 * ```ts
 * import { UI_THEME_CHANGED, type UiTopic } from '@gluezero/theme'
 * broker.subscribe(UI_THEME_CHANGED, (event) => { ... })
 * ```
 *
 * `UI_TOPIC_NAMESPACE` documenta wildcard prefix `'ui.*'` per subscribe pattern
 * matching (PRD §11 wildcard subscription).
 *
 * Refs: 07-CONTEXT.md UI-EVENT-06; PRD §13 (broker events catalog).
 */
export const UI_THEME_CHANGED = 'ui.theme.changed' as const
export const UI_DENSITY_CHANGED = 'ui.density.changed' as const
export const UI_DIRECTION_CHANGED = 'ui.direction.changed' as const
export const UI_ADAPTER_CHANGED = 'ui.adapter.changed' as const
export const UI_OS_PREFERENCE_CHANGED = 'ui.osPreference.changed' as const

/** Wildcard prefix per subscribe `ui.*` (PRD §11 wildcard subscription). */
export const UI_TOPIC_NAMESPACE = 'ui.*' as const

/** Union dei 5 topic UI canonici (type-safe). */
export type UiTopic =
  | typeof UI_THEME_CHANGED
  | typeof UI_DENSITY_CHANGED
  | typeof UI_DIRECTION_CHANGED
  | typeof UI_ADAPTER_CHANGED
  | typeof UI_OS_PREFERENCE_CHANGED
