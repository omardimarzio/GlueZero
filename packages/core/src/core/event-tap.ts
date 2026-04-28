// EventTap: noopEventTap + safeTapStep + startStep helper
// (PRD §10, §28; REQ CORE-13; decisione D-20).
//
// `noopEventTap` è il tap default registrato in F1 quando nessun Inspector è installato.
// La pipeline emette un evento al tap su ogni step (D-20: 5 step F1, F2-F5 estendono,
// F6 sostituisce con Inspector reali). Costo zero in produzione.
//
// `safeTapStep` è il wrapper che la pipeline (`bus.ts` plan 07) usa per invocare il tap:
// cattura ogni eccezione lanciata dal tap di terze parti (D-20: errors swallowed → un tap
// che fallisce non rompe la pipeline). Threat T-04-01 mitigation.
//
// `startStep()` è un helper factory: cattura `performance.now()` all'avvio dello step,
// ritorna una funzione che produce uno `PipelineSnapshot` completo con `durationMs`
// calcolato al momento dell'invocazione. Permette al chiamante di emettere il tap
// alla fine dello step senza passarsi manualmente il timestamp.

import type { EventTap, PipelineSnapshot, PipelineStep } from '../types/tap'

export const noopEventTap: EventTap = {
  onPipelineStep: () => {},
}

export function safeTapStep(
  tap: EventTap,
  step: PipelineStep,
  snapshot: PipelineSnapshot,
  onError?: (e: unknown) => void,
): void {
  try {
    tap.onPipelineStep(step, snapshot)
  } catch (e) {
    onError?.(e)
  }
}

export type SnapshotFactory = (
  step: PipelineStep,
  eventId: string,
  topic: string,
  extras?: Partial<PipelineSnapshot>,
) => PipelineSnapshot

export function startStep(): SnapshotFactory {
  const start = performance.now()
  return (step, eventId, topic, extras = {}) => ({
    eventId,
    topic,
    step,
    timestamp: Date.now(),
    durationMs: performance.now() - start,
    ...extras,
  })
}
