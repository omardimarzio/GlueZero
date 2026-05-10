# @gluezero/gluezero

## 1.1.0

### Minor Changes

- ad830fe: feat: UI Standardization Layer (v1.1) — Phase 7

  Aggiunge `@gluezero/theme` (9° pacchetto del monorepo, opt-in) con:

  - **Token system**: design tokens canonici via CSS Custom Properties `--gz-*`
    (~35 token lean) + `applyTokens()` runtime override + multi-scope theming
    (`opts.scope`).
  - **Role registry**: vocabolario canonico 14 STANDARD_ROLES (`action.{primary,
secondary,danger,ghost}`, `feedback.*`, `surface.*`, `input.*`, `navigation.*`)
    - cardinality cap 100.
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

### Patch Changes

- Updated dependencies [ad830fe]
  - @gluezero/devtools@1.1.0
  - @gluezero/core@1.0.2
  - @gluezero/cache@1.0.2
  - @gluezero/gateway@1.0.2
  - @gluezero/mapper@1.0.2
  - @gluezero/routing@1.0.2
  - @gluezero/theme@1.1.1
  - @gluezero/worker@1.0.2

## 1.0.1

### Patch Changes

- # v1.0.1 — npm registry metadata propagation

  Patch release per propagare metadata e fix di build pipeline su npm registry. **Nessun cambio funzionale**, nessun cambio di API, nessun cambio di runtime behavior. Tutti i package sono interscambiabili con `1.0.0` a livello di codice.

  ## What changed (metadata only)

  - **`description`** user-facing aggiunta a tutti gli 8 package (era assente / generica in v1.0.0). Ora ogni package su npm mostra una description concisa e search-friendly.
  - **`keywords`** aggiunte a tutti gli 8 package (10-14 keywords specifiche per package: `pub-sub`, `event-bus`, `web-worker`, `lru`, `sse`, `websocket`, `routing`, ecc.). Critico per `npm search` discoverability.
  - **`author`** popolato (`Omar Di Marzio`).
  - **`repository`** completo con `directory: "packages/<name>"` (npm best practice multi-package repo: abilita "View on GitHub" pointing direttamente al sub-folder).
  - **`homepage`** unificata a `https://gluezero.org` (era inconsistente fra package).
  - **`bugs`** aggiunto puntando a `https://github.com/omardimarzio/GlueZero/issues`.
  - **`publishConfig.provenance`** rimosso (richiedeva CI environment con OIDC, fallisce da terminale locale; lo riabiliteremo via GitHub Actions in una release futura).

  ## Build pipeline fix

  - Root `pnpm build` ora gestisce correttamente la dipendenza ciclica `routing ↔ gateway` per la generazione DTS (script `build:f3` + sequenziale per pacchetti dipendenti). Prima `pnpm release` falliva con `TS7016`. Solo manutentori del repo sono toccati da questo fix.

  ## Why a patch release

  Niente di funzionale è cambiato. Il codice runtime di v1.0.1 è identico a v1.0.0. La patch esiste esclusivamente per propagare i metadata che migliorano la discoverability su npmjs.com e nei tool che leggono `package.json` (npm registry search, GitHub Dependents UI, bundlephobia, libraries.io, ecc.).

  Se non hai bisogno di metadata aggiornati, rimanere su 1.0.0 è perfettamente OK.

- Updated dependencies
  - @gluezero/core@1.0.1
  - @gluezero/mapper@1.0.1
  - @gluezero/routing@1.0.1
  - @gluezero/gateway@1.0.1
  - @gluezero/worker@1.0.1
  - @gluezero/cache@1.0.1
  - @gluezero/devtools@1.0.1

## 1.0.0

### Major Changes

