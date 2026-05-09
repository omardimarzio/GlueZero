// tsup.config.ts — build config Phase 7 UI Standardization (plan 07-01).
//
// Pattern role-match con `packages/cache/tsup.config.ts`: ESM-only, target ES2022,
// `dts: true` integrato esbuild, `clean: true` pre-build, `treeshake: true`.
// F7 theme ha 1 entry pubblica + asset CSS copiato via `onSuccess`:
//   - `index: 'src/index.ts'` — barrel pubblico (W1 surface)
//   - `tokens-default.css` — copiato as-is da workspace root a dist/ (Pitfall 8 mitigation)
//
// Riferimenti:
// - 07-CONTEXT.md D-F7-22 + D-83 strict carryover esteso
// - 07-RESEARCH.md sezione "Pattern 5: tsup Multi-Entry + onSuccess CSS Copy"
// - 07-01-PLAN.md Task 1 action 3

import { copyFile } from 'node:fs/promises'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    // Subpath additivo (D-F7-04): le descrizioni IT dei 14 ruoli canonici
    // sono importate solo da consumer Inspector/docs (W5a) — NON gravano
    // il bundle runtime principale (07-06-PLAN.md bundle mitigation).
    'standard-role-definitions': 'src/standard-role-definitions.ts',
    // Subpath additivi (D-F7-04): le strategie A (DomApplier, MutationObserver +
    // ClassesTracker batched) e B (StyleSheetGenerator, <style>@layer adapter)
    // sono opt-in. Consumer importa solo quella che usa, e classFor (Strategia C
    // escape hatch ~50 B) resta nel barrel come default minimal-cost.
    // Bundle savings ~1.7 KB gzipped (07-07-PLAN.md bundle mitigation per
    // restare entro cap 6 KB con W3.3).
    'dom-applier': 'src/dom-applier.ts',
    'stylesheet-generator': 'src/stylesheet-generator.ts',
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
  external: [/^node:/, '@gluezero/core', '@gluezero/mapper'],
  banner: {
    js: '/* @gluezero/theme — MIT — https://github.com/omardimarzio/GlueZero */',
  },
  async onSuccess() {
    // Pitfall 8 mitigation: copia asset CSS as-is post-build.
    // Tier-1 test `build-artifacts.test.ts` verifica esistenza dist/tokens-default.css.
    await copyFile('tokens-default.css', 'dist/tokens-default.css')
  },
})
