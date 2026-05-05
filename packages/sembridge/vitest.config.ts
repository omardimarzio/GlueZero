// vitest.config.ts — Tier-1 jsdom test runner @sembridge/sembridge aggregato
// (Phase 6 plan 06-01).
//
// Wave 1 placeholder: il pacchetto è puro re-export aggregato — no test runtime
// in questa fase. Wave 4 (plan 06-08) aggiungerà smoke `createSemBridge` e
// 06-09 aggiunge integration end-to-end.
//
// `passWithNoTests` evita errori durante Wave 1.

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@sembridge/sembridge',
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/types/**'],
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
