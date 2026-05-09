---
"@gluezero/theme": minor
"@gluezero/devtools": minor
"@gluezero/gluezero": minor
"@gluezero/core": patch
---

feat: UI Standardization Layer (v1.1) — Phase 7

Aggiunge `@gluezero/theme` (9° pacchetto del monorepo, opt-in) con:

- **Token system**: design tokens canonici via CSS Custom Properties `--gz-*`
  (~35 token lean) + `applyTokens()` runtime override + multi-scope theming
  (`opts.scope`).
- **Role registry**: vocabolario canonico 14 STANDARD_ROLES (`action.{primary,
  secondary,danger,ghost}`, `feedback.*`, `surface.*`, `input.*`, `navigation.*`)
  + cardinality cap 100.
- **Theme adapter intercambiabile**: 3 strategie (DomApplier MutationObserver,
  StyleSheetGenerator @layer, classFor escape hatch) + collision throw +
  override esplicito + WeakMap track per cleanup non-destructive su hot-swap.
- **Broker events `ui.*`**: `ui.theme.changed`, `ui.density.changed`,
  `ui.direction.changed`, `ui.adapter.changed`, `ui.osPreference.changed` +
  topic constants type-safe.
- **Anti-FOUC**: `tokens-default.css` linked + `getInitialThemeScript()` IIFE
  inline pre-paint.
- **Auto OS prefs**: default `setMode('auto')` mirror `prefers-color-scheme`
  con `matchMedia` listener.
- **Persistence opt-in**: 4 chiavi separate (`gluezero.theme.{mode,density,
  direction,adapter}`) + multi-tab `StorageEvent` listener (default OFF).
- **Lifecycle cascade** `unregisterPlugin → unregisterAdapter` (LIFE-02 ext F7).
- **Devtools subpath additivo** `@gluezero/devtools/theme-inspector`
  (Inspector ring buffer 500 + RoleCoverageReport + LiveTokenEditor +
  snapshotTokens + diffSnapshots).
- **Aggregate opt-in**: `createGlueZero({ theme })` parametro additivo
  opzionale (D-F7-07 — `theme?: Theme` su `GlueZeroConfig`).

**Bundle**: `@gluezero/theme` 6.35 KB / 7 KB cap gzipped (90.7% utilization;
cap raised W4 da 6 KB a 7 KB con motivazione documentata in W4 deviation log).

**Verifiche Tier-3 Playwright Chromium** (TEST-03 ext F7 — 12/12 test passing):
- FOUC frame-1 (Pitfall HIGH #1) — IIFE pre-paint con `prefers-color-scheme: dark`
- Specificity war @layer cascade (Pitfall HIGH #2) — adapter wins, app-overrides wins
- OS preferences emulateMedia (Pitfall HIGH #6) — colorScheme + reducedMotion via CDP
- Adapter hot-swap atomico (Pitfall HIGH #5 + Q5) — single repaint, no orphan style
- axe-core a11y zero critical (Pitfall HIGH #5 + UI-DOC-04) — `data-gz-role` + ARIA
- React StrictMode race coalescing (Pitfall HIGH #4) — `queueMicrotask` last-write-wins

**D-83 strict carryover esteso preservato**: zero modifiche runtime ai pacchetti
F1-F6 src/ + devtools/src/ top-level. Eccezioni esplicite documentate (additive
only):
- `packages/devtools/src/theme-inspector/**` (NEW subpath dir — D-F7-04).
- `packages/devtools/package.json` (subpath export + peerDependenciesMeta opzionale).
- `packages/gluezero/src/{glue-zero.ts, index.ts, types/gluezero-config.ts}`
  (parametro `theme?: Theme` additivo — D-F7-07).
- `packages/gluezero/package.json` (peerDependenciesMeta opzionale).
- `packages/core/src/core/plugin-registry.{ts,test.ts}` (D-23 asimmetria fix
  — auto-inject `source` su publish da plugin scoped broker; commit `542d725`,
  separate scope ma incluso nel range v1.1 — patch bump per `@gluezero/core`).

**Examples runnable** (W6 plan 07-12): `examples/theme-tokens-only.html`,
`examples/theme-dark-mode-meteo.html`, `examples/theme-tailwind.html` standalone
HTML pages senza build step. Hero `examples/pub-sub-demo.html` esteso con theme
switcher live + `data-gz-role` attributes.

**ROADMAP success criteria F7 raggiunti**: brand swap runtime in-place + adapter
swap cross-framework + dark mode anti-FOUC frame-1 + lifecycle cleanup cascade +
Theme Inspector broker-native + bundle ≤ 7 KB.
