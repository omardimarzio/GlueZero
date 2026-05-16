/**
 * `GlueZeroElement` — base class opzionale per Custom Elements che integrano GlueZero.
 *
 * Fornisce tre capability core (D-V2-F17-05/06/08):
 *
 * 1. **Property-mode context wiring** (D-V2-F17-06):
 *    `glueZeroBroker` + `glueZeroContext` esposte come properties; l'host invoca
 *    `element.glueZeroBroker = broker` (NON observed attributes — broker non è
 *    serializzabile come string attribute). Carryover F15 `wc-loader.ts`
 *    `contextMode='property'`.
 *
 * 2. **Cleanup automatico AbortController** (D-V2-F17-05):
 *    `_abortController` istanziato in `constructor`; `disconnectedCallback()` invoca
 *    `_abortController.abort()` → tutte le subscription registrate via
 *    `this.subscribe(...)` (con auto-iniezione `signal`) sono unsubscribed in
 *    una sola operazione idempotente. `broker.subscribe` accetta nativamente
 *    `{signal}` (F1 — verificato `packages/core/src/core/broker.ts` linea 230).
 *
 * 3. **Helper instance methods** (D-V2-F17-08):
 *    - `this.publish(topic, payload)` — wrap `broker.publish` con auto-iniezione
 *      `metadata.microFrontendId` da `this.glueZeroContext.id` (MF-OBS-01 carryover F8)
 *      e `source` di default (`{ type: 'component', id: mfId ?? 'wc' }`) se non fornito
 *    - `this.subscribe(topic, handler)` — wrap `broker.subscribe` con auto-iniezione
 *      `signal: this._abortController.signal`
 *
 * NO auto-register `customElements.define()` in questo modulo — l'host registra
 * esplicitamente con nome custom per evitare conflitti registry tra MF multipli
 * (T-17-03-01). `package.json` ha `sideEffects: false`.
 *
 * @example Sottoclasse Custom Element
 * ```ts
 * class CartButton extends GlueZeroElement {
 *   onContextReady() {
 *     this.subscribe('cart.total.changed', (e) => this.render(e.payload))
 *   }
 *   private render(total: unknown) {
 *     this.textContent = `Total: ${String(total)}`
 *   }
 * }
 * customElements.define('cart-button', CartButton)
 *
 * // Host (post-mount property wiring):
 * const el = document.createElement('cart-button') as CartButton
 * el.glueZeroBroker = broker
 * el.glueZeroContext = mfContext // optional
 * document.body.appendChild(el)
 * ```
 *
 * @example Publish dal componente
 * ```ts
 * class AddToCart extends GlueZeroElement {
 *   connectedCallback() {
 *     this.onclick = () => this.publish('cart.add.requested', { sku: 'X-1' })
 *   }
 * }
 * ```
 *
 * @see {@link https://github.com/omardimarzio/GlueZero/blob/main/prd_2.0.0.md#28.5} PRD §28.5 Web Components integration
 * @see {@link GlueZeroController} per integrazione Lit 3.x via ReactiveController
 * @throws {Error} se `publish` / `subscribe` chiamati prima di `glueZeroBroker` setter
 * @packageDocumentation
 */

import type { Broker, BrokerEvent, EventSource, SubscribeOptions, Subscription } from '@gluezero/core'
import type { MicroFrontendRuntimeContext } from '@gluezero/microfrontends'
import type { WcPublishOptions } from './types.js'

/**
 * Base class HTMLElement opzionale con GlueZero context + cleanup unificato.
 *
 * Subclass MUST chiamare `super.disconnectedCallback()` se override del lifecycle hook.
 */
export class GlueZeroElement extends HTMLElement {
  /**
   * AbortController per cleanup unificato di tutte le subscription registrate via
   * `this.subscribe(...)`. Abortito in `disconnectedCallback`.
   */
  protected _abortController: AbortController

  /**
   * Promise risolta quando `glueZeroBroker` è settato (e `glueZeroContext` se mai
   * settato → flag `_expectingContext`). Use case: subclass attende `await this.ready`
   * prima di richiamare `this.publish` / `this.subscribe`.
   */
  readonly ready: Promise<void>

  /** @internal Resolver della Promise `ready`. */
  private _resolveReady!: () => void

  /** @internal Storage broker — null finché setter non invocato. */
  private _broker: Broker | null = null

  /** @internal Storage context — null finché setter non invocato. */
  private _context: MicroFrontendRuntimeContext | null = null

  /** @internal Flag: setter `glueZeroContext` invocato → `ready` aspetta entrambi (T-17-03-03). */
  private _expectingContext = false

  /** @internal Flag: `ready` Promise già risolta (idempotency su setter multipli). */
  private _readyResolved = false

  constructor() {
    super()
    this._abortController = new AbortController()
    this.ready = new Promise<void>((resolve) => {
      this._resolveReady = resolve
    })
  }

  /**
   * Setter property — host invoca `element.glueZeroBroker = broker` post-mount.
   *
   * Trigger automatico:
   * - Aggiorna storage interno
   * - Verifica condizione `ready` (broker + context se previsto) → resolve Promise + invoca `onContextReady` hook
   *
   * @see D-V2-F17-06 property-mode context wiring
   */
  set glueZeroBroker(broker: Broker | null) {
    this._broker = broker
    this._maybeResolveReady()
  }
  get glueZeroBroker(): Broker | null {
    return this._broker
  }

