# @gluezero/mf-module-federation

> Module Federation loader (webpack 5 + `@module-federation/runtime` v0.x) per micro-frontends GlueZero v2.0.

**Status:** 🚧 **Experimental @0.x.0 — D-V2-23 lockato V2.0 GA. GA promotion deferred V2.1.**

Scaffolding W1 — implementazione W2 Plan 15-04 in corso. README completo prodotto in W3 Plan 15-05.

## Cos'è

Loader concreto F15 che implementa `MicroFrontendLoaderAdapter` con `type: 'module-federation'`:

- **webpack-only V2.0 GA** (D-V2-F15-09) — `remoteEntry.js` formato webpack 5 + `@module-federation/runtime` v0.x API (`init({remotes})` + `loadRemote(scope/module)`).
- **Share scope conflict — warn + proceed** (D-V2-F15-10) — emit topic `microfrontend.mf.share.version-mismatch` + procede usando shared host.
- **5 error codes literal union** (REQ MF-MF-02): `MF_REMOTE_ENTRY_LOAD_FAILED`, `MF_REMOTE_SCOPE_NOT_FOUND`, `MF_REMOTE_MODULE_NOT_FOUND`, `MF_REMOTE_FACTORY_FAILED`, `MF_SHARE_SCOPE_FAILED`.

## Build tool support V2.0 GA

- ✅ webpack 5 (reference implementation 2026).
- ⏳ rsbuild (deferred V2.1 — `mf-manifest.json` formato leggermente diverso).
- ⏳ vite Module Federation plugin (deferred V2.1 — community matura ma fragmented).

## Bundle target

- `dist/index.js` ≤ **5 KB gzipped** (D-V2-F15-14).
- `dist/augment.js` ≤ **1 KB gzipped** (Pattern S1 stretto marker only).

## Riferimenti

- PRD v2.0 §24 — Module Federation Loader.
- `.planning/phases/15-wc-iframe-module-federation-single-spa-loaders/15-CONTEXT.md` — D-V2-F15-09/10.
- `.planning/phases/15-wc-iframe-module-federation-single-spa-loaders/15-RESEARCH.md` — `@module-federation/runtime >=2.0.0 <3.0.0`.

## Lifecycle stato

- 🚧 W1 (Plan 15-01): scaffolding — package skeleton + tsup multi-entry + size-limit caps + augment + topics literal 1.
- ⏳ W2 (Plan 15-04): implementazione `moduleFederationLoader` + `MfModuleFederationError` + share scope warn.
- ⏳ W3 (Plan 15-05): Tier-3 Playwright Chromium 2 scenari + README completo italiano.

---

**License:** MIT
**Author:** Omar Di Marzio
