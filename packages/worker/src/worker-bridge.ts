// worker-bridge.ts — `WorkerBridge` class — Comlink 4.4.x wrapper produzione-ready
// Wave 3-A plan 05-04 (D-123, D-124, D-125, D-129, D-131, D-132, D-135, D-137,
// D-139, D-140, D-141).
//
// Wrapper di un singolo Worker (mode='dedicated' o slot di un pool) con:
// - **Lazy first-dispatch (D-129)** — il `factory: () => Worker` del descriptor
//   viene invocato SOLO al primo `dispatch()`. Footprint zero se il bridge non
//   viene mai usato (test 1).
// - **Comlink.wrap (D-125)** — al primo dispatch wrappa il worker per ottenere
//   il proxy RPC. Subsequent dispatch riusano il proxy (Test 2).
// - **Fail-fast unknown task (D-124)** — `desc.tasks.includes(taskName) === false`
//   → throw `BrokerError code='worker.task.unknown' category='config'` PRIMA
//   di spawn (Test 3). Niente spawn wasted, niente proxy access leak.
// - **assertSerializable PRE-postMessage (D-139, D-140)** — modes 'always',
//   'dev' (default), 'off'. `'dev'` rileva `process.env.NODE_ENV !== 'production'`.
//   Throw `BrokerError code='worker.serialization.failed.<sub>'` strutturato con
//   `fieldPath`. Test 4 verifica throw + NO spawn (validation è step 1 dopo
//   tasks.includes check).
// - **extractTransferables + Comlink.transfer (D-141)** — se `options.transferable`
//   non vuoto, estrae Transferable dal payload via JSONPath e wrappa con
//   `Comlink.transfer`. Test 6.
// - **AbortSignal via Comlink.proxy (D-132)** — il signal main-thread viene
//   proxied al worker. Il worker richiama `signal.throwIfAborted()` cooperativo.
//   Test 7.
// - **onProgress via Comlink.proxy (D-135)** — callback main-thread proxied al
//   worker. Test 8.
// - **Progress throttling latest-only window (D-137)** — `progressThrottleMs`
//   default 100ms. La prima chiamata in window-aperta passa immediatamente
//   (leading); le successive nella finestra collassano e schedulano un trailing
//   flush con il valore più recente (latest-only). Test 9.
// - **Terminate explicit (D-131 dedicated path)** — `Comlink.releaseProxy` +
//   `worker.terminate()`. Idempotente (Test 11). Re-spawn lazy al next
//   dispatch dopo terminate (Test 10).
// - **Worker error/messageerror events** — listener su `'error'` e
//   `'messageerror'` memorizzano il `BrokerError` corrispondente come last
//   error (consultabile da `getLastErrorForTesting()` in test e dal handler
//   05-06 in produzione). Test 13/14.
//
// **Pattern role-match:** `packages/gateway/src/sse-ws/sse-adapter.ts` (DI
// external constructor + lazy lifecycle + cleanup tracking).
//
// **Threat coverage:**
// - T-05-04-01 (Tampering payload mutato post-validation pre-postMessage):
//   assertSerializable + Comlink.transfer atomic in singolo dispatch (event loop
//   single-thread). Test 4.
// - T-05-04-05 (Logic flaw bypass via JSON serialize): `WorkerBridge` NON
//   esegue chiamate a `JSON serialize` runtime — postMessage usa SCA direttamente
//   con payload validato da assertSerializable. Audit invocation count zero.
// - T-05-04-06 (Spoofing Comlink proxy escape elevation): `desc.tasks.includes`
//   valida fail-fast (D-124) prima di chiamare `proxy[taskName]`. Test 3.
// - T-05-04-08 (DoS onProgress flood broker): `makeThrottledOnProgress`
//   latest-only window (D-137 default 100ms). Test 9.
// - T-05-04-09 (Information Disclosure BrokerError.details include payload):
//   details solo metadata (`workerId`, `taskName`, `declaredTasks`, `fieldPath`,
//   `fieldType`, `filename`, `lineno`) — NIENTE payload value.
// - T-05-04-10 (Tampering Comlink.releaseProxy mancato → memory leak):
//   `terminate()` chiama `proxy[Comlink.releaseProxy]?.()` + `worker.terminate()`.
//   Idempotente (Test 11).

