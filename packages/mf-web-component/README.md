# @gluezero/mf-web-component

> Web Component (Custom Elements) ESM loader per micro-frontends GlueZero v2.0.

**Status:** Scaffolding W1 — implementazione W2 Plan 15-02 in corso. README completo prodotto in W3 Plan 15-05.

## Cos'è

Loader concreto F15 che implementa `MicroFrontendLoaderAdapter` con `type: 'web-component'`. Permette di registrare un MF come Custom Element ESM-only:

- `customElements.whenDefined(elementName)` + `AbortSignal.timeout(15000ms)` carryover F9 D-V2-F9-01.
- Default `contextMode: 'property'` (D-V2-F15-05) — `element.glueZeroContext = ctx` JS property assignment.
- ESM-only via `import(url)` (D-V2-F15-07) — side-effect `customElements.define()` durante module evaluation.
- Reuse-on-collision (D-V2-F15-08) — catch DOMException 'already defined' + `console.warn` + procede con `customElements.get(elementName)`.

## Bundle target

- `dist/index.js` ≤ **3 KB gzipped** (D-V2-F15-14).
- `dist/augment.js` ≤ **1 KB gzipped** (Pattern S1 stretto marker only).

## Riferimenti

- PRD v2.0 §25 — Web Component Loader.
- `.planning/phases/15-wc-iframe-module-federation-single-spa-loaders/15-CONTEXT.md` — decisioni F15.
- `.planning/phases/15-wc-iframe-module-federation-single-spa-loaders/15-RESEARCH.md` — peer dep version pins.
- `D-V2-F15-05/06/07/08/12/19` — decisioni applicate.

## Lifecycle stato

- 🚧 W1 (Plan 15-01): scaffolding — package skeleton + tsup multi-entry + size-limit caps + augment Pattern S1.
- ⏳ W2 (Plan 15-02): implementazione `webComponentLoader` + `MfWebComponentError` + contextMode dispatch.
- ⏳ W3 (Plan 15-05): Tier-3 Playwright Chromium 2 scenari + README completo italiano + JSDoc enrichment.

---

**License:** MIT
**Author:** Omar Di Marzio
