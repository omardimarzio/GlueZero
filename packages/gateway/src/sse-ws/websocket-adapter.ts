// websocket-adapter.ts — `WebSocketAdapter` class
// (D-101 / D-104 / D-106 / D-107 / D-109 / D-111 / D-113 — RT-02/04/05/06, ERR-02).
//
// Wrapper di `WebSocket` nativo con:
// - **Lifecycle** governato dal manager (plan 04-07) — l'adapter espone
//   `connect()` / `disconnect()` / `checkFreshness()` ma NON gestisce il loop
//   di reconnect (delegato al manager che possiede la `ReconnectStrategy`
//   cross-canale).
// - **Envelope JSON parsing** (D-106) via `parseFrame` (plan 04-02). Frame non
//   conformi → publish `network.error` con `payload.category: 'protocol'` riuso
//   ERR-02 ext F3.
// - **Internal topics filter STRICT** (D-111 + PITFALL §11.7 anti-AP-6) via
//   `isInternalTopic`: `__ping__`/`__pong__` consumed dall'adapter, NON publish.
//   Topic legittimi come `weather.__ping__` (raro ma legittimo) passano through.
// - **Heartbeat ping/pong applicativo** (D-111). L'adapter invia
//   `JSON.stringify({topic:'__ping__',data:{ts}})` ogni `heartbeatIntervalMs`
//   (default 30s); il server risponde con `{topic:'__pong__'}`. Stale detection:
//   se `Date.now() - lastPongAt > staleTimeoutMs` (default 60s) → l'adapter
//   chiude la connessione + recordFailure. Anti-AP-4: NON trustare
//   `readyState === OPEN` come liveness.
// - **bufferedAmount cap pre-send** (RESEARCH §4.4 / §4.7). Skip ping se
//   `ws.bufferedAmount > 64_000` per evitare amplification quando il TCP send
//   buffer è saturo.
// - **Scheme switch** (D-107) automatico `https://` → `wss://`, `http://` →
//   `ws://`. Permette al consumer di passare un URL di base coerente con il
//   resto dell'API HTTP senza dover gestire la conversione.
// - **WS subprotocols** (Q4 / PITFALL §11.3) passthrough opt-in via
//   `def.wsSubprotocols` → `new WebSocket(url, subprotocols)`.
// - **Close codes routing** (RFC 6455 §7.4 / RESEARCH §4.2): code 1000 normal
//   (no recordFailure), 1006/1008/1011/1012/1013/1014 abnormal (recordFailure
//   per triggerare reconnect manager), 1002/1003/1007/1009/1010/1015 fatali
//   (no recordFailure — fail permanente protocol/policy violation).
// - **Backpressure adapter-level** (D-115 — riuso 1:1 di `BackpressureStrategy`
//   F3) PRIMA di `publishFn`. Eventi `priority: 'normal'` (V1).
// - **AbortController cascade** (D-112): `externalSignal?.addEventListener('abort',
//   () => disconnect(), { once: true })`.
// - **DI WebSocketCtor** per testabilità (jsdom non supporta WebSocket nativo
//   — RESEARCH §9.1; `MockWebSocket` in `test-utils/`).
//
// **Anti-pattern AP-3** (PATTERNS.md §5): NON usare `reconnecting-websocket`
// — vincolo PRD §31.3 + STACK.md.
// **Anti-pattern AP-4** (RESEARCH §4.6): NON trustare `readyState === OPEN`
// come liveness — ping/pong app-level + stale watchdog.
// **Anti-pattern AP-6** (PITFALL §11.7): match strict `topic === '__ping__'`,
// NON `topic.startsWith('__')` — `weather.__ping__` deve passare through.
//
// Pattern lifecycle replica `sse-adapter.ts` (plan 04-05 — analog) e
// `http-gateway.ts` (try → register → outcome → finally cleanup). La
// `ReconnectStrategy` (plan 04-03) viene istanziata nel constructor con
// `initialMode: 'websocket'`.

import type { BrokerEvent, EventSource as BrokerEventSource } from '@sembridge/core'
import { createBrokerError } from '@sembridge/core'
import { nanoid } from 'nanoid'
import type { BackpressureStrategy } from '../http/types/http-strategies'
import { INTERNAL_TOPICS, isInternalTopic, parseFrame } from './frame-parser'
import { createReconnectStrategy, type ReconnectStrategy } from './reconnect-strategy'
import type { RealtimeChannelDef } from './types/realtime-channel-def'

