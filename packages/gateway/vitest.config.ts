import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@sembridge/gateway',
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/http/index.ts',
        'src/http/types/**',
        'src/augment.ts',
        // Phase 4 (plan 04-01) — non-runtime sse-ws files exclusi dalla coverage:
        // barrel skeleton (re-export only), types-only files, augment (decl merging
        // compile-time), test-utils helpers. I thresholds rimangono invariati per
        // ora — verranno calibrati in 04-09 dopo coverage measurement post-implementation.
        'src/sse-ws/index.ts',
        'src/sse-ws/types/**',
        'src/sse-ws/augment.ts',
        'src/sse-ws/test-utils/**',
      ],
      // F3 V1: branches threshold 75% (realistic post-implementation; defensive
      // try/catch in http-gateway error classification + combine-signals dispose
      // edge cases produce branches non sempre coperti). Pattern lesson learned
      // F2 plan 02-12 budget calibration.
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 88,
        lines: 87,
      },
    },
    typecheck: {
      enabled: false,
    },
  },
})
