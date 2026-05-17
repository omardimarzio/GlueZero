/**
 * `@gluezero/devtools/mf-inspector/pause` — Custom pause/resume/flush wrapper (D-V2-F16-10).
 *
 * **NON usa direttamente F6 `createPauseController`** (RESEARCH Pitfall §3.4 nota critica):
 * F6 ha semantica replay-broker (`pauseTopic` accoda eventi per replay successivo via
 * `resumeTopic`), mentre F16 ha semantica snapshot-retention (pause stoppa il flusso
 * inspector ma NON re-emette gli eventi al resume — la queue è drenata via `flush()`).
 *
 * Pattern: chiusura semplice con boolean `paused` + array queue. Il chiamante
 * (`module.ts` subscribe handler) usa `intercept(event)` come gate:
 * - `intercept(event) === true` → passthrough (event raggiunge aggregator/timings)
 * - `intercept(event) === false` → queued (skip downstream)
 *
 * **Globale (non per-topic):** F16 pause è globale come da REQ MF-DEVTOOLS-04 — non
 * richiede granularità per-topic (a differenza F6 `pauseController.pauseTopic(topic)`).
 *
 * @see D-V2-F16-10 — pause/resume/flush API globale
 * @see RESEARCH §2.3 + Pitfall §3.4 — semantica diversa vs F6 replay-broker
 * @see packages/devtools/src/pause-controller.ts — F6 (NON usato qui)
 * @packageDocumentation
 */

/**
 * Wrapper pause/resume/flush + intercept gate (D-V2-F16-10).
 *
 * - `pause()` — attiva il flag globale: `intercept(event)` ritornerà `false`.
 * - `resume()` — disattiva il flag globale: `intercept(event)` ritornerà `true`.
 * - `flush()` — drena la queue accumulata e ritorna gli eventi. La queue viene
 *   svuotata atomicamente (idempotent — chiamate successive ritornano `[]`).
 * - `isPaused()` — reflect dello state corrente per assertion test.
 * - `intercept<T>(event)` — gate per il subscribe handler. Ritorna `true` quando
 *   il subscribe deve passare al downstream; `false` quando l'event va accodato.
 */
export interface MfPauseWrap {
  pause(): void
  resume(): void
  /** Drena la queue accumulata + svuota atomicamente. Ritorna deep-clone safe. */
  flush(): readonly unknown[]
  isPaused(): boolean
  /**
   * Gate per subscribe handler. Quando `isPaused() === true`, accoda l'event
   * e ritorna `false` (caller deve `return` early). Quando `false`, passthrough
   * (caller deve invocare aggregator/timings).
   */
  intercept(event: unknown): boolean
}

/**
 * Crea un nuovo wrapper pause/resume/flush (D-V2-F16-10).
 *
 * Pattern carryover RESEARCH §2.3 — closure semplice senza dipendenze F6
 * `PauseController` (semantica diversa Pitfall §3.4).
 *
 * @returns Una nuova istanza `MfPauseWrap` con stato inizialmente non-paused.
 *
 * @example Quick start
 * ```ts
 * const ctrl = createMfPause()
 * ctrl.intercept({}) // true (passthrough)
 * ctrl.pause()
 * ctrl.intercept({ topic: 'a' }) // false (queued)
 * ctrl.intercept({ topic: 'b' }) // false (queued)
 * console.log(ctrl.flush()) // [{topic:'a'}, {topic:'b'}]
 * console.log(ctrl.flush()) // [] (idempotent)
 * ```
 *
 * @example Subscribe handler gate
 * ```ts
 * const pauseCtrl = createMfPause()
 * broker.subscribe('microfrontend.mounted', (event) => {
 *   if (!pauseCtrl.intercept(event)) return // queued, skip downstream
 *   aggregator.handleEvent('microfrontend.mounted', event)
 * })
 * ```
 *
 * @see D-V2-F16-10
 * @see RESEARCH §2.3
 */
export function createMfPause(): MfPauseWrap {
  const queue: unknown[] = []
  let paused = false
  return {
    pause(): void {
      paused = true
    },
    resume(): void {
      paused = false
    },
    flush(): readonly unknown[] {
      const out = queue.slice()
      queue.length = 0
      return out
    },
    isPaused(): boolean {
      return paused
    },
    intercept(event: unknown): boolean {
      if (paused) {
        queue.push(event)
        return false
      }
      return true
    },
  }
}
