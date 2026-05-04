// sse-adapter.ts — `SseAdapter` class (D-101 / D-104 / D-105 / D-109 / D-113 — RT-01/04/06/07).
//
// Wrapper di `EventSource` nativo con:
// - **Lifecycle** governato dal manager (plan 04-07) — l'adapter espone `connect()` /
//   `disconnect()` / `checkFreshness()` ma NON gestisce il loop di reconnect (delegato
//   al manager che possiede la `ReconnectStrategy` cross-canale).
// - **Last-Event-ID management manuale** (RESEARCH §3.2 — chiusura RT-07): il browser
//   invia `Last-Event-ID` header automaticamente SOLO durante il native reconnect
//   di EventSource. Il custom reconnect di SemBridge crea un NEW `EventSource` quindi
//   inietta l'ID via query string `?lastEventId=` tramite `buildUrl()` (vincolo D-105
//   no header custom).
// - **Auth-agnostic via `buildUrl()` async hook** (D-104) con fallback a `url` statico.
// - **Backpressure adapter-level** (D-115 — riuso 1:1 di `BackpressureStrategy` F3)
//   PRIMA di `publishFn`. Eventi `priority: 'critical'` bypassano (V1: l'adapter usa
//   `priority: 'normal'` come default, il manager può sostituire).
// - **Eventi standard** `system.realtime.connected/disconnected` (ERR-02 ext F4).
// - **Topic validation** (regex F1 D-24 lowercase dot-separated) — frame con topic
//   invalido → `network.error` con `payload.category: 'protocol'`, NON crash
//   (RESEARCH §3.7 — la category 'protocol' viaggia nel payload dell'event, NON come
//   `BrokerError.category` che ha un union ristretto a F1 categories).
// - **AbortController cascade** (D-112): `externalSignal?.addEventListener('abort',
//   () => disconnect(), { once: true })`.
// - **Freshness check** (D-110) — `lastEventReceivedAt` tracking + `checkFreshness()`
//   API per visibility orchestration (manager responsabile).
// - **DI EventSourceCtor** per testabilità (jsdom non supporta EventSource nativo —
//   RESEARCH §9.1; MockEventSource in `test-utils/`).
//
// **Anti-pattern AP-2 da evitare** (PATTERNS.md §5): NON tentare di iniettare custom
// headers in EventSource (vincolo PRD §31.3 + D-105). Auth via `buildUrl()` query
// string only.
//
// **Anti-pattern AP-4 implicito** (RESEARCH §3.3): NON usare il native reconnect di
// EventSource — su `'error'` chiamiamo `es.close()` per forzare CLOSED state e
// applicare la nostra reconnect policy custom (full jitter D-109 + auto-fallback D-107).
//
// **Pattern lifecycle** replica `http-gateway.ts:100-298` (try → register → outcome →
// finally cleanup) e `circuit-breaker.ts` (state machine con closure factory). La
// `ReconnectStrategy` (plan 04-03) viene istanziata nel constructor per ricordare il
// counter `consecutiveFailures` cross-connect; il loop di reconnect è del manager
// (plan 04-07) che chiama `adapter.connect()` dopo `nextDelayMs()`.

import type { BrokerEvent, EventSource as BrokerEventSource } from '@sembridge/core'
import { createBrokerError } from '@sembridge/core'
import { nanoid } from 'nanoid'
import type { BackpressureStrategy } from '../http/types/http-strategies'
import { createReconnectStrategy, type ReconnectStrategy } from './reconnect-strategy'
import type { RealtimeChannelDef } from './types/realtime-channel-def'

/**
 * Regex F1 (D-24) — topic naming: dot-separated lowercase alphanumeric segments.
 *
 * Identica al pattern di F1 `core/util/topic-validator.ts`. Inline-replicata qui per
 * evitare cross-package import (D-83 strict — niente runtime touch a `packages/core/`).
 */
const TOPIC_REGEX = /^[a-z0-9]+(\.[a-z0-9]+)*$/

