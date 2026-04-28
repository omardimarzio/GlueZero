// Public types re-export hub di `@sembridge/core`.
//
// Tutti i tipi pubblici sono ri-esportati qui via `export type` (richiesto da
// `verbatimModuleSyntax: true` in `tsconfig.base.json`).
//
// Tipi interni (es. registration record del plugin registry, vedi `./plugin`)
// NON sono ri-esportati: i plan 07/08 li importano direttamente via path relativo.
//
// Plan 08 (`src/index.ts`) farà `export * from './types'` per esporre l'API pubblica
// finale del package `@sembridge/core`.

export type {
  BrokerEvent,
  DeliveryMode,
  EventId,
  EventSource,
  Priority,
} from './broker-event'

export type { BrokerConfig } from './config'

export type { DeepReadonly } from './deep-readonly'

export type {
  BrokerError,
  CreateBrokerErrorParams,
  ErrorCategory,
} from './error'

export type { BrokerLogger, LogLevel } from './logger'

export type {
  PluginContext,
  PluginDescriptor,
  PluginState,
} from './plugin'

export type { SubscribeOptions, Subscription } from './subscription'

export type { EventTap, PipelineSnapshot, PipelineStep } from './tap'
