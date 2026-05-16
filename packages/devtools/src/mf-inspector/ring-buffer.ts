/**
 * `@gluezero/devtools/mf-inspector/ring-buffer` — Generic FIFO ring buffer (D-V2-F16-09).
 *
 * Closure factory che mantiene un `T[]` con cap configurabile (default 500).
 * Quando `push(item)` supera la capacity, `shift()` rimuove l'item più vecchio
 * (FIFO drop-oldest semantica — match `event-inspector.ts` F6 D-167 pattern).
 *
 * Per-MF topology (D-V2-F16-09): l'aggregator istanzia una `MfRingBuffer<MfEvent>(500)`
 * per ogni `mfId` osservato, garantendo isolamento (l'overflow di un MF non droppa
 * eventi di altri). Cardinality cap globale N_MF è reserved V2.1 (D-V2-F16-12).
 *
 * **`snapshot()` ritorna deep-clone** via `structuredClone` (D-162 pattern carryover
 * F6 event-inspector.ts) — mutare il return value NON corrompe lo state interno.
 *
 * @see D-V2-F16-09 — per-MF ring buffer 500 topology
 * @see D-V2-F16-12 — cardinality cap unbounded V2 (V2.1 enforcement reserved)
 * @see packages/devtools/src/event-inspector.ts — analog primario (F6 D-167)
 * @packageDocumentation
 */

/**
 * Ring buffer FIFO generico con cap configurabile.
 *
 * **Semantica push:** quando `buf.length > capacity` dopo `push()`, viene
 * rimosso l'elemento più vecchio via `Array.shift()` (FIFO drop-oldest, NO
 * silent loss — il caller può comparare `size()` pre/post per detection).
 *
 * **Semantica snapshot:** ritorna deep-clone via `structuredClone` — mutare
 * il return value NON corrompe lo state interno (D-162 carryover F6).
 *
 * @example Quick start
 * ```ts
 * const buf = createMfRingBuffer<{ topic: string }>(3)
 * buf.push({ topic: 'a' })
 * buf.push({ topic: 'b' })
 * buf.push({ topic: 'c' })
 * buf.push({ topic: 'd' }) // drops 'a' (FIFO)
 * console.log(buf.snapshot()) // [{topic:'b'}, {topic:'c'}, {topic:'d'}]
 * console.log(buf.size())     // 3
 * console.log(buf.capacity()) // 3
 * ```
 */
export interface MfRingBuffer<T> {
  push(item: T): void
  /** Deep-clone via structuredClone (D-162). Mutare return value NON corrompe state. */
  snapshot(): readonly T[]
  size(): number
  capacity(): number
  clear(): void
}

const DEFAULT_CAPACITY = 500

/**
 * Crea un nuovo ring buffer FIFO con capacity dato (default 500).
 *
 * Pattern carryover diretto da `packages/devtools/src/event-inspector.ts:115-140`
 * + `task-tracker.ts` F5 closure factory.
 *
 * @param capacity - Cap massima (default 500, D-V2-F16-09). Quando `size() > capacity`
 *   dopo `push()`, viene rimosso l'item più vecchio via `shift()`.
 * @returns Una nuova istanza `MfRingBuffer<T>`.
 *
 * @example FIFO drop-oldest oltre capacity
 * ```ts
 * const buf = createMfRingBuffer<number>(2)
 * buf.push(1); buf.push(2); buf.push(3)
 * console.log(buf.snapshot()) // [2, 3] — '1' shifted via FIFO
 * ```
 *
 * @example Deep-clone snapshot (D-162)
 * ```ts
 * const buf = createMfRingBuffer<{ x: number }>(10)
 * buf.push({ x: 1 })
 * const snap = buf.snapshot()
 * ;(snap as Array<{ x: number }>)[0].x = 999 // safe — NOT visible in buf
 * console.log(buf.snapshot()[0].x) // 1
 * ```
 *
 * @see D-V2-F16-09 (per-MF 500)
 * @see D-V2-F16-12 (cardinality cap N_MF reserved)
 */
export function createMfRingBuffer<T>(capacity: number = DEFAULT_CAPACITY): MfRingBuffer<T> {
  const buf: T[] = []
  return {
    push(item: T): void {
      buf.push(item)
      // FIFO drop-oldest via Array.shift (analog event-inspector.ts:128)
      if (buf.length > capacity) buf.shift()
    },
    snapshot(): readonly T[] {
      // D-162 defensive deep-clone (structuredClone nativo, no polyfill)
      return structuredClone(buf)
    },
    size(): number {
      return buf.length
    },
    capacity(): number {
      return capacity
    },
    clear(): void {
      buf.length = 0
    },
  }
}
