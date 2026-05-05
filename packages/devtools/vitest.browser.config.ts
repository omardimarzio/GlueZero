// vitest.browser.config.ts — Tier-3 Playwright Chromium config Phase 6 Devtools.
//
// Esecuzione separata dal Tier-1 jsdom: carica solo i file in
// `src/__browser__/**` con provider Playwright headless Chromium. V1 scope:
// smoke structuredClone deep-clone perf per `getDebugSnapshot()` (D-162) +
// reservoir sampling jitter sotto load reale.
//
// Vitest 4.x: `browser.provider` accetta una factory function — `playwright` di
// `@vitest/browser-playwright`.
//
// Riferimenti:
// - 06-CONTEXT.md D-150 carryover (3-tier strategy)

import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@sembridge/devtools:browser',
    include: ['src/__browser__/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
})
