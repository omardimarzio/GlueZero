/**
 * `SingleSpaLoaderDefinition` — Type narrowing F8 `MicroFrontendLoaderDefinition`
 * con `type: 'single-spa'` discriminator literal + campi SS-specific.
 *
 * Experimental @0.x.0 V2.0 GA (D-V2-23 lockato). Peer `single-spa@^5.9.0 || ^6.0.0`
 * (D-V2-F15-11 + research-verified 6.0.3 stable Mar 2026).
 *
 * @see D-V2-F15-11 — Peer dep single-spa ^5.9.0 || ^6.0.0
 * @see REQ MF-SS-01 — Lifecycle mapping + NO router replacement
 * @see PRD §27 — single-spa Adapter
 */
import type { MicroFrontendLoaderDefinition } from '@gluezero/microfrontends'

/**
 * Lifecycle entry single-spa — funzione singola o array (5.9+ supporta array per
 * parallel exec).
 */
export type SingleSpaLifecycleFn = (props: Record<string, unknown>) => Promise<unknown> | unknown
export type SingleSpaLifecycleEntry = SingleSpaLifecycleFn | ReadonlyArray<SingleSpaLifecycleFn>

/**
 * Shape minimo del modulo single-spa atteso da `definition.module()` resolve.
 *
 * `bootstrap` / `mount` / `unmount` sono mandatory (REQ MF-SS-01). `update` opzionale
 * (single-spa 5.9+). Parcels API (`createParcel`, `mountParcel`) deferred V2.1.
 */
export interface SingleSpaApp {
  readonly bootstrap: SingleSpaLifecycleEntry
  readonly mount: SingleSpaLifecycleEntry
  readonly unmount: SingleSpaLifecycleEntry
  readonly update?: SingleSpaLifecycleEntry
}

/**
 * Loader definition narrowing per `type: 'single-spa'`.
 *
 * W2 P04 fill: contract completo + JSDoc per ognuno dei field.
 *
 * @example Descriptor single-spa async loader
 * ```ts
 * await broker.registerMicroFrontend({
 *   id: 'navbar-app',
 *   name: 'Navigation (single-spa)',
 *   version: '1.0.0',
 *   loader: {
 *     type: 'single-spa',
 *     module: () => import('https://cdn.example/navbar.js'),
 *     appName: 'navbar',
 *   } satisfies SingleSpaLoaderDefinition,
 * })
 * ```
 *
 * @example Descriptor single-spa object inline
 * ```ts
 * loader: {
 *   type: 'single-spa',
 *   module: {
 *     bootstrap: async () => { ... },
 *     mount: async (props) => { props.domElement.innerHTML = 'Hello' },
 *     unmount: async (props) => { props.domElement.innerHTML = '' },
 *   } satisfies SingleSpaApp,
 * }
 * ```
 */
export interface SingleSpaLoaderDefinition extends MicroFrontendLoaderDefinition {
  /** Discriminator literal — narrowing TS. */
  readonly type: 'single-spa'

  /**
   * Loader function che ritorna modulo single-spa con lifecycle exports
   * (`bootstrap`/`mount`/`unmount`) — coerente single-spa `loadApp` contract.
   *
   * Può ritornare:
   * - `Promise<SingleSpaApp>` — async dynamic import (es. `() => import(url)`).
   * - `SingleSpaApp` — object inline sync (testing / co-located bundling).
   */
  readonly module: () => Promise<SingleSpaApp | unknown> | SingleSpaApp | unknown

  /** Nome app registrata in single-spa (default `ctx.descriptor.id`). */
  readonly appName?: string

  /** Timeout `definition.module()` resolve in millisecondi (default 15000). */
  readonly timeoutMs?: number
}
