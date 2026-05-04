// worker-broker.ts — `WorkerBroker` composition wrapper di `RouterBroker` (Wave 4
// plan 05-06 — D-121 / D-83 strict carryover — F5 vive solo in
// `packages/worker/src/`).
//
// **Opzione B research §7.2 — D-83 strict preservation:**
// Il `publish(topic)` override intercetta topic matching una worker route registrata
// PRIMA di delegare a `inner.publish` (RouterBroker F3). In questo modo F5:
// - NON modifica `packages/routing/route-resolver.ts` né `route-executor.ts`
// - NON viola D-83 (`git diff main packages/{core,mapper,routing}/src/
//   packages/gateway/src/{http,sse-ws}/` zero output)
// - Riusa pipeline §28 mapper F2 step 5-6 + step 11-12 invariati per il flusso
//   non-worker (HTTP/local/cache/composite)
// - Aggiunge step 9 dispatch worker pre-publish per route worker matching
//
// Pattern composition identico a `RealtimeBroker` di F4 (plan 04-08):
// - `inner: RouterBroker` (F3) — delegato per pub/sub/lifecycle/routing/http/cache/composite
// - `registry: WorkerRegistry` — Map<id, WorkerEntry> con cascade owner (D-126)
// - `pool: WorkerPool` — bounded slots + lazy spawn + F3 BackpressureStrategy
//   riusato (D-130 critical bypass)
// - `tracker: TaskTracker` — state machine atomico Pitfall 2C closure (D-133)
// - `handler: WorkerHandler` — Strategy F3 dispatch (D-152) costruito al constructor
// - `workerRoutes: Map<topic, RouteWorkerDefinition>` — registry route worker per
//   topic match nel `publish` intercept
//
// **Cascade D-126 + LIFE-02 ext F5:**
// - `registerPlugin(desc)` → `inner.registerPlugin` + auto-registra
//   `desc.workers` con `ownerId=desc.id` nel registry (con `system.warn`
//   strutturato su register failure — pattern F4 W-5 closure)
// - `unregisterPlugin(id)` → `inner.unregisterPlugin` + `registry.unregisterByOwner`
//   + `pool.terminateByOwner` (3-step cascade, try/catch isolato per idempotency
//   — pattern F3 router-broker-wrapper.ts:463-485)
//
// Threat coverage:
// - T-05-06-01 (Tampering — F3 dispatch worker via modifica routing/): mitigate
//   via Opzione B publish intercept. Verifica: `git diff main packages/routing/`
//   zero output post-commit.
// - T-05-06-02 (Spoofing — source 'worker' override consumer): mitigate. Source
//   descriptor impostato dal handler `{ type: 'worker', id: route.worker, name: route.task }`
//   writer-side — il consumer payload NON può sovrascriverlo.
// - T-05-06-09 (Logic flaw — cascade cleanup parziale lascia worker dangling):
//   mitigate via 3-step cascade try/catch isolato.
// - T-05-06-10 (DoS — worker route duplicate topic silent override): mitigate via
//   `registerWorkerRoute` throw `worker.route.duplicate` (NO last-write-wins).
// - T-05-06-11 (Information Disclosure — externalAbortControllers Map leak):
//   accept. Map cleanup in `finally` di publish — entry rimossa post-execute.

import { createBrokerError, type BrokerEvent, type PluginDescriptor, type Subscription } from '@sembridge/core'
import { RouterBroker, type RouterBrokerConfig } from '@sembridge/routing'

import { WorkerRegistry, type WorkerEntry, type WorkerRegistrySnapshot } from './worker-registry'
import { WorkerPool, type WorkerPoolSnapshot } from './worker-pool'
import {
  WorkerBridge,
  type WorkerBridgeDeps,
} from './worker-bridge'
import {
  createTaskTracker,
  type TaskTracker,
  type TaskTrackerSnapshot,
} from './task-tracker'
import { createWorkerHandler, type WorkerHandler } from './worker-handler'
import type {
  AssertSerializableMode,
  RouteWorkerDefinition,
  WorkerConfig,
  WorkerDescriptor,
} from './types'

/**
 * Type del terzo argomento di `RouterBroker.publish` — riusato per propagare
 * `options.source/id/correlationId/priority`. Pattern coerente con `RealtimeBroker`
 * di F4.
 */
