// mock-websocket.ts — implementazione minimale `WebSocket`-compatibile per test
// `vitest` in tier-1 jsdom (PRD §31.3, RESEARCH §9.1).
//
// jsdom (vitest tier-1) NON ha `WebSocket` nativo. Il `WebSocketAdapter` (plan
// 04-06) accetta `WebSocketCtor?` come DI — questa mock viene iniettata in test
// al posto del nativo browser per simulare il lifecycle server-side senza un
// vero handshake WebSocket.
//
// **B-NEW-2 fix (iter 2)** — Map test-only `byChannelName` per routing strict
// per-canale dell'harness (plan 04-08). Ogni canale di test che vuole essere
// indicizzato deve avere `?_channel=<name>` nella URL: il constructor parsa il
// query param e si registra qui. Permette `MockWebSocket.byChannelName.get(name)`
// lookup deterministico senza fallback ambiguo a `MockWebSocket.lastInstance`
// (che soffre di cross-canale pollution se il test crea più canali).
//
// File NON è production code — `vitest.config.ts` (plan 04-01) lo esclude dalla
// coverage via `'src/sse-ws/test-utils/**'`.
//
// Pattern parallelo a `mock-event-source.ts` (plan 04-05). Stessa shape API:
// constructor con `_channel` parsing, helper `__open/__message/__error/__close`,
// `__reset()` cleanup globale.

/**
 * Implementazione minimale `WebSocket`-compatibile per test jsdom.
 *
 * Espone solo i membri richiesti dal `WebSocketAdapter` (`addEventListener`,
 * `removeEventListener`, `close`, `send`, `readyState`, `url`, `protocol`,
 * `bufferedAmount`, `CONNECTING/OPEN/CLOSING/CLOSED`). Il typing è
 * intenzionalmente loose: il consumer di test casta a `typeof WebSocket` quando
 * necessario per soddisfare la firma del DI.
 *
 * **Test helpers** (`__open`, `__message`, `__error`, `__close`,
 * `__setBufferedAmount`, `__reset`) NON fanno parte della spec WebSocket — sono
 * prefissati con `__` per chiarire l'intento di simulazione server-side.
 */
export class MockWebSocket {
  static readonly CONNECTING = 0 as const
  static readonly OPEN = 1 as const
  static readonly CLOSING = 2 as const
  static readonly CLOSED = 3 as const

  /** Per assertion test: ultimo costruttore invocato. */
  static lastInstance: MockWebSocket | null = null
  /** Tutte le instanze create dal `__reset()` precedente. */
  static instances: MockWebSocket[] = []

  /**
   * **B-NEW-2 fix (iter 2)** — Mapping test-only per routing strict per-canale
   * dell'harness (plan 04-08). Indicizzato dal query param `_channel=<name>`.
   * Il consumer test che vuole indexing deterministico passa l'URL
   * `wss://x/ws?_channel=<channelName>`.
   *
   * Permette `MockWebSocket.byChannelName.get(channelName)` senza fallback
   * ambiguo a "ultima instanza creata".
   */
  static byChannelName: Map<string, MockWebSocket> = new Map()

  readonly url: string
  readonly protocol: string
  readyState: number = MockWebSocket.CONNECTING
  bufferedAmount = 0
  readonly CONNECTING = 0 as const
  readonly OPEN = 1 as const
  readonly CLOSING = 2 as const
  readonly CLOSED = 3 as const

  /** Frame stringa inviati via `send()` — per assertion test su ping/pong. */
  sentFrames: string[] = []

  private listeners: Map<string, Set<EventListener>> = new Map()

  constructor(url: string | URL, protocols?: string | readonly string[]) {
    this.url = url.toString()
    // WebSocket spec: se viene passato un array, `protocol` finale è quello
    // negoziato dal server. Per semplicità mock, prendiamo il primo elemento
    // (il test che vuole simulare un negotiation diverso può modificare
    // `protocol` direttamente sull'instance).
    if (Array.isArray(protocols)) {
      this.protocol = protocols[0] ?? ''
    } else if (typeof protocols === 'string') {
      this.protocol = protocols
    } else {
      this.protocol = ''
    }
    MockWebSocket.lastInstance = this
    MockWebSocket.instances.push(this)

    // B-NEW-2: parse `?_channel=<name>` per indexing test-only. Se l'URL è
    // relativo o malformato, skip silenziosamente (non indicizzabile).
    try {
      const parsed = new URL(this.url, 'http://localhost')
      const channelName = parsed.searchParams.get('_channel')
      if (channelName) {
        MockWebSocket.byChannelName.set(channelName, this)
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

  /**
   * Simula `WebSocket.send()`. Solo stringhe sono tracciate in `sentFrames`
   * (le binary `ArrayBuffer/Blob` non rilevanti per envelope JSON D-106).
   */
  send(data: string | ArrayBuffer | Blob): void {
    if (typeof data === 'string') {
      this.sentFrames.push(data)
    }
  }

  /**
   * Simula `WebSocket.close()` chiamato dal client. Idempotente (no-op se già
   * `CLOSED`). Triggera `'close'` event con `code` e `reason` forniti.
   */
  close(code: number = 1000, reason: string = ''): void {
    if (this.readyState === MockWebSocket.CLOSED) return
    this.readyState = MockWebSocket.CLOSED
    const ev = new CloseEvent('close', { code, reason, wasClean: code === 1000 })
    this.dispatch('close', ev)
  }

  // ---------------------------------------------------------------------------
  // Test helpers (NOT part of WebSocket spec). Prefisso `__` chiarisce intento.
  // ---------------------------------------------------------------------------

  /** Simula `'open'` event server-side (transition CONNECTING → OPEN). */
  __open(): void {
    this.readyState = MockWebSocket.OPEN
    this.dispatch('open', new Event('open'))
  }

  /**
   * Simula `'message'` event server-side.
   *
   * @param data - Stringa raw consegnata via `MessageEvent.data`. L'envelope
   *   JSON D-106 atteso è `{topic,data,id?}` ma il test può anche inviare
   *   stringhe malformate per verificare il graceful handling.
   */
  __message(data: string): void {
    this.dispatch('message', new MessageEvent('message', { data }))
  }

  /** Simula `'error'` event server-side (network drop, server reboot, ...). */
  __error(): void {
    this.dispatch('error', new Event('error'))
  }

  /**
   * Simula `'close'` event server-side con `code`/`reason`/`wasClean` espliciti.
   * Necessario per testare close codes RFC 6455 §7.4 (1000 normal vs 1006
   * abnormal vs 1011 server error, ecc).
   */
  __close(code: number, reason: string = '', wasClean: boolean = false): void {
    this.readyState = MockWebSocket.CLOSED
    const ev = new CloseEvent('close', { code, reason, wasClean })
    this.dispatch('close', ev)
  }

  /**
   * Imposta `bufferedAmount` per simulare backpressure socket-level (RESEARCH
   * §4.4 — ping skip se buffer > 64KB).
   */
  __setBufferedAmount(bytes: number): void {
    this.bufferedAmount = bytes
  }

  /** Reset globale (chiamato da `beforeEach`). B-NEW-2 — pulisce anche `byChannelName`. */
  static __reset(): void {
    MockWebSocket.lastInstance = null
    MockWebSocket.instances = []
    MockWebSocket.byChannelName.clear()
  }

  private dispatch(type: string, ev: Event): void {
    const set = this.listeners.get(type)
    if (!set) return
    for (const fn of set) fn(ev)
  }
}
