// vitest.browser.config.ts — Tier-3 Playwright Chromium config Phase 6 Cache (plan 06-01).
//
// Esecuzione separata dal Tier-1 jsdom: carica solo i file in
// `src/__browser__/**` con provider Playwright headless Chromium. Verifica che le
// API browser native (structuredClone, microtask ordering, Map insertion-order LRU)
// siano disponibili e funzionanti in real-browser environment.
//
// **V1 scope (Wave 4 plan 06-08)**: smoke `cache-then-network-microtask.test.ts`
// per verificare ordering garantito SC-1 (cache hit pubblicato prima del remote).
//
// Vitest 4.x: `browser.provider` accetta una factory function (NON una stringa) —
// vedi https://vitest.dev/config/browser/provider. La factory è `playwright` di
// `@vitest/browser-playwright`.
//
// Riferimenti:
// - 06-CONTEXT.md D-149/D-150 carryover (3-tier test strategy)
// - 06-RESEARCH.md §1 (analog F5 vitest.browser.config.ts pattern)

import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@sembridge/cache:browser',
    include: ['src/__browser__/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
})
