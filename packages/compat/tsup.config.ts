import { defineConfig } from 'tsup'

// F12 adaptation vs F11 (permissions):
// - `external` ridotta a triple peer `@gluezero/core` + `@gluezero/microfrontends` + `@gluezero/theme`
//   (F12 NON dipende da `@gluezero/context` — D-12 carryover, compat check è broker-side).
// - `noExternal: ['semver']` CRITICAL — semver 7.7.4 è CJS-only (no `type:"module"`, no `exports` field);
//   senza `noExternal` tsup considera semver come external e i consumer ESM-only sganciano
//   `require('semver')` che fallisce in browser. Force CJS→ESM bundling inline (RESEARCH §3).
// - `define: { __GLUEZERO_VERSION__: ... }` (OQ-5 resolution) — esbuild sostituisce letteralmente
//   ogni occorrenza dell'identifier al build-time. Verifica post-build via `grep "2.0.0" dist/index.js`.
// - `minify: true` (carryover D-V2-F11-19 — bundle cap stretto 9 KB gzipped incluso semver).
// - Multi-entry `index.ts` + `augment.ts` (Pattern S1 side-effect intent signaling stretto
//   carryover D-V2-F11-17 — NO `declare module`, NO `Broker.prototype` patch).
export default defineConfig({
  entry: ['src/index.ts', 'src/augment.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: true,
  target: 'es2022',
  platform: 'browser',
  external: [/^node:/, '@gluezero/core', '@gluezero/microfrontends', '@gluezero/theme'],
  // F12-SPECIFIC v2.0 divergenze vs F11 analog:
  noExternal: ['semver'], // semver 7.7.4 è CJS-only: force CJS→ESM bundling inline (RESEARCH §3)
  define: {
    // OQ-5 resolution — build-time injection di __GLUEZERO_VERSION__ via esbuild define.
    // Default '2.0.0' per development locale; CI override via env var GLUEZERO_VERSION (changesets).
    __GLUEZERO_VERSION__: JSON.stringify(process.env.GLUEZERO_VERSION ?? '2.0.0'),
  },
  banner: {
    js: '/* @gluezero/compat — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
