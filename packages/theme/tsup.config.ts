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
