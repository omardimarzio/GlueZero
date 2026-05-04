// augment.ts — TS declaration merging per estendere @sembridge/core con tipi F5
// Worker Runtime.
//
// (D-122 / D-126 / D-152 in 05-CONTEXT.md — replica simmetrica di
// gateway/sse-ws/augment.ts di F4 + gateway/augment.ts di F3 + routing/augment.ts
// di F3 + mapper/augment.ts di F2)
//
// Vincolo D-83 / D-121: NESSUNA modifica a packages/core/src/, packages/mapper/src/,
// packages/routing/src/, packages/gateway/src/{http,sse-ws}/ runtime. Questo file
// è il PUNTO UNICO di chiusura del placeholder F1 in
// `packages/core/src/types/plugin.ts:51` ("F5 will add: workers") e
// `packages/core/src/types/config.ts` (sezione `workers` placeholder F1 D-29).
//
// Cosa estende:
//   - BrokerConfig (interface, da @sembridge/core) — aggiunge `workers?: WorkerConfig`
//     come campo opzionale (D-122). Sezione complementare a `realtime` (F4 — gateway
//     sse-ws), `gateway`/`routes`/`routing` (F3), `canonicalModel`/`aliasRegistry`/
//     `transforms` (F2).
//   - PluginDescriptor (interface, da @sembridge/core) — aggiunge
//     `readonly workers?: readonly WorkerDescriptor[]` come campo opzionale
//     (D-126, WK-01). Pattern simmetrico con `realtimeChannels?` di F4 e
//     `routes?` di F3 routing.
//
// Cosa NON estende qui (limitazione TS R4 — RESEARCH §17):
//   - `RouteDefinition` literal union di `@sembridge/routing` NON è merge-abile
//     (TS non supporta declaration merging di type alias). Soluzione: il consumer
//     dichiara localmente `type AllRoutes = RouteDefinition | RouteWorkerDefinition`.
//     Documentato in D-152 + tipo `RouteWorkerDefinition` esportato a parte.
//   - `PipelineStep` type alias non si può fare merging — esposto come
//     `F5PipelineStep` literal union additive (vedi sotto, pattern F2/F3/F4).
//
// Side-effect import: `packages/worker/src/index.ts` ri-esporta
// `__augmentWorkerLoaded` da questo file. Il `package.json` ha già il glob
// `sideEffects: ["**/augment.ts", "**/augment.js"]` che copre `dist/augment.js`.
//
// Threat coverage:
// - T-05-01-01 (Tampering — augment.ts decl merging mutation): mitigate via const
//   literal `true` non runtime-mutabile (`__augmentWorkerLoaded: true`).
// - T-05-01-02 (DoS — tree-shaker elimina augment): mitigate via sideEffects glob
//   + `__augmentWorkerLoaded` re-export dal barrel.
// - T-05-01-04 (Logic flaw — collision F2/F3/F4 fields): accept. F5 augmenta SOLO
//   `BrokerConfig.workers` e `PluginDescriptor.workers` — campi DISGIUNTI.
//   Test 5 augment.test.ts verifica coexistenza.

import type { WorkerConfig } from './types/worker-config'
import type { WorkerDescriptor } from './types/worker-descriptor'

declare module '@sembridge/core' {
  /**
   * F5 augmentation (D-122, PRD §27): aggiunge la sezione `workers` a `BrokerConfig`.
   *
   * `workers`: configurazione runtime worker (assertSerializable mode, defaults
   * globali progressThrottleMs/timeoutMs). Pattern identico a `BrokerConfig.realtime`
   * (F4) e `BrokerConfig.gateway` (F3) — sezione strutturata letta dal `WorkerBroker`
   * costruttore (plan 05-06) per istanziare `WorkerRegistry` + `WorkerPool` map e
   * configurare defaults globali.
   */
  interface BrokerConfig {
    /** F5 sezione `workers` (D-122, PRD §19): config runtime worker (D-139, D-137, D-145). */
    workers?: WorkerConfig
  }

  /**
   * F5 augmentation (D-126, WK-01): aggiunge il campo opzionale `workers` al
   * PluginDescriptor pubblico — chiude il placeholder F1 in
   * `packages/core/src/types/plugin.ts` ("F5 will add: workers").
   *
   * I worker sono auto-registrati al `registerPlugin` con `ownerId = pluginId`
   * (cascade D-26 ext F5 / LIFE-02 ext F5 — plan 05-06). Pattern simmetrico a
   * `realtimeChannels?: readonly RealtimeChannelDef[]` di F4 e
   * `routes?: readonly RouteDefinition[]` di F3 routing.
   */
  interface PluginDescriptor {
    /** F5 (D-126): worker auto-registrati al `registerPlugin` con `ownerId = pluginId`. */
    readonly workers?: readonly WorkerDescriptor[]
  }
}

/**
 * F5 PipelineStep — eventi step §28 emessi dal `WorkerHandler` (D-152 step 9
 * dispatch worker). Pattern carryover F2/F3/F4 (`F2PipelineStep` di
 * `@sembridge/mapper`, `F3PipelineStep` di `@sembridge/routing`,
 * `F4PipelineStep` di `@sembridge/gateway/sse-ws`).
 *
 * **Limitazione TS R4 (RESEARCH §17)**: `PipelineStep` di `@sembridge/core` è un
 * type alias literal union, NON un'interface — TS non supporta declaration merging
 * di type alias. Soluzione: il consumer che dichiara tap F5 importa questo
 * super-set additive e dichiara localmente:
 *
 * ```ts
 * import type { PipelineStep } from '@sembridge/core'
 * import type { F2PipelineStep } from '@sembridge/mapper'
 * import type { F3PipelineStep } from '@sembridge/routing'
 * import type { F4PipelineStep } from '@sembridge/gateway/sse-ws'
 * import type { F5PipelineStep } from '@sembridge/worker'
 *
 * type AllSteps = PipelineStep | F2PipelineStep | F3PipelineStep | F4PipelineStep | F5PipelineStep
 * ```
 *
 * I 4 step F5 sono inseriti nello step 9 dispatch della pipeline §28:
 * - `event.worker.dispatched` — task assegnato a worker bridge (post-acquire pool D-127).
 * - `event.worker.progress` — onProgress callback proxied via Comlink (D-135 + D-137 throttle).
 * - `event.worker.completed` — outcome `state === 'done'` post-state-transition (D-133, D-152).
 * - `event.worker.failed` — outcome `state ∈ {'timeout','cancelled','error'}` (D-133).
 */
export type F5PipelineStep =
  | 'event.worker.dispatched' // step 9 post-acquire pool/dedicated (D-152)
  | 'event.worker.progress' // onProgress callback proxied (D-135, D-137)
  | 'event.worker.completed' // outcome state='done' (D-133)
  | 'event.worker.failed' // outcome state in timeout/cancelled/error (D-133)

/**
 * Marker const esportato per detection runtime del side-effect import.
 *
 * Pattern S1 (replica `__augmentLoaded` di routing/augment.ts +
 * `__augmentGatewayLoaded` di gateway/augment.ts +
 * `__augmentSseWsLoaded` di gateway/sse-ws/augment.ts): export const literal
 * `true` ri-esportato dal barrel `src/index.ts` per evitare tree-shaking
 * accidentale.
 *
 * Audit-able: `grep "__augmentWorkerLoaded" dist/` permette di confermare il
 * side-effect è presente nel bundle distribuito (T-05-01-02 mitigation).
 */
export const __augmentWorkerLoaded: true = true
