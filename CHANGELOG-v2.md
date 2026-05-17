# GlueZero v2.0.0 — General Availability

**Release date:** 2026-05-17

**Milestone:** Microfrontend Governance Layer + Framework Adapters — 10 fasi v2.0 (F8-F17) complete, 132 REQ-IDs chiusi, 16 package npm pubblicati su registry pubblico.

Backward compatibility v1.x preservata bit-exact (BC §42 14 API + MF-PIPE-01 pipeline §28 ordine letterale). `createBroker({})` continua a funzionare semantica v1.x — zero breaking change per consumer esistenti che non adottano i nuovi moduli.

---

## Highlights

### Framework Adapters NEW

- **`@gluezero/react`** — React adapter completo:
  - `<GlueZeroProvider broker mfContext?>` Provider singolo con 2 React.Context separati internamente (BrokerCtx + MfCtx)
  - 6 hooks: `useGlueZero`, `useGlueZeroPublish`, `useGlueZeroSubscribe`, `useRuntimeContext`, `useMicroFrontendContext`, `useGlueZeroBroker`
  - `createReactMicroFrontendLifecycle(Component, options?)` factory compatibile `MicroFrontendRuntimeModule` F8
  - `<GlueZeroErrorBoundary>` class component built-in (pubblica `microfrontend.runtime.failed` + delega a `SERVICE_FALLBACKS` F14)
  - React 19 StrictMode coalescing pattern (carryover D-F7-04 v1.1)
  - Peer optional `react`+`react-dom` `>=18.2.0 <20.0.0`
  - **Bundle:** 1.53 KB gzipped (cap 10 KB)

- **`@gluezero/web-components`** — Web Components adapter:
  - `GlueZeroElement` base class opzionale
  - Cleanup automatico via `AbortController + signal` (delegato a `disconnectedCallback`)
  - Helper context wiring (`glueZeroBroker`/`glueZeroContext` property assignment + setter trigger)
  - `this.publish` / `this.subscribe` instance method shortcuts con auto-iniezione `signal` + `metadata.microFrontendId`
  - **Subpath `@gluezero/web-components/lit`** two-tier:
    - `GlueZeroController` (Lit `ReactiveController` 3.x)
    - `GlueZeroLitMixin<Base extends LitElement>(Base)` mixin ergonomico
  - Peer optional `lit: >=3.0.0 <4.0.0`
  - **Bundle:** 609 B gzipped (cap 8 KB) + `/lit` 480 B (cap 3 KB)

### Microfrontend Governance Stack (F8-F16)

- **Canonical Model esteso v2.0** (`@gluezero/core` + `@gluezero/microfrontends` + `@gluezero/mapper` + `@gluezero/context`):
  - MicroFrontendRegistry + RuntimeContext + 29 standard topics F8
  - `createBroker({})` rimane semantica v1.x bit-exact (zero breaking change Livello A)
  - `createBroker({modules:[microFrontendModule()]})` abilita MF governance opt-in (Livello B)
  - Bundle delta ≤ +350 B (D-V2-21 PASS)

- **ESM Loader** (`@gluezero/mf-esm`) — Dynamic import + lifecycle FSM mount/unmount/destroy + governance integration.

- **Production Governance Stack** (`@gluezero/permissions` + `@gluezero/compat` + `@gluezero/isolation` + `@gluezero/fallbacks`):
  - Permission topic ACL
  - Compat policy matrix (block-mount/warn/allow)
  - Shadow-DOM isolation
  - ErrorBoundary fallback Service Locator pattern

- **4 Loaders experimental** (`@gluezero/mf-{web-component,iframe,module-federation,single-spa}`):
  - Enterprise multi-team multi-MF SaaS support
  - WC + iframe (bridge handshake) + Module Federation + single-spa adapter

- **DevTools** (`@gluezero/devtools`):
  - `mfInspectorModule()` MIN-3 SnapshotProvider Registry
  - 14 metriche per-MF (`gluezero.mfs.*` namespace)
  - Subpath `/mf-inspector` per Inspector + Metrics module

### Documentation

