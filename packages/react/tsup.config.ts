import { defineConfig } from 'tsup'

// F17 W1 P01 scaffolding — single-entry (no subpath per React adapter)
// - ESM-only + dts + target es2022 + platform browser
// - external React/react-dom + workspace peer (resolved tramite peerDependencies)
// - minify: true (D-V2-F17-XX cap stretto 10 KB gzipped)
// - jsx: 'automatic' (React 19 + tsx → JSX runtime esbuild)
export default defineConfig({
  entry: ['src/index.ts'],
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
    '@gluezero/fallbacks',
    'react',
    'react-dom',
    'react/jsx-runtime',
    'react-dom/client',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
  banner: {
    js: '/* @gluezero/react — MIT — https://github.com/omardimarzio/GlueZero */',
  },
})