/**
 * Threshold `bufferedAmount` (RESEARCH §4.4) — ping skip se buffer > 64KB.
 *
 * Quando il TCP send buffer è saturo (es. tab in background, network slow), il
 * `WebSocket.send()` accumula in memoria — `bufferedAmount` riflette questa
 * crescita. Inviare ulteriori ping aggraverebbe la pressione memoria senza
 * benefit (il socket sta già drenando lentamente). 64KB è un compromesso
 * empirico (RESEARCH §4.4 / §4.7).
 */
const BUFFERED_AMOUNT_PING_CAP = 64_000

/** Default heartbeat interval in ms (D-111). */
const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000
/** Default stale timeout in ms (D-111). Uniforme con SSE freshness (Q5). */
const DEFAULT_STALE_TIMEOUT_MS = 60_000

/** Source descriptor immutabile per tutti gli event pubblicati dall'adapter (PRD §18.5 + D-113). */
const WS_SOURCE: BrokerEventSource = Object.freeze({
  type: 'server',
  id: 'realtime-channel',
  name: 'websocket',
})

/** Funzione publish iniettata dal manager — loose coupling (no import diretto del Broker). */
export type RealtimePublishFn = (event: BrokerEvent) => void

/**
 * Dipendenze `WebSocketAdapter` — injection point per `publishFn`,
 * `backpressure`, e `WebSocketCtor` (DI per test jsdom).
 */
export interface WebSocketAdapterDeps {
  /** Publish callback verso il broker (D-113 — pipeline §28 step 1 ingress). */
  readonly publishFn: RealtimePublishFn
  /** Backpressure strategy adapter-level (D-115 — riuso F3, opt-in). */
  readonly backpressure?: BackpressureStrategy
  /**
   * DI WebSocket constructor per test jsdom (RESEARCH §9.1).
   * Default: `globalThis.WebSocket` (browser nativo).
   */
  readonly WebSocketCtor?: typeof WebSocket
}

/**
 * RFC 6455 §7.4 — close codes che NON richiedono reconnect (RESEARCH §4.2).
 *
 * - `1000` Normal Closure — chiusura intenzionale (manuale, server graceful).
 * - `1002` Protocol Error — frame mal formato, no recovery.
 * - `1003` Unsupported Data — payload type non gestito (es. binary su canale text).
 * - `1007` Invalid Frame Payload Data — UTF-8 non valido.
 * - `1009` Message Too Big — payload eccede limite server.
 * - `1010` Mandatory Extension — handshake mismatch.
 * - `1015` TLS Handshake Failed — fallimento TLS, no recovery automatico.
 *
 * Tutti gli altri codes (1001 Going Away, 1006 Abnormal Closure, 1011 Server
 * Error, 1012 Service Restart, 1013 Try Again Later, 1014 Bad Gateway, ecc.)
 * suggeriscono retry. La distinzione 1006 (no graceful close received) è
 * particolarmente importante: l'osservatore browser-side è chiunque la VEDA in
 * pratica per network drops (RESEARCH §4.2.1).
 *
 * @returns `true` se il code suggerisce retry, `false` per chiusure intenzionali
 *   o fatali (no recovery automatico).
 */
function shouldReconnectOnCloseCode(code: number): boolean {
  if (code === 1000) return false
  if (
    code === 1002 ||
    code === 1003 ||
    code === 1007 ||
    code === 1009 ||
    code === 1010 ||
    code === 1015
  ) {
    return false
  }
  return true
}