- **18 documenti PRD §41** in `docs/v2/` (architettura, core vs MF, descriptor, lifecycle, loaders, isolation, context, permissions, capabilities, compat/versioning, fallback, devtools, esempi ESM/WC/iframe/React, migration guide, performance)
- **2 README italiano adapter** (react + web-components) 13 sezioni
- **Migration guide adoption levels A/B/C** (`docs/v2/17-migration-guide.md`):
  - **Livello A** — Zero-change v1.x bit-exact semantics
  - **Livello B** — Opt-in MF basic (microFrontendModule + 1 loader)
  - **Livello C** — Production governance full F8-F17 stack
- **`examples/customer-dashboard/`** golden showcase end-to-end (1 host + 3 MF mixed React/WC/iframe + 5 governance modules + walkthrough A→B→C)
- **6 examples HTML CDN standalone** in `examples/microfrontends/` (mf-esm-basic, mf-shadow-dom, mf-iframe-sandbox, mf-permissions-demo, mf-react-adapter, mf-compat-matrix)
- **TypeDoc + typedoc-plugin-markdown 4.9** GitHub Pages auto-deploy: `gluezero.github.io/v2/`

### Quality Gates

- **Backward Compatibility §42 14 API v1.x** preservate bit-exact — 273/276 PASS (3 skipped expected baseline)
- **MF-PIPE-01 pipeline §28 ordine letterale** preservato cross-fase F8-F17 — 273/276 PASS
- **Bench tinybench CI hard gate** (P-02 mitigation):
  - Scenario A (no modules): -0.46% vs baseline (cap 5%)
  - Scenario B (module installed, no MF active): -1.93% vs baseline (cap 10%)
- **D-83 strict octuple esteso F17** — 19 git diff checks ALL-ZERO (zero modifications to existing 20 packages source code)
- **Tier discipline closure** — 17 unit categorie + 15 integration scenari (12 PRD §40.2 carryover + 3 NEW React Tier-3 Playwright Chromium) + bench harness
- **70 Tier-1 jsdom test NEW F17** (33 React + 37 WC) + 3 Tier-3 Playwright Chromium React-specific
- **publint + attw** clean su tutti i 16 package (ESM-only profile)

---

## Breaking changes

**Nessuno** per Livello A (`createBroker({})` bit-exact v1.x). I 16 package vengono bumped major per allinearsi alla nuova milestone GA + Canonical Model esteso v2.0 (semantica module-aware), ma BC §42 garantisce API v1.x preservation.

Major bump rationale per-package:
- **core / mapper / microfrontends / context**: API extends con module-aware semantics + MF registry + RuntimeContext (BC §42 14 API preserved).
- **devtools**: extends con `mfInspectorModule()` + subpath `/mf-inspector` + 14 metriche MF (debug-snapshot-shape + get-metrics-shape D-V2-19 preserved).
- **mf-esm + permissions + compat + isolation + fallbacks + mf-{wc,iframe,mf,ss}**: NEW packages v2.0 (pre-bumped `2.0.0-alpha.0` durante development F8-F15).
- **react + web-components**: NEW packages v2.0 framework adapters (F17 W2/W3).

---

## Migration v1.x → v2.0

**Livello A — Stay on v1.x semantics (Zero-change):**
```js
// v1.x
import { createBroker } from '@gluezero/core'
const broker = createBroker({})

// v2.0 (NO modules → bit-exact v1.x)
import { createBroker } from '@gluezero/core'
const broker = createBroker({})
// → API publish/subscribe/registerPlugin/... preservate bit-exact (BC §42)
```

**Livello B — Opt-in MF basic:**
```js
import { createBroker } from '@gluezero/core'
import { microFrontendModule } from '@gluezero/microfrontends'
import { esmLoader } from '@gluezero/mf-esm'

const broker = createBroker({
  modules: [microFrontendModule({ loaders: [esmLoader()] })]
})

broker.registerMicroFrontend({
  id: 'my-mf',
  loader: { type: 'esm', url: '/mf/main.js' },
  mount: { target: '#mf-slot' }
})
```

