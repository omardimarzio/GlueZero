import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'test/browser/**'],
  },
})
