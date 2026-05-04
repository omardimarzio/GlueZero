/**
 * `@sembridge/worker` — Worker Runtime entry point pubblico (Phase 5).
 *
 * Espone la superficie F5 type-level (Wave 1 plan 05-01). Wave 2-4 popolerà
 * runtime exports:
 * - W2 (plan 05-02 + 05-03) — `assertSerializable`, `extractTransferables`,
 *   `createTaskTracker` (state machine atomico Pitfall 2C D-133).
 * - W3 (plan 05-04 + 05-05) — `WorkerBridge`, `WorkerPool`, `WorkerRegistry`,
 *   `MockWorker` (test util).
 * - W4 (plan 05-06) — `WorkerHandler`, `WorkerBroker`, `createWorkerBroker`,
 *   composition wrapper di `RouterBroker` (D-121 / D-83 strict carryover —
 *   F5 vive solo in `packages/worker/src/`).
 *
 * **Pattern S1 anti tree-shake (T-05-01-02 mitigation):** il side-effect import
 * `./augment` è preservato dal `package.json#sideEffects` glob
 * `**\/augment.{ts,js}` + dal re-export `__augmentWorkerLoaded`. Audit:
 * `grep "__augmentWorkerLoaded" dist/index.js` exit 0.
 *
 * Vincolo D-83 / D-121: zero modifiche a F1-F4 runtime. Composition wrapper
 * invocato dal factory pubblico `createWorkerBroker` (Wave 4 plan 05-06).
 *
 * @example
 * ```ts
 * // Wave 1 — type-level scaffold (esempi runtime in W4 plan 05-06):
 * import type { RouteWorkerDefinition, WorkerDescriptor, ProgressPayload } from '@sembridge/worker'
 * import { INTERNAL_TOPICS_WORKER, isInternalWorkerTopic } from '@sembridge/worker'
 *
 * const descriptor: WorkerDescriptor = {
 *   id: 'report-worker',
 *   factory: () => new Worker(new URL('./report.worker.ts', import.meta.url), { type: 'module' }),
 *   tasks: ['generateReport'],
 *   mode: 'pool',
 * }
 * ```
 *
 * @packageDocumentation
 */

// Side-effect import — abilita TS declaration merging per BrokerConfig.workers
// + PluginDescriptor.workers (D-122 + D-126). Pattern S1 anti tree-shaking
// (riferimento PATTERNS.md §3.2). Wave 4 plan 05-06 estenderà runtime con
// composition wrapper.
export { __augmentWorkerLoaded, type F5PipelineStep } from './augment'

// ---------- Public types F5 ----------
export {
  INTERNAL_TOPICS_WORKER,
  isInternalWorkerTopic,
  type AssertSerializableMode,
  type ProgressPayload,
  type RouteWorkerDefinition,
  type RouteWorkerPublishesSpec,
  type TaskState,
  type WorkerConfig,
  type WorkerDescriptor,
  type WorkerMode,
  type WorkerTaskOutcome,
  type WorkerType,
} from './types'

// ---------- W2 plan 05-02 — assert-serializable + transferable-extractor (D-139/D-140/D-141) ----------
export { assertSerializable } from './assert-serializable'
export { extractTransferables } from './transferable-extractor'

// ---------- W2 plan 05-03 — task-tracker (state machine atomico D-133) ----------
export { createTaskTracker, type TaskTracker, type TaskTrackerSnapshot } from './task-tracker'

// ---------- W3-B plan 05-05 — worker-pool + worker-registry (D-126/127/128/129/130/131) ----------
export {
  WorkerRegistry,
  MAX_POOL_SIZE_HARD,
  type WorkerEntry,
  type WorkerRegistrySnapshot,
} from './worker-registry'
export {
  WorkerPool,
  defaultPoolSize,
  type WorkerBridgeLike,
  type WorkerPoolDeps,
  type WorkerPoolSnapshot,
} from './worker-pool'

// ---------- W3-A plan 05-04 — WorkerBridge Comlink wrap + lifecycle (D-124/129/131/132/135/137/139/140/141) ----------
export {
  WorkerBridge,
  type ComlinkAdapter,
  type WorkerBridgeDeps,
  type WorkerBridgeDispatchOptions,
  type WorkerBridgeSnapshot,
} from './worker-bridge'

// ---------- Wave 4 plan 05-06 (placeholder — file ownership 05-06) ----------
// W4 (plan 05-06):
//   export { createWorkerBroker } from './public-factory'
//   export { WorkerBroker, type WorkerBrokerConfig } from './worker-broker'
//   export { WorkerHandler } from './worker-handler'
