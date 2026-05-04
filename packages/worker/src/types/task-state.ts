// types/task-state.ts — state machine atomico per Pitfall 2C closure (D-133).
//
// Riferimento decisioni (05-CONTEXT.md):
// - D-133: state machine atomico `Map<TaskId, TaskState>` ignora ogni response
//   post-state-transition (timeout/cancelled/error/done). Una volta `state ≠
//   'pending'`, ogni successivo message dal worker viene scartato silenziosamente
//   (counter `lateResponses` incrementato — Claude's Discretion debug telemetry
//   in plan 05-03 task-tracker).
// - D-152: `WorkerTaskOutcome` shape letto dal `WorkerHandler` per costruire
//   `OutcomeCollector` analog F3 (`route-outcome.ts:RouteOutcome`).
// - D-153: il publishing del topic `success`/`error` fa parte del fan-out finale
//   del WorkerHandler — outcome non-pending → publish + cleanup state.
// - D-134: `correlationId` end-to-end nel payload del progress + outcome events,
//   propagato da event ingress fino al final publish.
//
// **Pitfall 2C strict (RESEARCH §10.2):** TIMEOUT race condition con response
// dal worker. Senza state machine atomico, il listener `onmessage` può:
// 1. Vedere `setTimeout` espirato → publish `error` + cleanup.
// 2. Successivamente ricevere `comlink-postMessage` di response del worker →
//    publish `success` (DUPLICATE EVENT, business logic violation).
//
// Soluzione D-133: ogni message check atomic CAS-like sullo state map. Solo la
// PRIMA transizione `pending → final-state` produce side-effect; le successive
// vengono droppate con `lateResponses++`.
//
// Pattern role-match con `packages/routing/src/types/route-outcome.ts`:
// outcome shape post-dispatch + `taskId`/`correlationId` keys.

/**
 * State machine atomico per task in-flight (D-133).
 *
 * Transizioni esclusive (CAS-like atomic via `Map.set` synchronous):
 * - `'pending'` — task in volo, listener attivo, timer running.
 * - `'done'` — worker ha completato + pubblicato success topic.
 * - `'timeout'` — timer scaduto prima di response, publish error con
 *   `code: 'worker.timeout'`.
 * - `'cancelled'` — AbortSignal triggered (cooperative D-131 pool o hard
 *   D-131 dedicated), publish error con `code: 'worker.cancelled'`.
 * - `'error'` — worker ha throwato (uncaught error event), publish error con
 *   `code: 'worker.error'`.
 *
 * Una volta `state ≠ 'pending'`, ogni successivo message dal worker viene
 * scartato silenziosamente (counter `lateResponses` incrementato per debug
 * telemetry in `task-tracker.ts` Wave 2 plan 05-03).
 */
export type TaskState = 'pending' | 'done' | 'timeout' | 'cancelled' | 'error'

/**
 * Outcome del task post-state-transition (D-152, D-153).
 *
 * Letto dal `WorkerHandler` per costruire l'`OutcomeCollector` analog F3
 * (`route-outcome.ts:RouteOutcome` di `@sembridge/routing`). Il publishing del
 * topic `success`/`error` fa parte del fan-out finale del WorkerHandler —
 * outcome non-pending → publish + cleanup state.
 *
 * Contract:
 * - `taskId` — ID univoco generato via `nanoid()` al dispatch (key del state
 *   machine map).
 * - `correlationId` — propagato dal `BrokerEvent` originale (D-134
 *   end-to-end).
 * - `state` — uno dei 5 valori `TaskState` (mai `'pending'` — outcome è il
 *   risultato post-transition).
 * - `result` — opzionale, populated solo quando `state === 'done'`.
 * - `errorCode`/`errorMessage` — opzionali, populated quando
 *   `state ∈ {'timeout', 'cancelled', 'error'}`.
 * - `elapsedMs` — durata wall-clock del task dal dispatch al final state.
 *
 * @example
 * ```ts
 * const outcome: WorkerTaskOutcome = {
 *   taskId: 'tk_abc123',
 *   correlationId: 'corr_xyz',
 *   state: 'done',
 *   result: { records: 10_000 },
 *   elapsedMs: 1542,
 * }
 * ```
 */
export interface WorkerTaskOutcome {
  /** ID univoco del task (nanoid generato al dispatch — D-134). */
  readonly taskId: string
  /** Correlation ID propagato dal `BrokerEvent` originale end-to-end (D-134). */
  readonly correlationId: string
  /** Final state post-transition (mai `'pending'`). */
  readonly state: TaskState
  /** Result del worker — populated solo quando `state === 'done'`. */
  readonly result?: unknown
  /** Error code — populated quando `state ∈ {'timeout','cancelled','error'}`. */
  readonly errorCode?: string
  /** Error message human-readable — populated quando errorCode è popolato. */
  readonly errorMessage?: string
  /** Durata wall-clock dal dispatch al final state (ms). */
  readonly elapsedMs: number
}
