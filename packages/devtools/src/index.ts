/**
 * `@sembridge/devtools` — Developer tooling entry point pubblico (Phase 6).
 *
 * Espone la superficie F6 type-level (Wave 1 plan 06-01). Wave 2-4 popolerà
 * runtime exports:
 * - W2 (plan 06-04) — `createMultiplexTap`, `createTapRegistry` (chain di tap
 *   con error isolation D-159).
 * - W3 (plan 06-05) — `createEventInspector`, `createRouteInspector` (ring
 *   buffer 500 eventi default D-167).
 * - W3 (plan 06-06) — `createMetricsCollector`, reservoir Algorithm R Vitter
 *   1985 (D-165) + naming dot.case `sembridge.<package>.<metric>` (D-163).
 * - W3 (plan 06-07) — `createPauseController` (queue cap 1000 + critical
 *   bypass D-170).
 * - W4 (plan 06-08) — `DevtoolsBroker`, `createDevtoolsBroker` composition
 *   wrapper di `CacheBroker` / `WorkerBroker` / `RouterBroker` (D-83 strict
 *   carryover).
 *
 * **Pattern S1 anti tree-shake (T-06-01-01 mitigation):** il side-effect
 * import `./augment` è preservato dal `package.json#sideEffects` glob
 * `**\/augment.{ts,js}` + dal re-export `__augmentDevtoolsLoaded`. Audit:
 * `grep "__augmentDevtoolsLoaded" dist/index.js` exit 0.
 *
 * Vincolo D-83 strict (carryover F1-F5): zero modifiche a F1-F5 runtime.
 *
 * @example
 * ```ts
 * // Wave 1 — type-level scaffold (esempi runtime in W2 plan 06-04..06-08):
 * import type {
 *   MetricsSnapshot,
 *   DevtoolsConfig,
 *   PauseAction,
 * } from '@sembridge/devtools'
 *
 * const config: DevtoolsConfig = {
 *   enableByDefault: true,
 *   eventBufferSize: 500,
 *   pauseQueueMaxSize: 1000,
 * }
 * ```
 *
 * @packageDocumentation
 */

// Side-effect import — abilita TS declaration merging per BrokerConfig.taps +
// BrokerConfig.devtools (D-159/D-160/D-167/D-170). Pattern S1 anti tree-shaking.
export { __augmentDevtoolsLoaded, type F6PipelineStep } from './augment'

// ---------- Public types F6 devtools ----------
export type {
  DevtoolsConfig,
  EventInspectorSnapshot,
  FlushQueueResult,
  HistogramSummary,
  MetricsDelta,
  MetricsSnapshot,
  PauseAction,
  PauseControllerSnapshot,
  PipelineSnapshot,
  RouteInspectorEntry,
} from './types'

// ---------- W2 plan 06-04 — multiplex-tap + tap-registry (D-159) ----------
export { createMultiplexTap } from './multiplex-tap'
export {
  createTapRegistry,
  type TapHandle,
  type TapRegistry,
  wrapLegacyTap,
} from './tap-registry'

// ---------- W3 plan 06-05 — event-inspector + route-inspector (D-167) ----------
// export { createEventInspector } from './event-inspector'
// export { createRouteInspector } from './route-inspector'

// ---------- W3 plan 06-06 — metrics-collector + reservoir (D-163/D-165) ----------
// export { createMetricsCollector } from './metrics-collector'
// export { createReservoir } from './reservoir'

// ---------- W3 plan 06-07 — pause-controller (D-168/D-170) ----------
// export { createPauseController } from './pause-controller'

// ---------- Wave 4 plan 06-08 — composition wrapper Opzione B + factory ----------
// export { DevtoolsBroker, createDevtoolsBroker } from './devtools-broker'
