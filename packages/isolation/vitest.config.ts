import { defineConfig } from 'vitest/config'

// F13 Tier-1 jsdom unit suite default (D-V2-F13-14 lockato carryover D-V2-F11-21).
// Tier-3 Playwright Chromium gestita da `vitest.browser.config.ts` separato
// (D-V2-F13-14 + D-V2-F13-23 6 scenari iframe/shadow-dom isolation reali).
export default defineConfig({
  test: {
    name: '@gluezero/isolation',
    environment: 'jsdom',
    globals: false,
    passWithNoTests: true,
    include: ['src/**/*.test.ts'],
    exclude: [
      'src/__integration__/**',
      'src/__browser__/**',
    ],
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
