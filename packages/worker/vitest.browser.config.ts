// vitest.browser.config.ts — Tier-3 Playwright Chromium config Phase 5 (plan 05-01).
//
// Esecuzione separata dal Tier-1 jsdom: carica solo i file in
// `src/__browser__/**` con provider Playwright headless Chromium. Verifica che le
// API browser native (Worker, structuredClone, transferable ownership) siano
// disponibili e funzionanti in real-browser environment (non MockWorker).
//
// **V1 scope (W4 plan 05-06 D-151 #7)**: smoke `playwright-worker-smoke.test.ts`
// con `__browser__/test-worker.ts` (Comlink.expose API reale). Dimostra
// transferable ownership + progress callback proxy + cancellation cooperative.
//
// Vitest 4.x: `browser.provider` accetta una factory function (NON una stringa) —
// vedi https://vitest.dev/config/browser/provider. La factory è `playwright` di
// `@vitest/browser-playwright`.
//
// Riferimenti:
// - 05-CONTEXT.md D-150 (3-tier test strategy)
// - 05-RESEARCH.md §9.3 (Playwright config esempio)

import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@sembridge/worker:browser',
    include: ['src/__browser__/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
})
