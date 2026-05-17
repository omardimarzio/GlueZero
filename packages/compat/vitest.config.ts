import { defineConfig } from 'vitest/config'

// F12 Tier-1 jsdom only (carryover D-V2-F11-21 / MF-TEST-01).
// NO Tier-3 Playwright/browser provider — F12 = logica pura JS (semver checker + version registry
// + check engine + policy dispatch) senza DOM-heavy concern.
export default defineConfig({
  // Rule 3 fix W2: replicate tsup `define` per `__GLUEZERO_VERSION__` ambient const
  // (build-time literal sostituito da esbuild — vedere tsup.config.ts). In test mode
  // vitest non passa attraverso tsup, quindi serve `define` esplicito (vitest/vite usa
  // esbuild-substitution lo stesso pattern). Senza questo, `gluezero-version.ts:43`
  // ritorna `ReferenceError: __GLUEZERO_VERSION__ is not defined` runtime.
  define: {
    __GLUEZERO_VERSION__: JSON.stringify(process.env.GLUEZERO_VERSION ?? '2.0.0'),
  },
  test: {
    name: '@gluezero/compat',
    environment: 'jsdom',
    globals: false,
    passWithNoTests: true,
    include: ['src/**/*.test.ts'],
    exclude: ['src/__integration__/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts', 'src/__integration__/**'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
    typecheck: {
      enabled: false,
    },
  },
})