/**
 * `WebSocketAdapter` — wrapper di `WebSocket` nativo
 * (D-101 / D-104 / D-106 / D-107 / D-109 / D-111 — RT-02/04/05/06).
 *
 * Lifecycle:
 * 1. `new WebSocketAdapter(def, deps)` — istanzia + inizializza
 *    `ReconnectStrategy` (mode 'websocket').
 * 2. `await adapter.connect(externalSignal?)` — risolve `buildUrl()` (o `url`
 *    statico), applica scheme switch http→ws, e crea
 *    `new WebSocket(wsUrl, subprotocols?)`. Registra listener per `'open'`,
 *    `'message'`, `'error'`, `'close'`.
 * 3. Su `'open'` → `recordSuccess` + publish `system.realtime.connected` +
 *    avvia heartbeat timer.
 * 4. Su `'message'` → `parseFrame` → se internal topic strict (`__ping__`/
 *    `__pong__`) consume internamente (pong aggiorna `lastPongAt`), altrimenti
 *    publish `BrokerEvent` (con backpressure adapter-level se DI fornita).
 * 5. Su `'close'` → ferma heartbeat + se `shouldReconnectOnCloseCode(code)`
 *    triggera `recordFailure` + publish `system.realtime.disconnected`.
 * 6. `adapter.disconnect(reason?)` — chiude WebSocket con code 1000 + abort
 *    controller + cleanup heartbeat. Idempotent.
 *
 * @example
 * ```ts
 * const adapter = new WebSocketAdapter(
 *   {
 *     name: 'orders',
 *     buildUrl: async () => `https://api/ws?token=${await getToken()}`,
 *     wsSubprotocols: ['sembridge-v1'],
 *     heartbeat: { intervalMs: 30_000, staleTimeoutMs: 60_000 },
 *   },
 *   { publishFn: (ev) => broker.publish(ev) },
 * )
 * await adapter.connect(externalSignal)
 * // ... eventi pubblicati via publishFn
 * adapter.disconnect('teardown')
 * ```
 *
 * @see {@link SseAdapter} — adapter parallelo prioritario V1 (plan 04-05)
 * @see {@link RealtimeChannelManager} — orchestratore N-canale + auto-fallback (plan 04-07)
 * @see {@link parseFrame} — envelope JSON parser strict (plan 04-02 D-106)
 * @see {@link shouldReconnectOnCloseCode} — close codes routing RFC 6455 §7.4
 */
export class WebSocketAdapter {
  /** Channel name (D-102) — chiave nel `RealtimeChannelManager` di plan 04-07. */
  readonly name: string

  private ws: WebSocket | null = null
  /**
   * AbortController scoped al ciclo connect→disconnect corrente. Re-inizializzato
   * a ogni `connect()` per supportare il loop di reconnect del manager
   * (pattern coerente con `sse-adapter.ts` Rule 1 fix).
   */
  private controller = new AbortController()
  private readonly reconnect: ReconnectStrategy
  /** Timer heartbeat ping/pong (D-111). `null` quando non attivo (pre-open o post-disconnect). */
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  /**
   * Timestamp ultimo `__pong__` ricevuto (D-111 stale detection). 0 al
   * pre-open; aggiornato a `Date.now()` in `startHeartbeat` (baseline) e su
   * ogni `__pong__` ricevuto.
   */
  private lastPongAt = 0
  /** Timestamp ultimo evento utente ricevuto (per `checkFreshness` D-110). */
  private lastEventReceivedAt = 0
  private readonly heartbeatIntervalMs: number
  private readonly staleTimeoutMs: number
  /** Flag per evitare doppia publish + per disabilitare recordFailure su disconnect manuale. */
  private intentionallyClosed = false
  /** Flag per evitare doppio publish di `system.realtime.disconnected` (close vs disconnect race). */
  private disconnectedPublished = false

  constructor(
    private readonly def: RealtimeChannelDef,
    private readonly deps: WebSocketAdapterDeps,
  ) {
    this.name = def.name
    // Spread condizionale per `exactOptionalPropertyTypes` strict TS F4
    // (pattern coerente con sse-adapter.ts).
    this.reconnect = createReconnectStrategy({
      initialMode: 'websocket',
      ...(def.reconnect?.baseMs !== undefined && { baseMs: def.reconnect.baseMs }),
      ...(def.reconnect?.capMs !== undefined && { capMs: def.reconnect.capMs }),
      ...(def.reconnect?.consolidationMs !== undefined && {
        consolidationMs: def.reconnect.consolidationMs,
      }),
      ...(def.reconnect?.maxAttempts !== undefined && { maxAttempts: def.reconnect.maxAttempts }),
      ...(def.reconnect?.fallbackThreshold !== undefined && {
        fallbackThreshold: def.reconnect.fallbackThreshold,
      }),
      ...(def.reconnect?.globalCycleCap !== undefined && {
        globalCycleCap: def.reconnect.globalCycleCap,
      }),
    })
    this.heartbeatIntervalMs = def.heartbeat?.intervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS
    this.staleTimeoutMs = def.heartbeat?.staleTimeoutMs ?? DEFAULT_STALE_TIMEOUT_MS
  }