- 058b2dc: # GlueZero v1.0.0 — Milestone Release

  Prima release pubblica major v1.0.0 di GlueZero: libreria browser-side TypeScript-first per pub/sub, routing, canonical model, server gateway, worker runtime, cache + developer tooling.

  ## Highlights

  - **6 fasi PRD complete**: Core + Mapper + Routing + Realtime + Worker + Cache/Tooling
  - **10/11 open issues PRD §39 closed** (#2 cross-fase pipeline ordering deferred V1.x)
  - **91/91 REQ-IDs Complete**
  - **8 pacchetti pubblicati**: `@gluezero/{core, mapper, routing, gateway, worker, cache, devtools, gluezero}`
  - **Zero deps esterne core** — solo `nanoid` + `valibot` + `comlink` (worker)
  - **ESM-only** + TypeScript declarations
  - **Coverage v8 ≥90/80/90/90** su tutti i package F2-F6 (target floor sopra-rispettato con margini ampi)
  - **3-tier test**: Tier-1 jsdom + Tier-2 MSW + Tier-3 Playwright Chromium reale

  ## Breaking Changes

  Nessuna — prima release pubblica major. V0.x era pre-release alpha (zero consumer pubblici).

  ## What's New (vs Pre-1.0)

  - **Phase 6 Cache & Tooling**: `MemoryCacheAdapter` LRU bounded `maxEntries=1000` (D-158) + scope hybrid D-156/D-157 + cache-then-network ordering microtask (RESEARCH §15.6) + Event Inspector + Route Inspector ring buffer 500 (D-167) + MetricsCollector simil-OpenMetrics + naming `gluezero.<package>.<metric>{<labels>}` Prometheus + reservoir Algorithm R Vitter 1985 (D-165) + cardinality cap 100 (D-166) + PauseController pauseTopic/resumeTopic/flushQueue + critical bypass (D-170) + getDebugSnapshot deep-clone via `structuredClone` (D-162) + tap registry chain MultiplexTap (D-159) + step 14 reale attivato `event.observed` (D-161).
  - **`createGlueZero` aggregato**: chain composition F1+F2+F3+F4+F5+F6 con features opt-out (cache/devtools/worker/realtime).
  - **Phase 5 Worker Runtime**: WorkerRegistry + WorkerPool bounded `min(hwc, 4)` cap 8 + WorkerBridge Comlink + state machine atomico Pitfall 2C closure (D-133) + cancellation hybrid + serialization WK-07.
  - **Phase 4 Realtime SSE/WS**: adapter SSE+WS + reconnection unificata + auto-fallback SSE→WS (D-107) + ping/pong applicativo (D-111) + visibility-aware (D-110).
  - **Phase 3 Routing & Gateway HTTP**: routing engine dichiarativo + gateway HTTP unico + retry/timeout/dedupe/auth/circuit-breaker.
  - **Phase 2 Canonical Mapper**: vocabolario canonico + mapper bidirezionale + Mapping Inspector + transform pipeline.
  - **Phase 1 Core**: broker pub/sub in-page + plugin registry + lifecycle anti-leak + EventTap pre-instrumentato.

  ## Open Issues PRD §39 Closed

  1. **MAP-17** — Precedenza alias automatici vs mapping esplicito → F2 (mapping esplicito vince sempre)
  2. **VAL-08** — Field mancante (errore vs default) → F2
  3. **VAL-09** — Transform failure (skip vs block) → F2
  4. **ROUTE-09** — Retry 4xx vs 5xx → F3 (no retry 4xx eccetto 408/429)
  5. **ROUTE-15** — Più route applicabili → F3 (first-match default + priority-ordered + all)
  6. **ROUTE-16** — Topic senza route → F3 (default consegna locale, opt-in `requiresRoute`)
  7. **LIFE-02** — Unsubscribe automatico in `unregisterPlugin` → F1 (cascade obbligatoria)
  8. **RT-07** — Reconnection rules realtime → F4 (full jitter + Last-Event-ID SSE + ping/pong WS)
  9. **WK-07** — Serializzazione messaggi worker → F5 (`structuredClone` default + `assertSerializable` dev + transferable opt-in)
  10. **TOOL-05** — Format metriche → **F6 (this release)** ✅ — schema simil-OpenMetrics + naming Prometheus + reservoir + cardinality cap

  **Open V1.x roadmap:**

  - #2 — Cross-fase pipeline ordering — deferred V1.x (opt-in quando emergeranno consumer cross-fase reali)

  ## Bundle Size (gz, with all deps)

  | Package              | Size                             |
  | -------------------- | -------------------------------- |
  | `@gluezero/core`     | ~6 KB                            |
  | `@gluezero/mapper`   | ~12 KB                           |
  | `@gluezero/routing`  | ~19 KB                           |
  | `@gluezero/gateway`  | ~6 KB (HTTP) + sse-ws sub-modulo |
  | `@gluezero/worker`   | ~26 KB                           |
  | `@gluezero/cache`    | ~22 KB                           |
  | `@gluezero/devtools` | ~22 KB                           |
  | `@gluezero/gluezero` | ~35 KB                           |

  ## V1.x Roadmap (deferred)

  - `@gluezero/cache-idb` (IndexedDB persistence)
  - `@gluezero/metrics-prometheus` (Prometheus textfile exporter)
  - `@gluezero/metrics-otel` (OpenTelemetry SDK adapter)
  - `superjson` adapter pluggable per worker serialization
  - Custom histogram bucketing per route
  - Anti-flap pause/resume (debounce N ms)
  - Worker retry policy idempotent opt-in
  - Auto-detect transferable heuristic
  - Cross-fase pipeline ordering canonical doc

### Patch Changes

- Updated dependencies [058b2dc]
  - @gluezero/core@1.0.0
  - @gluezero/mapper@1.0.0
  - @gluezero/routing@1.0.0
  - @gluezero/gateway@1.0.0
  - @gluezero/worker@1.0.0
  - @gluezero/cache@1.0.0
  - @gluezero/devtools@1.0.0