**Livello C — Production governance full:**
```js
import { createBroker } from '@gluezero/core'
import { microFrontendModule } from '@gluezero/microfrontends'
import { permissionsModule } from '@gluezero/permissions'
import { compatModule } from '@gluezero/compat'
import { isolationModule } from '@gluezero/isolation'
import { fallbacksModule } from '@gluezero/fallbacks'
import { mfInspectorModule } from '@gluezero/devtools/mf-inspector'
import { esmLoader } from '@gluezero/mf-esm'
import { wcLoader } from '@gluezero/mf-web-component'
import { iframeLoader } from '@gluezero/mf-iframe'

const broker = createBroker({
  modules: [
    microFrontendModule({ loaders: [esmLoader(), wcLoader(), iframeLoader()] }),
    permissionsModule(),
    compatModule(),
    isolationModule(),
    fallbacksModule(),
    mfInspectorModule()
  ]
})
```

Per dettagli completi (incluso React + WC adapter integration), vedi [`docs/v2/17-migration-guide.md`](./docs/v2/17-migration-guide.md) e [`examples/customer-dashboard/README.md`](./examples/customer-dashboard/README.md).

---

## Packages

| Package | Version | Type |
|---------|---------|------|
| `@gluezero/core` | 2.0.0 | Bumped (BC §42 preserved) |
| `@gluezero/microfrontends` | 2.0.0 | NEW (v2.0 init) |
| `@gluezero/mapper` | 2.0.0 | Bumped (BC §42 preserved) |
| `@gluezero/context` | 2.0.0 | NEW (v2.0 init) |
| `@gluezero/mf-esm` | 2.0.0 | NEW (v2.0 init) |
| `@gluezero/mf-web-component` | 2.0.0 | NEW (v2.0 init) |
| `@gluezero/mf-iframe` | 2.0.0 | NEW (v2.0 init) |
| `@gluezero/mf-module-federation` | 2.0.0 | NEW (v2.0 init, experimental) |
| `@gluezero/mf-single-spa` | 2.0.0 | NEW (v2.0 init, experimental) |
| `@gluezero/permissions` | 2.0.0 | NEW (v2.0 init) |
| `@gluezero/compat` | 2.0.0 | NEW (v2.0 init) |
| `@gluezero/isolation` | 2.0.0 | NEW (v2.0 init) |
| `@gluezero/fallbacks` | 2.0.0 | NEW (v2.0 init) |
| `@gluezero/devtools` | 2.0.0 | Bumped (mfInspectorModule + 14 metriche) |
| `@gluezero/react` | 2.0.0 | NEW (F17) |
| `@gluezero/web-components` | 2.0.0 | NEW (F17) + subpath `/lit` |

**Frozen v1.x (NON pubblicati questa release):** `@gluezero/cache@1.0.2`, `@gluezero/gateway@1.0.2`, `@gluezero/routing@1.0.2`, `@gluezero/worker@1.0.2`, `@gluezero/theme@1.1.0`, `@gluezero/gluezero@1.1.0` (aggregator).

---

## Deferred (V2.1 cycle)

- Vue / Svelte / Angular / Solid framework adapters (D-V2-24 deferred V2.1)
- React `use()` + Suspense pattern integration (deferred V2.1)
- React `hydrateRoot` SSR support (deferred V2.1)
- `useGlueZeroValue` 7° hook latest-value reactive (`useSyncExternalStore`-based, deferred V2.1)
- DevTools Chrome extension panel + IndexedDB persistent ring buffer (deferred V2.1)
- i18n docs bilingue inglese (deferred V2.1)
- Module Federation hostMap dynamic remote + single-spa lifecycle wrap completi (deferred V2.1)

---

## Acknowledgments

GlueZero v2.0.0 development: 10 milestones, 132 REQ-IDs, ~58 plans executed, ~280 commits, ~70 days work. Built with `claude-opus-4-7-1` as primary AI development partner.

Per dettagli architetturali completi, vedi [`docs/v2/`](./docs/v2/) e [`prd_2.0.0.md`](./prd_2.0.0.md).