import { type BrokerError, createBrokerError } from '@sembridge/core'
import * as Comlink from 'comlink'

import { assertSerializable } from './assert-serializable'
import { extractTransferables } from './transferable-extractor'
import type { ProgressPayload } from './types/progress-payload'
import type { WorkerDescriptor } from './types/worker-descriptor'

/**
 * Adapter layer Comlink per DI test (D-150 Tier-1 jsdom).
 *
 * In production il `WorkerBridge` usa `Comlink.wrap`, `Comlink.proxy`,
 * `Comlink.transfer` direttamente. Test inietta un `comlinkAdapter` con stub
 * `wrap` (no MessageChannel necessario — ritorna un Proxy che intercetta
 * property access come task function).
 *
 * Pattern analog F4 `EventSourceCtor` DI per mock-event-source — qui il sub-set
 * dell'API Comlink è il punto di iniezione.
 *
 * @internal — non parte di API pubblica consumer.
 */
export interface ComlinkAdapter {
  /** `Comlink.wrap` — wrappa endpoint in Remote proxy. */
  readonly wrap: <T>(ep: object) => Comlink.Remote<T>
  /** `Comlink.proxy` — marca value per proxying via Comlink. */
  readonly proxy: <T extends object>(value: T) => T
  /** `Comlink.transfer` — marca value per transfer via postMessage transferList. */
  readonly transfer: <T>(value: T, transfers: readonly Transferable[]) => T
  /** Symbol per `Comlink.releaseProxy` — usato come `proxy[releaseProxy]()`. */
  readonly releaseProxy: typeof Comlink.releaseProxy
}

/**
 * Default adapter — produce binding diretto su `Comlink.*` API.
 *
 * @internal
 */
const DEFAULT_COMLINK_ADAPTER: ComlinkAdapter = {
  // biome-ignore lint/suspicious/noExplicitAny: Comlink.wrap signature accetta Endpoint cast lib-specific
  wrap: ((ep: object) => Comlink.wrap(ep as Comlink.Endpoint)) as ComlinkAdapter['wrap'],
  proxy: ((value: object) => Comlink.proxy(value)) as ComlinkAdapter['proxy'],
  transfer: ((value: unknown, transfers: readonly Transferable[]) =>
    Comlink.transfer(value, [...transfers])) as ComlinkAdapter['transfer'],
  releaseProxy: Comlink.releaseProxy,
}

/**
 * Mode di attivazione `assertSerializable` (D-139).
 *
 * - `'always'` — sempre attivo (test/dev/prod). Override esplicito quando il
 *   consumer vuole zero rischio runtime di postMessage failure invisibili.
 * - `'dev'` (default) — attivo se `process.env.NODE_ENV !== 'production'`.
 *   Build production = zero overhead.
 * - `'off'` — sempre disattivo. Override esplicito per scenari critical-path
 *   con payload pre-validated (es. WorkerHandler 05-06 dopo Valibot canonical).
 */
export type AssertSerializableMode = 'always' | 'dev' | 'off'

/**
 * Dipendenze `WorkerBridge` — injection point per `WorkerCtor` DI test (jsdom)
 * e config override.
 */
