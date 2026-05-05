// types/route-worker-definition.ts — discriminator `type: 'worker'` per route worker
// (D-143, D-146, D-141, D-137).
//
// Riferimento decisioni (05-CONTEXT.md):
// - D-143: subset `RoutePolicies` rilevante a F5: `timeout`, `concurrency`,
//   `backpressure`, `dedupe`. NIENTE `retry`/`auth`/`circuitBreaker` (deferred
//   V1.x — semantica server-only).
// - D-146: hybrid auto-derive + override per topic publishing. Default regola
//   suffix `<entity>.<action>.requested` → `<entity>.<action>.completed|.failed|.progress`.
//   `publishes?` permette override completo dei 3 topic.
// - D-141: transferable JSONPath-like array per opt-in zero-copy (Wave 2 plan
//   05-02 implementa `extractTransferables`). Wildcard `[*]` supportato per
//   array of objects.
// - D-137: per-route override del progress throttle (default 100ms da
//   `WorkerConfig.defaultProgressThrottleMs`).
//
// **Limitazione TS R4 (RESEARCH §17):** TypeScript NON supporta declaration
// merging di type alias. `RouteDefinition` di `@gluezero/routing` è una literal
// union (D-60: `local | http | cache | composite`). F5 NON può estendere
// `RouteDefinition` con `type: 'worker'` via decl merging — il consumer dichiara
// localmente il superset:
//
// ```ts
// import type { RouteDefinition } from '@gluezero/routing'
// import type { RouteWorkerDefinition } from '@gluezero/worker'
// type AllRoutes = RouteDefinition | RouteWorkerDefinition
// ```
//
// Soluzione lockata in D-152 + 05-CONTEXT — il `WorkerHandler` (Wave 4 plan
// 05-06) accetta `RouteWorkerDefinition` come input separato, mai come
// discriminant case di `RouteDefinition`.
//
// Pattern role-match con `packages/routing/src/types/route-definition.ts`
// (`RouteHttpDefinition`): id+topic+priority+policies + sub-spec specifico F5.

import type { RoutePolicies } from '@gluezero/routing'

/**
 * Topic publishing override per `RouteWorkerDefinition` (D-146).
 *
 * Default convention auto-derive da `topic` con regola suffix:
 * `<entity>.<action>.requested` → `<entity>.<action>.completed` (success),
 * `<entity>.<action>.failed` (error), `<entity>.<action>.progress` (progress).
 * Quando `publishes` è popolato, il `WorkerHandler` usa i topic forniti
 * preservando l'auto-derive solo per i field assenti.
 *
 * @example
 * ```ts
 * const publishes: RouteWorkerPublishesSpec = {
 *   success: 'report.generated',
 *   error: 'report.error',
 *   progress: 'report.progress',
 * }
 * ```
 */
export interface RouteWorkerPublishesSpec {
  /** Topic publish on success (default `<topic-prefix>.completed` D-146). */
  readonly success?: string
  /** Topic publish on progress callback (default `<topic-prefix>.progress` D-146). */
  readonly progress?: string
  /** Topic publish on error (default `<topic-prefix>.failed` D-146). */
  readonly error?: string
}

/**
 * Route worker (D-143, D-146, D-141, D-137) — discriminator `type: 'worker'`.
 *
 * Dispatch orchestrato dal `WorkerHandler` (Wave 4 plan 05-06):
 * 1. Lookup `descriptor` via `WorkerRegistry.get(worker)` — fail-fast
 *    `worker.unknown` se assente.
 * 2. Valida `task` ∈ `descriptor.tasks` — fail-fast `worker.task.unknown`
 *    (D-124).
 * 3. Acquire bridge via `WorkerPool.acquire` o lazy spawn dedicated (D-127,
 *    D-129).
 * 4. Estrai transferables via `extractTransferables(payload, transferable)`
 *    (D-141 plan 05-02).
 * 5. Comlink `bridge.task(args, signal, onProgress)` (D-125 hybrid expose).
 * 6. State machine atomico per outcome (D-133, plan 05-03).
 * 7. Publish topic via `publishes` resolved (D-146 + auto-derive).
 *
 * @example
 * ```ts
 * const reportRoute: RouteWorkerDefinition = {
 *   id: 'report-worker-route',
 *   type: 'worker',
 *   topic: 'report.generation.requested',
 *   worker: 'report-worker',
 *   task: 'generateReport',
 *   transferable: ['payload.csvBuffer', 'payload.images[*].buffer'],
 *   progressThrottleMs: 200,
 *   policies: { timeout: 60_000, concurrency: 'latest-only' },
 * }
 * // auto-derive: success = 'report.generation.completed',
 * //              error   = 'report.generation.failed',
 * //              progress= 'report.generation.progress'
 * ```
 */
export interface RouteWorkerDefinition {
  /** Discriminator literal `'worker'` (D-152 declaration merging fallback). */
  readonly type: 'worker'
  /** Identificativo univoco della route (validato runtime al register). */
  readonly id: string
  /** Topic intercettato (es. `'report.generation.requested'`). NON vuoto. */
  readonly topic: string
  /**
   * Worker id (chiave `WorkerRegistry`). Deve essere registrato via
   * `registerWorker` o `PluginDescriptor.workers` (D-126) PRIMA del dispatch.
   * Fail-fast `worker.unknown` se assente.
   */
  readonly worker: string
  /**
   * Task name esposto dal worker. DEVE essere in `WorkerDescriptor.tasks`
   * (D-124 fail-fast `worker.task.unknown` al register della route).
   */
  readonly task: string
  /**
   * Override topic publishing (D-146). Default convention auto-derive suffix
   * `.requested` → `.completed|.failed|.progress`.
   */
  readonly publishes?: RouteWorkerPublishesSpec
  /**
   * JSONPath-like array per transferable extraction zero-copy (D-141).
   * Wildcard `[*]` supportato per array of objects. Default: nessun
   * transferable, postMessage uses structured cloning algorithm (D-142).
   *
   * @example `['payload.audioBuffer', 'payload.images[*].buffer']`
   * @see Pitfall 7.E DOC-05 (WK-07 closure)
   */
  readonly transferable?: readonly string[]
  /**
   * Progress throttle window per-route (D-137). Default 100ms (override-abile
   * via `WorkerConfig.defaultProgressThrottleMs`). Latest-only policy: solo
   * l'ultimo `onProgress` nel window viene pubblicato.
   */
  readonly progressThrottleMs?: number
  /** Priority opzionale per `multipleRoutesPolicy: 'priority-ordered'` (D-66 carryover F3). */
  readonly priority?: number
  /**
   * Subset rilevante delle `RoutePolicies` F3 (D-143):
   * - `timeout` — WK-06 obbligatorio, default 30000ms (D-145).
   * - `concurrency` — D-144 default `'latest-only'`.
   * - `backpressure` — D-130 carryover F3 1:1.
   * - `dedupe` — D-143 (riusabile per task storm).
   *
   * **NIENTE** `retry` (semantica idempotency server-only), `auth` (worker
   * locale), `circuitBreaker` (server-only). Deferred V1.x.
   */
  readonly policies?: Pick<RoutePolicies, 'timeout' | 'concurrency' | 'backpressure' | 'dedupe'>
}
