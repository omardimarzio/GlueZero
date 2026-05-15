import { defineConfig } from 'tsup'

// F15 P01 scaffolding — replica F9 mf-esm + F14 fallbacks pattern:
// - Multi-entry `index.ts` + `augment.ts` per emettere `dist/augment.js` distinto
//   (referenziato da `sideEffects` nel package.json — Pattern S1 stretto D-V2-F15-19).
// - `external` peer optional `@gluezero/context` (RuntimeContext type per contextMode dispatch D-V2-F15-05).
// - `minify: true` (D-V2-F15-14 cap stretto 3 KB gzipped).
// - `target: 'es2022'` + `platform: 'browser'` (CustomElements API native).
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
  external: [/^node:/, '@gluezero/core', '@gluezero/microfrontends', '@gluezero/context'],
  banner: {
    js: '/* @gluezero/mf-web-component — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
