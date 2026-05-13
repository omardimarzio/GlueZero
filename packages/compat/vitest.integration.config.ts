import { defineConfig } from 'vitest/config'

/**
 * F12 W3 integration suite config — Tier-1 jsdom only (carryover D-V2-F11-21).
 *
 * Eseguito esplicito tramite `pnpm --filter @gluezero/compat test:integration`.
 * Include SOLO `src/__integration__/**` (escluso dal default `pnpm test`).
 *
 * Pattern F11-style split unit vs integration — separa suite veloce default (unit)
 * dal closure E2E suite (integration cross-cumulativa W2+W3).
 */
export default defineConfig({
  test: {
    name: '@gluezero/compat/integration',
    environment: 'jsdom',
    globals: false,
    passWithNoTests: true,
    include: ['src/__integration__/**/*.test.ts'],
    testTimeout: 10000,
    typecheck: {
      enabled: false,
    },
  },
})
