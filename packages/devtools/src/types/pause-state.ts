/**
 * F6 PauseAction — risultato di `PauseController.intercept(event)` (D-168).
 *
 * - `pass`: topic NON in pausa o priority='critical' (D-170 critical bypass) →
 *   delegato downstream RouterBroker
 * - `queued`: topic in pausa, evento accodato FIFO
 * - `dropped`: topic in pausa + queue piena (cap default 1000 D-170) → dropped
 *   il più vecchio (drop-oldest FIFO) + emit `system.queue.overflow`
 */
export type PauseAction = 'pass' | 'queued' | 'dropped'

/**
 * F6 PauseControllerSnapshot — meta-info esposta da `getPauseControllerSnapshot()`.
 */
export interface PauseControllerSnapshot {
  readonly pausedTopics: readonly string[]
  readonly queueSizes: Readonly<Record<string, number>>
  readonly maxQueueSize: number
}

/**
 * F6 FlushQueueResult — ritornato da `flushQueue(topic?)` (D-169).
 */
export interface FlushQueueResult {
  readonly topic: string
  readonly droppedCount: number
  readonly droppedEventIds: readonly string[]
}
