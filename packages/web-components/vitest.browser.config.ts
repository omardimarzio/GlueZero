import { defineConfig } from 'vitest/config'

// F17 Tier-3 Playwright Chromium per Custom Elements registry + Lit 3.x integration (D-V2-F17-17, ROADMAP linea 42).
export default defineConfig({
  test: {
    include: ['test/browser/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
      headless: true,
    },
  },
})
