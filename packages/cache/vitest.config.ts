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
      // Wave 5a calibration (plan 06-09a final gate F6):
      // Misurato post-implementation W1..W4: 100 / 94.21 / 100 / 100.
      // Thresholds calibrate al floor measurato arrotondato per difetto al 0.5%
      // (analog F4 04-09 commit 761e4ad + F5 05-07 commit 1347d0b pattern).
      // Hard floor inderogabile target ≥90/80/90/90 — tutti rispettati con margini ampi.
      thresholds: {
        statements: 99.5,
        branches: 93.5,
        functions: 99.5,
        lines: 99.5,
      },
    },
    typecheck: {
      enabled: false,
    },
  },
})
