// worker-registry.ts — Map<id, WorkerEntry> registry + cascade `unregisterByOwner`
// (Wave 3-B plan 05-05 — GREEN phase).
//
// Decisioni implementate:
// - D-124 fail-fast: validazione descriptor al register (`tasks` non-empty,
//   `factory` callable, `id` non-empty).
// - D-126 cascade: `unregisterByOwner(ownerId)` rimuove TUTTE le entry con quel
//   `ownerId` — pattern carryover da F3 D-86 (`unregisterByOwner` HTTP) e F4
//   D-112 (`disconnectByOwner` realtime). LIFE-02 ext F5.
// - D-128 cap hard: pool size > 8 throws `worker.pool.size.exceeded` salvo
//   `allowUnboundedPool: true`. `MAX_POOL_SIZE_HARD = 8` constant esportata
//   per uso simmetrico in `worker-pool.ts`.
//
// Pattern role-match con `realtime-channel-manager.ts` di F4:
// - Map indicizzata per `id` univoco (NON multiplex per factory/url).
// - Duplicate guard al register con `existingOwner` in details (T-05-05-03).
// - `getDebugSnapshot` analog `getDebugInfo` F4.
//
// Threat coverage:
// - T-05-05-01 DoS pool storm: `MAX_POOL_SIZE_HARD = 8` + `allowUnboundedPool`
//   opt-in (Pitfall 7.D protection).
// - T-05-05-03 Spoofing cross-plugin worker: duplicate id throws con
//   `existingOwner` — Plugin B non può sovrascrivere worker di Plugin A.
// - T-05-05-04 Tampering cross-plugin cleanup: `unregisterByOwner` filtra
//   strict `entry.ownerId === ownerId` — preserve cross-plugin.

import { createBrokerError } from '@sembridge/core'
import type { WorkerDescriptor } from './types'

/**
 * Cap hard pool size (D-128).
 *
 * Pool size > {@link MAX_POOL_SIZE_HARD} richiede `allowUnboundedPool: true` esplicito
 * nel descriptor (con `console.warn` lato pool — Pitfall 7.D protection contro storm).
 *
 * Esportato come `const literal` per consumer esterni (es. test
 * `worker-pool.test.ts` Test 10) e per simmetria con `worker-pool.ts`.
 */
export const MAX_POOL_SIZE_HARD = 8 as const

/**
 * Entry interna del registry — descriptor + ownership + timestamp.
 *
 * `registeredAt` utile per debug snapshot e troubleshooting (es. ordine di
 * registrazione plugin vs cascade).
 */
export interface WorkerEntry {
  readonly desc: WorkerDescriptor
  readonly ownerId: string
  readonly registeredAt: number
}

/**
 * Snapshot debug (Inspector F6 future-compat / DOC-05).
 */
export interface WorkerRegistrySnapshot {
  readonly workerCount: number
  readonly byOwner: Readonly<Record<string, number>>
}

