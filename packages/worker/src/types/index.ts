// types/index.ts — barrel types-only F5 Worker Runtime.
//
// Re-export `import type { ... } from '@sembridge/worker'` per consumer e per i
// plan 05-02..05-06 che importano i types senza dipendere dal runtime
// (assert-serializable, transferable-extractor, task-tracker, worker-bridge,
// worker-pool, worker-registry, worker-handler, worker-broker). Pattern
// identico a `gateway/sse-ws/types/index.ts` di F4.
//
// Riferimento: 05-PATTERNS.md §"types/index.ts" (analog `gateway/sse-ws/types/index.ts`).

/** Barrel types F5 — re-export da `@sembridge/worker`. */
export type {
  WorkerDescriptor,
  WorkerMode,
  WorkerType,
} from './worker-descriptor'
export type { AssertSerializableMode, WorkerConfig } from './worker-config'
export type { RouteWorkerDefinition, RouteWorkerPublishesSpec } from './route-worker-definition'
export type { ProgressPayload } from './progress-payload'
export type { TaskState, WorkerTaskOutcome } from './task-state'
export { INTERNAL_TOPICS_WORKER, isInternalWorkerTopic } from './internal-topics'
