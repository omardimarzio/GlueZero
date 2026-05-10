// vitest.config.ts — Tier-1 jsdom test runner Phase 7 Theme (plan 07-01).
//
// Pattern role-match con `packages/cache/vitest.config.ts`. F7 theme esegue:
//   - Tier-1 (jsdom) — tutti i `*.test.ts` non in `__browser__/**` (helper IIFE,
//     ThemeError factory, build-artifacts smoke).
//   - Tier-3 (Playwright Chromium real-browser) — file in `__browser__/**` via
//     `vitest.browser.config.ts`. Wave 6 attiverà smoke FOUC + ApplyTheme microtask.
//
// Wave 1 ha solo helper + factory + types — `passWithNoTests` permette esecuzione
// stabile prima che siano disponibili i file in `__browser__/`.
//
// Riferimenti:
// - 07-CONTEXT.md D-F7-08 (3-tier test strategy)
// - 07-RESEARCH.md §1 + sezione "Standard Stack"

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@gluezero/theme',
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts'],
    // Esclude Tier-3 Playwright dal Tier-1 jsdom run.
    exclude: ['node_modules', 'dist', '**/__browser__/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/csstype-augment.ts',
        'src/types/**',
        'src/__browser__/**',
        'src/__tests__/**',
      ],
    },
    typecheck: {
      enabled: false,
    },
  },
})
