/**
 * @gluezero/theme — UI Standardization Layer (Phase 7 v1.1.0).
 *
 * W1 public surface — extended in W2/W3/W4/W5/W6.
 *
 * Exports:
 * - Types: DesignTokens, CoreTokenName, ThemeConfig, ThemeSnapshot, ThemeAdapter,
 *   RegisterAdapterOptions, StandardRole, RoleDefinition, RoleSet
 * - Helper: getInitialThemeScript (anti-FOUC IIFE)
 * - Error: createThemeError, isThemeError, ThemeError, ThemeErrorCode
 * - Topic constants: UI_THEME_CHANGED, UI_DENSITY_CHANGED, UI_DIRECTION_CHANGED,
 *   UI_ADAPTER_CHANGED, UI_OS_PREFERENCE_CHANGED, UI_TOPIC_NAMESPACE, UiTopic
 *
 * Side-effects: import './csstype-augment' carica module augmentation per IDE
 * autocomplete sui 10 branded core token (D-F7-21). Zero runtime cost.
 *
 * Refs: 07-CONTEXT.md D-F7-04 (subpath additivo); 07-01-PLAN.md Task 3.
 */

// Types — W1 surface skeleton (estesa W2-W6)
export type { CoreTokenName, DesignTokens } from './types/design-tokens'
export type { ThemeConfig } from './types/theme-config'
export type { ThemeSnapshot } from './types/theme-snapshot'
export type { RegisterAdapterOptions, ThemeAdapter } from './types/theme-adapter'
export type { RoleDefinition, RoleSet, StandardRole } from './types/role'

// Helper IIFE anti-FOUC (Pitfall HIGH #1)
export {
  getInitialThemeScript,
  type GetInitialThemeScriptOptions,
} from './get-initial-theme-script'

// Error factory + type guard (ERR-ext-F7)
export {
  createThemeError,
  isThemeError,
  type ThemeError,
  type ThemeErrorCode,
} from './theme-error'

// Topic constants ui.* (UI-EVENT-06)
export {
  UI_ADAPTER_CHANGED,
  UI_DENSITY_CHANGED,
  UI_DIRECTION_CHANGED,
  UI_OS_PREFERENCE_CHANGED,
  UI_THEME_CHANGED,
  UI_TOPIC_NAMESPACE,
  type UiTopic,
} from './topic-constants'

// W2 — TokenRegistry closure factory (THEME-01/02/09/11)
export {
  createTokenRegistry,
  type ApplyOptions,
  type CreateTokenRegistryOptions,
  type TokenRegistry,
} from './token-registry'

// W2 — Snapshot helpers + diff (D-F7-08, UI-DEVTOOLS-04 reuse)
export {
  createSnapshot,
  diffSnapshots,
  type SnapshotDiff,
  type SnapshotInput,
} from './snapshot'

// W2 — Cardinality cap helper (D-166 replica locale, D-83 strict)
export {
  TOKEN_CAP,
  ROLE_CAP,
  SOFT_WARN_RATIO,
  checkCap,
  type CapCheckResult,
} from './cardinality-cap'

// Internal Valibot schemas NOT re-exported via barrel (path internal/) — opt-in
// via `import { TokenSetSchema } from '@gluezero/theme/internal/valibot-schemas'`
// per advanced users che validano adapter custom in userland.

// Type-only re-export per garantire che TypeScript carichi il module augmentation
// `csstype-augment` nella public surface (D-F7-21 — IDE autocomplete sui 10
// branded core token). Zero runtime cost — solo declaration merge a build-time.
export type {} from './csstype-augment'
