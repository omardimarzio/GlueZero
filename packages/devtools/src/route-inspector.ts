// route-inspector.ts — F6 plan 06-05 Task 2.
//
// `createRouteInspector(opts)` cattura step 9 (`event.route.executed`) + step 10
// (`event.outcome.collected`) F3, aggrega per (eventId, routeId) in
// RouteInspectorEntry. Pending Map cleanup post-completion. Default NODE_ENV
// inline coerente con event-inspector (D-160 uniformità cross-component).
//
// Pattern carryover:
// - F5 task-tracker (state Map atomic + closure factory)
// - F3 outcome-collector (step 10 capture)
// - event-inspector.ts (Task 1 — closure factory ring buffer + lazy mode +
//   structuredClone D-162 + drop-oldest FIFO D-167)
//
// Vincolo D-83 strict: nessuna modifica a F1-F5 runtime. Vive solo in
// `packages/devtools/src/`.
//
// **BLOCKER-1 fix**: questo file NON modifica `packages/devtools/src/index.ts`.
// Barrel append cumulativo gestito esclusivamente in 06-08b Wave 4b.
//
// Threat coverage:
// - T-06-05-01 (DoS buffer cresce illimitato): mitigated via D-167 cap +
//   drop-oldest FIFO. Test 5.
// - T-06-05-02 (Information disclosure leak via mutation): mitigated via D-162
//   structuredClone in getBuffer(). Test 6.
// - T-06-05-03 (Logic flaw disable non clear-buffer leak): mitigated via
//   `state.buffer = []` + `state.pending.clear()` in disable(). Test 12.
//
// @see RESEARCH §6.2 RouteInspector focus route-level

import type { EventTap, PipelineSnapshot, PipelineStep } from '@sembridge/core'
import type { RouteInspectorEntry } from './types/inspector-entry'

interface RouteInspectorState {
  enabled: boolean
  buffer: RouteInspectorEntry[]
  readonly bufferSize: number
  /** Map<`${eventId}::${routeId}`, partial entry> — accumulator step 9 → step 10. */
  readonly pending: Map<string, RouteInspectorEntry>
}

/**
 * F6 RouteInspector — closure factory ritorna { tap, enable, disable, getBuffer
 * (deep-clone D-162), clear, getSnapshot }.
 *
 * @see {@link createRouteInspector}
 */
export interface RouteInspector {
  readonly tap: EventTap
  enable(): void
  disable(): void
  getBuffer(): readonly RouteInspectorEntry[]
  clear(): void
  getSnapshot(): {
    readonly enabled: boolean
    readonly bufferEntries: number
    readonly bufferSize: number
  }
}

/**
 * Opzioni `createRouteInspector`.
 *
 * - `bufferSize` — cap ring buffer (default 500, D-167).
 * - `initiallyEnabled` — toggle iniziale (default: NODE_ENV !== 'production',
 *   D-160).
 */
export interface RouteInspectorOptions {
  readonly bufferSize?: number
  readonly initiallyEnabled?: boolean
}

const DEFAULT_BUFFER_SIZE = 500 // D-167
const STEP_ROUTE_EXECUTED = 'event.route.executed' as PipelineStep
const STEP_OUTCOME_COLLECTED = 'event.outcome.collected' as PipelineStep

/**
 * Default inline detection NODE_ENV (D-160 uniformità cross-component).
 * Pattern coerente con event-inspector.ts (Task 1) — replica inline per zero
 * coupling tra i due Inspector (file ownership disgiunta in 06-05 ma stessa
 * decisione architetturale D-160).
 */
function detectDefaultEnabled(): boolean {
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    if (proc != null && proc.env != null) {
      return proc.env['NODE_ENV'] !== 'production'
    }
  } catch {
    /* fallthrough — accesso process eccezione → fallback browser */
  }
  return true
}

function aggregateKey(eventId: string, routeId: string): string {
  return `${eventId}::${routeId}`
}

function pushBuffer(state: RouteInspectorState, entry: RouteInspectorEntry): void {
  state.buffer.push(entry)
  if (state.buffer.length > state.bufferSize) {
    state.buffer.shift() // FIFO drop-oldest D-167
  }
}

