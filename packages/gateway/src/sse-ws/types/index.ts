// types/index.ts — barrel types-only F4 SSE/WS.
//
// Re-export `import type { ... } from '@gluezero/gateway/sse-ws'` per consumer e per i
// plan 04-02..04-08 che importano i types senza dipendere dal runtime (parser, manager,
// broker). Pattern identico a `gateway/http/types/index.ts` di F3.

export type {
  RealtimeChannelDef,
  RealtimeMode,
  RealtimeReconnectConfig,
} from './realtime-channel-def'
/** Barrel types F4 — re-export da `@gluezero/gateway/sse-ws`. */
export type {
  HeartbeatDefaults,
  RealtimeConfig,
  ReconnectDefaults,
  VisibilityDefaults,
} from './realtime-config'