export interface WorkerBridgeDeps {
  /**
   * DI Worker constructor per Tier-1 jsdom (RESEARCH §9.1, D-150). jsdom non
   * implementa `Worker` nativo; consumer test inietta `MockWorker`.
   *
   * Default: undefined — il bridge usa `desc.factory()` che a sua volta usa
   * `globalThis.Worker` (browser nativo Tier-3 Playwright o produzione).
   *
   * Quando definito, il bridge ASSUME che `desc.factory()` ritorni un'istanza
   * compatibile con `WorkerCtor` (test setup è responsabile di fornire una
   * factory che istanzia il Mock).
   */
  readonly WorkerCtor?: typeof Worker
  /**
   * Mode override `assertSerializable` (D-139). Default: `'dev'` con detection
   * runtime di `process.env.NODE_ENV`.
   */
  readonly assertSerializableMode?: AssertSerializableMode
  /**
   * Default progress throttle window (ms) override (D-137). Default: 100ms.
   * Override per-dispatch tramite `WorkerBridgeDispatchOptions.progressThrottleMs`.
   */
  readonly defaultProgressThrottleMs?: number
  /**
   * DI Comlink adapter per Tier-1 jsdom (D-150). Default: binding diretto a
   * `Comlink.wrap/proxy/transfer/releaseProxy`. Test inietta stub che
   * intercetta property access come task function (no MessageChannel).
   *
   * @internal — non parte di API pubblica consumer.
   */
  readonly comlinkAdapter?: ComlinkAdapter
}

/**
 * Opzioni per-dispatch (D-141 transferable + D-137 throttle override).
 */
export interface WorkerBridgeDispatchOptions {
  /**
   * D-141 — JSONPath array per transferable extraction. Default: `[]`.
   *
   * @example `['payload.audioBuffer']` — single ArrayBuffer transferito.
   * @example `['images[*].buffer']` — wildcard array (multipli ArrayBuffer).
   */
  readonly transferable?: readonly string[]
  /**
   * D-137 — override progressThrottleMs per questo dispatch. Default:
   * `WorkerBridgeDeps.defaultProgressThrottleMs ?? 100`.
   */
  readonly progressThrottleMs?: number
}

/**
 * Snapshot debug del bridge (Inspector pre-instrumentation D-150 + audit T-05-04-07).
 */
export interface WorkerBridgeSnapshot {
  /** Descriptor `id` chiave registry. */
  readonly workerId: string
  /** True se `factory()` è stato invocato (lazy spawn D-129). */
  readonly spawned: boolean
  /** Conteggio dispatch eseguiti dal lifecycle corrente (reset al terminate). */
  readonly messagesCount: number
  /** True dopo `terminate()` finché next dispatch non re-spawna. */
  readonly terminated: boolean
}

/**
 * Type util per accesso dinamico a task del proxy Comlink. Le task signature
 * sono `(payload, signalProxy, onProgressProxy?) => Promise<unknown>` ma
 * `Comlink.Remote` aggiunge `Promisify<>` etc. — usiamo un cast loose qui per
 * il dispatch generico.
 */
type ComlinkTaskFn = (...args: unknown[]) => Promise<unknown>

/**
 * `WorkerBridge` — wrapper Comlink 4.4.x per un singolo Worker.
 *
 * Lifecycle:
 * 1. `new WorkerBridge(desc, deps)` — NO spawn (D-129 lazy).
 * 2. `await bridge.dispatch(taskName, payload, signal, onProgress?, options?)`
 *    prima chiamata: validate task → assert serialization → spawn worker via
 *    `desc.factory()` → `Comlink.wrap` → invoca `proxy[taskName](payload,
 *    signalProxy, onProgressProxy)`. Subsequent: skip spawn (riuso).
 * 3. `bridge.terminate()` → `Comlink.releaseProxy` + `worker.terminate()` +
 *    reset state. Idempotente.
 * 4. Subsequent dispatch post-terminate → re-spawn lazy.
 *
 * Throw cases:
 * - `desc.tasks.includes(taskName) === false` → throw `BrokerError
 *   code='worker.task.unknown' category='config'` PRIMA di spawn (D-124).
 * - `assertSerializable` failure → throw `BrokerError
 *   code='worker.serialization.failed.<sub>' category='worker'` PRIMA di spawn
 *   (D-140).
 * - Comlink RPC reject (worker error/timeout) → propagato come Promise reject.
 *
 * @example
 * ```ts
 * const bridge = new WorkerBridge({
 *   id: 'csv-parser',
 *   factory: () => new Worker(new URL('./csv.worker.ts', import.meta.url), { type: 'module' }),
 *   tasks: ['parseCsv'],
 *   mode: 'dedicated',
 * })
 * const ctrl = new AbortController()
 * const result = await bridge.dispatch(
 *   'parseCsv',
 *   { rows: csvText },
 *   ctrl.signal,
 *   (p) => console.log('progress', p.value),
 * )
 * bridge.terminate()
 * ```
 *
 * @see {@link assertSerializable} — pre-validation D-139/D-140
 * @see {@link extractTransferables} — JSONPath transferable D-141
 * @see {@link WorkerDescriptor} — config shape D-123/D-124
 */
