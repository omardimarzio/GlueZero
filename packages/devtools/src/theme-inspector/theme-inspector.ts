/**
 * `createThemeInspector` — subscriber passivo `ui.*` + ring buffer 500
 * (W5a plan 07-09, UI-DEVTOOLS-01).
 *
 * Pattern role-match con `packages/devtools/src/event-inspector.ts:133` (F6
 * plan 06-05): closure factory + lazy-mode toggle (D-160) + deep-clone via
 * `structuredClone` (D-162) + ring buffer cap default 500 (D-167) + hot-path
 * early-return su `state.enabled === false` per zero overhead in production.
 *
 * **D-F7-04 D-83 strict:** vive in NUOVA sub-folder
 * `packages/devtools/src/theme-inspector/`. Zero modifiche a
 * `packages/devtools/src/index.ts` o ai file top-level esistenti di devtools/src.
 *
 * **Peer dep optional:** `BrokerLike` importato come type-only da
 * `@gluezero/theme` (peerDependenciesMeta.optional). Consumer che NON usa il
 * subpath theme-inspector non installa `@gluezero/theme`.
 *
 * Threat coverage:
 * - T-F7-01 (Tampering buffer entries): structuredClone in getBuffer (D-162)
 *   + subscriber passivo (no event mutation).
 * - T-F7-03 (DoS ring buffer overflow): cap 500 default (D-167) + Array.shift
 *   FIFO; clear su disable per memory hygiene.
 *
 * Refs:
 * - 07-CONTEXT.md D-F7-04 (subpath additivo) + UI-DEVTOOLS-01
 * - 07-09-PLAN.md Task 2
 * - F6 createEventInspector pattern (06-CONTEXT.md D-160 + D-162 + D-167)
 */

import type { BrokerLike } from '@gluezero/theme'
import type {
  ThemeInspectorOptions,
  ThemeInspectorSnapshot,
  UiEventEntry,
} from './types/inspector'

/** Default ring buffer cap (D-167 — pattern F6 createEventInspector). */
const DEFAULT_BUFFER_SIZE = 500

/**
 * Surface API esposta da `createThemeInspector`.
 *
 * @see {@link createThemeInspector}
 */
export interface ThemeInspector {
  /** Riabilita la cattura events post `disable()`. */
  enable(): void
  /**
   * Disabilita la cattura + svuota il buffer (memory hygiene, T-F7-03 mitigation
   * — pattern F6 EventInspector D-160).
   */
  disable(): void
  /**
   * Ritorna deep-clone del buffer (D-162 — caller mutation NON corrompe stato
   * interno).
   */
  getBuffer(): readonly UiEventEntry[]
  /** Svuota il buffer senza toccare lo stato `enabled`. */
  clear(): void
  /** Snapshot stato runtime corrente. */
  getSnapshot(): ThemeInspectorSnapshot
  /**
   * Cleanup: unsubscribe broker + svuota buffer + flag destroyed. Idempotent
   * (multiple call safe, T-F7-03 mitigation per leak prevention).
   */
  destroy(): void
}

/**
 * Default inline detection NODE_ENV (D-160 pattern F6 carryover).
 *
 * Production → `false` (zero overhead). Browser/dev → `true` (DX dev-friendly).
 */
function detectDefaultEnabled(): boolean {
  try {
    // Pattern carryover F6 event-inspector.ts:89 — accesso safe via globalThis cast
    // (devtools è browser-package senza @types/node; `process` non è in scope ambient).
    const proc = (
      globalThis as {
        process?: { env?: Record<string, string | undefined> }
      }
    ).process
    if (proc != null && proc.env != null) {
      return proc.env['NODE_ENV'] !== 'production'
    }
  } catch {
    /* fallthrough — qualsiasi accesso/lettura process eccezione → fallback browser */
  }
  return true
}

