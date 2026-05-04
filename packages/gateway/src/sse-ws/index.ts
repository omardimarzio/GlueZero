/**
 * `@sembridge/gateway/sse-ws` — Subpath SSE/WebSocket realtime adapter (Phase 4).
 *
 * Plan 04-01: bootstrap types + augment + scaffolding. I runtime export
 * (parseFrame, createReconnectStrategy, SseAdapter, WebSocketAdapter,
 * RealtimeChannelManager, RealtimeBroker, createRealtimeBroker) verranno aggiunti
 * incrementalmente nei plan 04-02..04-08 via Wave-based parallelization.
 *
 * Vincolo D-101: composition wrapper di `RouterBroker` (F3). ZERO modifiche runtime
 * a F1/F2/F3 (D-83 ext F4).
 *
 * @packageDocumentation
 */

// Side-effect import — abilita TS declaration merging per BrokerConfig.realtime
// + PluginDescriptor.realtimeChannels (D-103). Pattern S1 anti tree-shaking
// (riferimento PATTERNS.md §3.2).
export { __augmentSseWsLoaded, type F4PipelineStep } from './augment'

// ---------- Type re-export: types/* ----------
export type {
  RealtimeConfig,
  ReconnectDefaults,
  HeartbeatDefaults,
  VisibilityDefaults,
  RealtimeChannelDef,
  RealtimeMode,
  RealtimeReconnectConfig,
} from './types'

// Plan 04-02..04-08 add: parseFrame, createReconnectStrategy, createVisibilityDetector,
// SseAdapter, WebSocketAdapter, RealtimeChannelManager, RealtimeBroker,
// createRealtimeBroker, FrameEnvelope, FrameParseResult.