  /**
   * Setter property — host invoca `element.glueZeroContext = ctx` post-mount.
   *
   * Marca `_expectingContext = true`: una volta invocato, `ready` aspetta SIA broker
   * SIA context per risolvere (T-17-03-03 mitigation: evita `onContextReady` premature
   * fire quando setter broker arriva prima di context atteso).
   */
  set glueZeroContext(context: MicroFrontendRuntimeContext | null) {
    this._expectingContext = true
    this._context = context
    this._maybeResolveReady()
  }
  get glueZeroContext(): MicroFrontendRuntimeContext | null {
    return this._context
  }

  /**
   * Verifica condizioni `ready`:
   * - broker settato (non null), AND
   * - context settato (se mai chiamato setter `glueZeroContext`)
   *
   * Idempotent: resolve Promise + invoca hook UNA sola volta anche se setter chiamati ripetutamente.
   */
  private _maybeResolveReady(): void {
    if (this._readyResolved) return
    const hasBroker = this._broker !== null
    const hasContextIfExpected = !this._expectingContext || this._context !== null
    if (hasBroker && hasContextIfExpected) {
      this._readyResolved = true
      this._resolveReady()
      try {
        this.onContextReady?.()
      } catch {
        // swallow: subclass hook error non deve impedire bootstrap
      }
    }
  }

  /**
   * Hook overridabile — invocato UNA volta dopo che broker (e context se previsto)
   * sono settati. Default no-op.
   *
   * Use case: subclass registra subscription qui invece che in `connectedCallback`
   * (dove broker potrebbe non essere ancora settato).
   *
   * @example
   * ```ts
   * class MyEl extends GlueZeroElement {
   *   onContextReady() {
   *     this.subscribe('topic.x', (e) => console.log(e.payload))
   *   }
   * }
   * ```
   */
  onContextReady?(): void

  /**
   * Standard Custom Elements `disconnectedCallback`. Abort signal → cleanup unificato
   * di tutte le subscription registrate via `this.subscribe(...)`.
   *
   * Subclass MUST chiamare `super.disconnectedCallback()` se override del lifecycle hook.
   */
  disconnectedCallback(): void {
    this._abortController.abort()
  }

  /**
   * Publish topic con auto-iniezione `metadata.microFrontendId` (MF-OBS-01 carryover F8)
   * + auto-iniezione `source: { type: 'component', id: <mfId|'wc'> }` se non fornito.
   *
   * Le `metadata` custom passate in `options` sono PRESERVATE (merge — `microFrontendId`
   * non sovrascrive proprietà esistenti diverse).
   *
   * @typeParam T - Payload type.
   * @param topic - Topic name (`<entity>.<action>.<status>` lowercase dot-separated).
   * @param payload - Event payload.
   * @param options - Publish options (vedi {@link WcPublishOptions}).
   * @throws {Error} se `glueZeroBroker` non ancora settato dall'host.
   *
   * @example
   * ```ts
   * this.publish('cart.add.requested', { sku: 'X-1' })
   * // → broker.publish con metadata.microFrontendId = this.glueZeroContext.id
   * ```
   */
  publish<T = unknown>(topic: string, payload?: T, options?: WcPublishOptions): void {
    const broker = this._broker
    if (broker === null) {
      throw new Error(
        'GlueZeroElement.publish() chiamato prima che `glueZeroBroker` sia settato. ' +
          "Assicurati che l'host esegua `element.glueZeroBroker = broker` prima del rendering.",
      )
    }
    const mfId = this._context?.id ?? null
    const baseMetadata = options?.metadata ?? {}
    const metadata = mfId !== null ? { microFrontendId: mfId, ...baseMetadata } : baseMetadata
    const source: EventSource = options?.source ?? {
      type: 'component',
      id: mfId ?? 'wc',
    }
    broker.publish(topic, payload as T, {
      ...options,
      source,
      metadata,
    })
  }

  /**
   * Subscribe topic con auto-iniezione `signal: this._abortController.signal`
   * → cleanup automatico su `disconnectedCallback()` (D-V2-F17-05).
   *
   * Se `options.signal` è fornito esplicitamente, viene comunque rispettato
   * (override possibile, ma raro — il default copre il 99% dei casi).
   *
   * @param pattern - Topic o pattern di subscribe (wildcard `weather.*` supportati).
   * @param handler - Function invocata al match (`event: BrokerEvent => void | Promise<void>`).
   * @param options - Subscribe options (vedi {@link SubscribeOptions}).
   * @throws {Error} se `glueZeroBroker` non ancora settato dall'host.
   * @returns Subscription handle con `unsubscribe()` idempotente.
   *
   * @example
   * ```ts
   * const sub = this.subscribe('cart.updated', (e) => this.render(e.payload))
   * // sub.unsubscribe() opzionale — cleanup automatico su disconnect
   * ```
   */
  subscribe(
    pattern: string,
    handler: (event: BrokerEvent) => void | Promise<void>,
    options?: SubscribeOptions,
  ): Subscription {
    const broker = this._broker
    if (broker === null) {
      throw new Error('GlueZeroElement.subscribe() chiamato prima che `glueZeroBroker` sia settato.')
    }
    return broker.subscribe(pattern, handler, {
      ...options,
      signal: options?.signal ?? this._abortController.signal,
    })
  }
}