/**
 * Crea un nuovo {@link ThemeInspector} (D-30 anti-singleton).
 *
 * Subscriber passivo `ui.*` (wildcard pattern F1 broker): cattura tutti i 5
 * `ui.*` events emessi da ThemeManager (UI-EVENT-01..05) in ring buffer 500
 * default. Non modifica eventi (subscriber read-only).
 *
 * Ring buffer drop-oldest FIFO via `Array.shift` quando length supera bufferSize
 * (D-167 + RESEARCH §6.3 memory footprint predictable).
 *
 * `getBuffer()` ritorna deep-clone via `structuredClone` (D-162) — caller
 * mutation NON corrompe `state.buffer` interno (T-F7-01 mitigation).
 *
 * `disable()` svuota il buffer per memory hygiene (T-F7-03 mitigation, pattern
 * F6 EventInspector RESEARCH §6.3 ring buffer leak).
 *
 * `destroy()` unsubscribe il broker subscriber per leak prevention.
 *
 * @example Live debug
 * ```ts
 * import { createTheme } from '@gluezero/theme/factory'
 * import { createBroker } from '@gluezero/core'
 * import { createThemeInspector } from '@gluezero/devtools/theme-inspector'
 *
 * const broker = createBroker()
 * const theme = createTheme({ broker })
 * const inspector = createThemeInspector(broker)
 *
 * theme.manager.setMode('dark')
 * theme.manager.setDensity('compact')
 *
 * console.log(inspector.getBuffer())
 * // [
 * //   { topic: 'ui.theme.changed',   payload: { ... }, timestamp: ... },
 * //   { topic: 'ui.density.changed', payload: { ... }, timestamp: ... },
 * // ]
 *
 * inspector.disable() // memory hygiene: drop buffer
 * inspector.destroy() // unsubscribe + cleanup
 * ```
 *
 * @param broker - Broker GlueZero (duck-typed `BrokerLike`) su cui sottoscrivere `ui.*`.
 * @param opts - {@link ThemeInspectorOptions}.
 * @returns ThemeInspector closure.
 *
 * @see UI-DEVTOOLS-01
 * @see D-160 (lazy-mode hot-path)
 * @see D-162 (structuredClone deep-clone)
 * @see D-167 (ring buffer cap 500)
 */
export function createThemeInspector(
  broker: BrokerLike,
  opts: ThemeInspectorOptions = {},
): ThemeInspector {
  const state = {
    enabled: opts.initiallyEnabled ?? detectDefaultEnabled(),
    buffer: [] as UiEventEntry[],
    bufferSize: opts.bufferSize ?? DEFAULT_BUFFER_SIZE,
  }
  let destroyed = false

  // Subscribe wildcard `ui.*` — cattura tutti i 5 ui.* events emessi da
  // ThemeManager (UI-EVENT-01..05). Subscriber passivo: nessuna mutation.
  const unsubscribe = broker.subscribe<unknown>('ui.*', (event) => {
    // Hot-path early return D-160 — zero overhead in production
    if (!state.enabled) return
    const entry: UiEventEntry = {
      topic: event.topic,
      payload: event.payload,
      timestamp: event.timestamp ?? Date.now(),
    }
    state.buffer.push(entry)
    if (state.buffer.length > state.bufferSize) {
      // FIFO drop-oldest D-167 — pattern F6 EventInspector
      state.buffer.shift()
    }
  })

  return {
    enable(): void {
      if (destroyed) return
      state.enabled = true
    },
    disable(): void {
      if (destroyed) return
      state.enabled = false
      // Memory hygiene RESEARCH §6.3 (T-F7-03 mitigation): drop buffer su disable
      state.buffer = []
    },
    getBuffer(): readonly UiEventEntry[] {
      // D-162 deep-clone via structuredClone — caller mutation NON corrompe stato interno
      return state.buffer.map((e) => structuredClone(e))
    },
    clear(): void {
      state.buffer = []
    },
    getSnapshot(): ThemeInspectorSnapshot {
      return Object.freeze({
        bufferSize: state.bufferSize,
        enabled: state.enabled,
        entryCount: state.buffer.length,
      })
    },
    destroy(): void {
      if (destroyed) return
      destroyed = true
      unsubscribe()
      state.buffer = []
      state.enabled = false
    },
  }
}
