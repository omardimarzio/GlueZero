// vitest.config.ts — Tier-1 jsdom test runner Phase 6 Devtools (plan 06-01).
//
// Pattern role-match con `packages/cache/vitest.config.ts` + worker. F6 devtools
// esegue:
//   - Tier-1 (jsdom) — tutti i `*.test.ts` non in `__browser__/**` (decl merging,
//     MultiplexTap, Inspector ring buffer, MetricsCollector reservoir, PauseController).
//   - Tier-3 (Playwright Chromium real-browser) — file in `__browser__/**` via
//     `vitest.browser.config.ts`. V1 scope: smoke structuredClone deep-clone perf.
//
// Coverage v8 thresholds Wave 1: 90/80/90/90 (placeholder; calibration finale in
// 06-09a). `passWithNoTests` permette esecuzione Wave 1 (solo type files +
// augment + decl merging smoke).
//
// Riferimenti:
// - 06-CONTEXT.md D-149/D-150 carryover
// - 06-RESEARCH.md §1 + §17.2 file ownership

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@sembridge/devtools',
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts', 'src/__integration__/**/*.test.ts'],
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
      // Misurato post-implementation W1..W4: 96.44 / 89.28 / 94.36 / 96.98.
      // Thresholds calibrate al floor measurato arrotondato per difetto al 0.5%
      // (analog F4 04-09 commit 761e4ad + F5 05-07 commit 1347d0b pattern).
      // Hard floor inderogabile target ≥90/80/90/90 — tutti rispettati con margini ampi
      // (+5.94 / +8.78 / +3.86 / +6.48).
      thresholds: {
        statements: 95.94,
        branches: 88.78,
        functions: 93.86,
        lines: 96.48,
      },
    },
    typecheck: {
      enabled: false,
    },
  },
})
