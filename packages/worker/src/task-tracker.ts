// task-tracker.ts — State machine atomico per Pitfall 2C closure (D-133).
//
// Riferimento decisioni (05-CONTEXT.md):
// - D-133: state machine atomico `Map<TaskId, TaskState>` ignora ogni response
//   post-state-transition (timeout/cancelled/error/done). Una volta `state ≠
//   'pending'`, ogni successivo message dal worker viene scartato silenziosamente
//   (counter `lateResponses` incrementato — Claude's Discretion lockata in
//   CONTEXT, audit retroattivo via getDebugSnapshot).
// - D-134: `correlationId` end-to-end propagato dal `BrokerEvent` originale
//   fino al `WorkerTaskOutcome` (consumer può filtrare 'scarto risposte con
//   correlationId che non è il mio ultimo').
// - D-149: Pattern TDD RED→GREEN co-located (test in task-tracker.test.ts).
// - D-151 #3: Test scenario obbligatorio "Timeout: response post-timeout
//   scartata silenziosamente" verificato deterministicamente in Test 6.
//
// **Pitfall 2C strict (RESEARCH §10.2):** TIMEOUT race condition con response
// dal worker. Senza state machine atomico, il listener `onmessage` può:
// 1. Vedere `setTimeout` espirato → publish `error` + cleanup.
// 2. Successivamente ricevere `comlink-postMessage` di response del worker →
//    publish `success` (DUPLICATE EVENT, business logic violation).
//
// Soluzione: ogni `mark*` invoca `tryTransition(taskId, target)` che fa
// check-and-set atomico (`state === 'pending'` check + `state = target`).
// L'atomicità è garantita dal JS event loop single-threaded — nessun lock
// necessario perché non c'è preemption mid-statement (RESEARCH §10.7).
//
// Pattern factory closure analog `circuit-breaker.ts` di F3 (D-99 state
// machine 3-states): factory ritorna interface tipata + Map<key, state>
// privata al closure + transition methods.

import type { TaskState, WorkerTaskOutcome } from './types'

/**
 * Stato interno per-task del task tracker.
 *
 * Privato al closure di `createTaskTracker` (consumer accede solo via
 * `getDebugSnapshot` snapshot read-only e `getOutcome` outcome typed).
 *
 * - `state` — stato corrente della state machine (D-133).
 * - `startedAt` — timestamp `Date.now()` del `register` (per `elapsedMs`).
 * - `correlationId` — propagato dal `BrokerEvent.correlationId` originale (D-134).
 * - `result` — populated solo quando `state === 'done'`.
 * - `errorCode`/`errorMessage` — populated quando `state === 'error'` (e
 *   opzionalmente `'timeout'`/`'cancelled'` se il consumer fornisce).
 * - `endedAt` — timestamp del final state (per `elapsedMs` deterministico).
 */
interface TrackerState {
  state: TaskState
  startedAt: number
  correlationId: string
  result?: unknown
  errorCode?: string
  errorMessage?: string
  endedAt?: number
}

/**
 * Snapshot read-only dello state della state machine — esposto per debug
 * telemetry (T-05-03-02 mitigation: audit trail per Pitfall 2C late responses).
 *
 * Coerente con il pattern Inspector di F6 (CORE-13 EventTap pre-instrumented).
 *
 * - `tasksActive` — count di task con `state === 'pending'` (in volo).
 * - `tasksCompleted` — count di transition completate (qualsiasi final state).
 * - `lateResponses` — count di transition non-pending o taskId mai registrato
 *   (Pitfall 2C audit). NON include i `register` duplicati (silent override
 *   non è una "late response").
 * - `tasks` — array snapshot dei task (read-only). Array nuovo, nessun
 *   reference interno alla Map (T-05-03-05 mitigation Tampering).
 */
export interface TaskTrackerSnapshot {
  readonly tasksActive: number
  readonly tasksCompleted: number
  readonly lateResponses: number
  readonly tasks: readonly {
    readonly taskId: string
    readonly state: TaskState
    readonly correlationId: string
    readonly startedAt: number
  }[]
}

/**
 * Interface pubblica del task tracker — composta dal `WorkerHandler` (Wave 4
 * plan 05-06) per orchestrare il lifecycle di ogni task in volo.
 *
 * Tutti i `mark*` ritornano `boolean` per consentire al caller di sapere se
 * la transition è stata effettiva (atomic guard CAS-like). Pattern coerente
 * con circuit-breaker.ts di F3 (`recordSuccess`/`recordFailure` → state
 * transition con `getState` snapshot).
 */
export interface TaskTracker {
  /**
   * Registra un nuovo task in volo. Idempotente: se `taskId` già registrato,
   * silent override (last-write-wins) — `taskId` è la chiave del Map.
   *
   * Caveat: re-register reset state a `'pending'` (consumer è responsabile
   * di garantire che `taskId` sia univoco — `nanoid` in handler 05-06).
   */
  register(taskId: string, correlationId: string): void

  /**
   * Tenta la transition `pending → done`. Ritorna `true` se transition
   * effettiva (state era pending), `false` altrimenti (late response,
   * incrementa `lateResponses` counter).
   */
  markDone(taskId: string, result: unknown): boolean

  /**
   * Tenta la transition `pending → timeout`. Stesse semantiche di `markDone`.
   */
  markTimeout(taskId: string): boolean

  /**
   * Tenta la transition `pending → cancelled`. Stesse semantiche di `markDone`.
   */
  markCancelled(taskId: string): boolean

  /**
   * Tenta la transition `pending → error`. Stesse semantiche di `markDone`.
   */
  markError(taskId: string, errorCode: string, errorMessage: string): boolean

