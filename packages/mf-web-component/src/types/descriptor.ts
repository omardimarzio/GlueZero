/**
 * `WebComponentLoaderDefinition` — Type narrowing F8 `MicroFrontendLoaderDefinition`
 * con `type: 'web-component'` discriminator literal + campi WC-specific.
 *
 * Carryover stretto F14 fallbacks types/ (NO `declare module '@gluezero/microfrontends'`
 * upstream — D-V2-F15-19 Pattern S1 stretto). Type-only LOCALE; consumer fa narrowing
 * lato applicazione via `if (definition.type === 'web-component')` discriminated union.
 *
 * @see D-V2-F15-05 — contextMode default property
 * @see D-V2-F15-06 — whenDefined + AbortSignal.timeout
 * @see D-V2-F15-08 — reuse-on-collision
 * @see REQ MF-WC-01 — elementName mandatory + contextMode 3-mode
 * @see PRD §25 — Web Component Loader
 */
import type { MicroFrontendLoaderDefinition } from '@gluezero/microfrontends'

/**
 * Loader definition narrowing per `type: 'web-component'`.
 *
 * W2 P02 fill: contract completo + JSDoc per ognuno dei 4 field.
 */
export interface WebComponentLoaderDefinition extends MicroFrontendLoaderDefinition {
  /** Discriminator literal — narrowing TS. */
  readonly type: 'web-component'

  /**
   * Nome del Custom Element registrato via `customElements.define(elementName, klass)`.
   * Deve seguire spec WHATWG (lowercase + hyphen mandatory, es. `mf-analytics`).
   * REQ MF-WC-01 explicit field (NO heuristic URL filename derivation).
   */
  readonly elementName: string

  /**
   * Mode di propagazione `RuntimeContext` al custom element instance.
   *
   * - `'property'` (default — D-V2-F15-05): `element.glueZeroContext = ctx` JS property
   *   assignment + observer via setter; reference identity preserved; zero serialization.
   * - `'attribute'`: serialize a stringa via `element.setAttribute('gz-context', JSON)` —
   *   64KB limit + perdita reference identity.
   * - `'event'`: dispatch `CustomEvent('gz-context', {detail: ctx})` lato MF code.
   */
  readonly contextMode?: 'property' | 'attribute' | 'event'

  /**
   * Timeout customElements.whenDefined (default 15000 ms — carryover F9 D-V2-F9-01).
   * Su timeout: throw `MfWebComponentError({code: 'MF_WC_DEFINE_TIMEOUT'})`.
   */
  readonly timeoutMs?: number
}
