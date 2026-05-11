import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@gluezero/microfrontends',
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts'],
    exclude: [
      'src/__integration__/end-to-end-scenario.test.ts',
      'src/__integration__/race-idempotency.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/test-utils/**',
        'src/__integration__/**',
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
    typecheck: {
      enabled: false,
    },
  },
})
