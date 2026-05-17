/**
 * Module Extension Runtime types (PRD §6.1, §36 — MIN-1 v2.0).
 *
 * MF-MOD-01: `BrokerModule` interface installato opt-in via `createBroker({ modules: [...] })`.
 * MF-MOD-04: Service locator typed via `BrokerModuleContext.registerService/getService`.
 *
 * Pattern: composition esterna pura. Il modulo NON deve mutare il prototype del
 * Broker — usa `ctx.registerService` (D-V2-02 service locator) + Pattern S1
 * augment opzionale documentato dai package downstream (es. `@gluezero/microfrontends/augment`).
 *
 * Loop install su array vuoto = bit-exact v1.x (PRD §6.2 MF-MOD-02 — bundle delta
 * 0 byte per consumer v1.x senza `modules` field). Fail-fast su install throw:
 * il broker abortisce il construction con `BrokerError { code: 'module.install.failed' }`.
 *
 * @see RESEARCH §1.1 (interface) + §1.4 (decisioni puntuali)
 * @see PRD §6.1 Module Extension Runtime, §36 API surface
 */
import type { Broker } from '../core/broker'
import type { BrokerConfig } from './config'
import type { BrokerLogger } from './logger'

/**
 * Modulo opt-in installato al construction del Broker (PRD §6.1, §36).
 *
 * Il modulo riceve un `BrokerModuleContext` con accesso al broker host, config
 * originale, logger condiviso, registry service tipizzato e seam interceptor
 * `publishInterceptors` (F8 hook vuoto, F11 attiverà permission check).
 *
 * @example
 * ```ts
 * import { createBroker, type BrokerModule } from '@gluezero/core'
 *
 * const myModule: BrokerModule = {
 *   id: 'my-feature',
 *   version: '1.0.0',
 *   install(ctx) {
 *     ctx.registerService('my-feature', { hello: () => 'world' })
 *   },
 * }
 *
 * const broker = createBroker({ modules: [myModule] })
 * const svc = broker.getService<{ hello: () => string }>('my-feature')
 * console.log(svc?.hello()) // 'world'
 * ```
 *
 * @see Broker#getService per il lookup del service registrato.
 * @see SERVICE_MICROFRONTENDS in `./services` per le const standard.
 */
export interface BrokerModule {
  /** Unique id — usato per dedupe e debug. Es. 'microfrontends', 'mf-esm'. */
  readonly id: string

  /** Versione del modulo — utile per compat check downstream. */
  readonly version?: string

  /**
   * Installazione one-shot. Il broker chiama questo metodo durante il
   * construction DOPO che `EventBus`/`PluginRegistry`/`TopicRegistry`/logger/tap
   * sono inizializzati.
   *
   * Il modulo PUÒ:
   * - registrare service via `ctx.registerService(name, instance)`
   * - sottoscriversi a topic interni (`ctx.broker.subscribe`)
   * - aggiungere interceptor (`ctx.publishInterceptors.push(fn)` — F11 attivo, F8 seam vuoto)
   * - leggere config (`ctx.config`)
   *
   * Sincrono OR async — il broker chiama `void m.install(ctx)` fire-and-forget.
   * Il modulo gestisce async internamente.
   *
   * @throws Se `install` throws, `createBroker` re-throws come `BrokerError`
   *   con `code: 'module.install.failed'` (fail-fast abort).
   */
  install(ctx: BrokerModuleContext): void | Promise<void>
}

/**
 * Context passato all'install hook del modulo.
 *
 * @see BrokerModule#install
 */
export interface BrokerModuleContext {
  /** Reference al Broker host (per subscribe/publish/registerPlugin se serve). */
  readonly broker: Broker

  /** Config originale passata a `createBroker` (read-only). */
  readonly config: BrokerConfig

  /** Logger condiviso del broker. I moduli possono creare child logger con scope. */
  readonly logger: BrokerLogger

  /**
   * Registra service tipizzato (D-V2-02 — chiave const string).
   *
   * @throws `BrokerError` con `code: 'service.duplicate'` se `name` già registrato.
   */
  registerService<T>(name: string, instance: T): void

  /**
   * Lookup service registrato da altri modules.
   * Returns `undefined` se non registrato.
   */
  getService<T>(name: string): T | undefined

  /**
   * EventTap hook seam vuoto in F8 (D-V2-F8-13). F11 vi aggiunge permission check.
   * I moduli aggiungono interceptor via push() durante install.
   *
   * Fast-path MANDATORY nel `broker.publish`:
   * `if (publishInterceptors.length === 0) return doPublishFast(...)`
   *
   * @see RESEARCH §1.4 decisioni puntuali — mutable Array (NOT readonly)
   */
  publishInterceptors: Array<(evt: unknown) => unknown | null>
}
