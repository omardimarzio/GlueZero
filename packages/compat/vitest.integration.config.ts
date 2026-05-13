import { defineConfig } from 'vitest/config'

/**
 * F12 W3 integration suite config — Tier-1 jsdom only (carryover D-V2-F11-21).
 *
 * Eseguito esplicito tramite `pnpm --filter @gluezero/compat test:integration`.
 * Include SOLO `src/__integration__/**` (escluso dal default `pnpm test`).
 *
 * Pattern F11-style split unit vs integration — separa suite veloce default (unit)
 * dal closure E2E suite (integration cross-cumulativa W2+W3).
 *
 * **W4 Rule 3 fix**: replicato `define: __GLUEZERO_VERSION__` dal `vitest.config.ts`
 * (vitest non passa attraverso tsup → necessario esbuild-substitution esplicito per
 * `gluezero-version.ts:43`). Senza questo, integration test throw
 * `ReferenceError: __GLUEZERO_VERSION__ is not defined`.
 */
export default defineConfig({
  define: {
    __GLUEZERO_VERSION__: JSON.stringify(process.env.GLUEZERO_VERSION ?? '2.0.0'),
  },
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