export class WorkerBridge {
  private worker: Worker | null = null
  private proxy: Comlink.Remote<Record<string, unknown>> | null = null
  /** Conteggio dispatch eseguiti dal current lifecycle (reset al terminate). */
  private dispatchCount = 0
  private terminatedFlag = false
  /** Last error catturato da `'error'` o `'messageerror'` listener (T-05-04-07). */
  private lastError: BrokerError | null = null
  /** Listener tracking per cleanup puntuale al terminate. */
  private listeners: Array<{ type: string; fn: EventListener }> = []
  /** Adapter Comlink (default oppure DI test). */
  private readonly comlink: ComlinkAdapter

  constructor(
    private readonly desc: WorkerDescriptor,
    private readonly deps: WorkerBridgeDeps = {},
  ) {
    this.comlink = deps.comlinkAdapter ?? DEFAULT_COMLINK_ADAPTER
  }

  /**
   * Dispatch RPC verso il worker.
   *
   * Steps (deterministic order):
   * 1. **D-124 fail-fast** — `desc.tasks.includes(taskName) === false` → throw
   *    `BrokerError code='worker.task.unknown'` PRIMA di spawn.
   * 2. **D-139/D-140 assertSerializable** PRE-postMessage (if mode active) —
   *    throw `BrokerError code='worker.serialization.failed.<sub>'` PRIMA di spawn.
   * 3. **D-129 ensureSpawned** — `factory()` se `worker === null`, `Comlink.wrap`.
   * 4. **D-141 extractTransferables** — JSONPath extract dei Transferable.
   * 5. **D-132 Comlink.proxy(signal)** — AbortSignal proxied al worker.
   * 6. **D-135 + D-137 onProgress** — proxied via Comlink.proxy con throttle
   *    latest-only window.
   * 7. **D-141 Comlink.transfer(payload, transferList)** — wrap se transferList
   *    non vuoto.
   * 8. **Invoke** `proxy[taskName](wrappedPayload, signalProxy, onProgressProxy)`.
   *
   * @param taskName - Nome del task (deve essere in `desc.tasks`).
   * @param payload - Payload da inviare al worker (SCA-cloneable).
   * @param signal - AbortSignal del caller (proxied al worker via Comlink).
   * @param onProgress - Callback opzionale per progress events del worker
   *   (proxied via Comlink + throttled latest-only).
   * @param options - Opzioni per-dispatch (transferable paths, throttle override).
   * @returns Promise risolto con il result del task worker.
   *
   * @throws {BrokerError} `code='worker.task.unknown' category='config'` se
   *   `taskName` non è in `desc.tasks` (D-124).
   * @throws {BrokerError} `code='worker.serialization.failed.<sub>'
   *   category='worker'` se `assertSerializable` fallisce (D-140).
   * @throws Errori propagati dal worker via Comlink RPC.
   */
  async dispatch(
    taskName: string,
    payload: unknown,
    signal: AbortSignal,
    onProgress?: (p: ProgressPayload) => void,
    options: WorkerBridgeDispatchOptions = {},
  ): Promise<unknown> {
    // Step 1: D-124 fail-fast unknown task — PRIMA di spawn (T-05-04-06)
    if (!this.desc.tasks.includes(taskName)) {
      throw createBrokerError({
        code: 'worker.task.unknown',
        category: 'config',
        message: `Worker '${this.desc.id}' does not declare task '${taskName}'. Declared: [${this.desc.tasks.join(', ')}]`,
        details: {
          workerId: this.desc.id,
          taskName,
          declaredTasks: [...this.desc.tasks],
        },
      })
    }

    // Step 2: D-139/D-140 assertSerializable PRE-postMessage — PRIMA di spawn (T-05-04-01)
    // Throw fa skip dello spawn (Test 4 verifica MockWorker.instances.length === 0)
    if (this.shouldAssertSerializable()) {
      assertSerializable(payload)
    }

    // Step 3: D-129 ensureSpawned (lazy first-dispatch)
    this.ensureSpawned()

    // Step 4: D-141 extractTransferables JSONPath (Wave 2 building block)
    const transferable = options.transferable ?? []
    const transferList = transferable.length > 0 ? extractTransferables(payload, transferable) : []

    // Step 5: D-132 AbortSignal proxied via Comlink (RESEARCH §4.2 — gotcha
    // `await signal.aborted` async getter sul worker side gestito dal worker).
    // `Comlink.proxy<T extends {}>(value: T)` accetta object — AbortSignal
    // estende EventTarget (object) ✓.
    const signalProxy = this.comlink.proxy(signal as unknown as object)

    // Step 6: D-135 onProgress proxied + D-137 throttle latest-only window.
    // Quando `onProgress === undefined` passiamo `undefined` esplicito al task
    // (Test 8 verifica args[2] === undefined).
    let onProgressProxy: unknown
    if (onProgress !== undefined) {
      const throttleMs = options.progressThrottleMs ?? this.deps.defaultProgressThrottleMs ?? 100
      const throttled = makeThrottledOnProgress(onProgress, throttleMs)
      onProgressProxy = this.comlink.proxy(throttled as unknown as object)
    }

    // Step 7: D-141 Comlink.transfer wrap se transferList non vuoto. La transfer
    // marca il payload con metadata che Comlink consuma per allegare la
    // transferList al postMessage interno.
    const wrappedPayload =
      transferList.length > 0 ? this.comlink.transfer(payload, transferList) : payload

    // Step 8: invoke proxy[taskName] dinamicamente.
    if (this.proxy === null) {
      // Defensive: ensureSpawned ha settato proxy. Questo branch non dovrebbe
      // mai essere preso a runtime — se preso, il worker source ha throwato in
      // wrap (es. endpoint invalido).
      throw createBrokerError({
        code: 'worker.bridge.invalid-state',
        category: 'worker',
        message: `WorkerBridge '${this.desc.id}' proxy is null after ensureSpawned (unexpected)`,
        details: { workerId: this.desc.id },
      })
    }
    // biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature TS strict — proxy è Record<string, unknown>
    const taskFn = (this.proxy as Record<string, unknown>)[taskName] as ComlinkTaskFn | undefined
    if (taskFn === undefined) {
      throw createBrokerError({
        code: 'worker.task.unknown',
        category: 'worker',
        message: `Worker '${this.desc.id}' did not expose task '${taskName}' via Comlink.expose`,
        details: { workerId: this.desc.id, taskName },
      })
    }

    this.dispatchCount++
    return await taskFn(wrappedPayload, signalProxy, onProgressProxy)
  }

