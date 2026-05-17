/**
 * `@gluezero/web-components/lit` — Lit 3.x integration subpath
 *
 * Two-tier pattern (D-V2-F17-07):
 * 1. {@link GlueZeroController} — `ReactiveController` building block per Lit avanzato
 * 2. {@link GlueZeroLitMixin} — class mixin ergonomic per uso comune (raccomandato)
 *
 * Peer optional: `lit: >=3.0.0 <4.0.0`. NO import statico `lit` a livello modulo
 * (peerDependenciesMeta.lit.optional = true + sideEffects false). Compile size cap: ≤ 3 KB gzipped.
 *
 * @example Mixin (ergonomic — raccomandato)
 * ```ts
 * import { LitElement, html } from 'lit'
 * import { GlueZeroLitMixin } from '@gluezero/web-components/lit'
 *
 * class MyEl extends GlueZeroLitMixin(LitElement) {
 *   render() {
 *     return html`<button @click="${() => this.gluezero.publish('x', {})}">+</button>`
 *   }
 * }
 * customElements.define('my-el', MyEl)
 * ```
 *
 * @example Controller diretto (avanzato)
 * ```ts
 * import { LitElement } from 'lit'
 * import { GlueZeroController } from '@gluezero/web-components/lit'
 *
 * class MyEl extends LitElement {
 *   gluezero = new GlueZeroController(this)
 *   glueZeroBroker = null
 *   glueZeroContext = null
 * }
 * ```
 *
 * @see {@link GlueZeroElement} base class no-Lit (subpath `.` principale)
 * @packageDocumentation
 */

export { GlueZeroController, type GlueZeroControllerHost } from './controller.js'
export { GlueZeroLitMixin, type GlueZeroLitMixinInterface } from './mixin.js'
