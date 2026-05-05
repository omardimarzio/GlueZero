// worker-handler.ts — Strategy F3 dispatch logic per F5 Worker Runtime (Wave 4
// plan 05-06 — D-152 step 9 dispatch §28 + D-153 mapping canonical → output +
// D-146 topic auto-derive + D-133 atomic state machine + D-134 correlationId
// end-to-end + D-145 default timeout 30s + D-144 default concurrency
// 'latest-only' + D-138 progress canonical via mapper).
//
// **Opzione B research §7.2 — D-83 strict preservation:**
// Questo handler viene invocato dal `WorkerBroker.publish` intercept PRE-delegate
// a `inner.publish` (RouterBroker F3) — evita modifica `packages/routing/`
// (`route-resolver.ts`/`route-executor.ts`). Pattern Strategy DI analog
// `route-handlers/local-handler.ts` di F3.
//
// Pipeline §28 step 9 dispatch (D-152):
// 1. Validate `WorkerRegistry.get(route.worker)` — fail-fast `worker.unknown`.
// 2. Validate `WorkerRegistry.validateTask(route.worker, route.task)` —
//    fail-fast `worker.task.unknown`.
// 3. Register task in `TaskTracker` (D-134 correlationId end-to-end propagato
//    da `event.correlationId ?? event.id`).
// 4. Combined signal (external + timeout + concurrency abort) — `AbortController`
//    interno con listeners.
// 5. Pool schedule (D-130 BackpressureStrategy F3 con critical bypass) → bridge
//    dispatch (Comlink RPC).
// 6. Atomic state transition via tracker (D-133 Pitfall 2C closure):
//    - `markDone(taskId, result)` ritorna boolean — late responses scartate
//      silenziosamente.
//    - `markTimeout(taskId)` invocato dal timeout handler.
//    - `markCancelled(taskId)` invocato dal external signal abort.
//    - `markError(taskId, code, msg)` invocato dal generic error path.
// 7. Publish outcome via `publishFn` (delegato a `inner.publish` del RouterBroker
//    nel `WorkerBroker`):
//    - success → `<topic>.completed` (D-146 auto-derive) o `route.publishes.success`.
//    - progress → `<topic>.progress` o `route.publishes.progress`.
//    - error → `<topic>.failed` o `route.publishes.error` PIÙ topic ext
//      `worker.error` (ERR-02 ext F5 D-140).
//
// Sanitized error shape (T-03-07-01 carryover F3 OutcomeCollector):
// `{ code, category, message, routeId, topic, eventId, workerId, taskName }` —
// NIENTE `originalError`/`cause`/`stack` per prevenire information disclosure.
//
// Threat coverage:
// - T-05-06-04 (Information Disclosure — payload/stack leak in error): mitigate
//   via `publishFailure` sanitize (no `originalError`/`stack`).
// - T-05-06-06 (Logic flaw — race timeout vs success Pitfall 2C): mitigate via
//   `tracker.markDone/markTimeout` CAS atomico (D-133).
// - T-05-06-08 (Elevation of Privilege — Comlink proxy escape via task.unknown):
//   mitigate via `registry.validateTask` fail-fast (D-124).
// - T-05-06-02 (Spoofing — source 'worker' override): handler imposta
//   `source: { type: 'worker', id: route.worker, name: route.task }` writer-side.

import { type BrokerError, type BrokerEvent, createBrokerError } from '@gluezero/core'
import { nanoid } from 'nanoid'
import type { TaskTracker } from './task-tracker'
import type { ProgressPayload, RouteWorkerDefinition } from './types'
import type { WorkerPool } from './worker-pool'
import type { WorkerRegistry } from './worker-registry'

/**
 * Signature publishFn iniettata dal `WorkerBroker` (Opzione B — bind a
 * `inner.publish` del RouterBroker F3).
 *
 * Accetta `topic`, `payload` e options con `source` + `correlationId`. Il
 * `WorkerBroker` lo binda a `this.inner.publish(topic, payload, options)` —
 * la `inner.publish` di `RouterBroker` (F3) accetta `Parameters<MapperBroker['publish']>[2]`
 * con shape `{ source?, id?, correlationId?, deliveryMode?, priority?, ... }`.
 *
 * Per disaccoppiamento, qui dichiariamo un sub-set strutturale minimale —
 * compatibile con `RouterBroker.publish` per duck typing.
 */
export type WorkerPublishFn = (
  topic: string,
  payload: unknown,
  options?: {
    readonly source?: { readonly type: string; readonly id: string; readonly name?: string }
    readonly correlationId?: string
    readonly priority?: 'low' | 'normal' | 'high' | 'critical'
  },
) => void | Promise<void>

