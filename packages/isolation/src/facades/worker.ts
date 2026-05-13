/**
 * `createWorkerFacade(mfId, policy, resolvers, broker)` — D-V2-F13-12 + MF-INT-WK-01/02.
 *
 * Mirror pattern di `createGatewayFacade` (D-V2-F13-04-AMENDED resolver pattern) con
 * divergenze:
 * - `action='worker'`, `resource='${workerId}.${task}'` (workerId qualifier + task method).
 * - 3 topics: `microfrontend.worker.task.started` (pre-call) + `.completed` (success +
 *   durationMs) + `.error` (catch + error message).
 * - `resolvers.worker?.()` → WorkerService instance lazy lookup.
 * - `workerService.run(workerId, task, payload, {...options, metadata: { microFrontendId: mfId }})`.
 * - NO modes che escludono worker (PRD §34 NON specifica policy worker disabling) —
 *   facade sempre creato; se resolver assente → throw runtime al primo `run()`.
 *
 * ## Lifecycle run (per ogni invocazione `run(workerId, task, payload, options?)`)
 *
 * 1. **Permission check** action='worker', resource=`${workerId}.${task}` — pattern
 *    identico gateway (peer optional tolerant + 3 modes off/warn/enforce).
 * 2. **Topic started** `microfrontend.worker.task.started` con `{microFrontendId, workerId,
 *    task, timestamp}`.
 * 3. **Lazy resolver** `resolvers.worker?.()` → WorkerService.
 * 4. **Invoke + duration tracking** `Date.now()` pre/post per `durationMs`.
 * 5. **On success** → topic `microfrontend.worker.task.completed` con `{..., durationMs}`.
 * 6. **On error** → topic `microfrontend.worker.task.error` con `{..., error}` + re-throw.
 *
 * @example Setup worker facade
 * ```ts
 * const wk = createWorkerFacade(
 *   'mf-1',
 *   resolvedPolicy,
 *   { worker: () => workerService },
 *   broker,
 * )
 * const result = await wk!.run('worker-compute', 'fft', { data: [1, 2, 3] })
 * // workerService.run invocato con metadata.microFrontendId = 'mf-1'
 * // 3 topics emit: started → completed (con durationMs ≥ 0)
 * ```
 *
 * @throws `Error` con `code='PERMISSION_DENIED'` se permission service rileva denied
 *   in mode='enforce'.
 * @throws `Error` se `resolvers.worker?.()` ritorna `undefined` (worker service not
 *   available — emit `microfrontend.worker.task.error` + re-throw).
 *
 * @see prd_2.0.0.md §34 — Worker integration
 * @see D-V2-F13-04-AMENDED — Factory 2-opt resolver pattern
 * @see D-V2-F13-12 — Topic emit observability
 *
 * @param mfId MicroFrontend identifier.
 * @param policy ResolvedIsolationPolicy (reserved per future worker-disable mode).
 * @param resolvers Host-provided lazy resolvers (resolvers.worker?).
 * @param broker Minimal broker shape per topic emit + getService.
 * @returns `WorkerFacade | undefined` — undefined SOLO se future modes esplicitly disable
 *   (per W2-P04: sempre creata se resolver presente).
 */
import type { ResolvedIsolationPolicy } from '../types/policy.js'
import type {
  IsolationResolvers,
  WorkerFacade,
  WorkerRunOptions,
} from '../types/facades.js'

interface Broker {
  publish(topic: string, payload: unknown): void
  getService?<T>(key: symbol | string): T | undefined
}

interface PermissionCheckResult {
  readonly allowed: boolean
  readonly mode: 'off' | 'warn' | 'enforce'
  readonly reason?: string
}

interface PermissionService {
  check(args: {
    readonly mfId: string
    readonly action: string
    readonly resource?: string
  }): PermissionCheckResult
}

interface WorkerServiceShape {
  run(
    workerId: string,
    task: string,
    payload?: unknown,
    options?: unknown,
  ): Promise<unknown>
}

const WARNED_NO_PERMISSIONS_WORKER = new WeakSet<Broker>()

const SERVICE_PERMISSIONS_KEY = 'permissions'

export function createWorkerFacade(
  mfId: string,
  _policy: ResolvedIsolationPolicy,
  resolvers: IsolationResolvers,
  broker: Broker,
): WorkerFacade {
  // PRD §34 NON specifica policy worker disabling — facade sempre creata.
  // Future: aggiungere policy.worker = 'blocked' mode (V2.1 extension).
  void _policy

  return {
    async run(
      workerId: string,
      task: string,
      payload?: unknown,
      options?: WorkerRunOptions,
    ): Promise<unknown> {
      const resource = `${workerId}.${task}`

      // 1. Permission check lazy
      const permService = broker.getService?.<PermissionService>(
        SERVICE_PERMISSIONS_KEY,
      )
      if (permService) {
        const result = permService.check({
          mfId,
          action: 'worker',
          resource,
        })
        if (!result.allowed) {
          if (result.mode === 'enforce') {
            const err = new Error(
              `Permission denied: worker.run('${resource}') for mf='${mfId}'`,
            )
            ;(err as { code?: string }).code = 'PERMISSION_DENIED'
            throw err
          }
          if (result.mode === 'warn') {
            console.warn(
              `[@gluezero/isolation] Permission warn: worker.run('${resource}') for mf='${mfId}'`,
            )
            broker.publish('microfrontend.permission.denied', {
              microFrontendId: mfId,
              action: 'worker',
              resource,
            })
          }
        }
      } else if (!WARNED_NO_PERMISSIONS_WORKER.has(broker)) {
        WARNED_NO_PERMISSIONS_WORKER.add(broker)
        console.warn(
          `[@gluezero/isolation] @gluezero/permissions not installed; worker facade pass-through (mode='off' effective).`,
        )
      }

      // 2. Topic started + duration tracking
      const startedAt = Date.now()
      broker.publish('microfrontend.worker.task.started', {
        microFrontendId: mfId,
        workerId,
        task,
        timestamp: startedAt,
      })

      // 3. Lazy resolver lookup
      const workerService = resolvers.worker?.() as
        | WorkerServiceShape
        | undefined
      if (!workerService) {
        const err = new Error(
          `[@gluezero/isolation] Worker service not available; provide resolvers.worker to isolationModule().`,
        )
        broker.publish('microfrontend.worker.task.error', {
          microFrontendId: mfId,
          workerId,
          task,
          error: err.message,
        })
        throw err
      }

      // 4. Invoke con metadata.microFrontendId attribution forzata
      try {
        const enhancedOptions = {
          ...options,
          metadata: {
            ...options?.metadata,
            microFrontendId: mfId,
          },
        }
        const result = await workerService.run(
          workerId,
          task,
          payload,
          enhancedOptions,
        )
        const durationMs = Date.now() - startedAt
        // 5. Topic completed
        broker.publish('microfrontend.worker.task.completed', {
          microFrontendId: mfId,
          workerId,
          task,
          durationMs,
        })
        return result
      } catch (err) {
        // 6. Topic error
        broker.publish('microfrontend.worker.task.error', {
          microFrontendId: mfId,
          workerId,
          task,
          error: err instanceof Error ? err.message : String(err),
        })
        throw err
      }
    },
  }
}
