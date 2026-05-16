import { defineConfig } from 'vitest/config'

// F17 Tier-3 Playwright Chromium per React 19 + StrictMode + createRoot integration (D-V2-F17-17).
// ROADMAP linea 42 lockato. P-22 mitigation reale browser context.
export default defineConfig({
  test: {
    include: ['test/browser/**/*.test.ts', 'test/browser/**/*.test.tsx'],
    browser: {
      enabled: true,
      provider: 'playwright',
      instances: [{ browser: 'chromium' }],
      headless: true,
    },
  },
})
