import { defineConfig } from 'vitest/config'

/**
 * F11 W3 integration suite config — Tier-1 jsdom only (D-V2-F11-21).
 *
 * Eseguito esplicito tramite `pnpm --filter @gluezero/permissions test:integration`.
 * Include SOLO `src/__integration__/**` (escluso dal default `pnpm test`).
 *
 * Pattern F10-style split unit vs integration — separa suite veloce default (unit)
 * dal closure E2E suite (integration cross-cumulativa W2+W3).
 */
export default defineConfig({
  test: {
    name: '@gluezero/permissions/integration',
    environment: 'jsdom',
    globals: false,
    include: ['src/__integration__/**/*.test.ts'],
    typecheck: {
      enabled: false,
    },
  },
})
