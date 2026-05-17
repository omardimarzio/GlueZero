import { defineConfig } from 'vitest/config'

// F10 Tier-1 jsdom only (D-V2-F10-16 lockato).
// NO Tier-3 Playwright/browser provider — F10 = logica pura JS (state container,
// selectors, events, mapping wire) senza DOM-heavy concern.
export default defineConfig({
  test: {
    name: '@gluezero/context',
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts'],
    exclude: [
      'src/__integration__/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/__integration__/**'],
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