  /**
   * Connette il canale WebSocket.
   *
   * Steps:
   * 1. Guard se l'external signal è già aborted (early return).
   * 2. Re-init controller se aborted (manager loop reconnect support).
   * 3. Cascade D-112: external signal abort → disconnect.
   * 4. Risolve URL via `buildUrl()` o `url` statico — throw
   *    `realtime.config.invalid` se entrambi assenti (`category: 'config'`).
   * 5. Applica scheme switch http(s)→ws(s) (D-107).
   * 6. Risolve `WebSocketCtor` (DI o `globalThis.WebSocket`) — throw
   *    `realtime.websocket.unavailable` se non disponibile (jsdom senza DI).
   * 7. Istanzia `new Ctor(wsUrl, subprotocols?)` con passthrough Q4.
   * 8. Registra listener: `'open'` → recordSuccess + connected event + heartbeat
   *    start; `'message'` → dispatchInbound (parseFrame); `'error'` → swallow
   *    (RESEARCH §4.5 — info opaque, onclose racconta la verità); `'close'` →
   *    stop heartbeat + (shouldReconnect ? recordFailure : no-op) + disconnected
   *    event.
   *
   * @param externalSignal - Signal di abort per cascade D-112. Se aborta → `disconnect()`.
   * @throws `BrokerError` con `code: 'realtime.config.invalid'` (category 'config')
   *   se né `buildUrl` né `url` forniti, o `realtime.websocket.unavailable` se
   *   `WebSocket` API non disponibile.
   */
  async connect(externalSignal?: AbortSignal): Promise<void> {
    if (externalSignal?.aborted) return
    if (this.controller.signal.aborted) {
      this.controller = new AbortController()
    }

    // Cascade D-112: external abort → close + abort our controller.
    if (externalSignal) {
      externalSignal.addEventListener(
        'abort',
        () => {
          this.disconnect('external.abort')
        },
        { once: true },
      )
    }

    const baseUrl = this.def.buildUrl ? await this.def.buildUrl() : this.def.url
    if (!baseUrl) {
      throw createBrokerError({
        code: 'realtime.config.invalid',
        category: 'config',
        message: `WS channel "${this.def.name}": neither buildUrl nor url provided`,
        details: { channel: this.def.name },
      })
    }

    const wsUrl = this.switchScheme(baseUrl)

    const Ctor =
      this.deps.WebSocketCtor ?? (globalThis as { WebSocket?: typeof WebSocket }).WebSocket
    if (!Ctor) {
      throw createBrokerError({
        code: 'realtime.websocket.unavailable',
        category: 'config',
        message: 'WebSocket API not available in this environment',
        details: { channel: this.def.name },
      })
    }

    // Reset flag per il nuovo ciclo di connessione.
    this.disconnectedPublished = false
    this.intentionallyClosed = false

    // Q4 — `wsSubprotocols` passthrough opt-in. WebSocket constructor accetta
    // `string | string[]` come secondo argomento. `readonly string[]` è
    // structurally compatible con `string[]` in TS (covariance).
    const subprotocols = this.def.wsSubprotocols
    this.ws =
      subprotocols !== undefined
        ? new Ctor(wsUrl, subprotocols as string | string[])
        : new Ctor(wsUrl)

    this.ws.addEventListener('open', () => this.handleOpen())
    this.ws.addEventListener('message', (ev) => this.dispatchInbound(ev as MessageEvent))
    // RESEARCH §4.5 — onerror è opaque, info utili arrivano da onclose.
    this.ws.addEventListener('error', () => {
      /* swallow — onclose racconta la verità */
    })
    this.ws.addEventListener('close', (ev) => this.handleClose(ev as CloseEvent))
  }

  /**
   * Disconnect + cleanup.
   *
   * Idempotente: chiamate ripetute non triggerano doppi publish del
   * `system.realtime.disconnected`. Setta `intentionallyClosed = true` per
   * disabilitare `recordFailure` nel listener 'close' (chiusura manuale NON
   * conta come fail per la reconnect strategy).
   *
   * @param reason - Reason descriptor (default `'manual'`). Pass `'external.abort'`
   *   quando chiamato dal cascade `externalSignal` (D-112).
   */
  disconnect(reason: string = 'manual'): void {
    this.intentionallyClosed = true
    this.stopHeartbeat()
    if (this.ws) {
      try {
        this.ws.close(1000, reason)
      } catch {
        // idempotent — close() può throw su readyState invalid
      }
      this.ws = null
    }
    if (!this.controller.signal.aborted) {
      this.controller.abort(reason)
    }
    if (!this.disconnectedPublished) {
      this.disconnectedPublished = true
      this.deps.publishFn(this.makeSystemEvent('system.realtime.disconnected', { reason }))
    }
  }

