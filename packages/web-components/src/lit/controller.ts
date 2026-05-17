/**
 * `GlueZeroController` — Lit 3.x `ReactiveController` per GlueZero integration (D-V2-F17-07 tier 1).
 *
 * Two-tier pattern:
 * 1. **Questo file** — building block low-level: developer Lit avanzato istanzia controller
 *    direttamente come property dell'host `LitElement`.
 * 2. {@link GlueZeroLitMixin} (file `mixin.ts`) — wrapper ergonomic class mixin che
 *    inietta automaticamente il controller in `this.gluezero`.
 *
 * Capability:
 * - **Lit lifecycle integration**: `hostConnected` ricrea AbortController su re-mount;
 *   `hostDisconnected` invoca `abort()` (D-V2-F17-05 cleanup).
 * - **Auto-iniezione metadata.microFrontendId** (MF-OBS-01 carryover F8): wrap `publish`
 *   con `metadata.microFrontendId` da `host.glueZeroContext.id`.
 * - **Auto-iniezione signal**: wrap `subscribe` con `signal: this._abortController.signal`.
 * - **Peer optional Lit**: NO import statico `lit` qui — usa interface strutturale
 *   {@link GlueZeroControllerHost} che `LitElement` implementa automaticamente
 *   (Lit `ReactiveControllerHost` superset).
 *
 * @example Uso diretto controller (avanzato)
 * ```ts
 * import { LitElement, html } from 'lit'
 * import { GlueZeroController } from '@gluezero/web-components/lit'
 *
 * class MyEl extends LitElement {
 *   gluezero = new GlueZeroController(this)
 *   glueZeroBroker = null
 *   glueZeroContext = null
 *   render() {
 *     return html`<button @click="${() => this.gluezero.publish('clicked', {})}">+</button>`
 *   }
 * }
 * customElements.define('my-el', MyEl)
 * ```
 *
 * @see {@link GlueZeroLitMixin} ergonomic wrapper raccomandato per uso comune
 * @see {@link https://lit.dev/docs/composition/controllers/} Lit ReactiveController docs
 * @throws {Error} se `publish` / `subscribe` chiamati con `host.glueZeroBroker` null
 */

import type {
  Broker,
  BrokerEvent,
  EventSource,
  MicroFrontendRuntimeContext,
  SubscribeOptions,
  Subscription,
  WcPublishOptions,
} from '../types.js'

/**
 * Subset minimo di Lit `ReactiveControllerHost` — evita peer import statico di `lit`.
 *
 * `LitElement` implementa nativamente questo shape (più ampio). Property `glueZeroBroker` +
 * `glueZeroContext` sono aggiunte alla shape per property-mode context wiring
 * (D-V2-F17-06 — carryover GlueZeroElement).
 */
export interface GlueZeroControllerHost {
  /** Aggiunge un controller al lifecycle Lit (`hostConnected` / `hostDisconnected` invocati). */
  addController(controller: { hostConnected?: () => void; hostDisconnected?: () => void }): void
  /** Optional: rimuove controller (Lit cleanup). */
  removeController?(controller: unknown): void
  /** Optional: trigger re-render Lit (non usato dal controller — esposto per consumer). */
  requestUpdate?: () => void
  /** Property-mode wiring (D-V2-F17-06): host esegue `el.glueZeroBroker = broker` post-mount. */
  glueZeroBroker?: Broker | null
  /** Property-mode wiring: context opzionale (MF-OBS-01 microFrontendId auto-injection). */
  glueZeroContext?: MicroFrontendRuntimeContext | null
}

/**
 * Reactive controller GlueZero-aware. Registrato in constructor via `host.addController(this)`.
 * Cleanup unified via AbortController nel lifecycle `hostDisconnected`.
 */
export class GlueZeroController {
  /** @internal Host LitElement-like che ha registrato il controller. */
  private _host: GlueZeroControllerHost

  /** @internal AbortController per cleanup unified — re-creato in hostConnected. */
  private _abortController: AbortController

  constructor(host: GlueZeroControllerHost) {
    this._host = host
    this._abortController = new AbortController()
    host.addController(this)
  }

  /**
   * Lit lifecycle hook — invocato al mount/re-mount dell'host.
   *
   * Re-crea AbortController se signal precedente è aborted (re-mount cycle: l'host
   * potrebbe essere stato `disconnected` e poi `connected` di nuovo — Lit garantisce
   * lifecycle deterministic).
   */
  hostConnected(): void {
    if (this._abortController.signal.aborted) {
      this._abortController = new AbortController()
    }
  }

  /**
   * Lit lifecycle hook — invocato al unmount dell'host.
   *
   * `abort()` → tutte le subscription registrate via `this.subscribe(...)` sono
   * unsubscribed in single operation (D-V2-F17-05 cleanup unified).
   */
  hostDisconnected(): void {
    this._abortController.abort()
  }

  /** Getter — broker dell'host (null finché setter non invocato). */
  get broker(): Broker | null {
    return this._host.glueZeroBroker ?? null
  }

  /** Getter — context MF dell'host (null finché setter non invocato, opzionale). */
  get context(): MicroFrontendRuntimeContext | null {
    return this._host.glueZeroContext ?? null
  }

  /**
   * Publish topic con auto-iniezione `metadata.microFrontendId` (MF-OBS-01 carryover F8)
   * + auto-iniezione `source: { type: 'component', id: <mfId|'wc'> }` se non fornito.
   *
   * @typeParam T - Payload type.
   * @param topic - Topic name (`<entity>.<action>.<status>`).
   * @param payload - Event payload.
   * @param options - Publish options (vedi {@link WcPublishOptions}).
   * @throws {Error} se `host.glueZeroBroker` non settato.
   *
   * @example
   * ```ts
   * this.gluezero.publish('cart.add', { sku: 'X-1' })
   * ```
   */
  publish<T = unknown>(topic: string, payload?: T, options?: WcPublishOptions): void {
    const broker = this.broker
    if (broker === null) {
      throw new Error(
        'GlueZeroController.publish() chiamato prima che `host.glueZeroBroker` sia settato.',
      )
    }
    const mfId = this.context?.id ?? null
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
   * → cleanup automatico su `hostDisconnected` (D-V2-F17-05).
   *
   * Defensive layer (Rule 2): se signal è già aborted al momento del subscribe
   * (anti-pattern), ritorna no-op subscription handle per evitare memory leak.
   *
   * @param pattern - Topic / pattern di subscribe (wildcard `weather.*` supportati).
   * @param handler - Function invocata al match.
   * @param options - Subscribe options.
   * @throws {Error} se `host.glueZeroBroker` non settato.
   * @returns Subscription handle (idempotent `unsubscribe`).
   *
   * @example
   * ```ts
   * this.gluezero.subscribe('cart.updated', (e) => this.requestUpdate())
   * ```
   */
  subscribe(
    pattern: string,
    handler: (event: BrokerEvent) => void | Promise<void>,
    options?: SubscribeOptions,
  ): Subscription {
    const broker = this.broker
    if (broker === null) {
      throw new Error(
        'GlueZeroController.subscribe() chiamato prima che `host.glueZeroBroker` sia settato.',
      )
    }
    const signal = options?.signal ?? this._abortController.signal
    if (signal.aborted) {
      return {
        get id() {
          return ''
        },
        get topic() {
          return pattern
        },
        get active() {
          return false
        },
        unsubscribe(): void {
          /* no-op */
        },
      } as Subscription
    }
    return broker.subscribe(pattern, handler, { ...options, signal })
  }
}
