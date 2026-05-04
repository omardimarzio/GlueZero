// mock-event-source.ts — implementazione minimale `EventSource`-compatibile per test
// `vitest` in tier-1 jsdom (PRD §31.3, RESEARCH §9.1).
//
// jsdom (vitest tier-1) NON ha `EventSource` nativo. L'`SseAdapter` accetta
// `EventSourceCtor?` come DI — questa mock viene iniettata in test al posto del nativo
// browser per simulare il lifecycle server-side senza un vero stream HTTP.
//
// **B-NEW-2 fix (iter 2)** — Map test-only `byChannelName` per routing strict per-canale
// dell'harness (plan 04-08). Ogni canale di test che vuole essere indicizzato deve avere
// `?_channel=<name>` nella URL: il constructor parsa il query param e si registra qui.
// Permette `MockEventSource.byChannelName.get(name)` lookup deterministico senza fallback
// "ultimo istanza" (causa di cross-canale pollution pre-fix B-2).
//
// File NON è production code — `vitest.config.ts` (plan 04-01) lo esclude dalla coverage
// via `'src/sse-ws/test-utils/**'`.

/**
 * Implementazione minimale `EventSource`-compatibile per test jsdom.
 *
 * Espone solo i membri richiesti dall'`SseAdapter` (`addEventListener`,
 * `removeEventListener`, `close`, `readyState`, `url`, `withCredentials`,
 * `CONNECTING/OPEN/CLOSED`). Il typing è intenzionalmente loose: il consumer di test
 * casta a `typeof EventSource` quando necessario per soddisfare la firma del DI.
 *
 * **Test helpers** (`__open`, `__message`, `__error`, `__reset`) NON fanno parte della
 * spec EventSource — sono prefissati con `__` per chiarire l'intento di simulazione
 * server-side.
 */
export class MockEventSource {
  static readonly CONNECTING = 0 as const
  static readonly OPEN = 1 as const
  static readonly CLOSED = 2 as const

  /** Per assertion test: ultimo costruttore invocato. */
  static lastInstance: MockEventSource | null = null
  /** Tutte le instanze create dal `__reset()` precedente. */
  static instances: MockEventSource[] = []

  /**
   * **B-NEW-2 fix (iter 2)** — Mapping test-only per routing strict per-canale dell'harness
   * (plan 04-08). Indicizzato dal query param `_channel=<name>`. Il consumer test che
   * vuole indexing deterministico passa l'URL `https://x/sse?_channel=<channelName>`.
   *
   * Permette `MockEventSource.byChannelName.get(channelName)` senza fallback ambiguo a
   * "ultima instanza creata".
   */
  static byChannelName: Map<string, MockEventSource> = new Map()

  readonly url: string
  readonly withCredentials: boolean
  readyState: number = MockEventSource.CONNECTING
  readonly CONNECTING = 0 as const
  readonly OPEN = 1 as const
  readonly CLOSED = 2 as const

  private listeners: Map<string, Set<EventListener>> = new Map()

  constructor(url: string | URL, init?: EventSourceInit) {
    this.url = url.toString()
    this.withCredentials = init?.withCredentials ?? false
    MockEventSource.lastInstance = this
    MockEventSource.instances.push(this)

    // B-NEW-2: parse `?_channel=<name>` per indexing test-only. Se l'URL è relativo
    // o malformato, skip silenziosamente (non indicizzabile).
    try {
      const parsed = new URL(this.url, 'http://localhost')
      const channelName = parsed.searchParams.get('_channel')
      if (channelName) {
        MockEventSource.byChannelName.set(channelName, this)
      }
    } catch {
      // URL non parsabile — no-op (non indicizzabile, ma resta in `instances`).
    }
  }

  addEventListener(type: string, fn: EventListener): void {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    set.add(fn)
  }

  removeEventListener(type: string, fn: EventListener): void {
    this.listeners.get(type)?.delete(fn)
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED
  }

  // ---------------------------------------------------------------------------
  // Test helpers (NOT part of EventSource spec). Prefisso `__` chiarisce intento.
  // ---------------------------------------------------------------------------

  /** Simula `'open'` event server-side (transition CONNECTING → OPEN). */
  __open(): void {
    this.readyState = MockEventSource.OPEN
    this.dispatch('open', new Event('open'))
  }

  /**
   * Simula `'message'` event server-side (o custom event type).
   *
   * @param data - Stringa raw (tipicamente JSON) consegnata via `MessageEvent.data`.
   * @param id - Optional Last-Event-ID propagato via `MessageEvent.lastEventId`.
   * @param eventType - Default `'message'`. Custom event type per `event:` field SSE.
   */
  __message(data: string, id?: string, eventType: string = 'message'): void {
    const ev = new MessageEvent(eventType, { data, lastEventId: id ?? '' })
    this.dispatch(eventType, ev)
  }

  /** Simula `'error'` event server-side (network drop, server reboot, ...). */
  __error(): void {
    this.readyState = MockEventSource.CLOSED
    this.dispatch('error', new Event('error'))
  }

  /** Reset globale (chiamato da `beforeEach`). B-NEW-2 — pulisce anche `byChannelName`. */
  static __reset(): void {
    MockEventSource.lastInstance = null
    MockEventSource.instances = []
    MockEventSource.byChannelName.clear()
  }

  private dispatch(type: string, ev: Event): void {
    const set = this.listeners.get(type)
    if (!set) return
    for (const fn of set) fn(ev)
  }
}
