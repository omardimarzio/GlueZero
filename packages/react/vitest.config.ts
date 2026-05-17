import { defineConfig } from 'vitest/config'

// F17 Tier-1 jsdom per hook unit isolati (D-V2-F17-17).
// Integration React mount va in vitest.browser.config.ts Tier-3 Playwright.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**', 'test/browser/**'],
  },
})