/**
 * `WorkerRegistry` — Map<id, WorkerEntry> con register/get/listByOwner +
 * cascade `unregisterByOwner` (D-126 LIFE-02 ext F5).
 *
 * Pattern simmetrico a `RealtimeChannelManager` di F4: registry N-entry +
 * cascade per-ownerId + duplicate guard al register.
 *
 * Lifecycle:
 * 1. `new WorkerRegistry()` — istanzia Map vuota.
 * 2. `register(desc, ownerId)` — valida descriptor (D-124 fail-fast +
 *    D-128 size cap) + duplicate guard. Throw `BrokerError` se invalid.
 * 3. `get(id)` — lookup O(1).
 * 4. `validateTask(workerId, taskName)` — pre-check D-124 per route handler
 *    (Wave 4 plan 05-06). Throw `worker.unknown` se id non registrato.
 * 5. `unregisterByOwner(ownerId)` — cascade analog F3 D-86 / F4 D-112.
 *    Ritorna l'array degli id rimossi (utile per pool cleanup downstream).
 *
 * @example Register + lookup + cascade
 * ```ts
 * const registry = new WorkerRegistry()
 * registry.register({ id: 'parser', factory: () => new Worker(...), tasks: ['parseCsv'] }, 'plugin-A')
 * const entry = registry.get('parser')
 * registry.unregisterByOwner('plugin-A') // cascade cleanup LIFE-02 ext F5
 * ```
 *
 * @example Validate task fail-fast (D-124)
 * ```ts
 * registry.register({ id: 'csv', factory, tasks: ['parseCsv'] })
 * registry.validateTask('csv', 'parseCsv')   // → true
 * registry.validateTask('csv', 'unknownTask') // → false (route handler will throw worker.task.unknown)
 * ```
 *
 * @throws {BrokerError} `worker.id.duplicate` (category 'config') al register
 *   se `desc.id` già presente (T-05-05-03 — include `existingOwner` in details).
 * @throws {BrokerError} `worker.descriptor.invalid` (category 'config') se
 *   descriptor con `id`/`factory`/`tasks` mancanti o malformati (D-124).
 * @throws {BrokerError} `worker.pool.size.exceeded` (category 'config') se
 *   `desc.size > MAX_POOL_SIZE_HARD` senza opt-in `allowUnboundedPool: true`.
 *
 * @see {@link MAX_POOL_SIZE_HARD} — D-128 cap costante 8
 * @see WorkerDescriptor — types/worker-descriptor.ts
 * @see D-126 — cascade LIFE-02 ext F5 unregisterByOwner
 */
export class WorkerRegistry {
  private readonly entries = new Map<string, WorkerEntry>()

  /**
   * Registra un worker descriptor con `ownerId`.
   *
   * Steps:
   * 1. Validate descriptor (D-124 fail-fast + D-128 size cap).
   * 2. Duplicate guard: se `desc.id` già presente, throw `worker.id.duplicate`
   *    con `existingOwner` + `requestedOwner` in details (T-05-05-03).
   * 3. Store entry con `registeredAt: Date.now()`.
   *
   * @throws `BrokerError` `worker.descriptor.invalid` (D-124) o
   *   `worker.pool.size.exceeded` (D-128) o `worker.id.duplicate`.
   */
  register(desc: WorkerDescriptor, ownerId: string): void {
    this.validateDescriptor(desc)
    const existing = this.entries.get(desc.id)
    if (existing !== undefined) {
      throw createBrokerError({
        code: 'worker.id.duplicate',
        message: `Worker id '${desc.id}' is already registered (owner: ${existing.ownerId}). Use unique id or unregister first.`,
        category: 'config',
        details: {
          workerId: desc.id,
          existingOwner: existing.ownerId,
          requestedOwner: ownerId,
        },
      })
    }
    this.entries.set(desc.id, { desc, ownerId, registeredAt: Date.now() })
  }

  /**
   * Lookup entry per `id`. O(1) Map.get.
   *
   * @returns `WorkerEntry` se registrato, `undefined` altrimenti.
   */
  get(id: string): WorkerEntry | undefined {
    return this.entries.get(id)
  }

  /**
   * Pre-check D-124 — verifica che `taskName` sia dichiarato nel descriptor.
   *
   * Usato dal route handler (Wave 4 plan 05-06) prima del dispatch al pool.
   * Distingue tra "worker non registrato" (throw `worker.unknown`) e "task
   * sconosciuto" (return false — caller decide se throw `worker.task.unknown`).
   *
   * @throws `BrokerError` `worker.unknown` se `workerId` non è registrato.
   */
  validateTask(workerId: string, taskName: string): boolean {
    const entry = this.entries.get(workerId)
    if (entry === undefined) {
      throw createBrokerError({
        code: 'worker.unknown',
        message: `Worker id '${workerId}' is not registered.`,
        category: 'config',
        details: { workerId },
      })
    }
    return entry.desc.tasks.includes(taskName)
  }