  /**
   * Terminate il worker corrente (D-131 dedicated mode hard cancel).
   *
   * Steps:
   * 1. Idempotency guard — se già terminated, no-op (Test 11).
   * 2. Comlink.releaseProxy via `proxy[Comlink.releaseProxy]?.()` — rilascia
   *    la MessageChannel interna (T-05-04-10 anti memory leak).
   * 3. `worker.terminate()` — hard kill del thread.
   * 4. Reset internal state — `worker = null`, `proxy = null`,
   *    `terminatedFlag = true`. Listener tracking pulito.
   *
   * Subsequent dispatch dopo terminate re-spawna lazy un nuovo worker (Test 10).
   */
  terminate(): void {
    if (this.terminatedFlag && this.worker === null) {
      // Già terminato — Test 11 idempotency.
      return
    }
    this.terminatedFlag = true

    // Step 2: Comlink.releaseProxy
    if (this.proxy !== null) {
      try {
        const releaseFn = (this.proxy as unknown as Record<symbol, unknown>)[
          this.comlink.releaseProxy
        ]
        if (typeof releaseFn === 'function') {
          ;(releaseFn as () => void)()
        }
      } catch {
        // Idempotent — alcuni proxy stub potrebbero non implementare releaseProxy.
      }
    }

    // Step 3: worker.terminate
    if (this.worker !== null) {
      // Cleanup listeners PRIMA di terminate (best-effort — alcuni Worker
      // implementations rimuovono auto al terminate).
      for (const { type, fn } of this.listeners) {
        try {
          this.worker.removeEventListener(type, fn)
        } catch {
          /* noop */
        }
      }
      try {
        this.worker.terminate()
      } catch {
        /* noop — idempotent */
      }
    }

    // Step 4: reset state
    this.worker = null
    this.proxy = null
    this.listeners = []
    this.dispatchCount = 0
  }

