import { defineConfig } from 'vitest/config'

/**
 * F10 W3 P05 integration suite config — Tier-1 jsdom only (D-V2-F10-16).
 *
 * Eseguito esplicito tramite `pnpm --filter @gluezero/context test:integration`.
 * Include SOLO `src/__integration__/**` (escluso dal default `pnpm test`).
 *
 * Pattern F9-style split unit vs integration — separa suite veloce default (unit)
 * dal closure E2E suite (integration cross-cumulativa W2+W3).
 */
export default defineConfig({
  test: {
    name: '@gluezero/context:integration',
    environment: 'jsdom',
    globals: false,
    include: ['src/__integration__/**/*.test.ts'],
    typecheck: {
      enabled: false,
    },
  },
})