  /**
   * Lista tutte le entry registrate da un dato `ownerId` — usato dal pool per
   * `terminateByOwner` cascade (D-126 LIFE-02 ext F5).
   *
   * @returns Array (vuoto se nessuna entry per `ownerId`).
   */
  listByOwner(ownerId: string): WorkerEntry[] {
    const out: WorkerEntry[] = []
    for (const entry of this.entries.values()) {
      if (entry.ownerId === ownerId) out.push(entry)
    }
    return out
  }

  /**
   * Rimuove singola entry per `id`.
   *
   * @returns `true` se l'entry esisteva, `false` altrimenti (idempotent-friendly).
   */
  unregister(id: string): boolean {
    return this.entries.delete(id)
  }

  /**
   * Cascade D-126 LIFE-02 ext F5 — rimuove TUTTE le entry registrate dal
   * plugin con `ownerId`.
   *
   * Pattern carryover da F3 D-86 (`HttpGateway.abortInFlightByOwner`) e F4 D-112
   * (`RealtimeChannelManager.disconnectByOwner`). Filtra strict
   * `entry.ownerId === ownerId` — Plugin A non può cleanup worker di Plugin B
   * (T-05-05-04 mitigation).
   *
   * @param ownerId Plugin owner — sconosciuto/empty match niente.
   * @returns Array degli id rimossi (utile per pool cleanup downstream).
   */
  unregisterByOwner(ownerId: string): readonly string[] {
    const removed: string[] = []
    for (const [id, entry] of this.entries) {
      if (entry.ownerId === ownerId) {
        this.entries.delete(id)
        removed.push(id)
      }
    }
    return removed
  }

  /**
   * Snapshot debug — pattern F1 `getDebugSnapshot` / F4 `getDebugInfo`.
   *
   * @returns `{ workerCount, byOwner: Record<ownerId, count> }`.
   */
  getDebugSnapshot(): WorkerRegistrySnapshot {
    const byOwner: Record<string, number> = {}
    for (const entry of this.entries.values()) {
      byOwner[entry.ownerId] = (byOwner[entry.ownerId] ?? 0) + 1
    }
    return { workerCount: this.entries.size, byOwner }
  }

  /**
   * Validate descriptor — D-124 fail-fast + D-128 cap hard.
   *
   * Errori uniformati con `category: 'config'` (descriptor errors sono config-time
   * non runtime).
   */
  private validateDescriptor(desc: WorkerDescriptor): void {
    if (desc.id === undefined || desc.id === '') {
      throw createBrokerError({
        code: 'worker.descriptor.invalid',
        message: `WorkerDescriptor.id is required and must be a non-empty string`,
        category: 'config',
      })
    }
    if (typeof desc.factory !== 'function') {
      throw createBrokerError({
        code: 'worker.descriptor.invalid',
        message: `WorkerDescriptor '${desc.id}'.factory must be a function (D-123)`,
        category: 'config',
        details: { workerId: desc.id },
      })
    }
    if (!Array.isArray(desc.tasks) || desc.tasks.length === 0) {
      throw createBrokerError({
        code: 'worker.descriptor.invalid',
        message: `WorkerDescriptor '${desc.id}'.tasks must be a non-empty readonly array (D-124 fail-fast)`,
        category: 'config',
        details: { workerId: desc.id, tasks: desc.tasks },
      })
    }
    // D-128 pool size validation — applicato solo se mode='pool' + size esplicito
    if (
      desc.mode === 'pool' &&
      desc.size !== undefined &&
      desc.size > MAX_POOL_SIZE_HARD &&
      desc.allowUnboundedPool !== true
    ) {
      throw createBrokerError({
        code: 'worker.pool.size.exceeded',
        message: `Pool size ${desc.size} exceeds hard cap ${MAX_POOL_SIZE_HARD}. Set allowUnboundedPool: true to bypass (with console.warn in dev mode).`,
        category: 'config',
        details: {
          workerId: desc.id,
          requestedSize: desc.size,
          maxSize: MAX_POOL_SIZE_HARD,
        },
      })
    }
  }
}