  /**
   * Snapshot debug per Inspector + audit (T-05-04-07).
   *
   * @returns `{ workerId, spawned, messagesCount, terminated }` — niente
   *   payload value (T-05-04-09 information disclosure mitigation).
   */
  getDebugSnapshot(): WorkerBridgeSnapshot {
    return {
      workerId: this.desc.id,
      spawned: this.worker !== null,
      messagesCount: this.dispatchCount,
      terminated: this.terminatedFlag && this.worker === null,
    }
  }

  /**
   * Last error catturato da listener `'error'`/`'messageerror'` del worker.
   * Espone l'ultimo `BrokerError` strutturato per consumer test (Test 13/14)
   * e per il `WorkerHandler` (plan 05-06) che combina con TaskTracker per
   * outcome publishing.
   *
   * @returns `BrokerError` o `null` se nessun error event.
   *
   * @internal — solo per test e WorkerHandler. NON parte di API pubblica.
   */
  getLastErrorForTesting(): BrokerError | null {
    return this.lastError
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Determina se `assertSerializable` deve essere invocato (D-139).
   *
   * - `'always'` → true sempre.
   * - `'off'` → false sempre.
   * - `'dev'` (default) → `detectDevMode()` (NODE_ENV !== 'production').
   *
   * @internal
   */
  private shouldAssertSerializable(): boolean {
    const mode = this.deps.assertSerializableMode ?? 'dev'
    if (mode === 'always') return true
    if (mode === 'off') return false
    return detectDevMode()
  }

  /**
   * Lazy spawn al primo dispatch (D-129) o post-terminate (Test 10).
   *
   * Se `worker !== null && proxy !== null` → no-op (riuso).
   * Altrimenti: invoca `desc.factory()`, attacca error listeners, esegue
   * `Comlink.wrap`, reset `terminatedFlag`.
   *
   * @internal
   */
  private ensureSpawned(): void {
    if (this.worker !== null && this.proxy !== null) return

    const w = this.desc.factory()
    this.attachErrorListeners(w)
    this.worker = w
    this.proxy = this.comlink.wrap<Record<string, unknown>>(w as unknown as object)
    this.terminatedFlag = false
  }

  /**
   * Attacca listener `'error'` e `'messageerror'` al worker per memorizzare
   * `lastError` (T-05-04-07 audit + Test 13/14).
   *
   * Listener tracking via `this.listeners` per cleanup al terminate.
   *
   * @internal
   */
  private attachErrorListeners(w: Worker): void {
    const onError = (ev: Event): void => {
      const errEv = ev as ErrorEvent
      this.lastError = createBrokerError({
        code: 'worker.error',
        category: 'worker',
        message: `Worker '${this.desc.id}' error: ${errEv.message ?? '(unknown)'}`,
        details: {
          workerId: this.desc.id,
          filename: errEv.filename ?? '',
          lineno: errEv.lineno ?? 0,
        },
      })
    }
    const onMessageError = (_ev: Event): void => {
      this.lastError = createBrokerError({
        code: 'worker.messageerror',
        category: 'worker',
        message: `Worker '${this.desc.id}' messageerror — payload deserialization failed`,
        details: { workerId: this.desc.id },
      })
    }
    w.addEventListener('error', onError)
    w.addEventListener('messageerror', onMessageError)
    this.listeners.push({ type: 'error', fn: onError })
    this.listeners.push({ type: 'messageerror', fn: onMessageError })
  }
}

// ============================================================================
// Module-level helpers (testable in isolation)
// ============================================================================

/**
 * Detecta dev mode tramite `process.env.NODE_ENV` (D-139).
 *
 * - `process.env.NODE_ENV === 'production'` → false (zero overhead prod).
 * - Tutti gli altri valori (incluso undefined, 'development', 'test') → true.
 *
 * Lookup tramite `globalThis` cast (no `@types/node` dependency) per environments
 * Web Worker globalScope senza polyfill — default permissive (true) per
 * assicurare validation in dev. Il bundler (tsup/esbuild) replace
 * `process.env.NODE_ENV` con literal in production build → tree-shake elimina
 * il branch.
 *
 * @internal
 */
function detectDevMode(): boolean {
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    if (proc === undefined) return true
    const env = proc.env
    if (env === undefined) return true
    return env['NODE_ENV'] !== 'production'
  } catch {
    return true
  }
}

