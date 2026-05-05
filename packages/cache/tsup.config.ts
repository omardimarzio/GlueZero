// tsup.config.ts — build config Phase 6 Cache layer (plan 06-01).
//
// Pattern role-match con `packages/worker/tsup.config.ts`: ESM-only, target ES2022,
// `dts: true` integrato esbuild, `clean: true` pre-build, `treeshake: true` runtime
// imports. F6 cache ha 2 entries (analog F5 worker):
//   - `index: 'src/index.ts'` — barrel pubblico
//   - `augment: 'src/augment.ts'` — declaration merging F6 (Pattern S1 anti tree-shake
//     coperto dal `package.json#sideEffects` glob `**/augment.{ts,js}`)
//
// Riferimenti:
// - 06-CONTEXT.md D-155/D-156/D-158/D-83 strict carryover
// - 06-RESEARCH.md §1 + §16.1 budget proposta
// - 06-PATTERNS.md §"packages/cache/tsup.config.ts" (analog F5 worker pattern map)

import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    augment: 'src/augment.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: false,
  target: 'es2022',
  platform: 'browser',
  external: [
    /^node:/,
    '@sembridge/core',
    '@sembridge/mapper',
    '@sembridge/routing',
    '@sembridge/gateway',
  ],
  banner: {
    js: '/* @sembridge/cache — MIT — https://github.com/<TBD>/sembridge */',
  },
})
