/**
 * `@sembridge/gateway/sse-ws` — Subpath SSE/WebSocket realtime adapter (Phase 4).
 *
 * Espone:
 * - **`RealtimeBroker`** — composition wrapper di `RouterBroker` (D-101 / D-83 strict)
 * - **`createRealtimeBroker`** — factory pubblica con Valibot validation (D-30 no singleton)
 * - **`RealtimeChannelManager`** — N-channel registry + cascade cleanup (D-102 / D-112)
 * - **adapter primitives** — `SseAdapter`, `WebSocketAdapter` (consumer avanzati)
 * - **state machines** — `createReconnectStrategy` (D-107 / D-109), `createVisibilityDetector` (D-110)
 * - **frame parser** — `parseFrame`, `isInternalTopic`, `INTERNAL_TOPICS` (D-106 envelope JSON, PITFALL §11.7)
 *
 * Vincolo D-83 / D-101: zero modifiche a F1-F3 runtime. Composition wrapper invocato dal
 * factory pubblico `createRealtimeBroker`.
 *
 * @example
 * ```ts
 * import { createRealtimeBroker } from '@sembridge/gateway/sse-ws'
 *
 * const broker = createRealtimeBroker({
 *   realtime: {
 *     channels: [{ name: 'orders', mode: 'auto', url: '/events' }],
 *   },
 * })
 *
 * await broker.connectRealtime({ name: 'feed', mode: 'sse', url: '/feed' })
 * broker.subscribe('orders.created', (ev) => console.log(ev.payload))
 * ```
 *
 * @packageDocumentation
 */

// Side-effect import — abilita TS declaration merging per BrokerConfig.realtime
// + PluginDescriptor.realtimeChannels (D-103). Pattern S1 anti tree-shaking
// (riferimento PATTERNS.md §3.2).
export { __augmentSseWsLoaded, type F4PipelineStep } from './augment'
// ---------- Runtime export: parser ----------
export { INTERNAL_TOPICS, isInternalTopic, parseFrame } from './frame-parser'
export { createRealtimeBroker } from './public-factory'
export { RealtimeBroker, type RealtimeBrokerConfig } from './realtime-broker'
// ---------- Runtime export: manager + broker + factory ----------
export {
  RealtimeChannelManager,
  type RealtimeChannelManagerDebugInfo,
  type RealtimeChannelManagerDeps,
} from './realtime-channel-manager'
// ---------- Runtime export: state machines ----------
export {
  createReconnectStrategy,
  type ReconnectStrategy,
  type ReconnectStrategyOptions,
} from './reconnect-strategy'

// ---------- Runtime export: adapters (consumer avanzati) ----------
export { SseAdapter, type SseAdapterDeps } from './sse-adapter'
// ---------- Type re-export: types/* ----------
export type {
  HeartbeatDefaults,
  RealtimeChannelDef,
  RealtimeConfig,
  RealtimeMode,
  RealtimeReconnectConfig,
  ReconnectDefaults,
  VisibilityDefaults,
} from './types'
export type { FrameEnvelope, FrameParseResult } from './types/frame-envelope'
export {
  createVisibilityDetector,
  type VisibilityDetector,
  type VisibilityDetectorOptions,
  type VisibilityState,
} from './visibility-detector'
export { WebSocketAdapter, type WebSocketAdapterDeps } from './websocket-adapter'
