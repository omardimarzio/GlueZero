# @gluezero/theme

## 1.1.0

### Minor Changes

- Initial release — UI Standardization Layer (v1.1) — Phase 7

  9° pacchetto del monorepo, opt-in. Permette ai plugin sviluppati indipendentemente — in qualunque framework UI — di essere ribrandizzati / dark-mode-switched / density-adattati / RTL-switched a runtime.

  - **Token system**: design tokens canonici via CSS Custom Properties `--gz-*` (~35 token lean) + `applyTokens()` runtime override + multi-scope theming (`opts.scope`).
  - **Role registry**: vocabolario canonico 14 STANDARD_ROLES (`action.{primary,secondary,danger,ghost}`, `feedback.*`, `surface.*`, `input.*`, `navigation.*`) + cardinality cap 100.
  - **Theme adapter intercambiabile**: 3 strategie (DomApplier MutationObserver, StyleSheetGenerator @layer, classFor escape hatch) + collision throw + override esplicito + WeakMap track per cleanup non-destructive su hot-swap.
  - **Broker events `ui.*`**: `ui.theme.changed`, `ui.density.changed`, `ui.direction.changed`, `ui.adapter.changed`, `ui.osPreference.changed` + topic constants type-safe.
  - **Anti-FOUC**: `tokens-default.css` linked + `getInitialThemeScript()` IIFE inline pre-paint.
  - **Auto OS prefs**: default `setMode('auto')` mirror `prefers-color-scheme` con `matchMedia` listener.
  - **Persistence opt-in**: 4 chiavi separate (`gluezero.theme.{mode,density,direction,adapter}`) + multi-tab `StorageEvent` listener (default OFF).
  - **Lifecycle cascade** `unregisterPlugin → unregisterAdapter` (LIFE-02 ext F7).
  - **createTheme() factory**: orchestratore singolo (subpath `@gluezero/theme/factory`).

  **Bundle**: 6.35 KB / 7 KB cap gzipped (90.7% utilization).

  **Verifiche Tier-3 Playwright Chromium** (12/12 test passing): FOUC frame-1, specificity war `@layer` cascade, OS preferences `emulateMedia`, adapter hot-swap atomico, axe-core a11y zero critical, React StrictMode race coalescing.

  **Peer dependencies**: `@gluezero/core` ≥ 1.0.2, `@gluezero/mapper` ≥ 1.0.2.

### Patch Changes

- Updated dependencies
  - @gluezero/core@1.0.2
  - @gluezero/mapper@1.0.2
