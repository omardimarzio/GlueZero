import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@sembridge/gateway',
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.ts'],
    // W-NEW-3 fix iter 2 (plan 04-08): esclude Tier-3 Playwright dal Tier-1 jsdom
    // run. I test in `__browser__/**` richiedono real-browser API (EventSource
    // nativo, WebSocket, ecc.) e vengono caricati da `vitest.browser.config.ts`
    // (Playwright headless Chromium). Senza questo exclude vitest jsdom fallisce
    // al carico dei file (es. `EventSource` undefined in Node).
    exclude: ['node_modules', 'dist', '**/__browser__/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/index.ts',
        'src/http/index.ts',
        'src/http/types/**',
        'src/augment.ts',
        // Phase 4 (plan 04-01) — non-runtime sse-ws files exclusi dalla coverage:
        // barrel skeleton (re-export only), types-only files, augment (decl merging
        // compile-time), test-utils helpers. I thresholds rimangono invariati per
        // ora — verranno calibrati in 04-09 dopo coverage measurement post-implementation.
        'src/sse-ws/index.ts',
        'src/sse-ws/types/**',
        'src/sse-ws/augment.ts',
        'src/sse-ws/test-utils/**',
      ],
      // F3 V1: branches threshold 75% (realistic post-implementation; defensive
      // try/catch in http-gateway error classification + combine-signals dispose
      // edge cases produce branches non sempre coperti). Pattern lesson learned
      // F2 plan 02-12 budget calibration.
      //
      // Phase 4 plan 04-09 (final gate F4) — coverage v8 measurement post-implementation:
      // - Globale: 87.27% statements / 80.23% branches / 88.75% functions / 89.32% lines
      // - sse-ws/ subset: 91.80% statements / 86.70% branches / 89.53% functions / 93.75% lines
      // sse-ws/ supera i thresholds globali su tutti gli assi (target ≥85/75/88/87
      // confermato realistic post-implementation). F4 chiusa con calibrazione invariata —
      // no raise globale per non rompere CI di sviluppi in corso che potrebbero
      // introdurre nuovi defensive try/catch nel sub-modulo /http (es. wiring
      // backpressure/dedupe deferred a F6).
      thresholds: {
        statements: 85,
        branches: 75,
        functions: 88,
        lines: 87,
      },
    },
    typecheck: {
      enabled: false,
    },
  },
})
