// test-utils/mock-worker.ts — implementazione minimale `Worker`-compatibile per test
// `vitest` Tier-1 jsdom (PRD §31.3, RESEARCH §9.1, D-150).
//
// jsdom NON ha `Worker` nativo. Il `WorkerBridge` (plan 05-04) accetta `WorkerCtor?`
// come DI — questa mock viene iniettata in test al posto del nativo browser per
// simulare il lifecycle Comlink-side senza un vero MessageChannel.
//
// **B-NEW-2 fix carryover (analog F4 MockEventSource/MockWebSocket)** — Map
// test-only `byWorkerId` per routing strict per-worker dell'harness (Wave 4
// plan 05-06). Ogni Worker di test che vuole essere indicizzato deve avere
// `?_worker=<id>` nella URL: il constructor parsa il query param e si registra
// qui. Permette `MockWorker.byWorkerId.get(id)` lookup deterministico senza
// fallback "ultima istanza" (causa di cross-worker pollution pre-fix B-2).
//
// File NON è production code — `vitest.config.ts` (plan 05-01) lo esclude dalla
// coverage via `'src/test-utils/**'`.
//
// Pattern role-match con `packages/gateway/src/sse-ws/test-utils/mock-event-source.ts`
// (D-118 carryover). Helpers `__reply`/`__error`/`__messageError` simulano i 3 event
// che Comlink listener `addEventListener('message'|'error'|'messageerror')`
// consuma per dispatch RPC + error propagation.

/**
 * Singolo `postMessage` registrato dal test (test assertion shape).
 *
 * - `data`: payload arg passato a `postMessage(message, transfer?)`.
 * - `transferList`: array `Transferable[]` (eventualmente vuoto) — verifica D-141.
 * - `timestamp`: `Date.now()` al momento della chiamata.
 */
export interface MockWorkerMessage {
  readonly data: unknown
  readonly transferList: readonly Transferable[]
  readonly timestamp: number
}

/**
 * Implementazione minimale `Worker`-compatibile per test jsdom.
 *
 * Espone i membri richiesti da Comlink (`postMessage`, `addEventListener`,
 * `removeEventListener`, `dispatchEvent`, `terminate`, `onmessage`,
 * `onmessageerror`, `onerror`). Implementa l'interface `Worker` lib DOM/WebWorker
 * tramite signature compatibili.
 *
 * **Test helpers** (`__reply`, `__error`, `__messageError`) NON fanno parte
 * della spec Worker — sono prefissati con `__` per chiarire l'intento di
 * simulazione worker-side (server-of-rpc).
 *
 * @example
 * ```ts
 * import { MockWorker } from '@gluezero/worker/test-utils/mock-worker'
 *
 * beforeEach(() => MockWorker.reset())
 *
 * const desc: WorkerDescriptor = {
 *   id: 'test-worker',
 *   factory: () => new MockWorker('about:blank') as unknown as Worker,
 *   tasks: ['parseCsv'],
 * }
 * const bridge = new WorkerBridge(desc, { WorkerCtor: MockWorker as unknown as typeof Worker })
 * // ... bridge.dispatch('parseCsv', payload, signal)
 * MockWorker.lastInstance?.__reply({ ok: true, result: ... })
 * ```
 */
export class MockWorker implements Worker {
  /** Per assertion test: ultimo costruttore invocato. */
  static lastInstance: MockWorker | null = null
  /** Tutte le instanze create dal `reset()` precedente. */
  static instances: MockWorker[] = []

  /**
   * Mapping test-only per routing strict per-worker dell'harness.
   *
   * Indicizzato dal query param `_worker=<id>`. Il consumer test che vuole
   * indexing deterministico passa l'URL `https://x/?_worker=<workerId>`.
   *
   * Permette `MockWorker.byWorkerId.get(id)` senza fallback ambiguo a
   * "ultima istanza creata".
   */
  static byWorkerId: Map<string, MockWorker> = new Map()

  /** Reset globale (chiamato da `beforeEach`). Pulisce `byWorkerId` + `instances`. */
  static reset(): void {
    MockWorker.lastInstance = null
    MockWorker.instances = []
    MockWorker.byWorkerId.clear()
  }

