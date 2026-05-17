/**
 * `@gluezero/web-components` — GlueZero Web Components adapter
 *
 * Base class opzionale `GlueZeroElement` per Custom Elements che integrano GlueZero
 * (AbortController cleanup + property-mode context wiring + helper `publish`/`subscribe`).
 * Subpath `/lit` (peer optional Lit 3.x) per developer Lit 3.x con `GlueZeroController`
 * (ReactiveController) + `GlueZeroLitMixin` (class mixin ergonomic).
 *
 * Entry point dual:
 * - `@gluezero/web-components` → `GlueZeroElement` + tipi (≤ 8 KB gzipped)
 * - `@gluezero/web-components/lit` → `GlueZeroController` + `GlueZeroLitMixin` (≤ 3 KB gzipped)
 *
 * @example Custom Element vanilla
 * ```ts
 * import { GlueZeroElement } from '@gluezero/web-components'
 *
 * class MyMf extends GlueZeroElement {
 *   onContextReady() {
 *     this.subscribe('topic.x', (e) => this.handle(e))
 *   }
 * }
 * customElements.define('my-mf', MyMf)
 * ```
 *
 * @example Lit 3.x integration (subpath `/lit`)
 * ```ts
 * import { LitElement, html } from 'lit'
 * import { GlueZeroLitMixin } from '@gluezero/web-components/lit'
 *
 * class MyLitMf extends GlueZeroLitMixin(LitElement) {
 *   render() {
 *     return html`<button @click="${() => this.gluezero.publish('clicked', {})}">+</button>`
 *   }
 * }
 * customElements.define('my-lit-mf', MyLitMf)
 * ```
 *
 * @see {@link https://github.com/omardimarzio/GlueZero/tree/main/packages/web-components#readme} README
 * @see {@link GlueZeroElement} base class
 * @packageDocumentation
 */

export { GlueZeroElement } from './gluezero-element.js'
export type {
  Broker,
  BrokerEvent,
  EventSource,
  MicroFrontendRuntimeContext,
  SubscribeOptions,
  Subscription,
  WcPublishOptions,
} from './types.js'
