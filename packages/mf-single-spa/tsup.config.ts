import { defineConfig } from 'tsup'

// F15 P01 scaffolding — replica F9 mf-esm + F14 fallbacks pattern:
// - Multi-entry `index.ts` + `augment.ts` per emettere `dist/augment.js` distinto
//   (Pattern S1 stretto D-V2-F15-19).
// - `external` peer optional `single-spa` (range ^5.9.0 || ^6.0.0 D-V2-F15-11
//   massima adozione 2026 senza fragmentation).
// - `minify: true` (D-V2-F15-14 cap stretto 3 KB gzipped).
// - `publishConfig.tag: experimental` (D-V2-23 lockato @0.x.0 V2.0 GA).
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
  external: [/^node:/, '@gluezero/core', '@gluezero/microfrontends', 'single-spa'],
  banner: {
    js: '/* @gluezero/mf-single-spa — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