  readonly url: string
  readonly options: WorkerOptions | undefined
  /** Ogni `postMessage` registrato — verifica D-141 transferable + Test 6. */
  readonly messages: MockWorkerMessage[] = []
  terminated = false

  // Worker interface required props (Worker lib DOM)
  onmessage: ((this: Worker, ev: MessageEvent) => unknown) | null = null
  onmessageerror: ((this: Worker, ev: MessageEvent) => unknown) | null = null
  onerror: ((this: AbstractWorker, ev: ErrorEvent) => unknown) | null = null

  private listeners: Map<string, Set<EventListenerOrEventListenerObject>> = new Map()

  constructor(url: string | URL, options?: WorkerOptions) {
    this.url = url.toString()
    this.options = options
    MockWorker.lastInstance = this
    MockWorker.instances.push(this)
    // Parse `?_worker=<id>` per indexing test-only. Se l'URL è relativo o
    // malformato (es. `'about:blank'`), skip silenziosamente (non indicizzabile).
    try {
      const parsed = new URL(this.url, 'http://localhost')
      const wid = parsed.searchParams.get('_worker')
      if (wid !== null) MockWorker.byWorkerId.set(wid, this)
    } catch {
      // URL non parsabile — no-op (non indicizzabile, ma resta in `instances`).
    }
  }

  postMessage(message: unknown, transfer?: Transferable[] | StructuredSerializeOptions): void {
    const transferList: readonly Transferable[] = Array.isArray(transfer) ? transfer : []
    this.messages.push({ data: message, transferList, timestamp: Date.now() })
  }

  terminate(): void {
    this.terminated = true
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    _options?: boolean | AddEventListenerOptions,
  ): void {
    if (listener === null) return
    let set = this.listeners.get(type)
    if (set === undefined) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(listener)
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    _options?: boolean | EventListenerOptions,
  ): void {
    if (listener === null) return
    this.listeners.get(type)?.delete(listener)
  }

  dispatchEvent(event: Event): boolean {
    const set = this.listeners.get(event.type)
    if (set !== undefined) {
      for (const l of set) {
        if (typeof l === 'function') {
          l.call(this, event)
        } else {
          l.handleEvent(event)
        }
      }
    }
    // Legacy on* handlers — dispatch SOLO se non già consumati via listeners
    // (alcuni adapter usano on*, altri addEventListener; emulando la spec, on*
    // viene chiamato AGGIUNTIVAMENTE — il consumer del bridge usa addEventListener).
    if (event.type === 'message' && this.onmessage !== null) {
      this.onmessage.call(this as unknown as Worker, event as MessageEvent)
    } else if (event.type === 'messageerror' && this.onmessageerror !== null) {
      this.onmessageerror.call(this as unknown as Worker, event as MessageEvent)
    } else if (event.type === 'error' && this.onerror !== null) {
      this.onerror.call(this as unknown as AbstractWorker, event as ErrorEvent)
    }
    return true
  }

  // ---------------------------------------------------------------------------
  // Test helpers (NOT part of Worker spec). Prefisso `__` chiarisce intento.
  // ---------------------------------------------------------------------------

  /**
   * Simula un `'message'` event worker-side (response di Comlink RPC).
   *
   * @param data - Payload raw consegnato via `MessageEvent.data`.
   */
  __reply(data: unknown): void {
    const ev = new MessageEvent('message', { data })
    this.dispatchEvent(ev)
  }

  /**
   * Simula un `'error'` event worker-side (uncaught error nel worker source).
   *
   * @param message - Error message.
   * @param filename - Optional source filename.
   * @param lineno - Optional source line number.
   */
  __error(message: string, filename = '', lineno = 0): void {
    const ev = new ErrorEvent('error', { message, filename, lineno })
    this.dispatchEvent(ev)
  }

  /**
   * Simula un `'messageerror'` event worker-side (deserialization fail).
   *
   * @param data - Payload raw del message event errato.
   */
  __messageError(data: unknown): void {
    const ev = new MessageEvent('messageerror', { data })
    this.dispatchEvent(ev)
  }
}
