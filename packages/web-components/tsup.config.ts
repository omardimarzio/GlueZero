import { defineConfig } from 'tsup'

// F17 W1 P01 scaffolding — multi-entry per subpath /lit (D-V2-F17-07 two-tier ReactiveController + Mixin)
// - entry object {index, lit/index} → dist/{index.js, lit/index.js}
// - sideEffects false (NO auto-register customElements — host registra esplicitamente)
// - external lit + workspace peer (resolved tramite peerDependencies)
// - minify: true (D-V2-F17-XX cap stretto 8 KB index + 3 KB lit subpath)
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'lit/index': 'src/lit/index.ts',
  },
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
    'lit',
    'lit/decorators.js',
    '@lit/reactive-element',
  ],
  banner: {
    js: '/* @gluezero/web-components — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
