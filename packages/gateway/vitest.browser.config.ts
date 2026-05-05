// vitest.browser.config.ts — Tier-3 Playwright config (B-1 closure W-NEW-1).
//
// Esecuzione separata dal Tier-1 jsdom: carica solo i file in `src/sse-ws/__browser__/**`
// con provider Playwright headless Chromium. Verifica che le API browser native
// (EventSource, WebSocket) siano disponibili e funzionanti in real-browser environment
// (non mock).
//
// **V1 scope minimo**: smoke bootstrap. E2E completo (connect+receive con server mock)
// è deferred V1.x — vedi `__browser__/playwright-sse-smoke.test.ts` disclaimer.
//
// Riferimenti:
// - RESEARCH §9.3 — 3-tier test strategy (jsdom + MSW + Playwright)
// - 04-CONTEXT.md D-118 — Tier-3 Playwright opt-in V1
//
// Vitest 4.x NB: `browser.provider` accetta una factory function (NON una stringa) —
// vedi https://vitest.dev/config/browser/provider. La factory è `playwright` di
// `@vitest/browser-playwright`.

import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@gluezero/gateway:browser',
    include: ['src/sse-ws/__browser__/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
})
