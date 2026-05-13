import { defineConfig } from 'vitest/config'

/**
 * F13 W2/W3 browser suite Tier-3 Playwright Chromium (D-V2-F13-14 + D-V2-F13-23).
 *
 * Eseguito esplicito tramite `pnpm --filter @gluezero/isolation test:browser`.
 * Include SOLO `src/__browser__/**` (escluso da default `pnpm test` + integration).
 *
 * Necessario per F13 perché isolation testa shadow-dom + iframe sandbox + CSS scoping
 * che jsdom NON modella accuratamente (es. ShadowRoot.adoptedStyleSheets, iframe sandbox
 * cross-origin policy, document fragment focus delegation, computed CSS containment).
 * 6 scenari obbligatori W3 (D-V2-F13-23).
 */
export default defineConfig({
  test: {
    name: '@gluezero/isolation/browser',
    include: ['src/__browser__/**/*.test.ts'],
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
    typecheck: {
      enabled: false,
    },
  },
})
