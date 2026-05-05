// types/index.ts — barrel types-only F6 Devtools.
//
// Re-export `import type { ... } from '@gluezero/devtools'` per consumer e per
// i plan 06-04..06-08 che importano i types senza dipendere dal runtime
// (multiplex-tap, event-inspector, route-inspector, metrics-collector,
// pause-controller, devtools-broker). Pattern identico a `cache/types/index.ts`
// di F6 + `worker/types/index.ts` di F5.

export type { DevtoolsConfig } from './devtools-config'
export type {
  EventInspectorSnapshot,
  PipelineSnapshot,
  RouteInspectorEntry,
} from './inspector-entry'
export type { HistogramSummary, MetricsDelta, MetricsSnapshot } from './metrics'
export type { FlushQueueResult, PauseAction, PauseControllerSnapshot } from './pause-state'
