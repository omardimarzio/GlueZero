// visibility-detector.ts — wrapper Visibility API event-driven (D-110, RESEARCH §5).
//
// Riferimento decisioni (04-CONTEXT.md):
// - D-110: Visibility API integration — listener `visibilitychange`, throttle tolerance ×3
//   stale timeout su hidden, freshness check su `visible`. Il consumer (RealtimeChannelManager
//   plan 04-07) invoca `checkFreshnessAll()` quando il detector emette `'visible'`.
// - D-117: TDD RED→GREEN obbligatorio — co-located test sibling.
// - D-112 (ext D-86): cascade cleanup — `stop()` rimuove la listener via removeEventListener.
//
// Pattern cleanup garantito: replica `combine-signals.ts:62-86` listener tracking
// (memoize listener ref + `addEventListener` + `removeEventListener` puntuale).
//
// Threat coverage (PLAN <threat_model>):
// - T-04-04-02 (Memory leak start ripetuto): start() idempotente — UNA listener anche su N call.
// - T-04-04-03 (Memory leak no stop): stop() idempotente + cleanup garantito.
//
// Anti-pattern AP-5 (PATTERNS.md §5): NO polling timer-based — la API è event-driven,
// polling produce overhead inutile e non risolve il problema mobile freeze (RESEARCH §5.5).

/**
 * Stato osservato della Visibility API (D-110, RESEARCH §5.1).
 *
 * Il W3C Page Visibility API L2 spec definisce anche `'prerender'` ma è raro.
 * F4 V1 collassa tutto su `'visible' | 'hidden'` (i due stati operativamente
 * rilevanti per il freshness check D-110).
 */
export type VisibilityState = 'visible' | 'hidden'

/** Opzioni del factory `createVisibilityDetector` (RESEARCH §5.3 DI guard). */
export interface VisibilityDetectorOptions {
  /** Callback invocato a OGNI transition `visibilitychange`. */
  readonly onChange: (state: VisibilityState) => void
  /**
   * DI per environment senza Document (RESEARCH §5.3 — Web Worker, SSR, iframe sandbox).
   * - `undefined` (default): usa `globalThis.document` (browser/jsdom).
   * - `null`: explicit disable — `start()` no-op, `getState()` ritorna `'visible'` default sicuro.
   * - `Document` mock: test injection.
   */
  readonly document?: Document | null
}

/** Public interface ritornata dal factory. Tutti i metodi sono sync e idempotenti. */
export interface VisibilityDetector {
  /** Inizia ad osservare `visibilitychange`. Idempotente (no-op se già attivo). */
  start(): void
  /** Stop osservazione + cleanup listener (D-112 cascade cleanup). Idempotente. */
  stop(): void
  /** Stato corrente snapshot. Default sicuro `'visible'` se DI guard attivo. */
  getState(): VisibilityState
  /** True se `start()` invocato e detector attivo. */
  isActive(): boolean
}

/**
 * Crea un `VisibilityDetector` che astrae la Visibility API (D-110, RESEARCH §5).
 *
 * Pattern cleanup garantito (replica `combine-signals.ts:62-86` listener tracking):
 * - `start()` registra listener via `document.addEventListener('visibilitychange', fn)`.
 * - `stop()` chiama `document.removeEventListener` puntuale (cleanup garantito, no leak).
 * - Idempotente: `start()` chiamato 2x senza `stop()` registra UNA sola volta.
 *
 * DI guard (RESEARCH §5.3): se `document === null`, `start()` è no-op e `getState()`
 * ritorna `'visible'` per default sicuro (assumiamo "visibile" se non possiamo osservare).
 *
 * **Anti-pattern AP-5 (PATTERNS.md §5):** NO polling timer-based — la Visibility API
 * è event-driven, polling produce overhead inutile.
 *
 * @example
 * ```ts
 * const v = createVisibilityDetector({
 *   onChange: (s) => { if (s === 'visible') manager.checkFreshnessAll() }
 * })
 * v.start()
 * // ... later
 * v.stop() // cleanup garantito
 * ```
 */
export function createVisibilityDetector(
  opts: VisibilityDetectorOptions,
): VisibilityDetector {
  // RESEARCH §5.3 DI guard:
  // - undefined → use globalThis.document (browser default).
  // - null → explicitly disabled (Worker/SSR/iframe sandbox).
  // - Document → test mock injection.
  const doc =
    opts.document === null
      ? null
      : opts.document !== undefined
        ? opts.document
        : typeof globalThis !== 'undefined' && 'document' in globalThis
          ? ((globalThis as { document?: Document }).document ?? null)
          : null

  let active = false
  let listener: (() => void) | null = null

  function read(): VisibilityState {
    if (!doc) return 'visible' // safe default (RESEARCH §5.3)
    return doc.visibilityState === 'hidden' ? 'hidden' : 'visible'
  }

  return {
    start(): void {
      if (active || !doc) return // idempotent + DI guard no-op
      const fn = (): void => {
        opts.onChange(read())
      }
      listener = fn
      doc.addEventListener('visibilitychange', fn)
      active = true
    },
    stop(): void {
      if (!active || !doc || listener === null) return
      doc.removeEventListener('visibilitychange', listener)
      listener = null
      active = false
    },
    getState(): VisibilityState {
      return read()
    },
    isActive(): boolean {
      return active
    },
  }
}
