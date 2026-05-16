/**
 * `GlueZeroLitMixin<Base extends LitElement>(Base)` — Lit 3.x class mixin ergonomic
 * (D-V2-F17-07 tier 2).
 *
 * Two-tier pattern (vedi `controller.ts`):
 * - tier 1 = {@link GlueZeroController} (building block low-level)
 * - tier 2 = **questo file** (wrapper ergonomic — raccomandato per uso comune)
 *
 * Capability:
 * - Inietta property `glueZeroBroker` + `glueZeroContext` (initial value `null`)
 * - Istanzia automaticamente `this.gluezero = new GlueZeroController(this)` nel constructor
 * - Consumer chiama `this.gluezero.publish(...)` / `this.gluezero.subscribe(...)` direttamente
 * - NO import statico `lit` — usa generic `Constructor<GlueZeroControllerHost>` come bound
 *   (peer optional Lit, package `sideEffects: false`)
 *
 * @example Mixin (ergonomic — raccomandato)
 * ```ts
 * import { LitElement, html } from 'lit'
 * import { GlueZeroLitMixin } from '@gluezero/web-components/lit'
 *
 * class CartButton extends GlueZeroLitMixin(LitElement) {
 *   render() {
 *     return html`<button @click="${() => this.gluezero.publish('cart.add', { sku: 'X' })}">Add</button>`
 *   }
 * }
 * customElements.define('cart-button', CartButton)
 *
 * // Host (post-mount property wiring):
 * const btn = document.createElement('cart-button')
 * btn.glueZeroBroker = broker
 * btn.glueZeroContext = mfContext // opzionale
 * document.body.appendChild(btn)
 * ```
 *
 * @see {@link GlueZeroController} per uso direct senza mixin
 * @see {@link https://lit.dev/docs/composition/mixins/} Lit class mixins pattern
 * @throws {Error} se `this.gluezero.publish` / `.subscribe` chiamati con `glueZeroBroker` null
 */

import { GlueZeroController, type GlueZeroControllerHost } from './controller.js'
import type { Broker, MicroFrontendRuntimeContext } from '../types.js'

/**
 * Constructor minimal per generic mixin pattern Lit-idiomatic.
 *
 * @internal Tipo helper non esportato pubblicamente (consumer usa solo la function `GlueZeroLitMixin`).
 */
type Constructor<T = object> = new (...args: any[]) => T

/**
 * Interface aggiunta al mixed class — TypeScript helper per consumer type-narrowing.
 *
 * @example
 * ```ts
 * import type { GlueZeroLitMixinInterface } from '@gluezero/web-components/lit'
 *
 * function setupHost(el: GlueZeroLitMixinInterface) {
 *   el.glueZeroBroker = broker
 *   el.gluezero.subscribe('topic.x', () => {})
 * }
 * ```
 */
export interface GlueZeroLitMixinInterface {
  glueZeroBroker: Broker | null
  glueZeroContext: MicroFrontendRuntimeContext | null
  readonly gluezero: GlueZeroController
}

/**
 * Function class mixin Lit-idiomatic. Restituisce class che estende `Base` con
 * property `glueZeroBroker` + `glueZeroContext` + `gluezero` controller pre-istanziato.
 *
 * @param Base - Class constructor (tipicamente `LitElement` o subclass).
 * @returns Mixed class constructor compatibile con `Base & GlueZeroLitMixinInterface`.
 *
 * @example
 * ```ts
 * class MyEl extends GlueZeroLitMixin(LitElement) { … }
 * ```
 */
export function GlueZeroLitMixin<TBase extends Constructor<GlueZeroControllerHost>>(Base: TBase) {
  class GlueZeroLitElement extends (Base as Constructor<GlueZeroControllerHost>) {
    override glueZeroBroker: Broker | null = null
    override glueZeroContext: MicroFrontendRuntimeContext | null = null
    readonly gluezero: GlueZeroController

    constructor(...args: any[]) {
      super(...args)
      this.gluezero = new GlueZeroController(this as unknown as GlueZeroControllerHost)
    }
  }
  return GlueZeroLitElement as unknown as TBase & Constructor<GlueZeroLitMixinInterface>
}
