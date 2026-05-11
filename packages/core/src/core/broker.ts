// Broker — composition root del @gluezero/core (PRD §10, §15, §27;
// REQ CORE-02, CORE-04, CORE-11, CORE-14, LIFE-01, LIFE-02; D-28, D-29, D-30).
//
// Composizione interna:
//   - EventBus (plan 07): dispatch pub/sub, handler isolation, tap orchestration
//   - PluginRegistry (plan 08 — sopra): lifecycle + cascade D-26
//   - TopicRegistry (plan 06): elenco topic noti
//   - BrokerLogger (plan 04): default createConsoleLogger(level), swap via setLogger
//   - EventTap (plan 04): default noopEventTap, override via config.runtime.tap
//
// Surface pubblica:
//   publish<T>(topic, payload, options?): void
//   subscribe(pattern, handler, options?): Subscription
//   registerPlugin(descriptor): Promise<void>
//   unregisterPlugin(id): Promise<void>
//   getTopicRegistry(): readonly string[]
//   setLogger(logger): void
//   enableDebug(): void              — D-29 toggle deep-freeze + verbose logging
//   disableDebug(): void             — D-29
//   getDebugSnapshot(): { ... }      — D-28 6 fields
//
// PluginContext.broker enforcement (D-26 punto 1):
// Il PluginRegistry riceve un buildContext factory che wrappa `this` con
// `createPluginScopedBroker(this, this.bus, id)`. Le subscription create dentro
// hooks plugin sono auto-tagged con `ownerId=pluginId`, e cascade unsubscribe
// (`bus.unsubscribeByOwner(id)`) le rimuove al `unregisterPlugin` senza richiedere
// AbortSignal hookup esplicito. Risolve il `unknown` placeholder di
// `PluginContext.broker` (plan 03) — il wrapper espone strutturalmente la stessa
// API pubblica del Broker root, ma con `subscribe` re-routato.
//
// D-30 (no singleton): nessuna istanza globale; ogni `new Broker(config)` ritorna
// istanza separata. Verifica copertura tramite `createBroker()` test (public-factory).
//
// Riferimento decisione D-29:
// `runtime.debug` di default = `import.meta.env.DEV` quando disponibile (build
// browser bundler). Fallback a `false` se `import.meta.env` non accessibile
// (es. test runner Node dove la prop non è iniettata da Vite/tsup). Try/catch
// per evitare ReferenceError su runtime esotici.

import type { BrokerEvent } from '../types/broker-event'
import type { BrokerConfig } from '../types/config'
import type { BrokerLogger, LogLevel } from '../types/logger'
import type { BrokerModule, BrokerModuleContext } from '../types/module'
import type { PluginDescriptor } from '../types/plugin'
import type { SubscribeOptions, Subscription } from '../types/subscription'
import type { EventTap, PipelineStep } from '../types/tap'
import { createBrokerError } from './broker-error'
import { EventBus } from './bus'
import { createBrokerEvent, type PublishParams } from './event-factory'
import { noopEventTap } from './event-tap'
import { createConsoleLogger } from './logger'
import { createPluginScopedBroker, PluginRegistry } from './plugin-registry'
import { TopicRegistry } from './topic-registry'

// Shape del meta env iniettato dai bundler (Vite/tsup) in build browser.
interface ImportMetaEnv {
  readonly DEV?: boolean
}

// Shape ritornata da `getDebugSnapshot()` — D-28.
export interface BrokerDebugSnapshot {
  readonly topics: string[]
  readonly subscriberCount: Record<string, number>
  readonly pluginIds: string[]
  readonly pendingAsyncDelivery: number
  readonly logLevel: LogLevel
  readonly pipelineSteps: PipelineStep[]
}

const F1_PIPELINE_STEPS: PipelineStep[] = [
  'event.received',
  'event.metadata.enriched',
  'event.validated',
  'event.dedupe.checked',
  'event.delivered',
]

/**
 * Core event broker. Composition of `EventBus` + `PluginRegistry` + `TopicRegistry`.
 *
 * Created via {@link createBroker} factory. No singleton pattern (D-30).
 *
 * Implements pub/sub with wildcard subscribe, plugin lifecycle anti-leak,
 * deep-freeze in dev mode, EventTap pre-instrumented on 5 F1 pipeline steps.
 */
export class Broker {
  private readonly bus: EventBus
  private readonly plugins: PluginRegistry
  private readonly topics = new TopicRegistry()
  private logger: BrokerLogger
  private readonly tap: EventTap
  private debugMode: boolean
  private readonly currentLogLevel: LogLevel

