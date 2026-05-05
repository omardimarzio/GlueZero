/**
 * `@sembridge/devtools` — Developer tooling entry point pubblico (Phase 6).
 *
 * Espone la superficie F6 type-level + runtime cumulative Wave 1+2+3+4:
 * - W1 (plan 06-01) — types F6 + augment declaration merging.
 * - W2 (plan 06-04) — `createMultiplexTap`, `createTapRegistry`, `wrapLegacyTap`
 *   (chain di tap con error isolation D-159).
 * - W3 (plan 06-05) — `createEventInspector`, `createRouteInspector` (ring
 *   buffer 500 eventi default D-167).
 * - W3 (plan 06-06) — `createMetricsCollector`, reservoir Algorithm R Vitter
 *   1985 (D-165) + cardinality cap (D-166) + naming dot.case
 *   `sembridge.<package>.<metric>` (D-163).
 * - W3 (plan 06-07) — `createPauseController` (queue cap 1000 + critical
 *   bypass D-170).
 * - W4 (plan 06-08b) — `DevtoolsBroker`, `createDevtoolsBroker` composition
 *   wrapper di `RouterBroker` (D-83 strict carryover).
 *
 * **BLOCKER-1 fix (single-writer cumulativo post-Wave 3)**: questo barrel viene
 * modificato ESCLUSIVAMENTE da plan 06-08b — Wave 3 plans 06-05/06-06/06-07
 * NON toccano questo file (file ownership disgiunta). Audit:
 * `git log --oneline packages/devtools/src/index.ts` mostra append cumulativo
 * Wave 4b (no commits Wave 3).
 *
 * **Pattern S1 anti tree-shake (T-06-01-01 mitigation):** il side-effect
 * import `./augment` è preservato dal `package.json#sideEffects` glob
 * `**\/augment.{ts,js}` + dal re-export `__augmentDevtoolsLoaded`. Audit:
 * `grep "__augmentDevtoolsLoaded" dist/index.js` exit 0.
 *
 * Vincolo D-83 strict (carryover F1-F5): zero modifiche a F1-F5 runtime.
 *
 * @example Quick start (Wave 4 — composition wrapper Opzione B)
 * ```ts
 * import { createDevtoolsBroker } from '@sembridge/devtools'
 *
 * const broker = createDevtoolsBroker({
 *   devtools: { enableByDefault: true, eventBufferSize: 500 },
 * })
 * await broker.publish('weather.requested', { city: 'Roma' })
 * const snap = broker.getDebugSnapshot()
 * ```
 *
 * @packageDocumentation
 */

// Side-effect import — abilita TS declaration merging per BrokerConfig.taps +
// BrokerConfig.devtools (D-159/D-160/D-167/D-170). Pattern S1 anti tree-shaking.
export { __augmentDevtoolsLoaded, type F6PipelineStep } from './augment'
export {
  type CardinalityTracker,
  type CardinalityTrackerOptions,
  createCardinalityTracker,
  flatLabels,
} from './cardinality-cap'
// ---------- W4 plan 06-08b — composition wrapper Opzione B + factory ----------
export {
  type DebugSnapshot,
  DevtoolsBroker,
  type DevtoolsBrokerConfig,
} from './devtools-broker'
// ---------- W3 plan 06-05 — event-inspector + route-inspector (D-167) ----------
export {
  createEventInspector,
  type EventInspector,
  type EventInspectorOptions,
} from './event-inspector'
// ---------- W3 plan 06-06 — metrics-collector + reservoir + cardinality (D-163/D-165/D-166) ----------
export {
  createMetricsCollector,
  type MetricsCollector,
  type MetricsCollectorOptions,
} from './metrics-collector'
// ---------- W2 plan 06-04 — multiplex-tap + tap-registry (D-159) ----------
export { createMultiplexTap } from './multiplex-tap'
// ---------- W3 plan 06-07 — pause-controller (D-168/D-170) ----------
export {
  createPauseController,
  type PauseController,
  type PauseControllerOptions,
  type PausePublishFn,
} from './pause-controller'
export { createDevtoolsBroker } from './public-factory'
export {
  computeSummary,
  createReservoir,
  type ReservoirState,
  reservoirAdd,
} from './reservoir-sampling'
export {
  createRouteInspector,
  type RouteInspector,
  type RouteInspectorOptions,
} from './route-inspector'
export {
  createTapRegistry,
  type TapHandle,
  type TapRegistry,
  wrapLegacyTap,
} from './tap-registry'
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