type RouterPublishOptions = Parameters<RouterBroker['publish']>[2]

/**
 * Configurazione `WorkerBroker` — accetta tutto il `RouterBrokerConfig` di F3 +
 * sezione F5 `workers` + bootstrap `workerRoutes`.
 *
 * Pattern declaration merging: `workers?: WorkerConfig` aggiunto via
 * `worker/augment.ts` (plan 05-01 D-122). Per chiarezza export-side ridichiariamo
 * il super-set come interface esplicita — coerente con `RouterBrokerConfig` di F3
 * e `RealtimeBrokerConfig` di F4.
 */
export interface WorkerBrokerConfig extends RouterBrokerConfig {
  /** F5 sezione `workers` (D-122). Override `assertSerializable` mode + defaults. */
  readonly workers?: WorkerConfig
  /**
   * Worker routes registrate al boot (alternativa a `registerWorkerRoute`
   * runtime). Pattern simmetrico a `routes` di F3 routing.
   */
  readonly workerRoutes?: readonly RouteWorkerDefinition[]
  /**
   * DI Worker constructor per Tier-1 jsdom test (D-150). Default:
   * `globalThis.Worker`. Quando passato, il bridge factory propaga al
   * `WorkerBridge` per uso da `desc.factory()`.
   */
  readonly WorkerCtor?: typeof Worker
}

/**
 * F5 WorkerBroker — composition wrapper di RouterBroker (D-121, D-83 strict
 * carryover).
 *
 * **Opzione B research §7.2 — D-83 strict preservation:**
 * Il `publish(topic)` override intercetta topic matching una worker route
 * registrata prima di delegare a `inner.publish` (RouterBroker F3). In questo
 * modo F5:
 * - NON modifica `packages/routing/route-resolver.ts` né `route-executor.ts`
 * - NON viola D-83 (zero diff `packages/routing/`)
 * - Riusa pipeline §28 mapper F2 step 5-6 + step 11-12 invariati per il flusso
 *   non-worker (HTTP/local/cache/composite)
 * - Aggiunge step 9 dispatch worker pre-publish per route worker matching
 *
 * Per le route NON-worker, il publish è delegato trasparentemente a
 * `inner.publish` — pipeline F3 normale.
 *
 * **Cascade D-126 + LIFE-02 ext F5:**
 * - `registerPlugin(desc)` → `inner.registerPlugin` + auto-registra
 *   `desc.workers` con `ownerId=desc.id`
 * - `unregisterPlugin(id)` → `inner.unregisterPlugin` +
 *   `registry.unregisterByOwner` + `pool.terminateByOwner` (3-step cascade,
 *   try/catch isolato per idempotency)
 *
 * @example Quick start (config-driven workers + workerRoutes)
 * ```ts
 * import { createWorkerBroker } from '@sembridge/worker'
 *
 * const broker = createWorkerBroker({
 *   workerRoutes: [
 *     { type: 'worker', id: 'r1', topic: 'csv.parse.requested',
 *       worker: 'csv-parser', task: 'parseCsv' },
 *   ],
 * })
 * broker.registerWorker({
 *   id: 'csv-parser',
 *   factory: () => new Worker(new URL('./csv.worker.ts', import.meta.url), { type: 'module' }),
 *   tasks: ['parseCsv'],
 * })
 * broker.subscribe('csv.parse.completed', (ev) => console.log(ev.payload))
 * await broker.publish('csv.parse.requested', { rows: '...' })
 * ```
 *
 * @example Plugin cascade (D-126)
 * ```ts
 * await broker.registerPlugin({
 *   id: 'reports-plugin',
 *   workers: [{ id: 'report-worker', factory: () => new Worker(...), tasks: ['generateReport'] }],
 * })
 * // Cleanup: tutti i workers + pool slots di reports-plugin terminati
 * await broker.unregisterPlugin('reports-plugin')
 * ```
 *
 * @see {@link createWorkerBroker} — public factory (no singleton, D-30)
 * @see {@link WorkerHandler} — Strategy F3 dispatch (D-152)
 * @see {@link WorkerRegistry} — Map<id, WorkerEntry> con cascade owner (D-126)
 * @see {@link WorkerPool} — bounded slots + lazy spawn + F3 BackpressureStrategy
 * @see RESEARCH §7.2 — Opzione B rationale + D-83 strict gate
 */
