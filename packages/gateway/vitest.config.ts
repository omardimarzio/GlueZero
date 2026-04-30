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
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/http/index.ts'],
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
