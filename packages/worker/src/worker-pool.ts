// worker-pool.ts — bounded slots + queue + lazy spawn + respawn + cancellation
// hybrid + cascade `terminateByOwner` (Wave 3-B plan 05-05 — GREEN phase).
//
// Decisioni implementate:
// - D-127 default size = `min(navigator.hardwareConcurrency, 4)` con fallback 4
//   se `navigator.hardwareConcurrency` undefined (jsdom / Worker / SSR).
// - D-128 cap hard 8 — registry valida al register; pool difensivo cap +
//   `console.warn` 1 volta per worker se `allowUnboundedPool: true` con
//   `size > 8` (Pitfall 7.D protection).
// - D-129 lazy first dispatch — slots spawnati on-demand al primo `acquireSlot`,
//   espansione fino a `targetSize`.
// - D-130 F3 BackpressureStrategy riusato 1:1 — import workspace dep da
//   `@sembridge/gateway/http` (`createBackpressureStrategy` + types). NIENTE
//   ridichiarazione, NIENTE copia. Critical priority bypass (Pitfall 4.C).
// - D-131 cancellation hybrid — `mode: 'dedicated'` → bridge.terminate immediato
//   via `terminateByOwner`; `mode: 'pool'` → cooperative via signal proxied
//   nel bridge.dispatch (delegato all'implementazione del bridge — owned da 05-04).
// - LIFE-02 ext F5 — `terminateByOwner` cascade rimuove SOLO i worker del plugin.
//
// File ownership disgiunta da 05-04 (parallel wave 3): NON importa direttamente
// `WorkerBridge` di `./worker-bridge`. Usa `WorkerBridgeLike` interface minimal
// + `bridgeFactory` DI — il consumer (05-06 worker-handler) connette
// `bridgeFactory: (desc) => new WorkerBridge(desc, deps)`.
//
// Pattern role-match con `RealtimeChannelManager` di F4 (registry + cascade)
// + `BackpressureStrategy` queue per-key (F3 D-75).
//
// Threat coverage:
// - T-05-05-01 DoS storm: cap hard 8 (registry-validato) + warn 1x se override.
// - T-05-05-04 Tampering cross-plugin cleanup: `terminateByOwner` filtra strict
//   `entry.ownerId === ownerId` via `registry.listByOwner`.
// - T-05-05-06 Race acquireSlot double-claim: JS event loop single-thread →
//   sequenza `for s of slots; if (!s.busy) s.busy = true; return s` atomica.
// - T-05-05-07 BackpressureStrategy bypass: `priority === 'critical'` esplicito
//   gate verificabile via grep (D-130 Pitfall 4.C).
// - T-05-05-09 respawn currentTaskId leak: nuovo PoolSlot { busy: false } —
//   currentTaskId implicit undefined (object literal fresh).

import {
  createBackpressureStrategy,
  type BackpressureStrategy,
} from '@sembridge/gateway/http'
import { MAX_POOL_SIZE_HARD, type WorkerRegistry } from './worker-registry'
import type {
  AssertSerializableMode,
  ProgressPayload,
  WorkerDescriptor,
} from './types'

/**
 * Interfaccia minimal del bridge consumed dal pool — disaccoppiamento da
 * `WorkerBridge` (Wave 3-A plan 05-04).
 *
 * Il consumer (Wave 4 plan 05-06) connette il `WorkerBridge` reale via
 * `WorkerPoolDeps.bridgeFactory: (desc) => new WorkerBridge(desc, deps)`.
 * I test del pool usano `MockBridge` locale (file ownership disgiunta).
 */
export interface WorkerBridgeLike {
  dispatch(
    taskName: string,
    payload: unknown,
    signal: AbortSignal,
    onProgress?: (p: ProgressPayload) => void,
    options?: { readonly transferable?: readonly string[] },
  ): Promise<unknown>
  terminate(): void
}