/**
 * Throttle latest-only window (D-137) — leading + trailing.
 *
 * Comportamento:
 * - **Leading**: la prima chiamata (window aperta, `now - lastFlushAt >=
 *   windowMs`) passa subito a `cb`. `lastFlushAt = now`.
 * - **In-window**: chiamate successive nella stessa finestra accumulano solo
 *   l'ultimo valore in `pending`. Se non c'è già un `setTimeout` schedulato,
 *   ne schedula uno per il trailing flush.
 * - **Trailing flush**: al timer expiration, invoca `cb(pending)` se non null,
 *   reset `pending = null`, `lastFlushAt = now`.
 *
 * Result: con 100 chiamate sincrone in <window → 1 leading immediato + 1
 * trailing schedulato = max 2 emit (Test 9). L'ultimo valore (latest-only) è
 * preservato dal trailing.
 *
 * @param cb - Callback originale.
 * @param windowMs - Finestra throttle in ms.
 * @returns Funzione throttled con stessa signature.
 *
 * @internal Esposto come module-private per testabilità isolata.
 */
function makeThrottledOnProgress(
  cb: (p: ProgressPayload) => void,
  windowMs: number,
): (p: ProgressPayload) => void {
  let lastFlushAt = 0
  let pending: ProgressPayload | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = (): void => {
    timer = null
    if (pending !== null) {
      const toEmit = pending
      pending = null
      lastFlushAt = Date.now()
      cb(toEmit)
    }
  }

  return (p: ProgressPayload): void => {
    const now = Date.now()
    const elapsed = now - lastFlushAt
    if (elapsed >= windowMs) {
      // Window aperta — leading flush immediato
      lastFlushAt = now
      pending = null
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
      cb(p)
    } else {
      // In-window — store latest, schedule trailing flush
      pending = p
      if (timer === null) {
        timer = setTimeout(flush, windowMs - elapsed)
      }
    }
  }
}
