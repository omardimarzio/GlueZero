import { defineConfig } from 'vitest/config'

// F15 P01 scaffolding — Tier-1 jsdom unit suite default (carryover F14 fallbacks/vitest.config.ts).
// Tier-3 Playwright Chromium gestita da `vitest.browser.config.ts` separato (W3 P05 closure).
export default defineConfig({
  test: {
    name: '@gluezero/mf-module-federation',
    environment: 'jsdom',
    globals: false,
    passWithNoTests: true,
    include: ['src/**/*.test.ts'],
    exclude: ['src/__integration__/**', 'src/__browser__/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/__integration__/**',
        'src/__browser__/**',
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
