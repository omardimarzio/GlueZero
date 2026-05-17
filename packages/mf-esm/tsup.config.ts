import { defineConfig } from 'tsup'

export default defineConfig({
  // `src/augment.ts` è una entry separata per emettere `dist/augment.js` come file
  // distinto — necessario perché `sideEffects: ["./dist/augment.js"]` nel package.json
  // referenzia esattamente questo path. Il barrel `src/index.ts` importa il modulo
  // come side-effect (`import './augment'`).
  //
  // F9 adaptation vs F8 microfrontends:
  // - `minify: true` (D-V2-F9-18 cap stretto 3 KB gzipped — strip whitespace e comments)
  // - `external` estesa a `@gluezero/microfrontends` (peerDep optional, NON bundlato)
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
  external: [/^node:/, '@gluezero/core', '@gluezero/microfrontends'],
  banner: {
    js: '/* @gluezero/mf-esm — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
