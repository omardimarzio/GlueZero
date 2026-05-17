import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Tier-3 Playwright Chromium — D-V2-F8-04 minimal targeted: SOLO 3 scenari critici.
// 1. end-to-end-scenario.test.ts — E2E MOCK loader + heap snapshot post 100 cycles (P-06 mitigation)
// 2. race-idempotency.test.ts — concurrent register/load/mount idempotency race (P-04 mitigation)
// Il terzo scenario (bundle-size-core-only) vive in packages/core/src/__bc_replay__/ (W1-P02).
export default defineConfig({
  test: {
    name: '@gluezero/microfrontends:browser',
    include: [
      'src/__integration__/end-to-end-scenario.test.ts',
      'src/__integration__/race-idempotency.test.ts',
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
})
