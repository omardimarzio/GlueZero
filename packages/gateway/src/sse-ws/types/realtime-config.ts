// realtime-config.ts — tipi della sezione root `BrokerConfig.realtime` (D-102).
//
// Pattern simmetrico a `GatewayConfig` di F3 (sezione `BrokerConfig.gateway`): root config
// con sezione `defaults.*` opzionale e array `channels` pre-registrato al boot. Letta dal
// `RealtimeBroker` costruttore (plan 04-08) per istanziare `RealtimeChannelManager`
// (plan 04-07).
//
// Decisioni implementate:
// - D-102: multi-channel topology — `channels: readonly RealtimeChannelDef[]` pre-registra
//   canali al boot, analog di `BrokerConfig.routes` di F3.
// - D-109: reconnect policy unificata SSE/WS, override-abile per-canale.
// - D-110: Visibility API integration con tolerance multiplier configurabile.
// - D-111: heartbeat WS / freshness SSE con interval+timeout configurabili.
//
// Riferimenti PRD: §16.2 (`connectRealtime` API), §18.6 (reconnection policy), §27 (config root).

import type { RealtimeChannelDef } from './realtime-channel-def'

/**
 * Default reconnect policy applicata a tutti i canali (D-109 / RT-05).
 *
 * Tutti i field sono opzionali e override-abili per-canale tramite
 * `RealtimeChannelDef.reconnect`. Se omessi, l'adapter usa i default lockati nel
 * 04-CONTEXT.md (D-109): `baseMs: 1_000`, `capMs: 30_000`, `consolidationMs: 5_000`,
 * `maxAttempts: Infinity`, `fallbackThreshold: 3`, `globalCycleCap: 5`.
 */
export interface ReconnectDefaults {
  /** Base del backoff esponenziale full-jitter, default 1_000ms (D-109). */
  readonly baseMs?: number
  /** Cap massimo del delay reconnect, default 30_000ms (PRD §18.6). */
  readonly capMs?: number
  /** Finestra di consolidamento eventi `system.realtime.reconnecting`, default 5_000ms. */
  readonly consolidationMs?: number
  /** Max tentativi reconnect prima di stop permanente, default `Infinity` (RT-05). */
  readonly maxAttempts?: number
  /** Soglia fail consecutivi prima dello switch SSE↔WS in `mode: 'auto'`, default 3 (D-107). */
  readonly fallbackThreshold?: number
  /** Cap globale cicli SSE↔WS prima di abort permanente, default 5 (D-107). */
  readonly globalCycleCap?: number
}

/**
 * Default heartbeat policy applicata a tutti i canali (D-111).
 *
 * `intervalMs` controlla la cadenza del ping applicativo (WS) e la fresh-check SSE.
 * `staleTimeoutMs` è il timeout oltre il quale la connessione viene considerata morta.
 * Override per-canale tramite `RealtimeChannelDef.heartbeat`.
 */
export interface HeartbeatDefaults {
  /** Cadenza ping WS / freshness check SSE, default 30_000ms (D-111). */
  readonly intervalMs?: number
  /** Timeout pong/ultimo evento prima di disconnect+reconnect, default 60_000ms (D-111 + Q5 SSE). */
  readonly staleTimeoutMs?: number
}

/**
 * Default Visibility API policy applicata al `RealtimeChannelManager` (D-110).
 *
 * Il `toleranceMultiplier` estende `staleTimeoutMs` quando il documento è `hidden`
 * (browser throttle dei timer): es. `multiplier: 3` su `staleTimeoutMs: 60_000` → 180s
 * effettivi prima di reconnect mentre il tab è in background.
 */
export interface VisibilityDefaults {
  /** Multiplier dello stale timeout in stato `document.hidden`, default 3 (D-110). */
  readonly toleranceMultiplier?: number
}

/**
 * Configurazione realtime — root config dichiarata in `BrokerConfig.realtime`.
 *
 * Pattern identico a `GatewayConfig` di F3 (sub-sezioni opzionali). Le sezioni
 * `defaults.*` si applicano a tutti i canali che non le overridano per-canale tramite
 * `RealtimeChannelDef.{reconnect,heartbeat}`. L'array `channels` pre-registra canali al
 * boot (D-102), analog di `BrokerConfig.routes` di F3.
 *
 * Riferimenti: PRD §16.2 (API `connectRealtime`), §18.3-18.4 (SSE/WS), §27 (config root).
 */
export interface RealtimeConfig {
  /** Default applicati a tutti i canali (RT-05 override-abile). */
  readonly defaults?: {
    readonly reconnect?: ReconnectDefaults
    readonly heartbeat?: HeartbeatDefaults
    readonly visibility?: VisibilityDefaults
  }
  /** Canali pre-registrati al boot (D-102 — analog `routes` di F3 RouterBrokerConfig). */
  readonly channels?: readonly RealtimeChannelDef[]
}
