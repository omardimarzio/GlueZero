// tsup.config.ts — build config Phase 6 Devtools (plan 06-01).
//
// Pattern role-match con `packages/cache/tsup.config.ts` + `packages/worker/tsup.config.ts`.
// ESM-only, target ES2022, `dts: true` integrato esbuild, `clean: true`,
// `treeshake: true`. F6 devtools ha 2 entries (analog F6 cache):
//   - `index: 'src/index.ts'` — barrel pubblico (Inspector + Metrics + PauseController)
//   - `augment: 'src/augment.ts'` — declaration merging F6 (Pattern S1 anti tree-shake
//     coperto dal `package.json#sideEffects` glob `**/augment.{ts,js}`)
//
// Riferimenti:
// - 06-CONTEXT.md D-159..D-170 + D-83 strict carryover
// - 06-RESEARCH.md §5 (tap registry) + §7 (MetricsCollector) + §10 (pauseTopic)

import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    augment: 'src/augment.ts',
    // F7 plan 07-09 W5a — subpath additivo `@gluezero/devtools/theme-inspector` (D-F7-04).
    // Source in NUOVA sub-folder `packages/devtools/src/theme-inspector/`; zero
    // modifiche a `packages/devtools/src/index.ts` (D-83 strict carryover esteso).
    'theme-inspector/index': 'src/theme-inspector/index.ts',
    // F16 plan 16-01 W1 P01 — subpath additivo `@gluezero/devtools/mf-inspector` (D-V2-F16-19).
    // Source in NUOVA sub-folder `packages/devtools/src/mf-inspector/`. W1 placeholder
    // (`export {}`); W2 P02 contiene `mfInspectorModule` factory + aggregator reale.
    'mf-inspector/index': 'src/mf-inspector/index.ts',
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
    // F7 plan 07-09 — peer optional, lazy import dal subpath theme-inspector.
    '@gluezero/theme',
  ],
  banner: {
    js: '/* @gluezero/devtools — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