/** Source descriptor immutabile per tutti gli event pubblicati dall'adapter (PRD §18.5). */
const SSE_SOURCE: BrokerEventSource = Object.freeze({
  type: 'server',
  id: 'realtime-channel',
  name: 'sse',
})

/** Funzione publish iniettata dal manager — loose coupling (no import diretto del Broker). */
export type RealtimePublishFn = (event: BrokerEvent) => void

/**
 * Dipendenze `SseAdapter` — injection point per `publishFn`, `backpressure`, e
 * `EventSourceCtor` (DI per test jsdom).
 */
export interface SseAdapterDeps {
  /** Publish callback verso il broker (D-113 — pipeline §28 step 1 ingress). */
  readonly publishFn: RealtimePublishFn
  /** Backpressure strategy adapter-level (D-115 — riuso F3, opt-in). */
  readonly backpressure?: BackpressureStrategy
  /**
   * DI EventSource constructor per test jsdom (RESEARCH §9.1).
   * Default: `globalThis.EventSource` (browser nativo).
   */
  readonly EventSourceCtor?: typeof EventSource
}

/**
 * `SseAdapter` — wrapper di `EventSource` nativo (D-101 / D-104 / D-109 — RT-01/04/06/07).
 *
 * Lifecycle:
 * 1. `new SseAdapter(def, deps)` — istanzia + inizializza `ReconnectStrategy` (mode 'sse').
 * 2. `await adapter.connect(externalSignal?)` — risolve `buildUrl()` (o `url` statico) e
 *    crea `new EventSource(url, { withCredentials: true })`. Registra listener per
 *    `'open'`, ogni eventType custom (W-4 fallback `'message'`), heartbeat eventTypes
 *    (B-5 default `'heartbeat'`), `'error'`.
 * 3. Su `'message'` → publish `BrokerEvent` via `publishFn` (con backpressure adapter-level
 *    se DI fornita); aggiorna `lastEventReceivedAt`; memorizza `lastEventId`.
 * 4. Su `'error'` → `recordFailure()` + close `EventSource` + publish
 *    `system.realtime.disconnected` (manager loop di reconnect via `nextDelayMs()`).
 * 5. `adapter.disconnect(reason?)` — close `EventSource` + abort controller + publish
 *    disconnected.
 *
 * @example
 * ```ts
 * const adapter = new SseAdapter(
 *   { name: 'orders', buildUrl: async () => `/sse?token=${await getToken()}` },
 *   { publishFn: (ev) => broker.publish(ev) },
 * )
 * await adapter.connect(externalSignal)
 * // ... eventi pubblicati via publishFn
 * adapter.disconnect('teardown')
 * ```
 *
 * @see {@link RealtimeChannelManager} — orchestratore N-canale + reconnect loop (plan 04-07)
 * @see {@link WebSocketAdapter} — adapter parallelo (plan 04-06)
 * @see {@link RealtimeChannelDef} — config shape (D-102, D-104, D-105)
 */
export class SseAdapter {
  /** Channel name (D-102) — chiave nel `RealtimeChannelManager` di plan 04-07. */
  readonly name: string

  private es: EventSource | null = null
  /**
   * AbortController scoped al ciclo connect→disconnect corrente. Viene RE-INIZIALIZZATO
   * a ogni `connect()` per supportare il loop di reconnect del manager
   * (`adapter.connect() → ... → adapter.disconnect() → adapter.connect()` deve creare
   * una nuova connessione, non essere bloccato dal controller del ciclo precedente).
   *
   * Il `disconnect()` aborta `controller` per propagare il signal a eventuali task
   * in-flight (es. backpressure schedule) — ma il NEW connect ricrea il controller
   * fresh. Pattern analogo a `http-gateway.ts` per fetch lifecycle multi-attempt.
   */
  private controller = new AbortController()
  private readonly reconnect: ReconnectStrategy
  /** Memorizzato dal `MessageEvent.lastEventId` per re-injection nel buildUrl al re-connect (RESEARCH §3.2). */
  private lastEventId: string | undefined = undefined
  private lastEventReceivedAt = 0
  /** Listener cleanup tracking per `disconnect()` puntuale (pattern combine-signals.ts). */
  private listeners: Array<{ type: string; fn: EventListener }> = []
  /** Flag per evitare doppia publish di `system.realtime.disconnected` (error+disconnect). */
  private disconnectedPublished = false