export class WorkerBroker {
  private readonly inner: RouterBroker
  private readonly registry: WorkerRegistry
  private readonly pool: WorkerPool
  private readonly tracker: TaskTracker
  private readonly handler: WorkerHandler
  /** Map<topic, RouteWorkerDefinition> per Opzione B publish intercept lookup. */
  private readonly workerRoutes = new Map<string, RouteWorkerDefinition>()
  /** External AbortControllers per scope publish (cleanup in finally). */
  private readonly externalAbortControllers = new Map<string, AbortController>()
  /** WorkerCtor injected per bridge factory (DI test Tier-1). */
  private readonly WorkerCtor: typeof Worker | undefined
  /** AssertSerializable mode propagato al WorkerBridge factory. */
  private readonly assertSerializableMode: AssertSerializableMode | undefined

  constructor(config: WorkerBrokerConfig = {}) {
    // 1. Compose RouterBroker (F3) — pattern identico RealtimeBroker → RouterBroker
    //    (D-83 chain F1→F2→F3→F4→F5).
    this.inner = new RouterBroker(config)

    // 2. Initialize building blocks (W2/W3)
    this.registry = new WorkerRegistry()
    this.WorkerCtor = config.WorkerCtor
    this.assertSerializableMode = config.workers?.assertSerializable
    this.pool = new WorkerPool({
      registry: this.registry,
      bridgeFactory: (desc) => this.makeBridge(desc),
      ...(this.assertSerializableMode !== undefined && {
        assertSerializableMode: this.assertSerializableMode,
      }),
    })
    this.tracker = createTaskTracker()

    // 3. Construct handler con publishFn legato a inner.publish (Opzione B
    //    delegate per outcome events — pipeline §28 step 11-12 mapper F2 +
    //    step 13 dispatch F1 invariati).
    this.handler = createWorkerHandler({
      registry: this.registry,
      pool: this.pool,
      tracker: this.tracker,
      publishFn: (topic, payload, opts) => {
        this.inner.publish(topic, payload, opts as RouterPublishOptions)
      },
    })

    // 4. Bootstrap worker routes from config (analog F3 `routes` boot)
    if (config.workerRoutes !== undefined) {
      for (const route of config.workerRoutes) {
        this.registerWorkerRoute(route)
      }
    }
  }

  // ============================================================================
  // Public API — publish intercept Opzione B (D-83 strict preservation)
  // ============================================================================

  /**
   * **Opzione B (RESEARCH §7.2) — publish intercept pre-delegate.**
   *
   * Topic matching worker route → execute via handler; altrimenti delegate inner.
   *
   * Per topic con worker route registrata:
   * 1. Costruisce un `BrokerEvent` canonico dal topic + payload + options.
   * 2. Crea un `AbortController` external scope per cancellation cooperative.
   * 3. Invoca `handler.execute(event, route, ctrl.signal)` (pipeline §28 step 9
   *    dispatch — D-152).
   * 4. Cleanup `externalAbortControllers` Map in `finally`.
   *
   * Per topic NON-worker → delegate `inner.publish(topic, payload, options)`
   * (pipeline F3 normale — HTTP/local/cache/composite invariati).
   *
   * @param topic - Topic dell'evento.
   * @param payload - Payload dell'evento.
   * @param options - Opzioni publish (source, correlationId, priority, deliveryMode).
   */
  async publish(
    topic: string,
    payload: unknown,
    options?: RouterPublishOptions,
  ): Promise<void> {
    const workerRoute = this.workerRoutes.get(topic)
    if (workerRoute === undefined) {
      // Topic non-worker → delegate diretto a inner (pipeline F3 normale).
      this.inner.publish(topic, payload, options)
      return
    }

    // Topic worker → costruisci BrokerEvent canonico per handler.
    const opts = (options ?? {}) as {
      readonly id?: string
      readonly source?: BrokerEvent['source']
      readonly correlationId?: string
      readonly priority?: BrokerEvent['priority']
    }
    const eventId = opts.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const event = {
      id: eventId,
      topic,
      payload,
      timestamp: Date.now(),
      source: opts.source ?? { type: 'system', id: 'worker-broker' },
      ...(opts.correlationId !== undefined && { correlationId: opts.correlationId }),
      ...(opts.priority !== undefined && { priority: opts.priority }),
    } as BrokerEvent

    const abortKey = `${topic}:${eventId}`
    const ctrl = new AbortController()
    this.externalAbortControllers.set(abortKey, ctrl)
    try {
      await this.handler.execute(event, workerRoute, ctrl.signal)
    } finally {
      this.externalAbortControllers.delete(abortKey)
    }
  }

