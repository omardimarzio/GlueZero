// augment.ts — TS declaration merging per estendere @gluezero/core con tipi F6
// Devtools (taps registry chain D-159 + DevtoolsConfig + F6PipelineStep step 14
// reale).
//
// (D-159/D-160/D-161/D-163/D-165/D-166/D-167/D-168/D-170/D-83 strict carryover
// in 06-CONTEXT.md — replica simmetrica di cache/augment.ts nello stesso plan.)
//
// Vincolo D-83 strict (carryover F1-F5): NESSUNA modifica a packages/{core,mapper,
// routing,gateway,worker}/src/ runtime. Questo file estende SOLO type via
// declaration merging additive disgiunta.
//
// Cosa estende:
//   - BrokerConfig (interface, da @gluezero/core) — aggiunge:
//     * `taps?: readonly EventTap[]` (D-159) — sostituisce semanticamente
//       `runtime.tap` F1 single-tap con multiplex chain. Il `createDevtoolsBroker`
//       F6 (plan 06-08) auto-wrappa eventuale `runtime.tap` legacy per
//       backward-compat.
//     * `devtools?: DevtoolsConfig` (D-160/D-167/D-170) — config Inspector,
//       MetricsCollector, PauseController.
//
// Cosa NON estende:
//   - F1 `runtime.tap` resta intatto (single value) — F6 lo legge e auto-wrappa
//     in `MultiplexTap` aggregator. NON modifichiamo packages/core/.
//
// Threat coverage:
// - T-06-01-01 (DoS tree-shake): mitigate via sideEffects glob.
// - T-06-04-01 (DoS tap throw blocca pipeline): mitigate downstream plan 06-04
//   (MultiplexTap try/catch isolato).
// - T-06-01-03 (Logic flaw collision F2-F5): accept — F6 devtools augmenta SOLO
//   `BrokerConfig.taps` e `BrokerConfig.devtools` — campi DISGIUNTI da F1-F5.

import type { EventTap } from '@gluezero/core'
import type { DevtoolsConfig } from './types/devtools-config'

declare module '@gluezero/core' {
  interface BrokerConfig {
    /**
     * F6 D-159: chain di tap (registry multiplex). Sostituisce `runtime.tap`
     * single-tap di F1 con array. `createDevtoolsBroker` (plan 06-08) auto-wrappa
     * `runtime.tap` legacy per backward-compat.
     */
    taps?: readonly EventTap[]
    /**
     * F6 D-160/D-167/D-170: config Inspector + Metrics + PauseController.
     */
    devtools?: DevtoolsConfig
  }
}

/**
 * F6 PipelineStep — step 14 (D-161 attivazione step 14 reale, "logging/metrics/
 * debug snapshot") + lifecycle events emessi dal CacheHandler / WorkerHandler /
 * RealtimeAdapter / RouteExecutor.
 *
 * **Limitazione TS R4 (RESEARCH §17 + F5 augment.ts pattern)**: `PipelineStep` di
 * `@gluezero/core` è type alias literal union — TS non supporta declaration
 * merging di type alias. Soluzione: super-set additive importato dal consumer
 * tap F6:
 *
 * ```ts
 * import type { PipelineStep } from '@gluezero/core'
 * import type { F2PipelineStep } from '@gluezero/mapper'
 * import type { F3PipelineStep } from '@gluezero/routing'
 * import type { F4PipelineStep } from '@gluezero/gateway/sse-ws'
 * import type { F5PipelineStep } from '@gluezero/worker'
 * import type { F6CachePipelineStep } from '@gluezero/cache'
 * import type { F6PipelineStep } from '@gluezero/devtools'
 * type AllSteps = PipelineStep | F2PipelineStep | F3PipelineStep | F4PipelineStep
 *                | F5PipelineStep | F6CachePipelineStep | F6PipelineStep
 * ```
 *
 * Lifecycle events (D-161): `route.dispatched`, `cache.{hit,miss,evicted}`,
 * `worker.{spawned,terminated}`, `realtime.{connected,disconnected}` sono già
 * coperti da F4/F5 step + F6CachePipelineStep di `@gluezero/cache/augment`.
 * Qui dichiariamo solo lo step 14 reale + system events audit.
 */
export type F6PipelineStep =
  | 'event.observed' // step 14 §28 reale (D-161 attivazione)
  | 'system.queue.flushed' // D-169 audit
  | 'system.queue.overflow' // D-170 audit
  | 'system.metrics.cardinality-overflow' // D-166 audit
  | 'system.cache.scope-missing' // D-157 audit (anche emesso da @gluezero/cache)

/**
 * Marker const esportato per detection runtime del side-effect import.
 *
 * Pattern S1 (replica `__augmentCacheLoaded` di cache/augment.ts +
 * `__augmentWorkerLoaded` di worker/augment.ts +
 * `__augmentSseWsLoaded` di gateway/sse-ws/augment.ts): export const literal
 * `true` ri-esportato dal barrel `src/index.ts`.
 *
 * Audit-able: `grep "__augmentDevtoolsLoaded" dist/` permette di confermare il
 * side-effect è presente nel bundle distribuito (T-06-01-01 mitigation).
 */
export const __augmentDevtoolsLoaded: true = true
