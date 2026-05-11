import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Tier-3 Playwright Chromium — D-V2-F9-13 minimal targeted: 3 scenari critici lockati.
// 1. end-to-end-scenario.test.ts — full lifecycle + heap snapshot post 100 mount/destroy (SC1 + P-06)
// 2. timeout-scenario.test.ts — MF_LOADER_TIMEOUT + MF_LOADER_INVALID_MODULE (SC2)
// 3. race-load-mount.test.ts — concurrent mount strict identity Promise + 1 network round-trip (SC4 + P-04)
//
// Pattern riuso F4/F7/F8 (provider API Playwright + binary install via `@vitest/browser-playwright`).
// Fixture private servite da Vite dev server via `publicDir: 'test/fixtures'` (D-V2-F9-14):
//   - /sample-mf.js (happy path lifecycle)
//   - /slow-mf.js (top-level await 5s — timeout test)
//   - /invalid-mf.js (no mount hook — invalid module test)
//
// `--expose-gc` consente force GC nel scenario 1b per heap snapshot deterministic.
export default defineConfig({
  test: {
    name: '@gluezero/mf-esm:browser',
    include: [
      'src/__integration__/end-to-end-scenario.test.ts',
      'src/__integration__/timeout-scenario.test.ts',
      'src/__integration__/race-load-mount.test.ts',
    ],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
          launch: { args: ['--expose-gc'] },
        },
      ],
      headless: true,
    },
  },
  // Vite dev server serve `test/fixtures/*.js` come asset statici alla root del browser test runner.
  // URL pattern: `/sample-mf.js`, `/slow-mf.js`, `/invalid-mf.js`.
  publicDir: 'test/fixtures',
})
