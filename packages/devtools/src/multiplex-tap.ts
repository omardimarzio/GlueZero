// multiplex-tap.ts — F6 plan 06-04 Task 1.
//
// `createMultiplexTap(taps)` aggrega N `EventTap` in un unico tap che la pipeline
// F1 vede come single value (`runtime.tap`). Il tap aggregator delega a tutti i
// tap interni con error isolation try/catch isolato per ciascun tap (D-159 +
// D-20 carryover safeTapStep F1 `bus.ts:79-110` `event-tap.ts:23-34`).
//
// Pattern Adapter: `RouterBroker { runtime: { tap } }` di F1 vede 1 tap. Quel
// tap è MultiplexTap che internamente forwarda a Inspector + MetricsCollector +
// PauseController + custom user tap. Inspector/Metrics/PauseController sono
// implementati nei plan 06-05/06-06/06-07. Composition wrapper finale in 06-08b.
//
// Vincolo D-83 strict (carryover F1-F5 → F6): nessuna modifica a
// `packages/core/src/core/{bus,event-tap}.ts` né a `packages/core/src/types/tap.ts`.
// Il pattern `safeTapStep` (D-20) è REPLICATO inline (try/catch swallow), NON
// importato — `safeTapStep` non è esportato dal barrel `@gluezero/core` e
// importarlo via deep path violerebbe il package boundary F1.
//
// Threat coverage:
// - T-06-04-01 (DoS tap throw blocca pipeline) → mitigated via try/catch isolato
//   per tap (Test 3 + Test 4 verificano).
// - T-06-04-02 (Information disclosure tap legge payload sensibile) → accept
//   boundary: il consumer registra il tap volontariamente, contract documentato
//   in DOC-06.
// - T-06-04-04 (DoS tap loop infinito ricorsivo) → accept boundary: pattern
//   responsibility consumer; recursion guard NON V1 (analog F1 carryover).

import type { EventTap, PipelineSnapshot, PipelineStep } from '@gluezero/core'

/**
 * F6 MultiplexTap — aggregator chain N {@link EventTap} con error isolation
 * try/catch isolato per tap (D-159 + D-20 carryover safeTapStep F1).
 *
 * Failure di un tap NON ferma downstream tap né blocca pipeline. Pattern
 * Adapter classico — la pipeline F1 vede UN solo tap (single value
 * `runtime.tap`), ma quel tap delega a N tap interni F6.
 *
 * Edge cases:
 * - `taps = []` → ritorna EventTap no-op (early return loop, zero overhead).
 * - `taps = [tap]` → invocazione singola (no overhead aggregato).
 * - `taps = [tap1, tap2, …, tapN]` → invocazione FIFO sequenziale, ognuno con
 *   try/catch indipendente.
 *
 * **Identity preservation**: `step` e `snapshot` sono passati per reference
 * IDENTICA a tutti i tap (no clone). Mutazione del snapshot da parte di un tap
 * è anti-pattern e responsibility del consumer (snapshot è `Readonly<...>` ma
 * non deep-frozen — perf trade-off Pitfall 7B).
 *
 * @see packages/core/src/core/event-tap.ts safeTapStep (analog F1 D-20 — replica
 *   inline pattern, non importato per non rompere D-83 boundary)
 * @see packages/core/src/core/bus.ts:79-116 (uso di safeTapStep nei 5 step F1)
 * @see RESEARCH §5.2 estensione F6 tap registry chain
 *
 * @example
 * ```ts
 * import { createEventInspector } from '@gluezero/devtools'
 * import { createMultiplexTap } from '@gluezero/devtools'
 *
 * const eventInspector = createEventInspector({ bufferSize: 500 })
 * const aggregated = createMultiplexTap([eventInspector.tap, customAnalyticsTap])
 *
 * // Wired al RouterBroker come single tap (config legacy F1):
 * new RouterBroker({ ...config, runtime: { tap: aggregated } })
 * ```
 *
 * @param taps Array (readonly) di EventTap da chainare. Ordering FIFO preservato.
 * @returns EventTap aggregator che invoca tutti i taps con error isolation.
 */
export function createMultiplexTap(taps: readonly EventTap[]): EventTap {
  return {
    onPipelineStep(step: PipelineStep, snapshot: PipelineSnapshot): void {
      for (const tap of taps) {
        try {
          tap.onPipelineStep(step, snapshot)
        } catch {
          // swallow — pattern F1 D-20 carryover (`safeTapStep` analog inline).
          // Failure di un tap NON ferma downstream tap né blocca pipeline (D-159).
          // Threat T-06-04-01 mitigation.
        }
      }
    },
  }
}
