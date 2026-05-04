// realtime-channel-def.ts — definizione di un canale realtime (D-102).
//
// Indicizzato per `name` univoco nel `RealtimeChannelManager` (plan 04-07). Ogni canale ha
// proprio adapter (SSE plan 04-05 o WS plan 04-06), proprio reconnect state, proprio
// `buildUrl()` hook (D-104 auth-agnostic).
//
// Coerente con `RouteDefinitionBase` di F3 (id+topic+priority): `name` qui ha lo stesso
// ruolo di `id` per un route, ma a livello di canale fisico.
//
// Decisioni implementate:
// - D-102: multi-channel topology, `name` chiave indice nel Manager.
// - D-104: `buildUrl?: () => Promise<string>` hook auth-agnostic invocato PRIMA di OGNI
//   connect/reconnect, return value = URL completo (incluso eventuale token in query).
// - D-107: `mode: 'sse' | 'websocket' | 'auto'`, default `'auto'` con SSE-first +
//   auto-fallback a WS dopo `fallbackThreshold` reconnect failures.
// - D-109: per-channel reconnect override.
// - D-111: per-channel heartbeat override (WS ping/pong + SSE freshness).
// - D-115: backpressure policy riusata da F3.
// - W-4 fix: `eventTypes?: readonly string[]` per SSE custom event types (chiusura SC-1
//   ROADMAP scenario meteo `event: weather.update`).
// - B-5 fix: `sseHeartbeatEventTypes?: readonly string[]` (default `['heartbeat']`)
//   per server SSE che inviano heartbeat sintattici.
// - Q4 closure: `wsSubprotocols?: string | readonly string[]` per WS subprotocol auth
//   handshake (passthrough a `new WebSocket(url, protocols)`).

import type { BackpressurePolicyConfig } from '@sembridge/routing'

/**
 * Modalità di connessione realtime (D-107).
 *
 * - `'sse'` — usa solo `EventSource`, no fallback. Adatto a server che espone solo SSE.
 * - `'websocket'` — usa solo `WebSocket`, no fallback. Adatto a server che espone solo WS
 *   o richiede bidirezionalità (ping app-level, D-111).
 * - `'auto'` — default V1: SSE-first, auto-fallback a WS dopo `fallbackThreshold` reconnect
 *   failures consecutivi. Counter reset al primo successo. Cap globale `globalCycleCap`
 *   cicli SSE↔WS prima di stop permanente.
 */
export type RealtimeMode = 'sse' | 'websocket' | 'auto'

/**
 * Per-channel reconnect override (D-109). Tutti i field sono override-abili rispetto a
 * `RealtimeConfig.defaults.reconnect`. Strutturalmente equivalente a `ReconnectDefaults`,
 * ma duplicato per intenzionalità: il consumer documenta override per-canale separato dai
 * default globali.
 */
export interface RealtimeReconnectConfig {
  readonly baseMs?: number
  readonly capMs?: number
  readonly consolidationMs?: number
  readonly maxAttempts?: number
  readonly fallbackThreshold?: number
  readonly globalCycleCap?: number
}

/**
 * Definizione di un canale realtime (D-102 — multi-channel topology).
 *
 * Indicizzato per `name` univoco nel `RealtimeChannelManager` (plan 04-07). Ogni canale
 * ha proprio adapter (SSE o WS, plan 04-05/04-06), proprio reconnect state, proprio
 * `buildUrl()` hook (D-104 auth-agnostic).
 *
 * @example
 * ```ts
 * const def: RealtimeChannelDef = {
 *   name: 'orders',
 *   mode: 'auto',                                    // D-107 SSE-first + WS fallback
 *   buildUrl: async () => `/events?token=${await getToken()}`,  // D-104 auth-agnostic
 *   wsSubprotocols: ['sembridge-v1'],                // Q4 opt-in per auth handshake
 *   reconnect: { baseMs: 500, capMs: 15_000 },       // override default
 *   heartbeat: { intervalMs: 20_000 },                // override per-canale
 *   backpressure: { policy: 'queue-bounded', maxSize: 500 }, // D-115 riuso F3
 * }
 * ```
 */
export interface RealtimeChannelDef {
  /** Chiave univoca del canale nel Manager (D-102). NON vuota. */
  readonly name: string
  /** Modalità connessione (D-107). Default `'auto'` se omesso. */
  readonly mode?: RealtimeMode
  /**
   * Hook auth-agnostic invocato PRIMA di OGNI connect/reconnect (D-104).
   * Return value = URL completo (incluso eventuale token in query string).
   * Default fallback: `url` statico se omesso.
   */
  readonly buildUrl?: () => Promise<string>
  /** URL fallback se `buildUrl` non fornito (D-104). */
  readonly url?: string
  /** Subprotocols WS opzionali (Q4 / PITFALL §11.3 — passthrough a `new WebSocket(url, protocols)`). */
  readonly wsSubprotocols?: string | readonly string[]
  /** Override reconnect per-canale (D-109). */
  readonly reconnect?: RealtimeReconnectConfig
  /** Override heartbeat per-canale WS (D-111). */
  readonly heartbeat?: { readonly intervalMs?: number; readonly staleTimeoutMs?: number }
  /** Backpressure strategy adapter-level (D-115 — riuso 1:1 di F3 BackpressurePolicyConfig). */
  readonly backpressure?: BackpressurePolicyConfig
  /**
   * SSE custom event types (W-4 fix — chiusura SC-1 ROADMAP scenario meteo
   * `event: weather.update`).
   *
   * Default `undefined` → adapter SSE registra solo listener `'message'` con
   * `topic = def.name`. Se popolato, l'adapter SSE registra
   * `addEventListener(eventType, ...)` per ogni elemento e il `BrokerEvent.topic`
   * deriva dal field `event:` SSE (NOT da `def.name`).
   *
   * **Solo SSE** — i WebSocket non hanno custom event types.
   *
   * @example
   * ```ts
   * { name: 'meteo', url: '/sse', eventTypes: ['weather.update', 'weather.alert'] }
   * // Server invia `event: weather.update\ndata: {...}` → BrokerEvent.topic === 'weather.update'
   * ```
   */
  readonly eventTypes?: readonly string[]
  /**
   * SSE custom event types che aggiornano `lastEventReceivedAt` SENZA pubblicare BrokerEvent
   * (B-5 fix — Q5 closure freshness check con server heartbeat sintattici).
   *
   * Default `['heartbeat']` se omesso. Server SSE che invia `event: heartbeat` ogni N<60s
   * mantiene il canale "fresh" senza spam topic. Se il server usa un altro nome custom
   * (es. `keepalive`, `ping`), passare `['keepalive']` o `['heartbeat', 'keepalive']`.
   *
   * **Solo SSE** — WebSocket usa `__pong__` JSON message (D-111).
   */
  readonly sseHeartbeatEventTypes?: readonly string[]
}
