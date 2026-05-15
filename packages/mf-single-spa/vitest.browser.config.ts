import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

/**
 * F15 P01 scaffolding — Tier-3 Playwright Chromium browser suite (carryover F14 fallbacks).
 *
 * W3 P05 implementerà 2 scenari SS: (7) lifecycle mapping bootstrap→mount→unmount + topic
 * emission + (8) MF_SS_LIFECYCLE_INVALID throw + FSM 'failed'.
 */
export default defineConfig({
  test: {
    name: '@gluezero/mf-single-spa/browser',
    include: ['src/__browser__/**/*.test.ts', '__tier3__/**/*.spec.ts'],
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
