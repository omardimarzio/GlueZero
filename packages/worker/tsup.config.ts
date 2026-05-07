// tsup.config.ts — build config Phase 5 Worker Runtime (plan 05-01).
//
// Pattern role-match con `packages/gateway/tsup.config.ts`: ESM-only, target ES2022,
// `dts: true` integrato esbuild, `clean: true` pre-build, `treeshake: true` runtime
// imports. F5 ha 2 entries (no subpath come F3+F4 multi-export):
//   - `index: 'src/index.ts'` — barrel pubblico
//   - `augment: 'src/augment.ts'` — declaration merging F5 (Pattern S1 anti tree-shake
//     coperto dal `package.json#sideEffects` glob `**/augment.{ts,js}`)
//
// Riferimenti:
// - 05-CONTEXT.md D-122 (BrokerConfig.workers), D-147 (`type: module`)
// - 05-RESEARCH.md §2.1 (deps lockate), §13 (Pattern S1)
// - 05-PATTERNS.md §"package.json" e §"augment.ts"

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
    '@gluezero/core',
    '@gluezero/mapper',
    '@gluezero/routing',
    '@gluezero/gateway',
    'comlink',
  ],
  banner: {
    js: '/* @gluezero/worker — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
