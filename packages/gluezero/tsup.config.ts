// tsup.config.ts — build config @gluezero/gluezero aggregato pubblico
// (Phase 6 plan 06-01).
//
// Single entry `src/index.ts` (no augment proprio — l'aggregato è puro
// re-export dei 7 sub-package + factory `createGlueZero`). Plan 06-08 popola
// runtime exports + factory; 06-09 final gate aggiunge README/EXAMPLES (DOC-02 +
// DOC-05).
//
// External: TUTTI i workspace dep + valibot per garantire bundle aggregato
// senza duplicazione (monorepo pnpm + tree-shake consumer-side).

import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'es2022',
  platform: 'browser',
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  external: [
    /^node:/,
    '@gluezero/core',
    '@gluezero/mapper',
    '@gluezero/routing',
    '@gluezero/gateway',
    '@gluezero/worker',
    '@gluezero/cache',
    '@gluezero/devtools',
    // v1.1.0 ext F7 (D-F7-07): peer optional theme — type-only import in source.
    '@gluezero/theme',
    /^@gluezero\/theme\//,
    'valibot',
  ],
  banner: {
    js: '/* @gluezero/gluezero — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