  constructor(
    private readonly def: RealtimeChannelDef,
    private readonly deps: SseAdapterDeps,
  ) {
    this.name = def.name
    // Build options per createReconnectStrategy in modo strict per `exactOptionalPropertyTypes`:
    // spread condizionale per includere il key SOLO se il valore è non-undefined
    // (l'interface `ReconnectStrategyOptions` ha tutti i campi `readonly` — assignment
    // post-init non è permesso).
    this.reconnect = createReconnectStrategy({
      initialMode: 'sse',
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
  }

  /**
   * Connette il canale SSE.
   *
   * Steps:
   * 1. Guard se già abortito (idempotenza).
   * 2. Cascade D-112: external signal abort → disconnect.
   * 3. Risolve URL via `buildUrl()` o `url` statico — throw `realtime.config.invalid`
   *    se entrambi assenti (`category: 'config'`).
   * 4. Inietta `?lastEventId=` se memorizzato (RESEARCH §3.2 — chiusura RT-07 senza
   *    header custom D-105).
   * 5. Istanzia `new EventSource(url, { withCredentials: true })` (cookie auth path).
   * 6. Registra listener: `'open'` → recordSuccess + connected event; eventType custom
   *    (W-4 default `'message'`) → dispatchInbound; heartbeat eventType (B-5 default
   *    `'heartbeat'`) → silent freshness update; `'error'` → recordFailure + close +
   *    disconnected event.
   *
   * @param externalSignal - Signal di abort per cascade D-112. Se aborta → `disconnect()`.
   * @throws `BrokerError` con `code: 'realtime.config.invalid'` (category 'config') se né
   *   `buildUrl` né `url` forniti.
   */
  async connect(externalSignal?: AbortSignal): Promise<void> {
    // Re-init controller per supportare reconnect dopo disconnect (manager loop).
    // Se il controller corrente era già abortito (da `disconnect()` precedente),
    // creiamo un fresh controller per il nuovo ciclo. Se invece l'external signal
    // è già abortito al momento del connect, restituiamo subito (caller cancellato
    // prima del setup).
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
        message: `SSE channel "${this.def.name}": neither buildUrl nor url provided`,
        details: { channel: this.def.name },
      })
    }

    // RESEARCH §3.2 — Last-Event-ID via query string (D-105 no header custom).
    const url =
      this.lastEventId !== undefined
        ? this.appendQueryParam(baseUrl, 'lastEventId', this.lastEventId)
        : baseUrl

    const Ctor =
      this.deps.EventSourceCtor ?? (globalThis as { EventSource?: typeof EventSource }).EventSource
    if (!Ctor) {
      throw createBrokerError({
        code: 'realtime.eventsource.unavailable',
        category: 'config',
        message: 'EventSource API not available in this environment',
        details: { channel: this.def.name },
      })
    }

    // Reset flag per il nuovo ciclo di connessione.
    this.disconnectedPublished = false
    this.es = new Ctor(url, { withCredentials: true })

    // 'open' listener — recordSuccess + connected event (ERR-02 ext F4).
    this.addListener('open', () => {
      this.reconnect.recordSuccess()
      this.deps.publishFn(this.makeSystemEvent('system.realtime.connected'))
    })