/**
 * Dependency injection per `createWorkerHandler` — registry + pool + tracker +
 * publishFn. Pattern coerente con `OutcomeCollectorDeps` di F3.
 */
export interface WorkerHandlerDeps {
  readonly registry: WorkerRegistry
  readonly pool: WorkerPool
  readonly tracker: TaskTracker
  readonly publishFn: WorkerPublishFn
}

/**
 * Interface pubblica del WorkerHandler — `execute(event, route, signal)`
 * orchestrato dal `WorkerBroker.publish` intercept (Opzione B).
 *
 * Single entry-point: il broker costruisce un `BrokerEvent` canonico dal topic +
 * payload e passa la `RouteWorkerDefinition` matching + un `AbortSignal` external
 * scope (per cancellation cooperative D-131/D-132).
 */
export interface WorkerHandler {
  /**
   * Dispatch del task worker secondo pipeline §28 step 9 (D-152).
   *
   * Tutti i path async terminano con publish di un outcome event (success,
   * progress eventuale, error). Niente throw fuori dal handler — gli errori
   * sono catturati e convertiti in `<topic>.failed` + `worker.error` events.
   *
   * @param event - BrokerEvent canonico (topic, payload, source, id, correlationId).
   * @param route - RouteWorkerDefinition matching del topic.
   * @param externalSignal - Signal del caller per cancellation cooperative.
   */
  execute(
    event: BrokerEvent,
    route: RouteWorkerDefinition,
    externalSignal: AbortSignal,
  ): Promise<void>
}

const DEFAULT_TIMEOUT_MS = 30_000 // D-145
// D-144 default concurrency 'latest-only' è applicato a livello di WorkerBroker
// (cancellation policy 2° publish stesso topic) — non utilizzato direttamente
// nel handler.execute. Documentato qui per discoverability.

/**
 * F5 createWorkerHandler — Strategy che orchestra registry → pool → bridge →
 * tracker → publish outcome (D-152 step 9 dispatch + D-153 mapping canonical →
 * output).
 *
 * **Opzione B research §7.2:** Questo handler viene invocato dal
 * `WorkerBroker.publish` intercept PRE-delegate a `inner.publish` — evita
 * modifica `packages/routing/` (D-83 strict).
 *
 * **Topic naming (D-146):** auto-derive con suffix-replace su `<topic>.requested`:
 * - success → `<entity>.<action>.completed`
 * - progress → `<entity>.<action>.progress`
 * - error → `<entity>.<action>.failed`
 * - override esplicito via `route.publishes.{success|progress|error}`.
 *
 * **State machine atomico (D-133 Pitfall 2C closure):** `tracker.markDone/Timeout/
 * Cancelled/Error` ritornano boolean — late responses post-state-transition sono
 * scartate silenziosamente (verifica deterministica via
 * `__integration__/timeout-strict.test.ts`).
 *
 * **correlationId end-to-end (D-134):** ogni outcome event propaga
 * `event.correlationId ?? event.id` per consumer filter side ('scarto risposte
 * con correlationId che non è il mio ultimo').
 *
 * @param deps - Registry + pool + tracker + publishFn DI.
 * @returns `WorkerHandler` con metodo `execute(event, route, externalSignal)`.
 *
 * @example Strategy dispatch (consumer interno WorkerBroker)
 * ```ts
 * const handler = createWorkerHandler({ registry, pool, tracker, publishFn })
 * await handler.execute(event, route, externalCtrl.signal)
 * // → publish '<topic>.completed' (success) | '<topic>.failed' (timeout/cancel/error)
 * //   + 'worker.error' ext F5 ERR-02 con sanitized payload
 * ```
 *
 * @example Topic auto-derive (D-146)
 * ```ts
 * deriveTopic('weather.requested', 'completed')  // → 'weather.completed'
 * deriveTopic('report.generation.requested', 'progress')  // → 'report.generation.progress'
 * deriveTopic('csv.parse.requested', 'failed')  // → 'csv.parse.failed'
 * // override esplicito via route.publishes.{success|progress|error}
 * ```
 *
 * @throws {BrokerError} `worker.unknown` (category 'config') se il worker non è
 *   registrato nel registry — sanitized error shape (no originalError/stack/cause).
 * @throws {BrokerError} `worker.task.unknown` (category 'config') se il task non
 *   è dichiarato in `WorkerDescriptor.tasks` (D-124 fail-fast runtime).
 * @throws {BrokerError} `worker.timeout` (category 'worker') se il task supera
 *   `route.policies.timeout` (default 30s — D-145).
 * @throws {BrokerError} `worker.cancelled` (category 'worker') se externalSignal
 *   abort propagato (D-131 cooperative).
 *
 * @see ./worker-broker.ts — Opzione B publish intercept consumer
 * @see RESEARCH §7.2 — Opzione B rationale
 * @see D-152 — pipeline §28 step 9 dispatch
 * @see D-153 — mapping canonical → output
 * @see D-146 — topic auto-derive
 * @see D-133 — state machine atomico Pitfall 2C
 */
