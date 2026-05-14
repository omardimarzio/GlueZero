import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

/**
 * F14 W2/W3 browser suite Tier-3 Playwright Chromium (D-V2-F14-14 carryover D-V2-F13-14).
 *
 * Eseguito esplicito tramite `pnpm --filter @gluezero/fallbacks test:browser`.
 * Include SOLO `src/__browser__/**` (escluso da default `pnpm test` + integration).
 *
 * Necessario per F14 perché error boundary runtime testa `window.addEventListener('error')`
 * + `unhandledrejection` + DOM rendering chain html-renderer + component-renderer adapter
 * (F15) — comportamenti che jsdom NON modella accuratamente (event propagation cross-task,
 * mutation observer + DOM target innerHTML idempotenza).
 *
 * Rule 1 carryover F13 W3 P05: vitest 4.x usa `browser.provider` factory import
 * (vedi https://vitest.dev/config/browser/provider) — `playwright()` da
 * `@vitest/browser-playwright`.
 */
export default defineConfig({
  test: {
    name: '@gluezero/fallbacks/browser',
    include: ['src/__browser__/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    typecheck: {
      enabled: false,
    },
  },
})