  /**
   * Ritorna l'outcome typed del task per fan-out al `WorkerHandler` (D-152).
   * Ritorna `undefined` se `taskId` mai registrato.
   *
   * Nota: il consumer (handler 05-06) è responsabile della cleanup del
   * tracker dopo aver pubblicato il topic `<topic>.completed/.failed`
   * (T-05-03-03: tasks Map growth unbounded — cleanup downstream owner).
   */
  getOutcome(taskId: string): WorkerTaskOutcome | undefined

  /**
   * Snapshot read-only per debug telemetry (Inspector F6 + audit Pitfall 2C
   * late responses). Array `tasks` è una copia, no reference interno.
   */
  getDebugSnapshot(): TaskTrackerSnapshot
}

/**
 * Crea un `TaskTracker` con state machine atomico Pitfall 2C closure (D-133).
 *
 * **Atomicità implicita**: JS event loop single-threaded — `tasks.get(taskId)`
 * + check `state === 'pending'` + `state = target` è una sequenza atomica per
 * lo standard JS (no preemption mid-statement). Nessun lock necessario.
 * Riferimento RESEARCH §10.7.
 *
 * **Counter lateResponses** (Claude's Discretion lockata in CONTEXT):
 * incrementato quando una transition arriva su un task non-pending o mai
 * registrato. Esposto in `getDebugSnapshot()` per audit retroattivo (T-05-03-02
 * mitigation Repudiation).
 *
 * @example
 * ```ts
 * const tracker = createTaskTracker()
 * tracker.register('t1', 'corr-1')
 * tracker.markTimeout('t1') // true
 * tracker.markDone('t1', { foo: 'bar' }) // false (late response)
 * tracker.getDebugSnapshot().lateResponses // 1
 * ```
 *
 * @see D-133 — state machine atomico Pitfall 2C closure
 * @see D-134 — correlationId end-to-end
 * @see D-149 — TDD RED→GREEN co-located
 * @see D-151 #3 — test scenario obbligatorio "Timeout strict"
 */
export function createTaskTracker(): TaskTracker {
  // Map<TaskId, TrackerState> — privata al closure (T-05-03-05 mitigation
  // Tampering: niente reference esposta).
  const tasks = new Map<string, TrackerState>()
  let tasksCompleted = 0
  let lateResponses = 0

  /**
   * Check-and-set atomico per la transition `pending → target`.
   *
   * Atomicità: JS event loop single-threaded garantisce che il check
   * `state === 'pending'` e il set `state = target` siano eseguiti senza
   * preemption (no race condition — RESEARCH §10.7).
   *
   * Late response handling: se `taskId` non esiste o lo state non è
   * `'pending'`, incrementa `lateResponses` e ritorna `false`. Il caller
   * (handler 05-06) usa il return per decidere se publishare il topic
   * outcome — `false` = silent drop.
   */
  function tryTransition(
    taskId: string,
    target: Exclude<TaskState, 'pending'>,
    update?: Partial<TrackerState>,
  ): boolean {
    const s = tasks.get(taskId)
    if (s === undefined || s.state !== 'pending') {
      lateResponses++
      return false
    }
    s.state = target
    s.endedAt = Date.now()
    if (update !== undefined) Object.assign(s, update)
    tasksCompleted++
    return true
  }

  return {
    register(taskId, correlationId) {
      // Last-write-wins: re-register override il TrackerState esistente
      // (Test 11 verifica). taskId univoco è responsabilità consumer.
      tasks.set(taskId, {
        state: 'pending',
        startedAt: Date.now(),
        correlationId,
      })
    },

    markDone(taskId, result) {
      return tryTransition(taskId, 'done', { result })
    },

    markTimeout(taskId) {
      return tryTransition(taskId, 'timeout')
    },

    markCancelled(taskId) {
      return tryTransition(taskId, 'cancelled')
    },

    markError(taskId, errorCode, errorMessage) {
      return tryTransition(taskId, 'error', { errorCode, errorMessage })
    },

    getOutcome(taskId) {
      const s = tasks.get(taskId)
      if (s === undefined) return undefined
      // Costruisce WorkerTaskOutcome shape (D-152). elapsedMs è calcolato
      // come `endedAt - startedAt` se la transition è già avvenuta, oppure
      // `Date.now() - startedAt` se ancora pending (consumer raramente
      // chiama getOutcome su pending — ma comportamento safe).
      //
      // Nota TS strict (`exactOptionalPropertyTypes: true`): i campi optional
      // di `WorkerTaskOutcome` non accettano `undefined` esplicito, quindi
      // costruiamo l'outcome via build incrementale (omit dei campi non
      // popolati).
      const base = {
        taskId,
        correlationId: s.correlationId,
        state: s.state,
        elapsedMs: (s.endedAt ?? Date.now()) - s.startedAt,
      } as const
      const withResult = s.result !== undefined ? { ...base, result: s.result } : base
      const withErrorCode =
        s.errorCode !== undefined ? { ...withResult, errorCode: s.errorCode } : withResult
      const outcome: WorkerTaskOutcome =
        s.errorMessage !== undefined
          ? { ...withErrorCode, errorMessage: s.errorMessage }
          : withErrorCode
      return outcome
    },

    getDebugSnapshot() {
      let active = 0
      // Array literal nuovo — niente reference interno al Map (T-05-03-05).
      const taskList: {
        readonly taskId: string
        readonly state: TaskState
        readonly correlationId: string
        readonly startedAt: number
      }[] = []
      for (const [taskId, s] of tasks) {
        if (s.state === 'pending') active++
        taskList.push({
          taskId,
          state: s.state,
          correlationId: s.correlationId,
          startedAt: s.startedAt,
        })
      }
      return {
        tasksActive: active,
        tasksCompleted,
        lateResponses,
        tasks: taskList,
      }
    },
  }
}
