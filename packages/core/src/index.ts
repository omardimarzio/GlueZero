/**
 * @gluezero/core — Browser-side event broker (pub/sub, plugin registry,
 * lifecycle, BrokerEvent model, EventTap pre-instrumentation).
 *
 * ESM-only library, target ES2022 (browser evergreen).
 * Phase 1 of GlueZero V1.
 *
 * Architectural constraint (per ARCHITECTURE.md §3.2): `EventTap` is
 * pre-instrumented at the 5 F1 pipeline steps with no-op implementation by
 * default. Phase 6 substitutes the no-op with real Inspector implementations
 * without retrofit.
 *
 * Surface pubblica:
 * - {@link createBroker} factory (D-19)
 * - {@link Broker} class (composition root EventBus + PluginRegistry + TopicRegistry)
 * - {@link createBrokerError}, {@link isBrokerError} per error handling consumer-side
 * - {@link createConsoleLogger}, {@link silentLogger} per swap logger in test/produzione
 *
 * I tipi interni (es. `PluginRegistration`, `EventBusOptions`, `EventBusStats`,
 * `BrokerDebugSnapshot`, `PluginScopedBroker`) NON sono ri-esportati: restano
 * accessibili solo via path relativo per consumer interni del monorepo.
 *
 * @packageDocumentation
 */

export { Broker } from './core/broker'
export { createBrokerError, isBrokerError } from './core/broker-error'
export { createConsoleLogger, silentLogger } from './core/logger'
// Runtime exports — il cuore della libreria.
export { createBroker } from './public-factory'

// Type exports — surface tipi pubblici.
export type {
  /** Event envelope flowing through the pipeline. Frozen recursively in dev mode (D-04). */
  BrokerEvent,
  /** Delivery semantics: `'sync' | 'async'` (F1 default) | `'worker' | 'remote'` (F1 fallback to async). */
  DeliveryMode,
  /** Branded type for unique event IDs (PRD §11.3, Pitfall #12 — type confusion prevention). */
  EventId,
  /** Originator descriptor (plugin/component/server/worker/system). Required at publish (D-23). */
  EventSource,
  /** Event priority: `'low' | 'normal'` (default) | `'high' | 'critical'`. */
  Priority,
} from './types/broker-event'
export type {
  /** Broker configuration with sections: `runtime`, `debug` (F1) + placeholders for F2-F6. */
  BrokerConfig,
} from './types/config'
export type {
  /** Recursive readonly utility type. Used for `BrokerEvent.payload` enforcement (D-07). */
  DeepReadonly,
} from './types/deep-readonly'
export type {
  /** Error type thrown by the broker, extending `Error` with `code`/`category`/`details`. */
  BrokerError,
  /** Error category enum: `validation | plugin | mapping | route | network | worker | system | config | topic`. */
  ErrorCategory,
} from './types/error'
export type {
  /** Logger interface: 5 methods (error, warn, info, debug, trace) + optional `meta`. */
  BrokerLogger,
  /** Log level: `silent | error | warn | info | debug | trace`. */
  LogLevel,
} from './types/logger'
export type {
  /** Context passed to plugin hooks: `id`, `logger`, `broker` (scoped), `signal` (cascade). */
  PluginContext,
  /** Plugin descriptor with optional lifecycle hooks (`onRegister`, `onMount`, `onUnmount`, `onDestroy`). */
  PluginDescriptor,
  /** Lifecycle state: `unregistered → registered → mounting → mounted → unmounting → unmounted → destroyed` (or `→ failed`). */
  PluginState,
} from './types/plugin'
export type {
  /** Options accepted by `Broker.subscribe`: `signal`, `priority`, `deliveryMode`, `once`. */
  SubscribeOptions,
  /** Subscription handle returned by `Broker.subscribe`. Idempotent unsubscribe. */
  Subscription,
} from './types/subscription'
export type {
  /** Wire Tap pattern for pipeline observation. F1 no-op default; F6 real Inspector. */
  EventTap,
  /** Pipeline state snapshot at each step (eventId, topic, step, timestamp, durationMs, ...). */
  PipelineSnapshot,
  /** Pipeline step identifier (5 steps in F1; F2-F6 estendono via declaration merging). */
  PipelineStep,
} from './types/tap'
