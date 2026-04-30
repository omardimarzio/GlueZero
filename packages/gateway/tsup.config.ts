import { defineConfig } from 'tsup'

export default defineConfig({
  // Multi-entry: subpath exports separano F3 (HTTP) da F4 (SSE/WS) sia a livello
  // di build (`dist/index.js` umbrella + `dist/http/index.js`) sia a livello di
  // dependency boundary (consumer importa `@sembridge/gateway/http` per F3-only).
  // Vedi RESEARCH §"Subpath Exports Recommendation".
  //
  // Plan 03-04 aggiungerà `'src/augment.ts'` alla entry list per emettere
  // `dist/augment.js` (referenziato dal `sideEffects` array per anti tree-shaking
  // del declaration merging).
  //
  // Phase 4 aggiungerà `'sse-ws/index': 'src/sse-ws/index.ts'` alla entry list
  // (placeholder export riservato in `package.json` se/quando attivato).
  entry: { index: 'src/index.ts', 'http/index': 'src/http/index.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: false,
  target: 'es2022',
  platform: 'browser',
  external: [/^node:/, '@sembridge/core', '@sembridge/mapper'],
  banner: {
    js: '/* @sembridge/gateway — MIT — https://github.com/<TBD>/sembridge */',
  },
})
