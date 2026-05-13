/**
 * Build-time const `__GLUEZERO_VERSION__` injected da tsup `define` option.
 *
 * Fonte: `tsup.config.ts`
 * ```typescript
 * define: { __GLUEZERO_VERSION__: JSON.stringify(process.env.GLUEZERO_VERSION ?? '2.0.0') }
 * ```
 *
 * Default fallback `'2.0.0'` per development locale dove env var non è settata.
 * Production build legge `process.env.GLUEZERO_VERSION` (CI/changesets setting).
 *
 * NON è una runtime API — è una constant inline dal bundler. esbuild sostituisce
 * letteralmente ogni occorrenza dell'identifier `__GLUEZERO_VERSION__` al build-time.
 *
 * OQ-5 resolution (RESEARCH §3.3): tre opzioni valutate —
 * (a) tsup `define` build-time, (b) read package.json runtime, (c) runtime import core.
 * Scelta (a) per compatibilità changesets + zero diff core + bundle minimo.
 *
 * Verifica W1 empirica post-build:
 * ```sh
 * grep '"2\.0\.0"' packages/compat/dist/index.js
 * ```
 * Deve restituire match — verifica che esbuild abbia sostituito letteralmente
 * `__GLUEZERO_VERSION__` con la stringa JSON-escaped `"2.0.0"`.
 *
 * @internal — usato solo da `check-engine.ts` (W2) per dim `gluezero` semver satisfies check.
 * @see prd_2.0.0.md §20.3 — dim `gluezero` (scalar range vs build-time version)
 * @see RESEARCH.md §3 — OQ-5 resolution rationale
 */

// Ambient declaration — esbuild sostituisce l'identifier al build-time via tsup `define`.
declare const __GLUEZERO_VERSION__: string

/**
 * Snapshot della versione GlueZero al build-time (immutable).
 *
 * Pattern: legge l'ambient `__GLUEZERO_VERSION__` (sostituito da esbuild `define`)
 * e lo espone come `const` named export. Consumer interno `check-engine.ts` (W2)
 * importa questo identifier per dim `gluezero` semver satisfies.
 *
 * @internal
 */
export const GLUEZERO_BUILD_VERSION: string = __GLUEZERO_VERSION__
