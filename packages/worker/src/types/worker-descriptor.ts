// types/worker-descriptor.ts — shape entry per WorkerRegistry (D-123, D-124, D-127,
// D-128, D-131, D-147).
//
// Riferimento decisioni (05-CONTEXT.md):
// - D-123: Factory lazy `() => Worker` invocata al PRIMO dispatch (D-129). Pattern
//   bundler-friendly: `factory: () => new Worker(new URL('./x.worker.ts', import.meta.url),
//   { type: 'module' })`.
// - D-124: `tasks: readonly string[]` dichiarate esplicite per fail-fast
//   `worker.task.unknown` al register.
// - D-127: `mode: 'dedicated' | 'pool'` default `'pool'` con
//   `size = min(navigator.hardwareConcurrency, 4)`.
// - D-128: Cap hard pool size 8 (con `console.warn` dev mode), opt-in
//   `allowUnboundedPool: true` per superare il cap.
// - D-131: Cancellation pool cooperative — `cancelGraceMs` default 2000ms grace
//   timeout prima di terminate fallback. Solo per `mode: 'pool'`; `mode: 'dedicated'`
//   chiama `worker.terminate()` immediato.
// - D-147: `workerType: 'module' | 'classic'` default `'module'`. Classic opt-in
//   per legacy bundler senza module-worker support (extension a PRD §31.3).
//
// Pattern role-match con `packages/gateway/src/sse-ws/types/realtime-channel-def.ts`:
// shape descriptor con `id` chiave registry univoca + factory hook + policy override.

/**
 * Modalità di esecuzione del worker (D-127).
 *
 * - `'dedicated'` — singola istanza Worker condivisa (lifecycle 1:1 al register).
 *   Cancellation hard via `worker.terminate()` (D-131).
 * - `'pool'` — pool di N worker pre-spawnati al primo dispatch (lazy D-129).
 *   Cancellation cooperative via `__cancel__` topic + AbortSignal proxy (D-131,
 *   D-132).
 *
 * Default `'pool'` se omesso.
 */
export type WorkerMode = 'dedicated' | 'pool'

/**
 * Tipo del Worker constructor (D-147).
 *
 * - `'module'` — `new Worker(url, { type: 'module' })`. Default V1 (RECOMMENDED).
 *   Permette `import` ES modules dentro il worker source, bundler-friendly via
 *   `new URL(..., import.meta.url)` pattern (D-148).
 * - `'classic'` — `new Worker(url)` legacy script global, no `import`. Opt-in
 *   per bundler senza module-worker support (extension PRD §31.3).
 */
export type WorkerType = 'module' | 'classic'

/**
 * Descriptor di un worker registrato in `WorkerRegistry` (D-123, D-124, D-127,
 * D-128, D-131, D-147).
 *
 * Indicizzato per `id` univoco. Usato da `RouteWorkerDefinition.worker` per
 * lookup runtime. Auto-registrato al `registerPlugin` se presente in
 * `PluginDescriptor.workers` (D-126 cascade ext F5).
 *
 * @example
 * ```ts
 * const descriptor: WorkerDescriptor = {
 *   id: 'report-worker',
 *   factory: () => new Worker(new URL('./report.worker.ts', import.meta.url), { type: 'module' }),
 *   tasks: ['generateReport', 'parseCsv'] as const,
 *   mode: 'pool',
 *   size: 4,
 *   workerType: 'module',
 *   cancelGraceMs: 2000,
 * }
 * ```
 */
export interface WorkerDescriptor {
  /** Chiave registry univoca (D-123). Usata da `RouteWorkerDefinition.worker`. NON vuota. */
  readonly id: string
  /**
   * Factory lazy (D-123): invocata al PRIMO dispatch (D-129). Pattern
   * bundler-friendly: `() => new Worker(new URL('./x.worker.ts', import.meta.url),
   * { type: 'module' })`.
   *
   * @see D-148 — bundler-friendly URL pattern
   */
  readonly factory: () => Worker
  /**
   * Tasks dichiarate esplicite (D-124) per fail-fast `worker.task.unknown` al
   * `registerWorker` o `registerPlugin`. La `WorkerRegistry` valida che ogni
   * `RouteWorkerDefinition.task` referenzi un task presente in questo array.
   */
  readonly tasks: readonly string[]
  /** Modalità esecuzione (D-127). Default `'pool'`. */
  readonly mode?: WorkerMode
  /**
   * Override pool size (D-127). Default `min(navigator.hardwareConcurrency, 4)`.
   * Cap hard 8 (D-128) salvo `allowUnboundedPool: true`.
   */
  readonly size?: number
  /**
   * Opt-in per pool size > 8 (D-128). Quando `true`, il `WorkerPool` permette
   * `size` arbitrario emettendo solo un `console.warn` in dev mode.
   */
  readonly allowUnboundedPool?: boolean
  /** Tipo Worker constructor (D-147). Default `'module'`. */
  readonly workerType?: WorkerType
  /**
   * Grace timeout cooperative cancellation (D-131). Default 2000ms. Solo per
   * `mode: 'pool'` — il pool emette `__cancel__` + attende `cancelGraceMs` prima
   * di `worker.terminate()` fallback. `mode: 'dedicated'` ignora questo field e
   * chiama terminate immediato.
   */
  readonly cancelGraceMs?: number
}