/**
 * Default pool size (D-127).
 *
 * Formula: `min(navigator.hardwareConcurrency, 4)` con fallback `4` se
 * `navigator` o `hardwareConcurrency` non disponibili (jsdom test, Worker
 * context, SSR). Il fallback 4 è coerente con il cap (`min(4, 4) = 4`).
 *
 * @returns Numero di slot di default per `mode: 'pool'` senza `size` esplicito.
 */
export function defaultPoolSize(): number {
  const nav = (globalThis as { navigator?: Navigator }).navigator
  const hwc =
    typeof nav?.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0
      ? nav.hardwareConcurrency
      : 4
  return Math.min(hwc, 4)
}

/** Slot interno del pool — bridge + busy flag + currentTaskId opzionale. */
interface PoolSlot {
  readonly bridge: WorkerBridgeLike
  busy: boolean
  currentTaskId?: string
}

/** Snapshot debug pool (Inspector F6 future-compat / DOC-05). */
export interface WorkerPoolSnapshot {
  readonly activeBridges: number
  readonly queuedTasks: number
  readonly byWorkerId: Readonly<
    Record<string, { readonly spawned: number; readonly busy: number }>
  >
}

/**
 * Dipendenze del `WorkerPool` — DI completa per testabilità.
 */
export interface WorkerPoolDeps {
  /** `WorkerRegistry` consumed per descriptor lookup + cascade `listByOwner`. */
  readonly registry: WorkerRegistry
  /**
   * Factory injection per `WorkerBridgeLike` (D-83 disaccoppiamento da 05-04).
   *
   * Il consumer (05-06) connette `(desc) => new WorkerBridge(desc, deps)`.
   * I test usano `(desc) => new MockBridge(desc)` con file ownership disgiunta.
   */
  readonly bridgeFactory: (desc: WorkerDescriptor) => WorkerBridgeLike
  /**
   * Backpressure strategy (D-130 carryover F3 D-75). Default:
   * `createBackpressureStrategy({ defaultPolicy: { type: 'queue-bounded', max: 1000 } })`.
   *
   * Override per test injection o per consumer che vuole policy custom per-route
   * via `resolvePolicy`.
   */
  readonly backpressure?: BackpressureStrategy
  /**
   * D-139 — `assertSerializable` mode forwarded al bridge factory consumer.
   * Il pool stesso non lo usa, ma può propagarlo via `bridgeFactory` se il
   * consumer lo onora. NON-strict.
   */
  readonly assertSerializableMode?: AssertSerializableMode
}

/** Default policy F5 — coerente con D-130 (queue-bounded max 1000). */
const DEFAULT_POOL_BACKPRESSURE_MAX = 1000

/**
 * `WorkerPool` — bounded slots + queue + lazy spawn + respawn + cancellation
 * hybrid (D-127/128/129/130/131).
 *
 * Lifecycle:
 * 1. `new WorkerPool({ registry, bridgeFactory, backpressure? })` — istanzia
 *    `slotsByWorker` Map vuota. Niente spawn (D-129 lazy).
 * 2. `acquireSlot(workerId)` — lookup descriptor in registry → cerca slot libero
 *    → se assente e pool sotto `targetSize`, spawn nuovo bridge via
 *    `bridgeFactory(desc)` → mark busy + return.
 * 3. `dispatchOnSlot(workerId, taskName, payload, signal, onProgress?)` — wrapper
 *    convenience: `acquireSlot → bridge.dispatch → releaseSlot`. Il `releaseSlot`
 *    è `try/finally` per garantire reset busy anche su errore del task.
 * 4. `releaseSlot(workerId, slot)` — flip `busy = false`, reset `currentTaskId`.
 * 5. `respawn(workerId, slotIndex)` — D-131 fault recovery: termina old bridge
 *    + crea nuovo bridge per lo slot (es. worker andato in error stato).
 * 6. `terminateByOwner(ownerId)` — cascade D-126 ext F5: per ogni worker owned
 *    da `ownerId`, termina tutti i bridge + rimuove dalla Map. Idempotente.
 * 7. `schedule(routeId, priority, task)` — delega a F3 BackpressureStrategy
 *    (D-130). `priority === 'critical'` BYPASSA (Pitfall 4.C carryover).
 *
 * @example
 * ```ts
 * const pool = new WorkerPool({
 *   registry,
 *   bridgeFactory: (desc) => new WorkerBridge(desc, { WorkerCtor: globalThis.Worker }),
 * })
 * await pool.dispatchOnSlot('parser', 'parseCsv', { data: '...' }, ctrl.signal)
 * pool.terminateByOwner('plugin-a') // cascade cleanup
 * ```
 *
 * @see {@link WorkerRegistry} — descriptor lookup + cascade owners
 * @see {@link defaultPoolSize} — D-127 formula
 * @see {@link MAX_POOL_SIZE_HARD} — D-128 cap hard (registry-validato)
 */
