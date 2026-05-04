// types/internal-topics.ts — reserved internal topics F5 (D-131 cancel + D-137
// progress).
//
// Riferimento decisioni (05-CONTEXT.md):
// - D-131: topic riservato `__cancel__` per cooperative cancellation pool worker.
//   Il `WorkerHandler` (plan 05-06) emette `__cancel__` con `taskId` payload sul
//   bridge Comlink; il worker source ascolta via signal proxy per uscire dal
//   task in modo cooperativo (default `cancelGraceMs: 2000ms` prima di terminate
//   fallback).
// - D-137: topic riservato `__progress__` per il payload progress tra worker e
//   handler (D-136 schema canonical). Filtrato strict per non finire come evento
//   pubblico nel broker (consumer-facing è il topic `<prefix>.progress`).
//
// **Pattern S5 STRICT match (RESEARCH §11.7 anti AP-6):** la filter function
// usa `===` esatto, NON `startsWith('__')`. Topic legittimi che iniziano con
// `__` (es. `weather.__cancel__`) NON sono internal — solo le 2 stringhe esatte
// `'__cancel__'` e `'__progress__'`.
//
// Pattern carryover F4 D-111 (`__ping__`/`__pong__` di
// `gateway/sse-ws/frame-parser.ts`).

/**
 * Reserved internal topics F5 (D-131 + D-137). Frozen const literal.
 *
 * Pattern S5 STRICT match — solo le 2 stringhe esatte sono internal. Topic
 * legittimi che iniziano con `__` (es. `weather.__cancel__`) passano through
 * come eventi normali del broker.
 *
 * @example
 * ```ts
 * INTERNAL_TOPICS_WORKER.CANCEL    // '__cancel__'
 * INTERNAL_TOPICS_WORKER.PROGRESS  // '__progress__'
 * Object.isFrozen(INTERNAL_TOPICS_WORKER) // true
 * ```
 */
export const INTERNAL_TOPICS_WORKER: Readonly<{
  readonly CANCEL: '__cancel__'
  readonly PROGRESS: '__progress__'
}> = Object.freeze({ CANCEL: '__cancel__', PROGRESS: '__progress__' } as const)

/**
 * Match STRICT — solo le 2 stringhe esatte sono internal (Pattern S5 anti
 * AP-6).
 *
 * - `isInternalWorkerTopic('__cancel__')` → `true`
 * - `isInternalWorkerTopic('__progress__')` → `true`
 * - `isInternalWorkerTopic('weather.__cancel__')` → `false` (NON prefix-based)
 * - `isInternalWorkerTopic('__cancelxxx__')` → `false` (NON prefix-based)
 *
 * @param topic — topic da verificare
 * @returns `true` se topic è esattamente `__cancel__` o `__progress__`
 */
export function isInternalWorkerTopic(topic: string): boolean {
  return topic === INTERNAL_TOPICS_WORKER.CANCEL || topic === INTERNAL_TOPICS_WORKER.PROGRESS
}
