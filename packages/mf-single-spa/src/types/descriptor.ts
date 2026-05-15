/**
 * `SingleSpaLoaderDefinition` — Type narrowing F8 `MicroFrontendLoaderDefinition`
 * con `type: 'single-spa'` discriminator literal + campi SS-specific.
 *
 * Experimental @0.x.0 V2.0 GA (D-V2-23 lockato). Peer `single-spa@^5.9.0 || ^6.0.0`
 * (D-V2-F15-11).
 *
 * @see D-V2-F15-11 — Peer dep single-spa ^5.9.0 || ^6.0.0
 * @see REQ MF-SS-01 — Lifecycle mapping + NO router replacement
 * @see PRD §27 — single-spa Adapter
 */
import type { MicroFrontendLoaderDefinition } from '@gluezero/microfrontends'

/**
 * Loader definition narrowing per `type: 'single-spa'`.
 *
 * W2 P04 fill: contract completo + JSDoc per ognuno dei field.
 */
export interface SingleSpaLoaderDefinition extends MicroFrontendLoaderDefinition {
  /** Discriminator literal — narrowing TS. */
  readonly type: 'single-spa'

  /**
   * Loader function che ritorna il modulo single-spa con lifecycle exports
   * (`bootstrap`/`mount`/`unmount`). Coerente single-spa `loadApp` contract.
   */
  readonly module: () => Promise<unknown> | unknown

  /** Nome app registrata in single-spa (opzionale — fallback su `MicroFrontendDescriptor.id`). */
  readonly appName?: string
}