/**
 * Crea un nuovo {@link RouteInspector} (closure factory).
 *
 * Cattura step 9 (`event.route.executed`) + step 10 (`event.outcome.collected`)
 * F3 della pipeline §28, aggrega per (eventId, routeId) in
 * {@link RouteInspectorEntry} con campi: outcome, retryCount, cacheHit,
 * policiesApplied, errorCode, durationMs.
 *
 * Step diversi da 9+10 → ignorati (no entry creata).
 * Step con metadata.routeId mancante → ignorati (defensive).
 * Step 9 senza step 10 successivo → entry resta in pending Map (cleanup via
 * disable() / clear()).
 *
 * @example
 * ```ts
 * const inspector = createRouteInspector({ bufferSize: 500 })
 * // F1 broker config: passa il tap (06-08b composition wrapper)
 * new RouterBroker({ ...config, runtime: { tap: inspector.tap } })
 * // Live debug
 * inspector.enable()
 * const recentRoutes = inspector.getBuffer() // immutable deep clone
 * ```
 *
 * @param opts {@link RouteInspectorOptions}.
 * @returns RouteInspector closure.
 */
export function createRouteInspector(opts: RouteInspectorOptions = {}): RouteInspector {
  const state: RouteInspectorState = {
    enabled: opts.initiallyEnabled ?? detectDefaultEnabled(),
    buffer: [],
    bufferSize: opts.bufferSize ?? DEFAULT_BUFFER_SIZE,
    pending: new Map(),
  }

  return {
    tap: {
      onPipelineStep(step: PipelineStep, snapshot: PipelineSnapshot): void {
        if (!state.enabled) return // hot-path early return D-160
        const meta = snapshot.metadata ?? {}
        const routeId = (meta as { routeId?: string }).routeId
        if (!routeId) return // defensive: senza routeId non aggrega

        const key = aggregateKey(snapshot.eventId, routeId)

        if (step === STEP_ROUTE_EXECUTED) {
          // exactOptionalPropertyTypes: true → costruzione condizionale dei
          // campi optional (NON assegnare undefined a RouteInspectorEntry).
          const retryCount = (meta as { retryCount?: number }).retryCount
          const policies = (meta as { policies?: readonly string[] }).policies
          const partial: RouteInspectorEntry = {
            eventId: snapshot.eventId,
            routeId,
            topic: snapshot.topic,
            type:
              ((meta as { type?: RouteInspectorEntry['type'] }).type ?? 'local') as
                RouteInspectorEntry['type'],
            outcome: 'pending',
            durationMs: snapshot.durationMs,
            timestamp: snapshot.timestamp,
            ...(retryCount !== undefined ? { retryCount } : {}),
            ...(policies !== undefined ? { policiesApplied: policies } : {}),
          }
          state.pending.set(key, partial)
          return
        }

        if (step === STEP_OUTCOME_COLLECTED) {
          const partial = state.pending.get(key)
          const outcome: RouteInspectorEntry['outcome'] =
            ((meta as { outcome?: RouteInspectorEntry['outcome'] }).outcome ?? 'success') as
              RouteInspectorEntry['outcome']
          const origin = (meta as { origin?: 'cache' | 'remote' }).origin
          const errorCode = (meta as { errorCode?: string }).errorCode
          const cacheHitResolved =
            origin === 'cache' ? true : (partial?.cacheHit ?? undefined)
          const base: RouteInspectorEntry = partial ?? {
            eventId: snapshot.eventId,
            routeId,
            topic: snapshot.topic,
            type: 'local',
            durationMs: snapshot.durationMs,
            timestamp: snapshot.timestamp,
            outcome: 'pending',
          }
          const final: RouteInspectorEntry = {
            ...base,
            outcome,
            durationMs: snapshot.durationMs,
            ...(cacheHitResolved !== undefined ? { cacheHit: cacheHitResolved } : {}),
            ...(errorCode !== undefined ? { errorCode } : {}),
          }
          state.pending.delete(key)
          pushBuffer(state, final)
        }
      },
    },
    enable() {
      state.enabled = true
    },
    disable() {
      state.enabled = false
      state.buffer = []
      state.pending.clear()
    },
    getBuffer() {
      return structuredClone(state.buffer)
    },
    clear() {
      state.buffer = []
      state.pending.clear()
    },
    getSnapshot() {
      return {
        enabled: state.enabled,
        bufferEntries: state.buffer.length,
        bufferSize: state.bufferSize,
      }
    },
  }
}
