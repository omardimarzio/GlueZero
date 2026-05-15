import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

/**
 * F15 P01 scaffolding — Tier-3 Playwright Chromium browser suite (carryover F14 fallbacks).
 *
 * W3 P05 implementerà 2 scenari WC: (1) ESM load + customElements.whenDefined +
 * property contextMode + (2) reuse-on-collision multi-instance warning.
 */
export default defineConfig({
  test: {
    name: '@gluezero/mf-web-component/browser',
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
