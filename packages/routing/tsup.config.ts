import { defineConfig } from 'tsup'

export default defineConfig({
  // `src/augment.ts` (plan 03-03) sarà una entry separata per emettere `dist/augment.js`
  // come file distinto — necessario perché `sideEffects: ["./dist/augment.js"]` nel
  // package.json referenzia esattamente questo path. Il barrel `src/index.ts` importerà
  // il modulo come side-effect (`import './augment'`); l'augmentation TypeScript
  // declaration merging si attiva al tipo-livello quando il consumer importa da
  // `@sembridge/routing`.
  //
  // Phase 3 plan 03-01 (skeleton) emette solo `index`. Plan 03-03 aggiungerà
  // `'src/augment.ts'` alla entry list.
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: false,
  target: 'es2022',
  platform: 'browser',
  external: [/^node:/, '@sembridge/core', '@sembridge/mapper'],
  banner: {
    js: '/* @sembridge/routing — MIT — https://github.com/<TBD>/sembridge */',
  },
})
