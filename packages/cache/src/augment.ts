// augment.ts — TS declaration merging per estendere @sembridge/core con tipi F6 Cache.
//
// (D-155/D-156/D-158/D-83 strict carryover in 06-CONTEXT.md — replica simmetrica
// di worker/augment.ts di F5 + gateway/sse-ws/augment.ts di F4 + gateway/augment.ts
// di F3 + routing/augment.ts di F3 + mapper/augment.ts di F2)
//
// Vincolo D-83 strict (carryover F1-F5): NESSUNA modifica a packages/{core,mapper,
// routing,gateway,worker}/src/ runtime. Questo file estende solo i type via
// declaration merging additive disgiunta.
//
// Cosa estende:
//   - BrokerConfig (interface, da @sembridge/core) — aggiunge `cache?: CacheConfig`
//     come campo opzionale (D-155/D-156/D-158). Sezione complementare a `workers`
//     (F5), `realtime` (F4), `gateway`/`routes`/`routing` (F3), `canonicalModel`/
//     `aliasRegistry`/`transforms` (F2).
//
// Cosa NON estende qui (limitazione TS R4 — RESEARCH §17):
//   - `RouteDefinition` literal union di `@sembridge/routing` NON è merge-abile
//     (TS non supporta declaration merging di type alias). I type cache route
//     vengono esposti separatamente nei plan 06-02/06-03 come
//     `RouteCacheDefinition` / `RouteCompositeDefinition` importabili dal consumer
//     che dichiara localmente `type AllRoutes = RouteDefinition | RouteCacheDefinition | ...`.
//   - `PipelineStep` type alias non si può fare merging — esposto come
//     `F6CachePipelineStep` literal union additive (vedi sotto, pattern F2/F3/F4/F5).
//
// Side-effect import: `packages/cache/src/index.ts` ri-esporta
// `__augmentCacheLoaded` da questo file. Il `package.json` ha già il glob
// `sideEffects: ["**/augment.ts", "**/augment.js"]` che copre `dist/augment.js`.
//
// Threat coverage:
// - T-06-01-01 (DoS tree-shake elimina augment): mitigate via sideEffects glob +
//   __augmentCacheLoaded re-export dal barrel.
// - T-06-01-02 (Tampering decl merging mutation): mitigate via const literal `true`.
// - T-06-01-03 (Logic flaw collision F2-F5 fields): accept — F6 cache augmenta
//   SOLO `BrokerConfig.cache` — campo DISGIUNTO da F2-F5.

import type { CacheConfig } from './types/cache-config'

declare module '@sembridge/core' {
  /**
   * F6 augmentation (D-155/D-156/D-158, PRD §20): aggiunge la sezione `cache` a
   * `BrokerConfig`.
   *
   * `cache`: configurazione runtime cache layer (maxEntries LRU, adapter swap,
   * scopeProvider hybrid). Pattern identico a `BrokerConfig.workers` (F5),
   * `BrokerConfig.realtime` (F4), `BrokerConfig.gateway` (F3) — sezione
   * strutturata letta dal `CacheBroker` costruttore (plan 06-08).
   */
  interface BrokerConfig {
    /** F6 sezione `cache` (D-155, PRD §20): config cache layer LRU + scope hybrid. */
    cache?: CacheConfig
  }
}

/**
 * F6 PipelineStep — eventi lifecycle cache emessi dal CacheHandler (D-161).
 * Pattern carryover F2/F3/F4/F5 (`F2PipelineStep` di @sembridge/mapper,
 * `F3PipelineStep` di @sembridge/routing, `F4PipelineStep` di @sembridge/gateway/sse-ws,
 * `F5PipelineStep` di @sembridge/worker).
 *
 * **Limitazione TS R4 (RESEARCH §17)**: `PipelineStep` di `@sembridge/core` è un
 * type alias literal union, NON un'interface — TS non supporta declaration merging
 * di type alias. Soluzione: il consumer che dichiara tap F6 importa questo
 * super-set additive e dichiara localmente:
 *
 * ```ts
 * import type { PipelineStep } from '@sembridge/core'
 * import type { F6CachePipelineStep } from '@sembridge/cache'
 * type AllSteps = PipelineStep | F6CachePipelineStep
 * ```
 *
 * I 4 step F6-cache sono inseriti come lifecycle events della cache (D-161):
 * - `event.cache.lookup` — pre-cache check (analog F3 dispatch step 9 inizio).
 * - `event.cache.hit` — cache.hit lifecycle (entry trovata + TTL valido).
 * - `event.cache.miss` — cache.miss lifecycle (entry assente o TTL expired).
 * - `event.cache.evicted` — LRU/TTL/invalidate eviction.
 */
export type F6CachePipelineStep =
  | 'event.cache.lookup' // pre-cache check (analog F3 dispatch step 9)
  | 'event.cache.hit' // cache.hit lifecycle (D-161)
  | 'event.cache.miss' // cache.miss lifecycle
  | 'event.cache.evicted' // LRU/TTL/invalidate eviction

/**
 * Marker const esportato per detection runtime del side-effect import.
 *
 * Pattern S1 (replica `__augmentWorkerLoaded` di worker/augment.ts +
 * `__augmentSseWsLoaded` di gateway/sse-ws/augment.ts +
 * `__augmentGatewayLoaded` di gateway/augment.ts +
 * `__augmentLoaded` di routing/augment.ts): export const literal `true`
 * ri-esportato dal barrel `src/index.ts` per evitare tree-shaking accidentale.
 *
 * Audit-able: `grep "__augmentCacheLoaded" dist/` permette di confermare il
 * side-effect è presente nel bundle distribuito (T-06-01-01 mitigation).
 */
export const __augmentCacheLoaded: true = true
