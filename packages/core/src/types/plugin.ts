// PluginDescriptor / PluginContext / PluginState / PluginRegistration
// (PRD §15, §24; REQ CORE-05/CORE-11).
//
// Riferimento decisioni (CONTEXT 01):
// - D-17: plugin id collision throw `BrokerError.code: 'plugin.id.duplicate'`
// - D-25: lifecycle order `onRegister` (sync) → `onMount` (async) →
//         `onUnmount` (async) → cascade unsubscribe → `onDestroy` (sync)
// - D-26: cascade cleanup su `unregisterPlugin` rimuove subscription, route, transform,
//         e firma AbortController per pending in-flight handler async (PRD §24.2, REQ LIFE-02)
// - D-27: Subscription handle (vedi `subscription.ts`)
//
// `PluginContext.broker` è tipato `unknown` provvisoriamente: in F1/plan 03 NON esiste ancora
// `core/broker.ts` (creato in plan 08). Plan 08 risolverà via TypeScript declaration merging
// o re-typing dell'interfaccia per esporre la firma reale di `Broker`.
//
// `PluginRegistration` è internal — NON deve essere ri-esportato come simbolo pubblico
// in `types/index.ts`. È importato direttamente da plan 07/08 via path relativo.

import type { BrokerError } from './error'
import type { BrokerLogger } from './logger'
import type { Subscription } from './subscription'

/**
 * Lifecycle state of a registered plugin: `unregistered → registered → mounting →
 * mounted → unmounting → unmounted → destroyed` (or `→ failed`).
 */
export type PluginState =
  | 'unregistered'
  | 'registered'
  | 'mounting'
  | 'mounted'
  | 'unmounting'
  | 'unmounted'
  | 'failed'
  | 'destroyed'

/**
 * Plugin descriptor with optional lifecycle hooks (D-25).
 *
 * Hook execution order on `registerPlugin`: `onRegister` (sync) → `onMount` (async).
 * Hook execution order on `unregisterPlugin` (D-26): `onUnmount` (async) → cascade
 * unsubscribe → `onDestroy` (sync).
 */
export interface PluginDescriptor {
  readonly id: string
  readonly version?: string
  readonly displayName?: string
  // F2 will add: inputMap, outputMap, requires, provides
  // F3 will add: routes
  // F4 will add: realtimeChannels
  // F5 will add: workers

  onRegister?(ctx: PluginContext): void | Promise<void>
  onMount?(ctx: PluginContext): void | Promise<void>
  onUnmount?(ctx: PluginContext): void | Promise<void>
  onDestroy?(ctx: PluginContext): void
}

/**
 * Context passed to plugin hooks. The `broker` is a scoped wrapper that
 * auto-tags subscriptions with `ownerId=pluginId` (cascade cleanup D-26).
 *
 * `signal` fires on `unregisterPlugin(id)` (D-26 cascade cleanup, LIFE-02).
 */
export interface PluginContext {
  readonly id: string
  readonly logger: BrokerLogger
  // `unknown` placeholder — plan 08 espone la vera firma di `Broker` via declaration merging
  // (evita ciclo `types/plugin.ts` ↔ `core/broker.ts` che non esiste ancora in F1 plan 03).
  readonly broker: unknown
  // AbortSignal che fires su `unregisterPlugin(id)` — D-26 cascade cleanup (LIFE-02).
  readonly signal: AbortSignal
}

// Internal — NOT exported publicly via `types/index.ts`.
// Importato direttamente dai plan 07 (`bus.ts`) e 08 (`plugin-registry.ts`, `lifecycle.ts`).
export interface PluginRegistration {
  descriptor: PluginDescriptor
  state: PluginState
  subscriptions: Set<Subscription>
  abortController: AbortController
  // F2/F3/F4/F5 extend with: routes, transforms, realtimeChannels, workers
  registeredAt: number
  mountedAt?: number
  unmountedAt?: number
  failureReason?: BrokerError
}
