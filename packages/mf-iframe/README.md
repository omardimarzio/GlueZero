# @gluezero/mf-iframe

> Iframe sandbox loader + bridge postMessage (9 message types Valibot strict + LRU dedup 500 + rate-limit 100/s + replay mitigation 30s + expectedOrigin MANDATORY) per micro-frontends GlueZero v2.0.

**Status:** Scaffolding W1 — implementazione W2 Plan 15-03 in corso. README completo prodotto in W3 Plan 15-05.

## Cos'è

Loader concreto F15 che implementa `MicroFrontendLoaderAdapter` con `type: 'iframe'` + closure D-V2-09 BLOCKING (security gates iframe bridge):

- **Valibot strict-only** (D-V2-F15-01) — `v.strictObject()` sui 9 message types (`gz:handshake`, `gz:ready`, `gz:publish`, `gz:subscribe`, `gz:unsubscribe`, `gz:context:get`, `gz:context:update`, `gz:error`, `gz:lifecycle`).
- **LRU dedup 500 per (origin, mfId)** (D-V2-F15-02) — `Map<\`${origin}::${mfId}\`, LRU<messageId, timestamp>>`.
- **Replay mitigation ID + timestamp 30s** (D-V2-F15-03) — dual-defense.
- **Rate limit 100 msg/s per mfId** (D-V2-F15-04) — drop + emit topic `microfrontend.iframe.bridge.rate-limited`.
- **`expectedOrigin` MANDATORY non-optional** (REQ MF-IFRAME-04).
- **`targetOrigin '*'` BANNED** (REQ MF-IFRAME-04) — ESLint custom rule + runtime assert dual-defense.
- **Sandbox baseline** (REQ MF-SEC-01) — default `'allow-scripts'` solo se necessario; NO `allow-same-origin` default.

Sblocca F13 `IframeAdapter.createSandbox(policy, mfId, mount)` contract (`packages/isolation/src/iframe-stub.ts:41-47`).

## Security disclaimer (P-13 governance-not-crypto)

⚠️ L'iframe sandbox è **governance + browser native protection**, NON sandbox crittografica completa (shared origin patterns can leak). Renwa Mar 2026 best practices doc-linked. Vedi PRD §44 + REQ MF-SEC-01..04.

## Subpath `/client` separato (MF-IFRAME-05)

Per code che gira **dentro** l'iframe: `import { ... } from '@gluezero/mf-iframe/client'` — NO broker completo esposto cross-frame.

## Bundle target

- `dist/index.js` ≤ **10 KB gzipped** (D-V2-F15-14 — single largest F15).
- `dist/augment.js` ≤ **1 KB gzipped** (Pattern S1 stretto marker only).
- `dist/client.js` ≤ **3 KB gzipped** (subpath separato).

## Riferimenti

- PRD v2.0 §26 — Iframe Loader + Bridge.
- PRD v2.0 §44 — Security (iframe origin + sandbox + Renwa Mar 2026 + CVE-2024-49038).
- `.planning/phases/15-wc-iframe-module-federation-single-spa-loaders/15-CONTEXT.md` — D-V2-09 closure.
- `.planning/phases/15-wc-iframe-module-federation-single-spa-loaders/15-RESEARCH.md` — Valibot 1.1.0 peer dep.

## Lifecycle stato

- 🚧 W1 (Plan 15-01): scaffolding — package skeleton + tsup 3-entry + size-limit caps + augment + topics literal 4.
- ⏳ W2 (Plan 15-03): implementazione `iframeLoader` + bridge handshake 9-step + Valibot schemas + LRU + rate-limit + `MfIframeError` + IframeAdapter.createSandbox sblocco F13.
- ⏳ W3 (Plan 15-05): Tier-3 Playwright Chromium 2 scenari security + README completo italiano + JSDoc enrichment.

---

**License:** MIT
**Author:** Omar Di Marzio
