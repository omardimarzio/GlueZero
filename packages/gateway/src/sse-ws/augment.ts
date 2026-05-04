// augment.ts — TS declaration merging per estendere @sembridge/core con tipi F4 SSE/WS.
// (D-103 in 04-CONTEXT.md — replica simmetrica di gateway/augment.ts di F3 + routing/augment.ts)
//
// Vincolo D-83 / D-101: NESSUNA modifica a packages/core/src/, packages/mapper/src/,
// packages/routing/src/, packages/gateway/src/http/ runtime. Questo file è il PUNTO UNICO
// di chiusura del placeholder F1 in `packages/core/src/types/plugin.ts:50`
// ("F4 will add: realtimeChannels").
//
// Cosa estende:
//   - BrokerConfig (interface, da @sembridge/core) — aggiunge `realtime?: RealtimeConfig`
//     come campo opzionale (D-102). Sezione complementare a `gateway` (F3 — questo stesso
//     pkg) e `routes`/`routing` (F3 routing).
//   - PluginDescriptor (interface, da @sembridge/core) — aggiunge
//     `readonly realtimeChannels?: readonly RealtimeChannelDef[]` come campo opzionale
//     (D-103, RT-01). Pattern simmetrico con `routes?: readonly RouteDefinition[]` di F3
//     routing/augment.ts:75-78.
//
// Cosa NON estende qui:
//   - Nessuna augmentation di RouteDefinition con `type: 'realtime-inbound'` (PRD §17.5
//     lo prevede ma è scope F3 placeholder — F4 V1 usa il MANAGER, non un route handler).
//   - PipelineStep type alias non si può fare merging — esposto come `F4PipelineStep`
//     literal union additive (vedi sotto, pattern F2 `F2PipelineStep` / F3 `F3PipelineStep`).
//
// Side-effect import: `packages/gateway/src/sse-ws/index.ts` ri-esporta
// `__augmentSseWsLoaded` da questo file. Il `package.json` ha già il glob
// `sideEffects: ["**/augment.ts", "**/augment.js"]` che copre `dist/sse-ws/augment.js`.
//
// Threat coverage:
// - T-04-01-01 (Tampering — tree-shaker elimina dist/sse-ws/augment.js): mitigate via
//   sideEffects glob + __augmentSseWsLoaded re-export dal barrel.
// - T-04-01-02 (Spoofing — collision con augment F2/F3): accept. F4 augmenta SOLO
//   `BrokerConfig.realtime` e `PluginDescriptor.realtimeChannels` — campi DISGIUNTI dai
//   campi F2 (inputMap/outputMap/canonicalModel/aliasRegistry/transforms) e F3
//   (routes/routing/gateway). Test backward-compat smoke verifica coexistenza.

import type { RealtimeChannelDef } from './types/realtime-channel-def'
import type { RealtimeConfig } from './types/realtime-config'

declare module '@sembridge/core' {
  /**
   * F4 augmentation (D-102, PRD §27): aggiunge la sezione `realtime` a `BrokerConfig`.
   *
   * `realtime`: configurazione del realtime adapter SSE/WS centralizzato (D-102 multi-channel
   * topology). Pattern identico a `BrokerConfig.gateway` (F3) e `BrokerConfig.canonicalModel`
   * (F2) — sezione strutturata letta dal `RealtimeBroker` costruttore (plan 04-08) per
   * istanziare `RealtimeChannelManager` (plan 04-07).
   */
  interface BrokerConfig {
    /** Sezione `realtime` (D-102, PRD §16.2/§18.3-18.4): config canali SSE/WS multi-channel. */
    realtime?: RealtimeConfig
  }

  /**
   * F4 augmentation (D-103, RT-01): aggiunge il campo opzionale `realtimeChannels`
   * al PluginDescriptor pubblico — chiude il placeholder F1 in
   * `packages/core/src/types/plugin.ts:50` ("F4 will add: realtimeChannels").
   *
   * I canali sono auto-registrati al `registerPlugin` con `ownerId = pluginId`
   * (cascade D-26 ext F4 / D-112 — plan 04-07/04-08). Pattern simmetrico a
   * `routes?: readonly RouteDefinition[]` di routing/augment.ts:75-78.
   */
  interface PluginDescriptor {
    /** Canali realtime auto-registrati al `registerPlugin` con `ownerId = pluginId` (D-103). */
    readonly realtimeChannels?: readonly RealtimeChannelDef[]
  }
}

/**
 * F4 PipelineStep — eventi step §28 emessi dagli adapter SSE/WS (D-113 ingress).
 *
 * **Limitazione TS**: `PipelineStep` di `@sembridge/core` è un type alias literal union, NON
 * un'interface — TS non supporta declaration merging di type alias. Soluzione: il consumer
 * che dichiara tap F4 importa questo super-set additive (pattern F2 `F2PipelineStep` di
 * `@sembridge/mapper` + F3 `F3PipelineStep` di `@sembridge/routing`):
 *
 * ```ts
 * import type { PipelineStep } from '@sembridge/core'
 * import type { F2PipelineStep } from '@sembridge/mapper'
 * import type { F3PipelineStep } from '@sembridge/routing'
 * import type { F4PipelineStep } from '@sembridge/gateway/sse-ws'
 *
 * type AllSteps = PipelineStep | F2PipelineStep | F3PipelineStep | F4PipelineStep
 * ```
 *
 * I 3 step F4 sono inseriti nel ramo "ingress realtime" della pipeline §28 step 1:
 * - `event.realtime.received` — frame raw ricevuto da `EventSource`/`WebSocket` (D-113).
 * - `event.realtime.frame-parsed` — envelope JSON parsed `{topic, data, id?}` (D-106).
 * - `event.realtime.reconnecting` — state transition reconnect (D-109).
 */
export type F4PipelineStep =
  | 'event.realtime.received' // step 1 ingress da adapter (D-113)
  | 'event.realtime.frame-parsed' // step 1.b parser envelope (D-106)
  | 'event.realtime.reconnecting' // diagnostic state machine (D-109)

/**
 * Marker const esportato per detection runtime del side-effect import.
 *
 * Pattern S1 (replica `__augmentLoaded` di routing/augment.ts:172 +
 * `__augmentGatewayLoaded` di gateway/augment.ts:92): export const literal `true`
 * ri-esportato dal barrel `sse-ws/index.ts` per evitare tree-shaking accidentale.
 *
 * Audit-able: `grep "__augmentSseWsLoaded" dist/` permette di confermare il
 * side-effect è presente nel bundle distribuito.
 */
export const __augmentSseWsLoaded: true = true
