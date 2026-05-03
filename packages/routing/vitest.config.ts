import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@sembridge/routing',
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts'],
    // Plan 03-13: msw setupServer lifecycle (listen / resetHandlers / close).
    // Setup attivo per TUTTI i test del package — gli unit test esistenti non toccano
    // `fetch`, quindi non sono impattati. Gli integration test in `__integration__/`
    // usano l'instance di `server` esposta da `test-utils/msw-server.ts`.
    setupFiles: ['./src/test-utils/vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
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