export class WorkerPool {
  private readonly slotsByWorker = new Map<string, PoolSlot[]>()
  private readonly backpressure: BackpressureStrategy
  /** Tracking per-worker del warn unbounded (Pitfall 7.D — emit 1x per worker). */
  private readonly warnedUnbounded = new Set<string>()

  constructor(private readonly deps: WorkerPoolDeps) {
    this.backpressure =
      deps.backpressure ??
      createBackpressureStrategy({
        defaultPolicy: { type: 'queue-bounded', max: DEFAULT_POOL_BACKPRESSURE_MAX },
      })
  }

  /**
   * Schedule task via F3 BackpressureStrategy (D-130 carryover).
   *
   * Critical bypass (Pitfall 4.C): `priority === 'critical'` skippa la strategy
   * e invoca `task()` direttamente. Verifica via grep
   * `priority === 'critical'` ≥ 1 in `worker-pool.ts`.
   *
   * @param routeId Backpressure key — tipicamente `RouteWorkerDefinition.id`.
   * @param priority Priorità BrokerEvent. `'critical'` riservato a `system.error`
   *   trusted (PRD §16 / Pitfall 4.C consistency).
   * @param task Funzione async — il caller la wrappa attorno al `dispatchOnSlot`.
   */
  async schedule<T>(
    routeId: string,
    priority: 'critical' | 'high' | 'normal' | 'low',
    task: () => Promise<T>,
  ): Promise<T> {
    if (priority === 'critical') {
      // D-130 / Pitfall 4.C — eventi critical SEMPRE delivered.
      return await task()
    }
    return await this.backpressure.schedule(routeId, priority, () => task())
  }

  /**
   * Convenience wrapper — acquire + dispatch + release con `try/finally`.
   *
   * Il release avviene DOPO `await bridge.dispatch` anche su throw — pattern
   * RAII-like che garantisce slot non-leak su errore del task.
   */
  async dispatchOnSlot(
    workerId: string,
    taskName: string,
    payload: unknown,
    signal: AbortSignal,
    onProgress?: (p: ProgressPayload) => void,
    transferable?: readonly string[],
  ): Promise<unknown> {
    const slot = await this.acquireSlot(workerId)
    try {
      return await slot.bridge.dispatch(
        taskName,
        payload,
        signal,
        onProgress,
        transferable !== undefined ? { transferable } : undefined,
      )
    } finally {
      this.releaseSlot(workerId, slot)
    }
  }

  /**
   * Variante test-friendly per Test 3: invoca un `task` arbitrario (no
   * dispatch sul bridge) ma occupa lo slot per la durata del task.
   *
   * Usato dai test per simulare workload e verificare bound + queue. Il
   * consumer reale (05-06) usa `dispatchOnSlot`.
   *
   * @internal — esposto per testing del pool stesso.
   */
  async dispatchOnSlotWithTask<T>(
    workerId: string,
    task: (slot: PoolSlot) => Promise<T>,
  ): Promise<T> {
    const slot = await this.acquireSlot(workerId)
    try {
      return await task(slot)
    } finally {
      this.releaseSlot(workerId, slot)
    }
  }