  /**
   * Freshness check invocato dal manager su `visibilitychange → visible` (D-110).
   *
   * @param staleTimeoutMs - Soglia di staleness in ms (tipicamente 60_000ms da
   *   `HeartbeatDefaults`).
   * @returns `true` se l'ultimo event ricevuto è entro `staleTimeoutMs`, oppure
   *   se nessun event è ancora stato ricevuto (default safe — assume fresh).
   */
  checkFreshness(staleTimeoutMs: number): boolean {
    if (this.lastEventReceivedAt === 0) return true
    return Date.now() - this.lastEventReceivedAt < staleTimeoutMs
  }

  /**
   * Snapshot per debug / Inspector (plan 04-09 / DOC-04).
   */
  getDebugInfo(): {
    readonly name: string
    readonly mode: 'websocket'
    readonly readyState: number | null
    readonly lastPongAt: number
    readonly lastEventReceivedAt: number
  } {
    return {
      name: this.def.name,
      mode: 'websocket',
      readyState: this.ws?.readyState ?? null,
      lastPongAt: this.lastPongAt,
      lastEventReceivedAt: this.lastEventReceivedAt,
    }
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Handler `'open'` event WS — recordSuccess, connected event, heartbeat start.
   */
  private handleOpen(): void {
    this.reconnect.recordSuccess()
    this.deps.publishFn(this.makeSystemEvent('system.realtime.connected'))
    this.startHeartbeat()
  }

  /**
   * Handler `'close'` event WS — RFC 6455 §7.4 close codes routing.
   *
   * - `code === 1000` (normal) → publish disconnected, NO recordFailure.
   * - Codes fatali (1002/1003/1007/1009/1010/1015) → publish disconnected, NO
   *   recordFailure (no recovery automatico — è un fail permanente del
   *   protocollo/policy/TLS).
   * - Tutti gli altri codes → publish disconnected + recordFailure (manager
   *   triggera reconnect via nextDelayMs).
   *
   * Se `intentionallyClosed === true` (disconnect() manuale), NO recordFailure
   * (chiusura intenzionale NON conta come fail).
   */
  private handleClose(ev: CloseEvent): void {
    const code = ev.code
    const reason = ev.reason || `close.${code}`
    this.stopHeartbeat()
    if (shouldReconnectOnCloseCode(code) && !this.intentionallyClosed) {
      this.reconnect.recordFailure()
    }
    if (!this.disconnectedPublished) {
      this.disconnectedPublished = true
      this.deps.publishFn(this.makeSystemEvent('system.realtime.disconnected', { code, reason }))
    }
  }

  /**
   * Dispatcha un `MessageEvent` WS come `BrokerEvent` (D-113 ingress step 1).
   *
   * Steps:
   * 1. `parseFrame(ev.data)` (plan 04-02) → envelope JSON `{topic,data,id?}`.
   * 2. Se parse fail → publish `network.error` con `payload.category: 'protocol'`
   *    e `code: 'realtime.frame.parse-failed'` (riuso ERR-02 ext F3, Q2 closure).
   * 3. Se topic è internal strict (`__ping__`/`__pong__`):
   *    - `__pong__` → aggiorna `lastPongAt = Date.now()` (stale watchdog reset).
   *    - `__ping__` → consumed silenziosamente (NO publish, server-emitted ping
   *      non è un evento utente).
   *    PITFALL §11.7 anti-AP-6: `weather.__ping__` NON è internal (match strict
   *    `topic === '__ping__'` — vedi `isInternalTopic` in frame-parser.ts).
   * 4. Build `BrokerEvent` con `id` da envelope (o nanoid fallback) e
   *    `source: WS_SOURCE`.
   * 5. Backpressure D-115: schedule via `BackpressureStrategy` se DI fornita,
   *    altrimenti publish diretto.
   */
  private dispatchInbound(ev: MessageEvent): void {
    const result = parseFrame(ev.data)
    if (!result.ok) {
      this.deps.publishFn({
        id: nanoid(),
        topic: 'network.error',
        timestamp: Date.now(),
        source: WS_SOURCE,
        payload: {
          category: 'protocol',
          code: 'realtime.frame.parse-failed',
          channel: this.def.name,
          reason: result.reason,
          raw: result.raw,
        },
      } as BrokerEvent)
      return
    }

    const { topic, data, id } = result.envelope

    // PITFALL §11.7 / anti-AP-6 — match strict (NON prefix).
    if (isInternalTopic(topic)) {
      if (topic === INTERNAL_TOPICS.PONG) {
        this.lastPongAt = Date.now()
      }
      // __ping__ from server: consumed silenziosamente (no publish).
      return
    }

    this.lastEventReceivedAt = Date.now()

    // Build BrokerEvent (D-113 ingress step 1 — la pipeline §28 si applica downstream).
    const event: BrokerEvent = {
      id: id ?? nanoid(),
      topic,
      timestamp: Date.now(),
      source: WS_SOURCE,
      payload: data,
    } as BrokerEvent

    // D-115 — Backpressure adapter-level PRIMA del publish.
    if (this.deps.backpressure) {
      this.deps.backpressure
        .schedule(this.def.name, 'normal', () => {
          this.deps.publishFn(event)
          return Promise.resolve(undefined)
        })
        .catch(() => {
          // Drop logged — pattern http-gateway error swallow.
        })
    } else {
      this.deps.publishFn(event)
    }
  }

  /**
   * Avvia il heartbeat timer ping/pong (D-111).
   *
   * Logica per tick:
   * 1. Stale check: se `Date.now() - lastPongAt > staleTimeoutMs` → publish
   *    `system.realtime.disconnected` con reason `stale.no-pong`, recordFailure,
   *    chiudi WS, ferma heartbeat. Anti-AP-4 mitigation.
   * 2. bufferedAmount cap (RESEARCH §4.4): se `ws.bufferedAmount >
   *    BUFFERED_AMOUNT_PING_CAP` (64KB) → skip ping (TCP send buffer saturo,
   *    inviare ulteriori frame aggraverebbe la pressione memoria).
   * 3. Send ping: `JSON.stringify({topic:'__ping__',data:{ts}})` via `ws.send()`.
   *    Wrap in try/catch per swallowing su readyState invalid (race teardown).
   *
   * Baseline `lastPongAt = Date.now()` al primo invocazione: il primo tick
   * avviene dopo `heartbeatIntervalMs`, quindi se il server non risponde mai
   * il watchdog scatta a `staleTimeoutMs` dal connect (60s default).
   */
  private startHeartbeat(): void {
    this.lastPongAt = Date.now()
    this.heartbeatTimer = setInterval(() => {
      // Stale check FIRST (anti-AP-4 — readyState OPEN non è prova di liveness).
      if (Date.now() - this.lastPongAt > this.staleTimeoutMs) {
        if (!this.disconnectedPublished) {
          this.disconnectedPublished = true
          this.deps.publishFn(
            this.makeSystemEvent('system.realtime.disconnected', { reason: 'stale.no-pong' }),
          )
        }
        this.reconnect.recordFailure()
        if (this.ws) {
          try {
            this.ws.close(1000, 'stale.no-pong')
          } catch {
            // idempotent
          }
          this.ws = null
        }
        this.stopHeartbeat()
        return
      }
      // bufferedAmount cap (RESEARCH §4.4) — skip ping se buffer > 64KB.
      if (!this.ws || this.ws.bufferedAmount > BUFFERED_AMOUNT_PING_CAP) return
      // Send ping envelope JSON. Wrap try/catch per readyState race su teardown.
      try {
        this.ws.send(JSON.stringify({ topic: INTERNAL_TOPICS.PING, data: { ts: Date.now() } }))
      } catch {
        // swallow — il close handler gestirà cleanup.
      }
    }, this.heartbeatIntervalMs)
  }

  /** Ferma il heartbeat timer (idempotent). */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * Scheme switch http(s)→ws(s) (D-107).
   *
   * Permette al consumer di passare un URL HTTP coerente con il resto dell'API
   * (es. `https://api.example.com/ws`) senza dover gestire la conversione. Usa
   * `URL` API per parsing strict; fallback regex per URL relativi/malformati.
   */
  private switchScheme(url: string): string {
    try {
      const u = new URL(url)
      if (u.protocol === 'https:') {
        u.protocol = 'wss:'
      } else if (u.protocol === 'http:') {
        u.protocol = 'ws:'
      }
      return u.toString()
    } catch {
      return url.replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://')
    }
  }

  /** Helper per costruire `system.realtime.*` events (ERR-02 ext F4). */
  private makeSystemEvent(topic: string, extraPayload?: Record<string, unknown>): BrokerEvent {
    return {
      id: nanoid(),
      topic,
      timestamp: Date.now(),
      source: WS_SOURCE,
      payload: { channel: this.def.name, ...extraPayload },
    } as BrokerEvent
  }
}
