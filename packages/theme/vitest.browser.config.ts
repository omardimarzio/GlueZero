// vitest.browser.config.ts — Tier-3 Playwright Chromium config Phase 7 Theme (plan 07-01).
//
// Esecuzione separata dal Tier-1 jsdom: carica solo i file in `src/__browser__/**`
// con provider Playwright headless Chromium. Verifica che le API browser native
// (matchMedia prefers-color-scheme, getComputedStyle CSS custom properties,
// :root cascade @layer) siano disponibili in real-browser environment.
//
// **W1 scope**: zero browser tests — Wave 6 attiva smoke FOUC + cascade @layer.
//
// Vitest 4.x: `browser.provider` accetta una factory function (NON una stringa) —
// vedi https://vitest.dev/config/browser/provider. Factory `playwright()` da
// `@vitest/browser-playwright`.
//
// Riferimenti:
// - 07-CONTEXT.md D-F7-08 (3-tier test strategy)
// - 07-RESEARCH.md §1 (analog F6 cache vitest.browser.config.ts pattern)

import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@gluezero/theme:browser',
    include: ['src/__browser__/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
})
