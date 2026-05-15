# @gluezero/mf-single-spa

> single-spa lifecycle adapter (bootstrap/mount/unmount mapping) per micro-frontends GlueZero v2.0.

**Status:** 🚧 **Experimental @0.x.0 — D-V2-23 lockato V2.0 GA. GA promotion deferred V2.1.**

Scaffolding W1 — implementazione W2 Plan 15-04 in corso. README completo prodotto in W3 Plan 15-05.

## Cos'è

Loader concreto F15 che implementa `MicroFrontendLoaderAdapter` con `type: 'single-spa'`:

- **Peer dep `single-spa@^5.9.0 || ^6.0.0`** (D-V2-F15-11) — massima adozione 2026 senza fragmentation (5.9 LTS + 6.x current).
- **Lifecycle mapping**: `single-spa.bootstrap → MicroFrontendRuntimeModule.bootstrap`, `single-spa.mount → mount`, `single-spa.unmount → unmount`.
- **NO router replacement** (REQ MF-SS-01) — GlueZero non sostituisce single-spa routing.
- **Topic emission**: pubblica eventi GlueZero su mount/unmount/error via broker reference da `LoaderContext.broker`.
- **4 error codes literal union**: `MF_SS_LIFECYCLE_INVALID`, `MF_SS_BOOTSTRAP_FAILED`, `MF_SS_MOUNT_FAILED`, `MF_SS_UNMOUNT_FAILED`.

## Scope V2.0 GA

- ✅ Top-level lifecycle (`bootstrap`/`mount`/`unmount`).
- ⏳ Parcels API (`mountParcel`, `applyMounted`) deferred V2.1 (REQ MF-SS-01 limita a top-level — parcels surface complessa).

## Bundle target

- `dist/index.js` ≤ **3 KB gzipped** (D-V2-F15-14).
- `dist/augment.js` ≤ **1 KB gzipped** (Pattern S1 stretto marker only).

## Riferimenti

- PRD v2.0 §27 — single-spa Adapter.
- `.planning/phases/15-wc-iframe-module-federation-single-spa-loaders/15-CONTEXT.md` — D-V2-F15-11.
- `.planning/phases/15-wc-iframe-module-federation-single-spa-loaders/15-RESEARCH.md` — single-spa 6.0.3 stable.

## Lifecycle stato

- 🚧 W1 (Plan 15-01): scaffolding — package skeleton + tsup multi-entry + size-limit caps + augment.
- ⏳ W2 (Plan 15-04): implementazione `singleSpaLoader` + `MfSingleSpaError` + lifecycle mapping + topic emit.
- ⏳ W3 (Plan 15-05): Tier-3 Playwright Chromium 2 scenari + README completo italiano.

---

**License:** MIT
**Author:** Omar Di Marzio
