/**
 * `singleSpaLoader` — Skeleton stub LoaderAdapter F15 W1.
 *
 * Implementazione W2 Plan 15-04 (experimental @0.x.0 — D-V2-23 lockato):
 * - Peer `single-spa@^5.9.0 || ^6.0.0` (D-V2-F15-11).
 * - Lifecycle mapping `single-spa.bootstrap → MicroFrontendRuntimeModule.bootstrap`,
 *   `single-spa.mount → mount`, `single-spa.unmount → unmount`.
 * - NO router replacement (REQ MF-SS-01 — GlueZero non sostituisce single-spa routing).
 * - Topic emission lifecycle phases via `ctx.broker.publish`.
 * - 4 error codes class `MfSingleSpaError`.
 *
 * @see D-V2-F15-11 — Peer single-spa ^5.9.0 || ^6.0.0
 * @see REQ MF-SS-01 — Lifecycle mapping + NO router replacement
 * @see PRD §27 — single-spa Adapter
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
 * @throws `MfSingleSpaError` con code in `MfSingleSpaErrorCode` union su lifecycle
 *   invalid / bootstrap failed / mount failed / unmount failed.
 */
export const singleSpaLoader: MicroFrontendLoaderAdapter = {
  type: 'single-spa',
  async load(_definition: MicroFrontendLoaderDefinition, _ctx: LoaderContext): Promise<LoadedModule> {
    throw new Error(
      'TODO W2 P04 — singleSpaLoader implementation D-V2-F15-11 (lifecycle mapping bootstrap/mount/unmount + topic emit + NO router replacement)',
    )
  },
}