    // W-4 fix — custom event types (chiusura SC-1 ROADMAP scenario meteo
    // `event: weather.update`). Default fallback a `['message']` se omesso.
    const eventTypes: readonly string[] =
      this.def.eventTypes && this.def.eventTypes.length > 0 ? this.def.eventTypes : ['message']
    for (const eventType of eventTypes) {
      this.addListener(eventType, (ev) => {
        this.dispatchInbound(ev as MessageEvent, eventType)
      })
    }

    // B-5 fix — SSE heartbeat eventTypes (Q5 closure). Server-emitted custom event
    // types (default `['heartbeat']`) aggiornano `lastEventReceivedAt` SENZA pubblicare
    // BrokerEvent (silent freshness update). Mantiene staleTimeoutMs uniforme con WS=60s
    // anche se il server non emette messaggi reali sui topic.
    const heartbeatTypes: readonly string[] = this.def.sseHeartbeatEventTypes ?? ['heartbeat']
    for (const heartbeatType of heartbeatTypes) {
      // Skip se già registrato come eventType pubblicabile (evita doppio listener).
      if (eventTypes.includes(heartbeatType)) continue
      this.addListener(heartbeatType, () => {
        this.lastEventReceivedAt = Date.now()
        // NO publish — heartbeat sintattico server-only.
      })
    }

