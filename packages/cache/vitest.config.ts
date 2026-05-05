// vitest.config.ts — Tier-1 jsdom test runner Phase 6 Cache (plan 06-01).
//
// Pattern role-match con `packages/worker/vitest.config.ts`. F6 cache esegue:
//   - Tier-1 (jsdom) — tutti i `*.test.ts` non in `__browser__/**` (decl merging,
//     LRU eviction logic, stable hash, cache handler).
//   - Tier-3 (Playwright Chromium real-browser) — file in `__browser__/**` via
//     `vitest.browser.config.ts`. Wave 4 attiverà smoke test cache-then-network.
//
// Coverage v8 thresholds Wave 1: 90/80/90/90 (statements/branches/functions/lines)
// post-implementation calibration in plan 06-09a final gate F6 (lesson learned F4-F5).
// Wave 1 ha solo type files + augment + decl merging smoke — `passWithNoTests`
// permette esecuzione senza tests runtime.
//
// Riferimenti:
// - 06-CONTEXT.md D-149 carryover (TDD RED→GREEN co-located)
// - 06-RESEARCH.md §1 + §17.2 file ownership Wave 1

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@sembridge/cache',
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts', 'src/__integration__/**/*.test.ts'],
    // Esclude Tier-3 Playwright dal Tier-1 jsdom run.
    exclude: ['node_modules', 'dist', '**/__browser__/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/augment.ts',
        'src/types/**',
        'src/test-utils/**',
        'src/__browser__/**',
      ],
      // Wave 1 placeholder thresholds. Calibration finale in 06-09a (lesson
      // learned F4-F5: misurare floor post-impl, arrotondare per difetto al 0.5%).
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 90,
        lines: 90,
      },
    },
    typecheck: {
      enabled: false,
    },
  },
})
