/**
 * MicroFrontend event payload types (PRD §31.4, §31.5, MF-EVT-04, MF-EVT-05).
 *
 * Shape pubblicata sui 17 lifecycle topics + 7 error topics standard.
 *
 * @see RESEARCH §5.2 + PRD §31
 */
import type { MicroFrontendDescriptor } from './descriptor'
import type {
  MicroFrontendFailurePhase,
  MicroFrontendState,
  MicroFrontendTimings,
} from './lifecycle'

/** Payload pubblicato sui 17 lifecycle topics (PRD §31.4). */
export interface MicroFrontendLifecycleEventPayload {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly previousState?: MicroFrontendState
  readonly state: MicroFrontendState
  readonly timestamp: number
  /** Inclusa SOLO per `registered` event (P-15 retention mitigation). */
  readonly descriptor?: MicroFrontendDescriptor
  readonly timings?: MicroFrontendTimings
  readonly metadata?: Record<string, unknown>
}

/** Payload pubblicato sui 7 error topics (PRD §31.5). */
export interface MicroFrontendErrorEventPayload {
  readonly id: string
  readonly name?: string
  readonly version?: string
  readonly phase: MicroFrontendFailurePhase
  /** Safe-serialized error (NO Error native — postMessage safe per Worker F15). */
  readonly error: {
    readonly message: string
    readonly code?: string
    readonly stack?: string
  }
  readonly recoverable: boolean
  /** Popolato da F14 FallbackPolicy. */
  readonly fallbackApplied?: boolean
  readonly timestamp: number
}
