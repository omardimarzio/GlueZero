import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

/**
 * F15 P01 scaffolding — Tier-3 Playwright Chromium browser suite (carryover F14 fallbacks).
 *
 * W3 P05 implementerà 2 scenari MF: (5) remoteEntry.js load + share scope warn + happy path
 * lifecycle + (6) MF_REMOTE_ENTRY_LOAD_FAILED + MF_SHARE_SCOPE_FAILED simulated.
 */
export default defineConfig({
  test: {
    name: '@gluezero/mf-module-federation/browser',
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