    // 'error' listener — RESEARCH §3.3: disable native reconnect chiudendo l'EventSource.
    this.addListener('error', () => {
      this.reconnect.recordFailure()
      // Publish disconnected PRIMA del close per evitare race con il flag.
      if (!this.disconnectedPublished) {
        this.disconnectedPublished = true
        this.deps.publishFn(
          this.makeSystemEvent('system.realtime.disconnected', { reason: 'eventsource.error' }),
        )
      }
      if (this.es) {
        this.es.close()
        this.es = null
      }
    })
  }

  /**
   * Disconnect + cleanup.
   *
   * Idempotente: chiamate ripetute non triggerano doppi publish del `system.realtime.disconnected`.
   *
   * @param reason - Reason descriptor (default `'manual'`). Pass `'external.abort'` quando
   *   chiamato dal cascade `externalSignal` (D-112).
   */
  disconnect(reason: string = 'manual'): void {
    if (this.es) {
      this.es.close()
      this.es = null
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
   * @param staleTimeoutMs - Soglia di staleness in ms (tipicamente 60_000ms da `HeartbeatDefaults`).
   * @returns `true` se l'ultimo event ricevuto è entro `staleTimeoutMs`, oppure se
   *   nessun event è ancora stato ricevuto (default safe — assume fresh).
   */
  checkFreshness(staleTimeoutMs: number): boolean {
    if (this.lastEventReceivedAt === 0) return true
    return Date.now() - this.lastEventReceivedAt < staleTimeoutMs
  }

  /**
   * Snapshot per debug / Inspector (plan 04-09 / DOC-04).
   *
   * @returns Stato corrente: `name`, `mode`, `readyState` (raw EventSource value o null
   *   se disconnesso), `lastEventId` memorizzato, `lastEventReceivedAt` timestamp.
   */
  getDebugInfo(): {
    readonly name: string
    readonly mode: 'sse'
    readonly readyState: number | null
    readonly lastEventId: string | undefined
    readonly lastEventReceivedAt: number
  } {
    return {
      name: this.def.name,
      mode: 'sse',
      readyState: this.es?.readyState ?? null,
      lastEventId: this.lastEventId,
      lastEventReceivedAt: this.lastEventReceivedAt,
    }
  }

  // ============================================================================
  // Private helpers
  // ============================================================================

  /**
   * Dispatcha un `MessageEvent` SSE come `BrokerEvent` (D-113 ingress step 1).
   *
   * Topic determination:
   * - `eventType === 'message'` → topic = `def.name` (default fallback W-4).
   * - `eventType !== 'message'` (custom event type) → topic = `eventType` (W-4 SC-1).
   *
   * Topic validation (RESEARCH §3.7 / D-24): se il topic finale viola la regex F1,
   * l'adapter pubblica `network.error` con `payload.category: 'protocol'` invece di
   * crashare. La category 'protocol' viaggia nel payload (non come BrokerError.category)
   * perché l'union `ErrorCategory` di F1 non include 'protocol'.
   *
   * Backpressure (D-115): se `deps.backpressure` è fornita, il publish viene schedulato
   * via `schedule(channelName, 'normal', task)`. Se la strategy droppa l'entry, il
   * `.catch()` swallowa silenziosamente (pattern http-gateway error swallow).
   */
  private dispatchInbound(ev: MessageEvent, eventType: string): void {
    this.lastEventReceivedAt = Date.now()
    if (ev.lastEventId) this.lastEventId = ev.lastEventId

    const topic = eventType === 'message' ? this.def.name : eventType

    // RESEARCH §3.7 — topic validation (regex F1 D-24). Invalid → network.error.
    if (!TOPIC_REGEX.test(topic)) {
      this.deps.publishFn({
        id: nanoid(),
        topic: 'network.error',
        timestamp: Date.now(),
        source: SSE_SOURCE,
        payload: {
          category: 'protocol',
          code: 'realtime.topic.invalid',
          channel: this.def.name,
          rawTopic: topic,
        },
      } as BrokerEvent)
      return
    }

    // Build BrokerEvent (D-113 ingress step 1 — la pipeline §28 si applica downstream).
    const event: BrokerEvent = {
      id: ev.lastEventId || nanoid(),
      topic,
      timestamp: Date.now(),
      source: SSE_SOURCE,
      payload: this.tryParseJson(ev.data),
    } as BrokerEvent

    // D-115 — Backpressure adapter-level PRIMA del publish.
    if (this.deps.backpressure) {
      this.deps.backpressure
        .schedule(this.def.name, 'normal', () => {
          this.deps.publishFn(event)
          return Promise.resolve(undefined)
        })
        .catch(() => {
          // Drop logged — pattern http-gateway error swallow (la backpressure è
          // responsabile di logging interno se richiesto).
        })
    } else {
      this.deps.publishFn(event)
    }
  }

  /**
   * Parsa `MessageEvent.data` come JSON; fallback a raw value se non parsabile.
   *
   * SSE consegna `data` come stringa (per spec). Se il server invia JSON, lo parsa;
   * altrimenti restituisce la stringa raw (che il mapper §28 step 4 può comunque
   * normalizzare se schema canonical applicabile).
   */
  private tryParseJson(data: unknown): unknown {
    if (typeof data !== 'string') return data
    if (data.length === 0) return data
    try {
      return JSON.parse(data)
    } catch {
      return data
    }
  }

  /**
   * Append/override query param a un URL.
   *
   * Usa `URL` API per parsing strict (gestisce path/host/protocol). Fallback manuale
   * per URL relativi o malformati (es. `'./events'` o `'/sse'` senza host).
   */
  private appendQueryParam(url: string, key: string, value: string): string {
    try {
      const u = new URL(url)
      u.searchParams.set(key, value)
      return u.toString()
    } catch {
      const sep = url.includes('?') ? '&' : '?'
      return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    }
  }

  /** Helper per costruire `system.realtime.*` events (ERR-02 ext F4). */
  private makeSystemEvent(topic: string, extraPayload?: Record<string, unknown>): BrokerEvent {
    return {
      id: nanoid(),
      topic,
      timestamp: Date.now(),
      source: SSE_SOURCE,
      payload: { channel: this.def.name, ...extraPayload },
    } as BrokerEvent
  }

  /**
   * Registra listener su `this.es` con tracking per cleanup (pattern combine-signals.ts).
   *
   * Il tracking è per documentazione/safety: `EventSource.close()` rimuove
   * implicitamente tutti i listener (browser-side), ma manteniamo l'array per
   * audit/debug e per future estensioni.
   */
  private addListener(type: string, fn: EventListener): void {
    if (!this.es) return
    this.es.addEventListener(type, fn)
    this.listeners.push({ type, fn })
  }
}