  /**
   * D-129 lazy first dispatch — spawn slot on-demand fino a `targetSize`.
   *
   * Algoritmo:
   * 1. Lookup descriptor in registry — throw se non registrato.
   * 2. Resolve `targetSize` (D-127 default + override D-128 con warn).
   * 3. Cerca slot libero (`!s.busy`) — atomicità implicita JS event loop.
   * 4. Se nessuno libero e `slots.length < targetSize`: spawn nuovo
   *    bridge via `bridgeFactory(desc)`.
   * 5. Se pool saturo: `waitForFreeSlot` polling (5ms tick — V1 minimal,
   *    consumer dovrebbe usare `schedule()` per backpressure formale).
   *
   * @throws Error inline (no createBrokerError per evitare circular dep core)
   *   se workerId non in registry.
   */
  async acquireSlot(workerId: string): Promise<PoolSlot> {
    const entry = this.deps.registry.get(workerId)
    if (entry === undefined) {
      throw new Error(
        `WorkerPool: worker '${workerId}' is not registered. Call registry.register() first.`,
      )
    }
    const desc = entry.desc
    const targetSize = this.resolveSize(desc)

    let slots = this.slotsByWorker.get(workerId)
    if (slots === undefined) {
      slots = []
      this.slotsByWorker.set(workerId, slots)
    }

    // 1. Cerca slot libero (T-05-05-06 race-free per JS single-thread)
    for (const s of slots) {
      if (!s.busy) {
        s.busy = true
        return s
      }
    }

    // 2. Espandi pool se sotto capacity (D-129 lazy)
    if (slots.length < targetSize) {
      const bridge = this.deps.bridgeFactory(desc)
      const newSlot: PoolSlot = { bridge, busy: true }
      slots.push(newSlot)
      return newSlot
    }

    // 3. Pool saturo — wait for free slot (V1 minimal polling)
    return await this.waitForFreeSlot(slots)
  }

  /**
   * Libera slot — flip `busy = false`, reset `currentTaskId`.
   *
   * Idempotente — chiamare 2x non causa side-effect.
   */
  releaseSlot(_workerId: string, slot: PoolSlot): void {
    slot.busy = false
    delete slot.currentTaskId
  }

  /**
   * D-131 fault recovery — termina old bridge + crea nuovo bridge per slot.
   *
   * Use case: worker andato in error stato (es. uncaught exception, memory leak,
   * Comlink proxy released). Il route handler (05-06) può invocare `respawn`
   * dopo N consecutive failures su quello slot.
   *
   * Il nuovo slot è `busy: false` — pronto per `acquireSlot` successivo
   * (T-05-05-09 mitigation: currentTaskId implicit undefined).
   *
   * @param workerId ID worker.
   * @param slotIndex Index dello slot in `slotsByWorker.get(workerId)`.
   */
  respawn(workerId: string, slotIndex: number): void {
    const slots = this.slotsByWorker.get(workerId)
    if (slots === undefined || slotIndex < 0 || slotIndex >= slots.length) return

    const oldSlot = slots[slotIndex]
    if (oldSlot === undefined) return

    try {
      oldSlot.bridge.terminate()
    } catch {
      // Idempotent — bridge.terminate dovrebbe essere safe ma swallow per robustezza
    }

    const entry = this.deps.registry.get(workerId)
    if (entry === undefined) {
      // Worker stato unregistered durante respawn — rimuovi slot
      slots.splice(slotIndex, 1)
      return
    }

    const newBridge = this.deps.bridgeFactory(entry.desc)
    slots[slotIndex] = { bridge: newBridge, busy: false }
  }

