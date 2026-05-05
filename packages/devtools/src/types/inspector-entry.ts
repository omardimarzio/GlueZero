import type { PipelineSnapshot } from '@sembridge/core'

/**
 * F6 RouteInspectorEntry — entry capture da RouteInspector (plan 06-05, D-167).
 *
 * Cattura via tap che ascolta step 9 (`event.route.executed`) + step 10
 * (`event.outcome.collected`) F3, aggrega per `eventId + routeId`.
 *
 * @see RESEARCH §6.2 RouteInspector focus route-level.
 */
export interface RouteInspectorEntry {
  readonly eventId: string
  readonly routeId: string
  readonly topic: string
  readonly type: 'local' | 'http' | 'cache' | 'composite' | 'worker' | 'realtime-inbound'
  readonly outcome: 'success' | 'error' | 'skipped' | 'cached' | 'pending'
  readonly durationMs: number
  readonly retryCount?: number
  readonly cacheHit?: boolean
  readonly policiesApplied?: readonly string[]
  readonly timestamp: number
  readonly errorCode?: string
}

/**
 * F6 EventInspectorSnapshot — meta-info esposta via getDebugSnapshot (D-162).
 *
 * Buffer eventi è array `PipelineSnapshot[]` deep-cloned via structuredClone.
 * Ring buffer cap default 500 (D-167).
 */
export interface EventInspectorSnapshot {
  readonly enabled: boolean
  readonly bufferEntries: number
  readonly bufferSize: number
}

/**
 * Re-export PipelineSnapshot per compat consumer devtools (single import surface).
 */
export type { PipelineSnapshot }
