// realtime-harness.ts — fixture per integration test F4 SSE/WS (D-119 6 scenari + scenari W-2 D-114).
//
// Pattern analog `router-harness.ts` di F3 — collect events + mock SSE/WS + reset
// deterministico per test isolation. NON è production code (escluso da coverage in
// `vitest.config.ts` plan 04-01 via `'src/sse-ws/test-utils/**'`).
//
// **Approccio collect events (W-3 closure)**: usa `subscribe(<pattern>)` per pattern
// di profondità multipla — il F1 topic-matcher (`packages/core/src/core/topic-matcher.ts`
// PATTERN_REGEX) supporta `*` come segment wildcard ma il match avviene per profondità
// esatta. Per coprire eventi single-segment (`'orders'`), 2-segment (`'system.warn'`,
// `'orders.created'`), 3-segment (`'system.realtime.connected'`), 4-segment, l'harness
// subscribe a 4 pattern di profondità (`'*'`, `'*.*'`, `'*.*.*'`, `'*.*.*.*'`). Niente
// monkey-patch di `broker.publish` (W-3 closure) — il path `manager.publishFn →
// inner.publish` resta intatto e la pipeline §28 viene esercitata interamente.
//
// **Approccio routing per-canale (B-2 + B-NEW-2 closure)**: usa `MockEventSource.byChannelName`
// e `MockWebSocket.byChannelName` per mappare ogni canale al mock corrispondente. La
// convenzione test: ogni canale di test passa `?_channel=<name>` nel URL. I mock files
// (plan 04-05/06) registrano l'instance al constructor parsando il query param. Niente
// fallback "ultimo istanza" (causa di cross-canale pollution pre-fix B-2).
//
// **Approccio injection EventSource/WebSocket**: patcha `globalThis.EventSource` e
// `globalThis.WebSocket` con i mock; `reset()` ripristina. Pattern jsdom-friendly (jsdom
// non ha `EventSource` né `WebSocket` nativi).

import { vi } from 'vitest'
import { createRealtimeBroker, type RealtimeBroker } from '../public-factory'
import type { RealtimeBrokerConfig } from '../realtime-broker'
import { MockEventSource } from './mock-event-source'
import { MockWebSocket } from './mock-websocket'

type GlobalES = { EventSource?: typeof EventSource }
type GlobalWS = { WebSocket?: typeof WebSocket }

/** Pattern subscribe `'*'`, `'*.*'`, `'*.*.*'`, `'*.*.*.*'` per coprire eventi 1-4 segmenti. */
const COLLECT_PATTERNS: readonly string[] = ['*', '*.*', '*.*.*', '*.*.*.*']

/**
 * Opzioni `createRealtimeHarness`. Estende `RealtimeBrokerConfig` (passa-through al
 * factory) + opzioni harness-specifiche.
 */
export interface RealtimeHarnessOptions extends RealtimeBrokerConfig {
  // Nessun extra in V1 — config passa intero al factory.
  readonly _placeholder?: never
}

/** Evento raccolto via subscribe wildcard (W-3 closure — niente monkey-patch). */
export interface CollectedEvent {
  readonly topic: string
  readonly payload: unknown
  readonly source?: { readonly type: string; readonly name?: string; readonly id?: string }
  readonly id?: string
  readonly timestamp: number
}

/**
 * Harness ritornato da `createRealtimeHarness`.
 */
export interface RealtimeHarness {
  /** Broker creato via `createRealtimeBroker` con i mock SSE/WS già patched. */
  readonly broker: RealtimeBroker
  /** Eventi raccolti via `subscribe('*' | '*.*' | '*.*.*' | '*.*.*.*')`. */
  readonly events: CollectedEvent[]
  /** Push raw frame al `MockEventSource` indicizzato per `name` (B-2 strict routing). */
  pushSseEvent(channelName: string, data: string, id?: string, eventType?: string): void
  /** Push raw frame al `MockWebSocket` indicizzato per `name` (B-2 strict routing). */
  pushWsFrame(channelName: string, frame: string): void
  /** Simula `__open()` per il canale (lookup byChannelName SSE+WS). */
  openChannel(channelName: string): void
  /** Simula `__close()` server-side (WS) o `__error()` (SSE) per il canale. */
  closeChannel(channelName: string, code?: number, reason?: string): void
  /** Simula `__error()` server-side (SSE+WS). */
  errorChannel(channelName: string): void
  /** Reset completo: clear events, restore globals, drop mock state. */
  reset(): void
  /** Flush microtask + N ms (default 0) per dispatch async F1 deliveryMode='async'. */
  flushAsync(ms?: number): Promise<void>
}

/**
 * Crea harness F4 con globals patch su `EventSource` + `WebSocket` (jsdom-friendly).
 *
 * @example
 * ```ts
 * const h = createRealtimeHarness()
 * await h.broker.connectRealtime({
 *   name: 'orders', mode: 'sse', url: 'http://x/?_channel=orders',
 * })
 * h.openChannel('orders')
 * h.pushSseEvent('orders', '{"city":"Roma"}', 'evt-1', 'orders.update')
 * await h.flushAsync()
 * expect(h.events.find((e) => e.topic === 'orders.update')).toBeDefined()
 * h.reset()
 * ```
 */
