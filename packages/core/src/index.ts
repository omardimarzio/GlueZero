// @sembridge/core public API surface — entry point pubblicato come `dist/index.js`.
//
// Phase 1 Plan 03 ha esposto i tipi pubblici via `export type * from './types'` come
// placeholder. Plan 08 (Wave 5) aggiunge i runtime export:
//   - `createBroker(config?)` factory (D-19) con validazione Valibot (D-18)
//   - `Broker` class (composition root EventBus + PluginRegistry + TopicRegistry)
//   - `createBrokerError`, `isBrokerError` helpers per error handling consumer-side
//   - `createConsoleLogger`, `silentLogger` helpers per swap logger in test/produzione
//
// Tipi pubblici sono ri-esportati esplicitamente (no wildcard `export type *`)
// per controllo della surface API e leggibilità da parte del consumer (TypeDoc
// genererà la API reference da questo file in F1.x).
//
// I tipi interni (es. `PluginRegistration`, `EventBusOptions`, `EventBusStats`,
// `BrokerDebugSnapshot`, `PluginScopedBroker`) NON sono ri-esportati: restano
// accessibili solo via path relativo per consumer interni del monorepo.

export { Broker } from './core/broker'
export { createBrokerError, isBrokerError } from './core/broker-error'
export { createConsoleLogger, silentLogger } from './core/logger'
// Runtime exports — il cuore della libreria.
export { createBroker } from './public-factory'

// Type exports — surface tipi pubblici.
export type {
  BrokerEvent,
  DeliveryMode,
  EventId,
  EventSource,
  Priority,
} from './types/broker-event'
export type { BrokerConfig } from './types/config'
export type { DeepReadonly } from './types/deep-readonly'
export type { BrokerError, ErrorCategory } from './types/error'
export type { BrokerLogger, LogLevel } from './types/logger'
export type { PluginContext, PluginDescriptor, PluginState } from './types/plugin'
export type { SubscribeOptions, Subscription } from './types/subscription'
export type { EventTap, PipelineSnapshot, PipelineStep } from './types/tap'
