// PluginRegistry — orchestrazione lifecycle plugin (PRD §15, §24;
// REQ CORE-04, CORE-05, CORE-11, LIFE-01, LIFE-02 — chiusura PRD §39 #7).
//
// Surface pubblica:
//   register(descriptor): Promise<void>   — auto-mount D-25 (registered → mounting → mounted)
//   unregister(id): Promise<void>          — onUnmount → cascade D-26 → onDestroy → destroyed
//   list(): string[]                       — id dei plugin attualmente registrati
//   get(id): PluginRegistration | undefined — accesso interno per debug/test
//
// CASCADE D-26 (LIFE-02 — chiusura PRD §39 #7):
//   1. bus.unsubscribeByOwner(pluginId) — rimuove tutte le subscription tagged
//   2. (F3) routes registrate dal plugin — non ancora implementato
//   3. (F2) transforms registrate dal plugin — non ancora implementato
//   4. abortController.abort() — fires AbortSignal verso listener registrati con `signal`
//
// L'ordine "abort dopo unmount, prima di destroy" (RESEARCH Open Q 5):
//   - signal.aborted === false durante onUnmount: l'hook può fare cleanup ordinato
//   - signal.aborted === true durante onDestroy: hook può rilevare disposal
//
// Decisioni:
//   - D-17: id duplicato → BrokerError code='plugin.id.duplicate' (no overwrite silenzioso)
//   - D-25: state machine via transitionState — nessun salto tra stati
//   - D-26: cascade SEMPRE eseguita, anche se onUnmount/onDestroy throw (try/catch swallow)
//
// `createPluginScopedBroker(rootBroker, bus, pluginId)`:
//   Wrapper Proxy esposto come `PluginContext.broker`. Tutte le chiamate a
//   `subscribe(pattern, handler, options)` propagano automaticamente
//   `ownerId=pluginId` al bus, garantendo che D-26 punto 1
//   (`unsubscribeByOwner`) durante `unregisterPlugin` rimuova le subscription
//   create dentro hooks plugin in modo naturale (senza richiedere AbortSignal hookup).
//
//   `publish(topic, payload, options?)` auto-inietta `source: { type: 'plugin',
//   id: pluginId }` quando il caller non fornisce `options.source`. Risolve
//   l'asimmetria publisher/subscriber: prima del fix il plugin "sapeva chi era"
//   solo durante subscribe (auto-tag ownerId) ma su publish doveva ripetere il
//   proprio id manualmente, a pena di `BrokerError 'event.source.missing'` (D-23).
//   Source esplicito da parte del caller continua a vincere (override consentito,
//   p.es. plugin che pubblica per conto di un componente UI).
//
//   Gli altri metodi (registerPlugin, unregisterPlugin, getDebugSnapshot,
//   getTopicRegistry, enableDebug, disableDebug, setLogger) sono delegati invariati
//   al broker root.
//
// Threat coverage:
// - T-08-02 (Tampering — onUnmount non chiamato in cascade): try/catch attorno onUnmount;
//   cascade procede anche se hook throw (D-26 must always run). Errore loggato.
// - T-08-03 (Tampering — onDestroy non chiamato): try/catch attorno onDestroy; log error.
// - T-08-04 (Tampering — id duplicato → overwrite silenzioso): D-17 throw esplicito.
// - T-08-07 (Race condition register/unregister concorrenti): Map.has + Map.set atomici
//   in single-threaded JS; transitionState valida pre-condition; race detection via
//   state machine (transition invalida → throw).

import type { BrokerEvent, EventSource } from '../types/broker-event'
import type { BrokerError } from '../types/error'
import type { BrokerLogger } from '../types/logger'
import type { PluginContext, PluginDescriptor, PluginRegistration } from '../types/plugin'
import type { SubscribeOptions, Subscription } from '../types/subscription'
import { createBrokerError } from './broker-error'
import type { EventBus } from './bus'
import { transitionState } from './lifecycle'

// Tipo strutturale minimo del rootBroker che il wrapper accetta. Il rootBroker
// reale è la classe Broker (plan 08), ma `createPluginScopedBroker` resta agnostico
// per facilitare testing e disaccoppiamento da broker.ts (evita ciclo import).
//
// Il wrapper override `subscribe` (auto-tag ownerId) e `publish` (auto-source);
// tutti gli altri metodi sono delegati. `[key: string]: unknown` permette al
// consumer di accedere a qualsiasi metodo del rootBroker senza dover
// ridichiarare l'API completa qui.
export interface PluginScopedBroker {
  subscribe(
    pattern: string,
    handler: (event: BrokerEvent) => void | Promise<void>,
    options?: SubscribeOptions,
  ): Subscription
  publish<T>(
    topic: string,
    payload: T,
    options?: { source?: EventSource } & Record<string, unknown>,
  ): void
  [key: string]: unknown
}

/**
 * Shape strutturale che `createPluginScopedBroker` assume sul rootBroker per
 * delegare `publish`. Tipizzata localmente (non importata da broker.ts) per
 * evitare ciclo import — coerente con la filosofia agnostica del wrapper.
 */
interface RootPublisher {
  publish<T>(
    topic: string,
    payload: T,
    options?: { source?: EventSource } & Record<string, unknown>,
  ): void
}

/**
 * Crea un Proxy del rootBroker che propaga `ownerId=pluginId` al bus su ogni
 * chiamata a `subscribe()` e auto-inietta `source: { type: 'plugin', id: pluginId }`
 * su ogni chiamata a `publish()` priva di source esplicito (D-23 — chiusura
 * asimmetria publisher/subscriber). Tutti gli altri property access sono
 * delegati al rootBroker: i metodi sono auto-bound al target per mantenere
 * `this` corretto.
 *
 * Type ritorno tipizzato come `PluginScopedBroker` (interface strutturale) per
 * conformità a `isolatedDeclarations: true`.
 */
