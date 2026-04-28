// EventTap — interfaccia di osservabilità pre-instrumentata della pipeline
// (PRD §10, §28; REQ CORE-13).
//
// VINCOLO ARCHITETTURALE CRITICO (RESEARCH §3.2 + SUMMARY):
// `EventTap` deve essere instrumentato già in F1, anche con implementazione no-op.
// F2-F5 estendono la pipeline aggiungendo step. F6 sostituisce il no-op con Inspector reali.
// Aggiungere il Tap retroattivamente in F6 = retrofit invasivo di tutti i filtri.
//
// Riferimento decisione D-20 (CONTEXT 01): F1 implementa esattamente i 5 step seguenti.
// Plan 07 (`bus.ts`) emette il tap ad ogni step. Errori del tap sono swallowed
// (un tap che fallisce non rompe la pipeline).
//
// `PipelineStep` discriminated union — F2/F3/F6 estenderanno via TypeScript declaration
// merging quando aggiungeranno step (vedi commenti in calce).

// F1 implements these 5 steps; F2/F3/F6 estenderanno via declaration merging:
//   F2/F3 add: 'event.source.resolved' (step 4), 'event.mapped.canonical' (step 5),
//              'event.canonical.validated' (step 6), 'event.route.resolved' (step 8),
//              'event.route.executed' (step 9), 'event.outcome.collected' (step 10),
//              'event.mapped.consumer' (step 11), 'event.final.validated' (step 12).
//   F6 adds:   'event.observed' (step 14).
/**
 * Pipeline step identifier (5 steps in F1).
 *
 * F2/F3 will add via declaration merging: `'event.source.resolved'`,
 * `'event.mapped.canonical'`, `'event.canonical.validated'`,
 * `'event.route.resolved'`, `'event.route.executed'`,
 * `'event.outcome.collected'`, `'event.mapped.consumer'`,
 * `'event.final.validated'`.
 *
 * F6 will add: `'event.observed'`.
 */
export type PipelineStep =
  | 'event.received'
  | 'event.metadata.enriched'
  | 'event.validated'
  | 'event.dedupe.checked'
  | 'event.delivered'

/**
 * Snapshot of pipeline state at a single step. Emitted by `EventBus` to the
 * configured {@link EventTap}. `payloadBefore`/`payloadAfter` are populated only
 * when `runtime.debug = true` + `debug.snapshotPayloadsFull = true` (D-29).
 */
export interface PipelineSnapshot {
  readonly eventId: string
  readonly topic: string
  readonly step: PipelineStep
  readonly timestamp: number
  readonly durationMs: number
  readonly payloadBefore?: unknown
  readonly payloadAfter?: unknown
  readonly metadata?: Record<string, unknown>
}

/**
 * Wire Tap pattern for pipeline observation (CORE-13).
 *
 * F1 default: no-op (zero overhead). F6 substitutes the no-op with real Event /
 * Mapping / Route Inspector — without retrofit (architectural constraint).
 *
 * Errors thrown from `onPipelineStep` are swallowed (D-20) — a tap that fails
 * never breaks the pipeline.
 */
export interface EventTap {
  onPipelineStep(step: PipelineStep, snapshot: PipelineSnapshot): void
}
