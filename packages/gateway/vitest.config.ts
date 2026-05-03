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
