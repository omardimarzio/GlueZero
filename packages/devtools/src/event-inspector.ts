// event-inspector.ts — F6 plan 06-05 Task 1.
//
// `createEventInspector(opts)` ring buffer 500 PipelineSnapshot default + lazy-mode
// toggle (D-160 + D-167) + deep-clone via structuredClone (D-162) + disable() clear-
// buffer (memory hygiene RESEARCH §6.3) + default NODE_ENV inline detection
// (uniformità cross-component WARNING-5 fix).
//
// Pattern primario carryover: F5 `task-tracker.ts:46-220` (state closure + factory).
// Pattern lazy-mode early-return D-160 + deep-clone D-162.
//
// **D-160 default NODE_ENV inline (uniformità cross-component WARNING-5 fix)**:
// se `opts.initiallyEnabled` undefined → fallback a
// `(typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true)`.
// Browser/dev → true (DX), production → false (zero overhead).
//
// Vincolo D-83 strict (carryover F1-F5 → F6): nessuna modifica a
// `packages/{core,mapper,routing,gateway,worker}/src/`. Questo file vive in
// `packages/devtools/src/` esclusivamente.
//
// **BLOCKER-1 fix**: questo file NON modifica `packages/devtools/src/index.ts`.
// Il barrel append (esportazione `createEventInspector` + types associati) è
// gestito esclusivamente in 06-08b Wave 4b sequential gate (file ownership Wave 3
// disgiunta su devtools/src/index.ts).
//
// Threat coverage:
// - T-06-05-01 (DoS buffer cresce illimitato): mitigated via D-167 cap default 500
//   + drop-oldest FIFO (Array.shift). Test 5.
// - T-06-05-02 (Information disclosure leak via mutation): mitigated via D-162
//   structuredClone in getBuffer(). Test 7.
// - T-06-05-03 (Logic flaw disable non clear-buffer leak): mitigated via
//   `state.buffer = []` in disable(). Test 4.
// - T-06-05-05 (Logic flaw production debug accidentale via initiallyEnabled
//   default): mitigated via detectDefaultEnabled() inline NODE_ENV detection.
//   Test 12.
//
// @see RESEARCH §6 Inspector ring buffer impl + §5.3 lazy-mode + §6.3 memory
//   footprint
// @see CONTEXT.md D-160 + D-162 + D-167

import type { EventTap, PipelineSnapshot, PipelineStep } from '@gluezero/core'
import type { EventInspectorSnapshot } from './types/inspector-entry'

interface EventInspectorState {
  enabled: boolean
  buffer: PipelineSnapshot[]
  readonly bufferSize: number
}

/**
 * F6 EventInspector — ring buffer 500 PipelineSnapshot + lazy-mode toggle (D-160
 * + D-167).
 *
 * Closure factory ritorna { tap, enable, disable, getBuffer (deep-clone D-162),
 * clear, getSnapshot }.
 *
 * @see {@link createEventInspector}
 */
export interface EventInspector {
  readonly tap: EventTap
  enable(): void
  disable(): void
  getBuffer(): readonly PipelineSnapshot[]
  clear(): void
  getSnapshot(): EventInspectorSnapshot
}

/**
 * Opzioni `createEventInspector`.
 *
 * - `bufferSize` — cap ring buffer (default 500, D-167).
 * - `initiallyEnabled` — toggle iniziale (default: NODE_ENV !== 'production',
 *   D-160).
 */
export interface EventInspectorOptions {
  readonly bufferSize?: number
  readonly initiallyEnabled?: boolean
}

const DEFAULT_BUFFER_SIZE = 500 // D-167

/**
 * Default inline detection NODE_ENV (D-160 uniformità cross-component WARNING-5 fix).
 *
 * Production → false (zero overhead). Browser/dev → true (DX dev-friendly).
 *
 * Coerente con `assertSerializable` dev-mode auto F5 D-139 + PRD §34.1
 * "debug mode disattivabile in produzione".
 */
function detectDefaultEnabled(): boolean {
  try {
    // Pattern carryover F5 worker-bridge.ts:556 — accesso safe via globalThis cast
    // (devtools è browser-package senza @types/node; `process` non è in scope ambient).
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    if (proc != null && proc.env != null) {
      return proc.env['NODE_ENV'] !== 'production'
    }
  } catch {
    /* fallthrough — qualsiasi accesso/lettura process eccezione → fallback browser */
  }
  return true
}

/**
 * Crea un nuovo {@link EventInspector} (closure factory).
 *
 * Pattern carryover F5 `task-tracker.ts:46-220` (state closure). Hot-path early
 * return su `state.enabled === false` per zero overhead in production (D-160).
 *
 * Ring buffer drop-oldest FIFO via Array.shift quando length supera bufferSize
 * (D-167 + RESEARCH §6.3 memory footprint predictable ~2.5MB con payload medi a
 * 500 entries).
 *
 * `getBuffer()` ritorna deep-clone via `structuredClone` (D-162) — caller
 * mutation NON corrompe state.buffer interno (T-06-05-02 mitigation).
 *
 * `disable()` clear-buffer (`state.buffer = []`) per memory hygiene
 * (T-06-05-03 mitigation, RESEARCH §6.3 Pitfall ring buffer leak).
 *
 * @example
 * ```ts
 * const inspector = createEventInspector({ bufferSize: 500 })
 * // F1 broker config: passa il tap (06-08b composition wrapper)
 * new RouterBroker({ ...config, runtime: { tap: inspector.tap } })
 * // Live debug
 * inspector.enable()
 * const recent = inspector.getBuffer() // immutable deep clone
 * inspector.disable() // memory hygiene: drop buffer
 * ```
 *
 * @param opts {@link EventInspectorOptions}.
 * @returns EventInspector closure.
 */
export function createEventInspector(opts: EventInspectorOptions = {}): EventInspector {
  const state: EventInspectorState = {
    enabled: opts.initiallyEnabled ?? detectDefaultEnabled(),
    buffer: [],
    bufferSize: opts.bufferSize ?? DEFAULT_BUFFER_SIZE,
  }

  return {
    tap: {
      onPipelineStep(_step: PipelineStep, snapshot: PipelineSnapshot): void {
        if (!state.enabled) return // hot-path early return D-160 — zero overhead production
        state.buffer.push(snapshot)
        if (state.buffer.length > state.bufferSize) {
          state.buffer.shift() // FIFO drop-oldest D-167
        }
      },
    },
    enable() {
      state.enabled = true
    },
    disable() {
      state.enabled = false
      state.buffer = [] // memory hygiene RESEARCH §6.3 (T-06-05-03 mitigation)
    },
    getBuffer() {
      // D-162 deep-clone via structuredClone — caller mutation NON corrompe state interno
      return structuredClone(state.buffer)
    },
    clear() {
      state.buffer = []
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
