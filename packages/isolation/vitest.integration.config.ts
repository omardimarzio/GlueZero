import { defineConfig } from 'vitest/config'

/**
 * F13 W3 integration suite config — Tier-1 jsdom (D-V2-F13-14).
 *
 * Eseguito esplicito tramite `pnpm --filter @gluezero/isolation test:integration`.
 * Include SOLO `src/__integration__/**` (escluso dal default `pnpm test`).
 *
 * Pattern F10/F11/F12-style split unit vs integration — separa suite veloce default
 * (unit) dal closure E2E suite (integration cross-cumulativa W2+W3).
 */
export default defineConfig({
  test: {
    name: '@gluezero/isolation/integration',
    environment: 'jsdom',
    globals: false,
    passWithNoTests: true,
    include: ['src/__integration__/**/*.test.ts'],
    typecheck: {
      enabled: false,
    },
  },
})
