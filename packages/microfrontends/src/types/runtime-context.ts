/**
 * MicroFrontend runtime context + module types (PRD §13, MF-LIFE-03).
 *
 * Facade injection: `publish` arricchisce `{microFrontendId, microFrontendVersion,
 * lifecycleState}` ai metadata. `subscribe` auto-tagga `ownerId: 'mf:${id}'`
 * per cascade unsubscribe (D-V2-16).
 *
 * Explicit object (NOT Proxy) — RESEARCH §8.2 P-02 mitigation.
 *
 * @see RESEARCH §8 + PATTERNS §28
 */
// Forward import del Broker — usa "import type" per evitare ciclo
import type { Broker, BrokerLogger, SubscribeOptions, Subscription } from '@gluezero/core'
import type { MicroFrontendDescriptor } from './descriptor'

/** Handler subscription event-typed (riuso F1 pattern). */
export type MicroFrontendEventHandler = (event: unknown) => void

/** Options publish (riuso v1.x — F8 expone shape compatibile). */
export interface MicroFrontendPublishOptions {
  readonly source?: { readonly type: string; readonly id: string }
  readonly metadata?: Record<string, unknown>
  readonly priority?: 'low' | 'normal' | 'high' | 'critical'
}

/**
 * Context injection passato agli hook del `MicroFrontendRuntimeModule`.
 *
 * Placeholder fields (`map`/`routes`/`gateway`/`context`/`permissions`/`theme`)
 * sono `unknown` in F8 — valorizzati da F10-F13.
 */
export interface MicroFrontendRuntimeContext {
  readonly id: string
  readonly descriptor: MicroFrontendDescriptor

  /** Broker raw — cultural "trust" (preferire facade `publish/subscribe`). */
  readonly broker: Broker

  /**
   * Facade publish con auto-enrichment metadata
   * `{microFrontendId, microFrontendVersion, lifecycleState}` (MF-OBS-01 + PRD §39.2).
   * NON modifica pipeline §28 (D-V2-F8-13).
   */
  publish<T>(topic: string, payload: T, options?: MicroFrontendPublishOptions): void

  /**
   * Facade subscribe con auto-tag `ownerId: 'mf:${id}'` (D-V2-16 cascade).
   * Subscription cleanup automatico su unmount/destroy via
   * `broker.unsubscribeByOwner(mf:id)`.
   */
  subscribe(
    pattern: string,
    handler: MicroFrontendEventHandler,
    options?: SubscribeOptions,
  ): Subscription

  /** AbortSignal aborted su unmount (D-26 pattern F1). */
  readonly signal?: AbortSignal

  /** Logger child con scope `[mf:${id}]`. */
  readonly logger?: BrokerLogger

  /** Placeholder F10 — valorizzato da `@gluezero/context`. */
  readonly map?: unknown
  /** Placeholder F11 — valorizzato da `@gluezero/permissions`. */
  readonly routes?: unknown
  /** Placeholder F13 — valorizzato da `@gluezero/isolation`. */
  readonly gateway?: unknown
  /** Placeholder F10 — valorizzato da `@gluezero/context`. */
  readonly context?: unknown
  /** Placeholder F11 — valorizzato da `@gluezero/permissions`. */
  readonly permissions?: unknown
  /** Placeholder F13 — valorizzato da `@gluezero/isolation` (theme). */
  readonly theme?: unknown
}

/**
 * Modulo runtime del MF — 5 hook opzionali (vs 4 in PluginDescriptor v1.x).
 *
 * Pattern carryover D-25 esteso con `update` (F8) per supportare hot-reload.
 */
export interface MicroFrontendRuntimeModule {
  /** Chiamato dopo `loaded`, prima di `mount`. Inizializzazione setup-once. */
  bootstrap?(ctx: MicroFrontendRuntimeContext): void | Promise<void>

  /** Chiamato per il mount nel DOM (sequence post-bootstrap). */
  mount?(ctx: MicroFrontendRuntimeContext): void | Promise<void>

  /** Chiamato per update incrementale runtime (F9+). */
  update?(ctx: MicroFrontendRuntimeContext, changes: unknown): void | Promise<void>

  /** Chiamato per unmount dal DOM. */
  unmount?(ctx: MicroFrontendRuntimeContext): void | Promise<void>

  /** Chiamato per cleanup finale (post-unmount). Sincrono per fast cleanup. */
  destroy?(ctx: MicroFrontendRuntimeContext): void
}
