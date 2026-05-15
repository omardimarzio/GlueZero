import { defineConfig } from 'tsup'

// F15 P01 scaffolding — replica F9 mf-esm + F14 fallbacks pattern:
// - Multi-entry `index.ts` + `augment.ts` per emettere `dist/augment.js` distinto
//   (Pattern S1 stretto D-V2-F15-19).
// - `external` peer optional `@module-federation/runtime` (range >=2.0.0 <3.0.0
//   ratified — research finding stabile 2.4.x Mar 2026; D-V2-F15-09 webpack-only V2.0 GA).
// - `minify: true` (D-V2-F15-14 cap stretto 5 KB gzipped).
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
  external: [
    /^node:/,
    '@gluezero/core',
    '@gluezero/microfrontends',
    '@module-federation/runtime',
  ],
  banner: {
    js: '/* @gluezero/mf-module-federation — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
