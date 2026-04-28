// Broker — composition root del @sembridge/core (PRD §10, §15, §27;
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
import type { PluginDescriptor } from '../types/plugin'
import type { SubscribeOptions, Subscription } from '../types/subscription'
import type { EventTap, PipelineStep } from '../types/tap'
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

export class Broker {
  private readonly bus: EventBus
  private readonly plugins: PluginRegistry
  private readonly topics = new TopicRegistry()
  private logger: BrokerLogger
  private readonly tap: EventTap
  private debugMode: boolean
  private readonly currentLogLevel: LogLevel

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
  }

  publish<T>(
    topic: string,
    payload: T,
    options: Omit<PublishParams<T>, 'topic' | 'payload'> = {},
  ): void {
    const event = createBrokerEvent<T>({ topic, payload, ...options }, undefined)
    this.topics.register(topic)
    this.bus.publish(event)
  }

  subscribe(
    pattern: string,
    handler: (event: BrokerEvent) => void | Promise<void>,
    options: SubscribeOptions = {},
  ): Subscription {
    return this.bus.subscribe(pattern, handler, options)
  }

  registerPlugin(descriptor: PluginDescriptor): Promise<void> {
    return this.plugins.register(descriptor)
  }

  unregisterPlugin(id: string): Promise<void> {
    return this.plugins.unregister(id)
  }

  getTopicRegistry(): readonly string[] {
    return this.topics.list()
  }

  setLogger(logger: BrokerLogger): void {
    this.logger = logger
  }

  enableDebug(): void {
    this.debugMode = true
    this.bus.setDebugMode(true)
  }

  disableDebug(): void {
    this.debugMode = false
    this.bus.setDebugMode(false)
  }

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
}