  private readonly services = new Map<string, unknown>()
  private readonly publishInterceptors: Array<(evt: unknown) => unknown | null> = []

  /**
   * Construct a new Broker. Prefer {@link createBroker} factory for consumer code
   * (it adds Valibot config validation).
   *
   * @param config - Optional broker configuration. F1 reads `runtime` and `debug`;
   *   F2-F6 sections are accepted but ignored at runtime in F1.
   */
  constructor(config: BrokerConfig = {}) {
    let isDev = false
    try {
      const meta = import.meta as unknown as { env?: ImportMetaEnv }
      isDev = meta?.env?.DEV ?? false
    } catch {
      isDev = false
    }
    this.debugMode = config.runtime?.debug ?? isDev
    this.currentLogLevel = config.runtime?.logLevel ?? 'info'
    this.logger = config.runtime?.logger ?? createConsoleLogger(this.currentLogLevel)
    this.tap = config.runtime?.tap ?? noopEventTap

    this.bus = new EventBus(this.logger, this.tap, { debug: this.debugMode })

    this.plugins = new PluginRegistry(this.bus, this.logger, (id, signal) => ({
      id,
      logger: this.logger,
      // D-26 punto 1 enforcement: scoped wrapper auto-tagga ownerId su ogni subscribe()
      // così cascade unsubscribeByOwner durante unregisterPlugin rimuove le subscription
      // create dentro hooks plugin in modo naturale (no AbortSignal hookup richiesto).
      broker: createPluginScopedBroker(this, this.bus, id),
      signal,
    }))

    const modules = config.modules ?? []
    if (modules.length > 0) {
      const ctx: BrokerModuleContext = {
        broker: this,
        config,
        logger: this.logger,
        registerService: <T>(name: string, instance: T): void => {
          if (this.services.has(name)) {
            throw createBrokerError({
              code: 'service.duplicate',
              category: 'config',
              message: `Service "${name}" already registered`,
            })
          }
          this.services.set(name, instance)
        },
        getService: <T>(name: string): T | undefined =>
          this.services.get(name) as T | undefined,
        publishInterceptors: this.publishInterceptors,
      }
      for (const m of modules) {
        try {
          void m.install(ctx)
        } catch (err) {
          throw createBrokerError({
            code: 'module.install.failed',
            category: 'config',
            message: `Module "${m.id}" install failed`,
            originalError: err instanceof Error ? err : new Error(String(err)),
          })
        }
      }
    }
  }

  /**
   * Publish an event to the broker.
   *
   * Builds a `BrokerEvent` via factory (with `id` from nanoid, `timestamp` from
   * `Date.now()` if not provided), validates the event shape (VAL-01), and
   * dispatches to matching subscribers.
   *
   * Default `deliveryMode` is `'async'` (D-01) via `queueMicrotask` — handler
   * invocation is deferred to next microtask, preventing re-entrancy stack
   * overflow.
   *
   * @typeParam T - Payload type. Frozen recursively in dev mode (D-04).
   * @param topic - Topic name. Must match `<entity>.<action>.<status>` (lowercase,
   *   dot-separated). Validated against regex `/^[a-z][a-z0-9]*(\.[a-z][a-z0-9*]*)*$/`.
   * @param payload - Event payload.
   * @param options - Publish options (`source` required, `deliveryMode`, `priority`,
   *   `correlationId`, `ttlMs`, `dedupeKey`, etc.).
   * @throws {BrokerError} `topic.invalid` if topic name fails regex.
   * @throws {BrokerError} `event.source.missing` if no source provided.
   * @throws {BrokerError} `event.validation.failed` if BrokerEvent shape invalid.
   *
   * @example
   * ```ts
   * broker.publish('weather.requested', { city: 'Roma' }, {
   *   source: { type: 'plugin', id: 'weather-form' },
   *   deliveryMode: 'async',
   * })
   * ```
   */
  publish<T>(
    topic: string,
    payload: T,
    options: Omit<PublishParams<T>, 'topic' | 'payload'> = {},
  ): void {
    if (this.publishInterceptors.length === 0) {
      const event = createBrokerEvent<T>({ topic, payload, ...options }, undefined)
      this.topics.register(topic)
      this.bus.publish(event)
      return
    }
    const event = createBrokerEvent<T>({ topic, payload, ...options }, undefined)
    this.topics.register(topic)
    this.bus.publish(event)
  }

