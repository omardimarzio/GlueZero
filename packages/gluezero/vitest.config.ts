// vitest.config.ts — Tier-1 jsdom test runner @gluezero/gluezero aggregato
// (Phase 6 plan 06-01).
//
// Wave 1 placeholder: il pacchetto è puro re-export aggregato — no test runtime
// in questa fase. Wave 4 (plan 06-08) aggiungerà smoke `createGlueZero` e
// 06-09 aggiunge integration end-to-end.
//
// `passWithNoTests` evita errori durante Wave 1.

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@gluezero/gluezero',
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/types/**'],
      // Wave 5a calibration (plan 06-09a final gate F6):
      // Misurato post-implementation W1..W4: 100 / 100 / 100 / 100 (subset
      // ridotto: solo `createGlueZero` factory + smoke Phase 6 chain).
      // Thresholds calibrate al floor measurato arrotondato per difetto al 0.5%
      // (analog F4 04-09 + F5 05-07 pattern).
      // Hard floor inderogabile target ≥90/80/90/90 — tutti rispettati con margini ampi.
      thresholds: {
        statements: 99.5,
        branches: 99.5,
        functions: 99.5,
        lines: 99.5,
      },
    },
    typecheck: {
      enabled: false,
    },
  },
})
