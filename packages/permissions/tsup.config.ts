import { defineConfig } from 'tsup'

// F11 adaptation vs F10 (context):
// - `external` estesa a triple peer `@gluezero/core` + `@gluezero/microfrontends` + `@gluezero/context`
//   (F11 riusa F10 RuntimeContext + Inspector wrapper via composition senza diff F1-F10 src).
// - `minify: true` (D-V2-F11-19 cap stretto 5 KB gzipped).
// - Multi-entry `index.ts` + `augment.ts` (Pattern S1 side-effect intent signaling
//   D-V2-F11-17 stretto — NO `declare module`, NO `Broker.prototype` patch).
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
  external: [/^node:/, '@gluezero/core', '@gluezero/microfrontends', '@gluezero/context'],
  banner: {
    js: '/* @gluezero/permissions — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
