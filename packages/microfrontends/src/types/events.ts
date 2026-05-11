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

/**
 * Payload pubblicato sui 17 lifecycle topics (PRD §31.4).
 *
 * `descriptor` field popolato SOLO per `registered` event (P-15 retention
 * mitigation — evita lifetime extension del descriptor su ogni transition).
 *
 * @example Subscribe lifecycle event
 * ```ts
 * broker.subscribe('microfrontend.mounted', (evt) => {
 *   const payload = evt.payload as MicroFrontendLifecycleEventPayload
 *   console.log(`MF ${payload.id} mounted in state ${payload.state}`)
 *   if (payload.timings?.mountedAt) {
 *     console.log('mounted at:', new Date(payload.timings.mountedAt))
 *   }
 * })
 * ```
 *
 * @see MF_LIFECYCLE_TOPICS — 17 topic literals
 * @see PRD §31.4 — payload spec
 */
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

/**
 * Payload pubblicato sui 7 error topics (PRD §31.5).
 *
 * Safe-serialized `error` (NO `Error` native) per postMessage compat con Worker (F15).
 *
 * @example Subscribe error event phase-specific
 * ```ts
 * broker.subscribe('microfrontend.bootstrap.failed', (evt) => {
 *   const payload = evt.payload as MicroFrontendErrorEventPayload
 *   console.error(`MF ${payload.id} failed in phase ${payload.phase}:`, payload.error.message)
 *   if (payload.recoverable) {
 *     console.log('Recovery suggerito: service.load(id) retry')
 *   }
 * })
 * ```
 *
 * @see MF_ERROR_TOPICS — 7 phase-specific topic literals
 * @see PRD §31.5 — payload spec
 * @see MF_ERROR_TOPIC_FOR_PHASE — helper mapping
 */
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