  /**
   * Subscribe to a topic or topic pattern.
   *
   * Patterns support wildcards: `weather.*` (single segment), `*.failed` (leading),
   * `weather.*.failed` (multi-position, D-11).
   *
   * Handler errors are isolated (CORE-12) and re-published as `system.error`
   * `BrokerEvent`. Other handlers continue to run.
   *
   * @param pattern - Topic or pattern to subscribe to.
   * @param handler - Function invoked when matching event published.
   * @param options - `signal` (AbortSignal for auto-unsubscribe), `once`,
   *   `priority`, `deliveryMode`.
   * @returns A {@link Subscription} handle with idempotent `.unsubscribe()`.
   *
   * @example
   * ```ts
   * const sub = broker.subscribe('weather.*', (event) => console.log(event))
   * sub.unsubscribe()
   * ```
   */
  subscribe(
    pattern: string,
    handler: (event: BrokerEvent) => void | Promise<void>,
    options: SubscribeOptions = {},
  ): Subscription {
    return this.bus.subscribe(pattern, handler, options)
  }

  /**
   * Register a plugin with lifecycle hooks.
   *
   * Lifecycle execution order (D-25):
   * 1. transitionState: `unregistered → registered`
   * 2. await `onRegister(ctx)`
   * 3. transitionState: `registered → mounting`
   * 4. await `onMount(ctx)`
   * 5. transitionState: `mounting → mounted`
   *
   * @param descriptor - Plugin descriptor with optional hooks.
   * @returns Promise resolving when `onMount` completes.
   * @throws {BrokerError} `plugin.id.duplicate` if a plugin with the same id is already registered.
   * @throws {BrokerError} `plugin.lifecycle.failed` if `onRegister` or `onMount` throws.
   */
  registerPlugin(descriptor: PluginDescriptor): Promise<void> {
    return this.plugins.register(descriptor)
  }

  /**
   * Unregister a plugin with mandatory cascade cleanup (D-26, LIFE-02 — closes PRD §39 #7).
   *
   * Cleanup order:
   * 1. await `onUnmount(ctx)` — errors caught + logged but cascade proceeds
   * 2. `bus.unsubscribeByOwner(id)` — removes all subscriptions registered with
   *    `signal: ctx.signal`
   * 3. `abortController.abort()` — fires `AbortSignal` for in-flight async handlers
   * 4. `onDestroy(ctx)` — sync, errors logged
   *
   * After unregister: {@link getDebugSnapshot} counters return to pre-registration baseline.
   *
   * @param id - Plugin id to unregister.
   * @returns Promise resolving when cascade completes.
   * @throws {BrokerError} `plugin.not-found` if no plugin with the given id.
   */
  unregisterPlugin(id: string): Promise<void> {
    return this.plugins.unregister(id)
  }

  /**
   * Get the list of all topic names ever published or registered (CORE-03).
   *
   * @returns Readonly array of topic names.
   */
  getTopicRegistry(): readonly string[] {
    return this.topics.list()
  }

  /**
   * Replace the runtime logger.
   *
   * @param logger - Custom {@link BrokerLogger} (e.g. pino, winston, telemetry adapter).
   */
  setLogger(logger: BrokerLogger): void {
    this.logger = logger
  }

  /**
   * Enable debug mode: deep-freeze runtime + verbose tap snapshots (D-29).
   */
  enableDebug(): void {
    this.debugMode = true
    this.bus.setDebugMode(true)
  }

  /**
   * Disable debug mode (production default).
   */
  disableDebug(): void {
    this.debugMode = false
    this.bus.setDebugMode(false)
  }

  /**
   * Get a snapshot of the current broker state for debugging (D-28).
   *
   * In F1 returns: `topics`, `subscriberCount` per topic, `pluginIds`,
   * `pendingAsyncDelivery`, `logLevel`, `pipelineSteps`. F6 will extend with
   * full metrics.
   *
   * @returns Snapshot of broker state.
   */
  getDebugSnapshot(): BrokerDebugSnapshot {
    const stats = this.bus.getStats()
    return {
      topics: stats.topics,
      subscriberCount: stats.subscriberCount,
      pluginIds: this.plugins.list(),
      pendingAsyncDelivery: stats.pendingAsyncDelivery,
      logLevel: this.currentLogLevel,
      pipelineSteps: F1_PIPELINE_STEPS,
    }
  }

  /** MIN-2 v2.0 (D-V2-16): cascade unsubscribe by ownerId convention `mf:${id}`. */
  unsubscribeByOwner(ownerId: string): number {
    return this.bus.unsubscribeByOwner(ownerId)
  }

  /** MIN-1 v2.0 (D-V2-02): lookup service registrato da modulo opt-in. */
  getService<T>(name: string): T | undefined {
    return this.services.get(name) as T | undefined
  }
}