export function createWorkerHandler(deps: WorkerHandlerDeps): WorkerHandler {
  return {
    async execute(
      event: BrokerEvent,
      route: RouteWorkerDefinition,
      externalSignal: AbortSignal,
    ): Promise<void> {
      const correlationId = event.correlationId ?? event.id
      const taskId = nanoid()

      // Step 1+2: Validate worker + task (D-124 fail-fast — runtime safety
      // oltre register-time)
      const entry = deps.registry.get(route.worker)
      if (entry === undefined) {
        await publishFailure(
          deps.publishFn,
          route,
          event,
          correlationId,
          createBrokerError({
            code: 'worker.unknown',
            message: `Worker '${route.worker}' is not registered`,
            category: 'config',
            details: {
              workerId: route.worker,
              routeId: route.id,
              topic: event.topic,
            },
          }),
        )
        return
      }
      try {
        if (!deps.registry.validateTask(route.worker, route.task)) {
          throw createBrokerError({
            code: 'worker.task.unknown',
            message: `Worker '${route.worker}' does not declare task '${route.task}'`,
            category: 'config',
            details: {
              workerId: route.worker,
              taskName: route.task,
              routeId: route.id,
              topic: event.topic,
            },
          })
        }
      } catch (err) {
        await publishFailure(deps.publishFn, route, event, correlationId, asBrokerError(err))
        return
      }

      // D-145 default timeout + D-144 default concurrency (note: concurrency
      // logic gestita upstream da `latest-only` cancellation in WorkerBroker per
      // V1 — qui solo timeout strict).
      const timeoutMs = resolveTimeoutMs(route.policies?.timeout)

      // Step 3: D-134 register tracker
      deps.tracker.register(taskId, correlationId)

      // Step 4: Combined signal — external + timeout + concurrency abort
      const internalCtrl = new AbortController()
      const onExternalAbort = (): void => internalCtrl.abort('external')
      externalSignal.addEventListener('abort', onExternalAbort, { once: true })
      const timeoutHandle = setTimeout(() => {
        if (deps.tracker.markTimeout(taskId)) {
          internalCtrl.abort('timeout')
        }
      }, timeoutMs)

      const onProgress = (p: ProgressPayload): void => {
        // D-138 progress passa per pipeline canonical → consumer
        const progressTopic = route.publishes?.progress ?? deriveTopic(event.topic, 'progress')
        // Fire-and-forget — niente await sul progress (high-frequency).
        const result = deps.publishFn(progressTopic, p, {
          source: { type: 'worker', id: route.worker, name: route.task },
          correlationId,
        })
        if (result !== undefined && typeof result === 'object' && 'catch' in result) {
          ;(result as Promise<void>).catch(() => {
            /* defensive — Pitfall onProgress flood */
          })
        }
      }

      try {
        // Step 5: D-130 pool.schedule (BackpressureStrategy F3 + critical bypass)
        const priority = event.priority ?? 'normal'
        const result = await deps.pool.schedule(route.id, priority, async () => {
          return await deps.pool.dispatchOnSlot(
            route.worker,
            route.task,
            event.payload,
            internalCtrl.signal,
            onProgress,
            route.transferable,
          )
        })
        // Step 6: D-133 atomic CAS — solo se ancora pending pubblica completed
        if (deps.tracker.markDone(taskId, result)) {
          const successTopic = route.publishes?.success ?? deriveTopic(event.topic, 'completed')
          await deps.publishFn(successTopic, result, {
            source: { type: 'worker', id: route.worker, name: route.task },
            correlationId,
          })
        }
        // else: late response — scartata silenziosamente (Pitfall 2C closure)
      } catch (err) {
        // D-133 atomic CAS — solo se ancora pending pubblica failed.
        // Nota: il timeout path usa il reason 'timeout' di internalCtrl.signal.
        const reason = (internalCtrl.signal as AbortSignal & { reason?: unknown }).reason
        if (reason === 'timeout') {
          // markTimeout già chiamato dal setTimeout — pubblica failed con timeout shape
          await publishFailure(
            deps.publishFn,
            route,
            event,
            correlationId,
            createBrokerError({
              code: 'worker.timeout',
              message: `Worker '${route.worker}' task '${route.task}' exceeded timeout ${timeoutMs}ms`,
              category: 'worker',
              details: {
                workerId: route.worker,
                taskName: route.task,
                routeId: route.id,
                topic: event.topic,
                timeoutMs,
              },
            }),
          )
        } else if (reason === 'external') {
          if (deps.tracker.markCancelled(taskId)) {
            await publishFailure(
              deps.publishFn,
              route,
              event,
              correlationId,
              createBrokerError({
                code: 'worker.cancelled',
                message: `Worker '${route.worker}' task '${route.task}' cancelled by signal`,
                category: 'worker',
                details: {
                  workerId: route.worker,
                  taskName: route.task,
                  routeId: route.id,
                  topic: event.topic,
                },
              }),
            )
          }
        } else {
          // Generic error path
          const brokerErr = asBrokerError(err)
          if (deps.tracker.markError(taskId, brokerErr.code, brokerErr.message)) {
            await publishFailure(deps.publishFn, route, event, correlationId, brokerErr)
          }
        }
      } finally {
        clearTimeout(timeoutHandle)
        externalSignal.removeEventListener('abort', onExternalAbort)
      }
    },
  }
}

