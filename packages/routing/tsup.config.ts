import { defineConfig } from 'tsup'

export default defineConfig({
  // `src/augment.ts` è una entry separata per emettere `dist/augment.js` come file
  // distinto — necessario perché `sideEffects: ["./dist/augment.js"]` nel package.json
  // referenzia esattamente questo path. Il barrel `src/index.ts` importa il modulo
  // come side-effect (`import './augment'`); l'augmentation TypeScript declaration
  // merging si attiva al tipo-livello quando il consumer importa da `@gluezero/routing`
  // (D-83/D-93/D-94/D-95). Pattern identico a `packages/mapper/tsup.config.ts`.
  entry: ['src/index.ts', 'src/augment.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: false,
  target: 'es2022',
  platform: 'browser',
  external: [/^node:/, '@gluezero/core', '@gluezero/mapper'],
  banner: {
    js: '/* @gluezero/routing — MIT — https://github.com/<TBD>/gluezero */',
  },
})
