import { defineConfig } from 'tsup'

// F14 adaptation vs F13 (isolation):
// - `external` 5 peer (`@gluezero/core` + `@gluezero/microfrontends` hard;
//   `@gluezero/context` + `@gluezero/permissions` + `@gluezero/isolation` optional via
//   Service Locator F8 lazy lookup). Scope MF F14 minore di F13 (no theme/cache/gateway/worker).
// - `minify: true` (D-V2-F14-13 cap stretto 6 KB gzipped).
// - Multi-entry `index.ts` + `augment.ts` (Pattern S1 stretto carryover F13/F11 —
//   NO `declare module '@gluezero/core'`, NO `Broker.prototype` patch).
// - ZERO `noExternal` — zero hard deps esterne (peer optional via Service Locator F8).
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
    '@gluezero/isolation',
  ],
  banner: {
    js: '/* @gluezero/fallbacks — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