/**
 * Coerce errore generic in BrokerError shape strutturata.
 *
 * Se `err` ha già shape `{ code, category, message }` → cast diretto.
 * Altrimenti wrap in `worker.error` `category: 'worker'`.
 *
 * @internal
 */
function asBrokerError(err: unknown): BrokerError {
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'category' in err &&
    'message' in err
  ) {
    return err as BrokerError
  }
  return createBrokerError({
    code: 'worker.error',
    message: err instanceof Error ? err.message : String(err),
    category: 'worker',
  })
}

/**
 * Publish failure outcome via `publishFn` — emette sia `<topic>.failed` (o
 * `route.publishes.error` override) che `worker.error` topic ext (ERR-02 ext F5
 * D-140).
 *
 * **Sanitization (T-03-07-01 carryover F3 OutcomeCollector):** payload include
 * solo `code/category/message/routeId/topic/eventId/workerId/taskName` — NIENTE
 * `originalError`/`cause`/`stack`. Pattern coerente con
 * `routing/outcome-collector.ts` `SanitizedError` shape D-80.
 *
 * @internal
 */
async function publishFailure(
  publishFn: WorkerPublishFn,
  route: RouteWorkerDefinition,
  event: BrokerEvent,
  correlationId: string,
  error: BrokerError,
): Promise<void> {
  const errorTopic = route.publishes?.error ?? deriveTopic(event.topic, 'failed')
  const sanitized = {
    code: error.code,
    category: error.category,
    message: error.message,
    routeId: route.id,
    topic: event.topic,
    eventId: event.id,
    workerId: route.worker,
    taskName: route.task,
  }
  await publishFn(errorTopic, sanitized, {
    source: { type: 'worker', id: route.worker, name: route.task },
    correlationId,
  })
  // ERR-02 ext F5 — emit also `worker.error` topic per consumer sistemici
  // (telemetria, banner, audit) (D-140 + carryover F3 D-81 `network.error`).
  await publishFn('worker.error', sanitized, {
    source: { type: 'worker', id: route.worker, name: route.task },
    correlationId,
  })
}

/**
 * Risolve `RoutePolicies.timeout` in ms. F3 type accetta `number |
 * TimeoutPolicyConfig` (`{ ms: number }`). Default `DEFAULT_TIMEOUT_MS` (30s
 * D-145).
 *
 * @internal
 */
function resolveTimeoutMs(timeout: number | { readonly ms: number } | undefined): number {
  if (timeout === undefined) return DEFAULT_TIMEOUT_MS
  if (typeof timeout === 'number') return timeout
  return timeout.ms
}

/**
 * D-146 topic auto-derive — analog `routing/outcome-collector.ts` deriveLoadedTopic
 * (suffix-replace logic).
 *
 * Convention `<entity>.<action>.requested` → `<entity>.<action>.<suffix>`:
 * - `weather.requested` → `weather.completed` / `.progress` / `.failed`
 * - `report.generation.requested` → `report.generation.completed` etc.
 * - `nonstandard` (no `.requested`) → fallback append `.completed`/`.progress`/`.failed`.
 *
 * @param sourceTopic Topic originale (es. `weather.requested`).
 * @param suffix Outcome suffix (`completed` | `progress` | `failed`).
 * @returns Topic derivato per outcome publish.
 */
export function deriveTopic(
  sourceTopic: string,
  suffix: 'completed' | 'progress' | 'failed',
): string {
  if (sourceTopic.endsWith('.requested')) {
    return `${sourceTopic.slice(0, -'.requested'.length)}.${suffix}`
  }
  return `${sourceTopic}.${suffix}`
}
