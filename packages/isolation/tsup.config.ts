import { defineConfig } from 'tsup'

// F13 adaptation vs F11 (permissions) + F12 (compat):
// - `external` estesa a 8 peer (`@gluezero/core` + `@gluezero/microfrontends` hard;
//   `@gluezero/context` + `@gluezero/permissions` + `@gluezero/theme` + `@gluezero/cache` +
//   `@gluezero/gateway` + `@gluezero/worker` optional via Service Locator F8 lazy lookup).
// - `minify: true` (D-V2-F13-13 cap stretto 12 KB gzipped).
// - Multi-entry `index.ts` + `augment.ts` (Pattern S1 stretto carryover D-V2-F11-17 +
//   D-V2-F12 — NO `declare module '@gluezero/core'`, NO `Broker.prototype` patch).
// - ZERO `noExternal` — riuso via Service Locator F8 lazy lookup (zero hard deps esterne).
export default defineConfig({
  entry: ['src/index.ts', 'src/augment.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: true,
  target: 'es2022',
  platform: 'browser',
  external: [
    /^node:/,
    '@gluezero/core',
    '@gluezero/microfrontends',
    '@gluezero/context',
    '@gluezero/permissions',
    '@gluezero/theme',
    '@gluezero/cache',
    '@gluezero/gateway',
    '@gluezero/worker',
  ],
  banner: {
    js: '/* @gluezero/isolation — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