  /**
   * D-126 ext F5 cascade LIFE-02 — termina TUTTI i worker owned da `ownerId`.
   *
   * Steps:
   * 1. `registry.listByOwner(ownerId)` — strict filter `entry.ownerId === ownerId`
   *    (T-05-05-04 mitigation).
   * 2. Per ogni worker: termina tutti i bridge dei suoi slot + rimuove la Map
   *    entry (i bridge non saranno più reachable).
   * 3. Idempotente: chiamare 2x non throw (Map.delete su key inesistente è no-op).
   *
   * Note: la cascade del registry (`registry.unregisterByOwner`) è responsabilità
   * del consumer (`WorkerBroker.unregisterPlugin` in Wave 4 plan 05-06) — questo
   * metodo gestisce SOLO il pool, lasciando il registry intoccato per evitare
   * doppia-rimozione.
   *
   * @param ownerId Plugin owner.
   */
  terminateByOwner(ownerId: string): void {
    const owned = this.deps.registry.listByOwner(ownerId)
    for (const entry of owned) {
      const workerId = entry.desc.id
      const slots = this.slotsByWorker.get(workerId)
      if (slots !== undefined) {
        for (const s of slots) {
          try {
            s.bridge.terminate()
          } catch {
            // Idempotent swallow — bridge.terminate safe-by-contract
          }
        }
        this.slotsByWorker.delete(workerId)
      }
      this.warnedUnbounded.delete(workerId)
    }
  }

  /**
   * Test util — eager spawn per assertions deterministiche.
   *
   * Forza la creazione di un bridge senza dispatch. Usato dai test per
   * verificare cascade cleanup e snapshot prima del primo task.
   *
   * @internal Non usato in production (D-129 lazy pattern).
   */
  spawnEager(workerId: string): void {
    const entry = this.deps.registry.get(workerId)
    if (entry === undefined) return
    const bridge = this.deps.bridgeFactory(entry.desc)
    let slots = this.slotsByWorker.get(workerId)
    if (slots === undefined) {
      slots = []
      this.slotsByWorker.set(workerId, slots)
    }
    slots.push({ bridge, busy: false })
  }

  /**
   * Snapshot debug — pattern F1 / F4 `getDebugSnapshot`.
   *
   * @returns `{ activeBridges, queuedTasks, byWorkerId: { spawned, busy } }`.
   */
  getDebugSnapshot(): WorkerPoolSnapshot {
    let active = 0
    const byWorkerId: Record<string, { readonly spawned: number; readonly busy: number }> = {}
    for (const [id, slots] of this.slotsByWorker) {
      const busy = slots.reduce((acc, s) => (s.busy ? acc + 1 : acc), 0)
      byWorkerId[id] = { spawned: slots.length, busy }
      active += slots.length
    }
    return { activeBridges: active, queuedTasks: 0, byWorkerId }
  }

  /**
   * Resolve target size dal descriptor (D-127 default + D-128 cap +
   * Pitfall 7.D warn).
   */
  private resolveSize(desc: WorkerDescriptor): number {
    if (desc.mode === 'dedicated') return 1

    const requested = desc.size ?? defaultPoolSize()

    if (
      requested > MAX_POOL_SIZE_HARD &&
      desc.allowUnboundedPool === true &&
      !this.warnedUnbounded.has(desc.id)
    ) {
      // Pitfall 7.D — emit warn 1x per worker
      // eslint-disable-next-line no-console
      console.warn(
        `[SemBridge] WorkerPool '${desc.id}' configured with allowUnboundedPool size=${requested}. Risk of pool storm — monitor RAM usage and worker lifetime.`,
      )
      this.warnedUnbounded.add(desc.id)
    }

    if (requested > MAX_POOL_SIZE_HARD && desc.allowUnboundedPool !== true) {
      // Defensive cap — registry dovrebbe aver già throw, ma safety belt
      return MAX_POOL_SIZE_HARD
    }

    return requested
  }

  /**
   * Polling minimal (5ms tick) per attendere uno slot libero quando il pool è
   * saturo. V1 — consumer dovrebbe usare `schedule()` per backpressure formale.
   *
   * Pattern: ciclo `setTimeout` non-bloccante con re-check atomico al wakeup.
   * Atomicità garantita da JS event loop single-thread (T-05-05-06).
   */
  private waitForFreeSlot(slots: PoolSlot[]): Promise<PoolSlot> {
    return new Promise<PoolSlot>((resolve) => {
      const tick = (): void => {
        for (const s of slots) {
          if (!s.busy) {
            s.busy = true
            resolve(s)
            return
          }
        }
        setTimeout(tick, 5)
      }
      tick()
    })
  }
}