export function createPluginScopedBroker(
  rootBroker: object,
  bus: EventBus,
  pluginId: string,
): PluginScopedBroker {
  return new Proxy(rootBroker, {
    get(target, prop, receiver): unknown {
      if (prop === 'subscribe') {
        return (
          pattern: string,
          handler: (event: BrokerEvent) => void | Promise<void>,
          options: SubscribeOptions = {},
        ): Subscription => bus.subscribe(pattern, handler, options, pluginId)
      }
      if (prop === 'publish') {
        const rootPublish = (target as RootPublisher).publish.bind(target as RootPublisher)
        return <T>(
          topic: string,
          payload: T,
          options: { source?: EventSource } & Record<string, unknown> = {},
        ): void => {
          const merged: { source?: EventSource } & Record<string, unknown> = options.source
            ? options
            : { ...options, source: { type: 'plugin', id: pluginId } }
          return rootPublish<T>(topic, payload, merged)
        }
      }
      const value = Reflect.get(target, prop, receiver)
      if (typeof value === 'function') {
        return (value as (...args: unknown[]) => unknown).bind(target)
      }
      return value
    },
  }) as PluginScopedBroker
}

export class PluginRegistry {
  private readonly plugins = new Map<string, PluginRegistration>()

  constructor(
    private readonly bus: EventBus,
    private readonly logger: BrokerLogger,
    private readonly buildContext: (id: string, signal: AbortSignal) => PluginContext,
  ) {}

  async register(descriptor: PluginDescriptor): Promise<void> {
    if (this.plugins.has(descriptor.id)) {
      throw createBrokerError({
        code: 'plugin.id.duplicate',
        category: 'plugin',
        message: `Plugin id "${descriptor.id}" is already registered.`,
        details: { id: descriptor.id },
      })
    }

    const ac = new AbortController()
    const reg: PluginRegistration = {
      descriptor,
      state: 'unregistered',
      subscriptions: new Set<Subscription>(),
      abortController: ac,
      registeredAt: Date.now(),
    }
    this.plugins.set(descriptor.id, reg)

    transitionState(reg, 'registered', this.logger)

    const ctx = this.buildContext(descriptor.id, ac.signal)

    // onRegister phase — failure rolls back (registered → unmounted, plugin removed).
    try {
      await descriptor.onRegister?.(ctx)
    } catch (err) {
      const wrapped = this.toBrokerError(err, descriptor.id)
      reg.failureReason = wrapped
      // Rollback: registered → unmounted (allowed by VALID_TRANSITIONS).
      transitionState(reg, 'unmounted', this.logger)
      this.plugins.delete(descriptor.id)
      throw wrapped
    }

    // Auto-mount per D-25 (mounting → mounted | failed).
    transitionState(reg, 'mounting', this.logger)
    try {
      await descriptor.onMount?.(ctx)
      reg.mountedAt = Date.now()
      transitionState(reg, 'mounted', this.logger)
    } catch (err) {
      const wrapped = this.toBrokerError(err, descriptor.id)
      reg.failureReason = wrapped
      transitionState(reg, 'failed', this.logger)
      this.logger.error('Plugin mount failed', { id: descriptor.id, error: err })
      throw wrapped
    }
  }

  async unregister(id: string): Promise<void> {
    const reg = this.plugins.get(id)
    if (!reg) {
      throw createBrokerError({
        code: 'plugin.not-found',
        category: 'plugin',
        message: `Plugin id "${id}" not registered.`,
        details: { id },
      })
    }

    transitionState(reg, 'unmounting', this.logger)
    const ctx = this.buildContext(id, reg.abortController.signal)

    // onUnmount phase — failure does NOT block cascade (D-26 must always run).
    try {
      await reg.descriptor.onUnmount?.(ctx)
    } catch (err) {
      this.logger.error('Plugin onUnmount threw', { id, error: err })
      // continue cascade
    }

    // CASCADE CLEANUP D-26 (LIFE-02 — closes PRD §39 #7):
    //   1. unsubscribe everything owned by plugin
    //   2. (F3) routes — not yet implemented in F1
    //   3. (F2) transforms — not yet implemented in F1
    //   4. fire AbortController for in-flight async handlers
    const unsubCount = this.bus.unsubscribeByOwner(id)
    reg.abortController.abort()

    reg.subscriptions.clear()
    reg.unmountedAt = Date.now()
    transitionState(reg, 'unmounted', this.logger)

    // onDestroy phase — failure logged but cascade already complete.
    try {
      reg.descriptor.onDestroy?.(ctx)
    } catch (err) {
      this.logger.error('Plugin onDestroy threw', { id, error: err })
    }

    transitionState(reg, 'destroyed', this.logger)
    this.plugins.delete(id)

    this.logger.debug('Plugin unregistered', { id, unsubscribed: unsubCount })
  }

  list(): string[] {
    return [...this.plugins.keys()]
  }

  get(id: string): PluginRegistration | undefined {
    return this.plugins.get(id)
  }

  private toBrokerError(err: unknown, pluginId: string): BrokerError {
    return createBrokerError({
      code: 'plugin.lifecycle.failed',
      category: 'plugin',
      message: err instanceof Error ? err.message : String(err),
      ...(err instanceof Error && { originalError: err }),
      details: { pluginId },
    })
  }
}