  /** Delegate `inner.subscribe`. */
  subscribe(...args: Parameters<RouterBroker['subscribe']>): Subscription {
    return this.inner.subscribe(...args)
  }

  /** Delegate `inner.registerRoute` (F3 — D-60 ROUTE-01). */
  registerRoute(
    ...args: Parameters<RouterBroker['registerRoute']>
  ): ReturnType<RouterBroker['registerRoute']> {
    return this.inner.registerRoute(...args)
  }

  /** Delegate `inner.unregisterRoute`. */
  unregisterRoute(
    ...args: Parameters<RouterBroker['unregisterRoute']>
  ): ReturnType<RouterBroker['unregisterRoute']> {
    return this.inner.unregisterRoute(...args)
  }

  /** Delegate `inner.registerCanonicalSchema` (F2). */
  registerCanonicalSchema(
    ...args: Parameters<RouterBroker['registerCanonicalSchema']>
  ): ReturnType<RouterBroker['registerCanonicalSchema']> {
    return this.inner.registerCanonicalSchema(...args)
  }

  // ============================================================================
  // Plugin management (override per cascade D-126 + LIFE-02 ext F5)
  // ============================================================================

  /**
   * Registra un plugin — delegate a `RouterBroker.registerPlugin` + auto-register
   * `descriptor.workers` con `ownerId = descriptor.id` (D-126 cascade).
   *
   * Pattern try/catch isolato (W-5 closure F4 — niente silent catch): un worker
   * fallito al register emette `system.warn` con dettagli strutturati. Il plugin
   * viene COMUNQUE registrato (graceful degrade pattern F3).
   */
  async registerPlugin(descriptor: PluginDescriptor): Promise<void> {
    await this.inner.registerPlugin(descriptor)
    if (descriptor.workers !== undefined && descriptor.workers.length > 0) {
      for (const desc of descriptor.workers) {
        try {
          this.registry.register(desc, descriptor.id)
        } catch (err) {
          // W-5 fix iter F4 — niente silent catch: emit `system.warn` strutturato.
          this.inner.publish(
            'system.warn',
            {
              plugin: descriptor.id,
              worker: desc.id,
              reason: 'worker-register-failed',
              error: errorToSafeShape(err),
            } as never,
            {
              source: { type: 'system', id: 'worker-broker', name: 'register-plugin' },
            } as RouterPublishOptions,
          )
        }
      }
    }
  }

  /**
   * Unregister plugin — cascade 3-step LIFE-02 ext F5 (carryover D-86 F3 / D-112 F4):
   *
   * 1. `inner.unregisterPlugin(id)` — F3 cascade routes + http abort + F2 cascade + F1 unsub
   * 2. `registry.unregisterByOwner(id)` — rimuove worker entries del plugin (D-126)
   * 3. `pool.terminateByOwner(id)` — termina bridge slots del plugin (idempotente)
   *
   * Try/catch isolato per ogni step (pattern F3 router-broker-wrapper.ts:463-485):
   * un fail in uno step NON blocca i successivi.
   */
  async unregisterPlugin(id: string): Promise<void> {
    try {
      await this.inner.unregisterPlugin(id)
    } catch {
      /* pattern F3 silent — un fail in F3 cascade NON blocca F5 cleanup */
    }
    // Termina pool PRIMA di unregister registry — il pool legge listByOwner che
    // dipende dal registry (T-05-05-04 mitigation).
    try {
      this.pool.terminateByOwner(id)
    } catch {
      /* idempotent */
    }
    try {
      this.registry.unregisterByOwner(id)
    } catch {
      /* idempotent */
    }
  }

  // ============================================================================
  // Worker management (top-level API — bypassa cascade plugin)
  // ============================================================================

  /**
   * Registra un worker top-level (`ownerId='system'`) — alternative a
   * `PluginDescriptor.workers` per consumer non-plugin. NON viene rimosso da
   * `unregisterPlugin` (filter strict per ownerId — T-05-05-04 mitigation).
   */
  registerWorker(desc: WorkerDescriptor): void {
    this.registry.register(desc, 'system')
  }

