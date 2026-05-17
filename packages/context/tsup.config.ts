import { defineConfig } from 'tsup'

// F10 adaptation vs F9 (mf-esm):
// - `external` estesa a triple peer `@gluezero/core` + `@gluezero/microfrontends` + `@gluezero/mapper`
//   (F10 riusa F2 MapperEngine + AliasRegistry + MappingInspector via composition senza diff F2 src).
// - `minify: true` (D-V2-F10-19 cap stretto 4 KB gzipped).
// - Multi-entry `index.ts` + `augment.ts` (Pattern S1 side-effect intent signaling
//   D-V2-F10-17 stretto — NO `declare module`, NO `Broker.prototype` patch).
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
  external: [/^node:/, '@gluezero/core', '@gluezero/microfrontends', '@gluezero/mapper'],
  banner: {
    js: '/* @gluezero/context — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
