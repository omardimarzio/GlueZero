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
      // Wave 1 placeholder thresholds. Calibration finale in 06-09a.
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