  /**
   * Rimuove un worker top-level — cascade `pool.terminateByOwner` PRIMA del
   * `registry.unregister` (per evitare race su `listByOwner`).
   */
  unregisterWorker(id: string): void {
    const entry = this.registry.get(id)
    if (entry !== undefined) {
      // Termina solo i bridge di quel worker (non tutti gli owner) — usa direttamente
      // pool.terminateByOwner con l'owner del worker.
      this.pool.terminateByOwner(entry.ownerId)
    }
    this.registry.unregister(id)
  }

  /**
   * Registra una worker route — popola `workerRoutes` Map per Opzione B publish
   * intercept lookup.
   *
   * Validazioni:
   * - Duplicate guard (NO last-write-wins): se topic già registrato → throw
   *   `worker.route.duplicate` (T-05-06-10 mitigation).
   * - Validate worker exists + task declared (D-124 fail-fast — solo se il
   *   worker è già registrato; il caso `worker.unknown` runtime è gestito dal
   *   handler.execute al primo publish).
   *
   * @throws BrokerError `worker.route.duplicate` (category 'config') se il topic
   *   è già registrato a un'altra route.
   * @throws BrokerError `worker.task.unknown` (category 'config') se il worker
   *   è già registrato e il task non è dichiarato.
   */
  registerWorkerRoute(route: RouteWorkerDefinition): void {
    if (this.workerRoutes.has(route.topic)) {
      const existing = this.workerRoutes.get(route.topic)!
      throw createBrokerError({
        code: 'worker.route.duplicate',
        message: `WorkerRoute on topic '${route.topic}' already registered (id: ${existing.id})`,
        category: 'config',
        details: {
          topic: route.topic,
          existingRouteId: existing.id,
          requestedRouteId: route.id,
        },
      })
    }
    // Pre-check D-124 task declared (skip se worker non ancora registrato — il
    // caso `worker.unknown` runtime è gestito dal handler.execute).
    if (this.registry.get(route.worker) !== undefined) {
      if (!this.registry.validateTask(route.worker, route.task)) {
        throw createBrokerError({
          code: 'worker.task.unknown',
          message: `Worker '${route.worker}' does not declare task '${route.task}'`,
          category: 'config',
          details: {
            workerId: route.worker,
            taskName: route.task,
            routeId: route.id,
          },
        })
      }
    }
    this.workerRoutes.set(route.topic, route)
  }

  /**
   * Snapshot debug F5 — registry + pool + tracker + workerRoutes count.
   *
   * Pattern F1/F4 `getDebugSnapshot` / `getDebugInfo`.
   */
  getDebugSnapshot(): {
    readonly registry: WorkerRegistrySnapshot
    readonly pool: WorkerPoolSnapshot
    readonly tracker: TaskTrackerSnapshot
    readonly workerRoutes: number
  } {
    return {
      registry: this.registry.getDebugSnapshot(),
      pool: this.pool.getDebugSnapshot(),
      tracker: this.tracker.getDebugSnapshot(),
      workerRoutes: this.workerRoutes.size,
    }
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Bridge factory iniettato nel WorkerPool — costruisce `WorkerBridge` con DI
   * `WorkerCtor` (test Tier-1) + `assertSerializableMode` propagato.
   *
   * @internal
   */
  private makeBridge(desc: WorkerDescriptor): WorkerBridge {
    const deps: WorkerBridgeDeps = {
      ...(this.WorkerCtor !== undefined && { WorkerCtor: this.WorkerCtor }),
      ...(this.assertSerializableMode !== undefined && {
        assertSerializableMode: this.assertSerializableMode,
      }),
    }
    return new WorkerBridge(desc, deps)
  }
}

/**
 * Coerce errore generic in shape safe per `system.warn` payload.
 *
 * @internal
 */
function errorToSafeShape(err: unknown): {
  readonly code: string
  readonly message: string
  readonly category: string
} {
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'category' in err &&
    'message' in err
  ) {
    const e = err as { code: string; message: string; category: string }
    return { code: e.code, message: e.message, category: e.category }
  }
  return {
    code: 'unknown',
    message: err instanceof Error ? err.message : String(err),
    category: 'system',
  }
}

// Re-export type per discoverability barrel-style.
export type { WorkerEntry }