export function createRealtimeHarness(opts: RealtimeHarnessOptions = {}): RealtimeHarness {
  // Patch globals: EventSource + WebSocket → mock. Mantiene reference all'originale
  // per ripristino in `reset()`.
  const originalES = (globalThis as GlobalES).EventSource
  const originalWS = (globalThis as GlobalWS).WebSocket
  ;(globalThis as GlobalES).EventSource = MockEventSource as unknown as typeof EventSource
  ;(globalThis as GlobalWS).WebSocket = MockWebSocket as unknown as typeof WebSocket

  // Reset mock state al boot — assicura test isolation se il consumer non chiama
  // `reset()` prima di ri-creare l'harness.
  MockEventSource.__reset()
  MockWebSocket.__reset()

  const events: CollectedEvent[] = []

  // Strip opzione harness-only prima di passare al factory.
  const { _placeholder: _ignored, ...brokerConfig } = opts
  const broker = createRealtimeBroker(brokerConfig)

  // W-3 fix — niente monkey-patch di `broker.publish`. Subscribe a pattern di
  // profondità multipla per catturare TUTTI gli eventi (single→4 segmenti) senza
  // mutare l'API pubblica del broker. Il path `manager.publishFn → inner.publish`
  // resta invariato e la pipeline §28 viene esercitata interamente.
  for (const pattern of COLLECT_PATTERNS) {
    broker.subscribe(
      pattern,
      (ev: { topic: string; payload: unknown; source?: unknown; id?: string }) => {
        const collected: CollectedEvent = {
          topic: ev.topic,
          payload: ev.payload,
          timestamp: Date.now(),
          ...(ev.source !== undefined && { source: ev.source as never }),
          ...(ev.id !== undefined && { id: ev.id }),
        }
        events.push(collected)
      },
    )
  }

  // B-2 fix — strict channel routing via static `byChannelName` Map.
  // Convention test: ogni canale ha URL nella forma `?_channel=<name>`. I mock files
  // (plan 04-05/06) parsano il query param al constructor e registrano l'instance.
  // L'harness lookup deterministico, throw esplicito se name non matcha (intentional —
  // indica test setup error).
  function findChannel(name: string): {
    readonly es?: MockEventSource
    readonly ws?: MockWebSocket
  } {
    const es = MockEventSource.byChannelName.get(name)
    const ws = MockWebSocket.byChannelName.get(name)
    return {
      ...(es && { es }),
      ...(ws && { ws }),
    }
  }

  return {
    broker,
    events,
    pushSseEvent(channelName, data, id, eventType = 'message') {
      const target = findChannel(channelName).es
      if (!target) {
        throw new Error(
          `No SSE channel found for name='${channelName}' — verify URL contains _channel=${channelName}`,
        )
      }
      target.__message(data, id, eventType)
    },
    pushWsFrame(channelName, frame) {
      const target = findChannel(channelName).ws
      if (!target) {
        throw new Error(
          `No WS channel found for name='${channelName}' — verify URL contains _channel=${channelName}`,
        )
      }
      target.__message(frame)
    },
    openChannel(channelName) {
      const ch = findChannel(channelName)
      if (ch.es) ch.es.__open()
      if (ch.ws) ch.ws.__open()
      if (!ch.es && !ch.ws) {
        throw new Error(
          `No channel found for name='${channelName}' — verify URL contains _channel=${channelName}`,
        )
      }
    },
    closeChannel(channelName, code = 1006, reason = 'abnormal') {
      const ch = findChannel(channelName)
      if (ch.ws) ch.ws.__close(code, reason)
      if (ch.es) ch.es.__error()
    },
    errorChannel(channelName) {
      const ch = findChannel(channelName)
      if (ch.es) ch.es.__error()
      if (ch.ws) ch.ws.__error()
    },
    reset() {
      events.length = 0
      MockEventSource.__reset()
      MockWebSocket.__reset()
      // Cast su record con `EventSource | WebSocket` opzionali — `exactOptionalPropertyTypes`
      // non permette assegnazione `undefined` a una property non opzionale; il workaround
      // usa `Partial` cast che accetta missing key. In jsdom EventSource/WebSocket sono
      // tipicamente undefined originariamente, e il `delete` re-installa lo stato pre-patch.
      if (originalES === undefined) {
        delete (globalThis as Partial<GlobalES>).EventSource
      } else {
        ;(globalThis as GlobalES).EventSource = originalES
      }
      if (originalWS === undefined) {
        delete (globalThis as Partial<GlobalWS>).WebSocket
      } else {
        ;(globalThis as GlobalWS).WebSocket = originalWS
      }
      vi.restoreAllMocks()
    },
    async flushAsync(ms = 0): Promise<void> {
      // Microtask flush + macrotask delay per dispatch async F1.
      await Promise.resolve()
      if (ms > 0) {
        await new Promise<void>((res) => setTimeout(res, ms))
      } else {
        await new Promise<void>((res) => setTimeout(res, 0))
      }
    },
  }
}
