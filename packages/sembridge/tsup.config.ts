// tsup.config.ts — build config @sembridge/sembridge aggregato pubblico
// (Phase 6 plan 06-01).
//
// Single entry `src/index.ts` (no augment proprio — l'aggregato è puro
// re-export dei 7 sub-package + factory `createSemBridge`). Plan 06-08 popola
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
    '@sembridge/core',
    '@sembridge/mapper',
    '@sembridge/routing',
    '@sembridge/gateway',
    '@sembridge/worker',
    '@sembridge/cache',
    '@sembridge/devtools',
    'valibot',
  ],
  banner: {
    js: '/* @sembridge/sembridge — MIT — https://github.com/<TBD>/sembridge */',
  },
})
