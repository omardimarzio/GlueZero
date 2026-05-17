import { defineConfig } from 'tsup'

// F15 P01 scaffolding — replica F9 mf-esm + F14 fallbacks pattern, esteso a 3-entry:
// - `index.ts` (loader + bridge core).
// - `augment.ts` (Pattern S1 stretto D-V2-F15-19 marker only).
// - `client.ts` (subpath separato MF-IFRAME-05 — code che gira DENTRO l'iframe; NO broker
//   completo cross-frame).
// - `external` peer: `@gluezero/context` (RuntimeContext serialize cross-frame),
//   `@gluezero/isolation` (IframeAdapter contract F13 sblocco D-V2-F15-21), `valibot`
//   (peer hard — 9 schemas strictObject D-V2-F15-01 NON bundled).
// - `minify: true` (D-V2-F15-14 cap stretto 10 KB gzipped — single largest F15).
export default defineConfig({
  entry: ['src/index.ts', 'src/augment.ts', 'src/client.ts'],
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
    '@gluezero/context',
    '@gluezero/isolation',
    'valibot',
  ],
  banner: {
    js: '/* @gluezero/mf-iframe — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
