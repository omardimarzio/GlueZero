// vitest.config.ts — Tier-1 jsdom test runner Phase 5 (plan 05-01).
//
// Pattern role-match con `packages/gateway/vitest.config.ts`. F5 esegue:
//   - Tier-1 (jsdom) — tutti i `*.test.ts` non in `__browser__/**` (decl merging,
//     state machines, parser puri, registry/pool con MockWorker).
//   - Tier-3 (Playwright Chromium real-browser) — file in `__browser__/**` via
//     `vitest.browser.config.ts`. Wave 4 attiverà `playwright-worker-smoke.test.ts`.
//
// Coverage v8 thresholds Wave 1: 90/80/90/90 (statements/branches/functions/lines)
// post-implementation calibration in Wave 5 (plan 05-07 final gate F5). Wave 1 ha solo
// type files + augment + decl merging smoke — `passWithNoTests` permette esecuzione
// senza tests runtime.
//
// Riferimenti:
// - 05-CONTEXT.md D-149/D-150 (test 3-tier strategy)
// - 05-RESEARCH.md §9.1 (DI WorkerCtor per jsdom + MockWorker), §9.3 (Tier-3)
// - 05-PATTERNS.md §"vitest.config.ts"

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@sembridge/worker',
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts', 'src/__integration__/**/*.test.ts'],
    // Esclude Tier-3 Playwright dal Tier-1 jsdom run. I test in `__browser__/**`
    // richiedono real-browser API (Worker nativo, structuredClone, transferable
    // ownership) e vengono caricati da `vitest.browser.config.ts` (Playwright
    // headless Chromium). Senza questo exclude vitest jsdom fallisce al carico
    // dei file (es. `Worker` constructor con module URL non risolvibile).
    exclude: ['node_modules', 'dist', '**/__browser__/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/augment.ts',
        'src/types/**',
        'src/test-utils/**',
        'src/__browser__/**',
      ],
      // Wave 1: thresholds documentano target post-implementation. Solo type files
      // + augment + smoke decl merging — coverage non significativa in W1.
      // Wave 5 (plan 05-07 final gate) calibra thresholds finali su misura
      // post-W2/W3/W4 implementation.
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
