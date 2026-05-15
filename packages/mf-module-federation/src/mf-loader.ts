/**
 * `moduleFederationLoader` — Skeleton stub LoaderAdapter F15 W1.
 *
 * Implementazione W2 Plan 15-04 (experimental @0.x.0 — D-V2-23 lockato):
 * - remoteEntry.js loader webpack 5 formato (D-V2-F15-09).
 * - `@module-federation/runtime` v0.x `init({remotes})` + `loadRemote(scope/module)`.
 * - Share scope conflict → console.warn + emit topic `microfrontend.mf.share.version-mismatch`
 *   + procede usando shared host (D-V2-F15-10 warn + proceed policy).
 * - 5 error codes class `MfModuleFederationError` (REQ MF-MF-02 lockato).
 * - Factory result normalize carryover F9 mf-esm.
 *
 * @see D-V2-F15-09 — webpack-only V2.0 GA
 * @see D-V2-F15-10 — Share scope conflict warn + proceed
 * @see REQ MF-MF-02 — 5 error codes literal union
 */
import type {
  LoaderContext,
  LoadedModule,
  MicroFrontendLoaderAdapter,
  MicroFrontendLoaderDefinition,
} from '@gluezero/microfrontends'

/**
 * Skeleton stub — body W2 P04 implementation.
 *
 * @throws `MfModuleFederationError` con code in `MfModuleFederationErrorCode` union su
 *   remote entry load failed / scope not found / module not found / factory failed.
 */
export const moduleFederationLoader: MicroFrontendLoaderAdapter = {
  type: 'module-federation',
  async load(_definition: MicroFrontendLoaderDefinition, _ctx: LoaderContext): Promise<LoadedModule> {
    throw new Error(
      'TODO W2 P04 — moduleFederationLoader implementation D-V2-F15-09/10 (remoteEntry.js webpack 5 + @module-federation/runtime v0.x + share scope warn+emit)',
    )
  },
}
