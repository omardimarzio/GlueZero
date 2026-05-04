// auto-fallback.test.ts — TEST-03 + D-107 (B-4 closure SSE→WS fallback effettivo).
//
// Scenario D-119 #3 — auto-fallback SSE→WS:
//   1. Connect mode='auto' → SSE-first (D-107)
//   2. EventSource constructor fail (simulato) → manager.runReconnectLoop attivato
//   3. fallbackThreshold raggiunto → fallback() switch mode → WebSocketAdapter creato
//   4. Verifica MockWebSocket istanziato dopo fail SSE (B-4 closure — pre-fix nessun
//      runner orchestrava il fallback)
//
// **Architettura testabilità**: il manager `runReconnectLoop` (plan 04-07) è
// triggered SOLO se `connect()` initial fa throw o reject. Un 'error' SSE post-open
// pubblica `system.realtime.disconnected` MA NON triggera il loop di reconnect
// (l'adapter chiama solo la sua reconnect strategy interna). Per il test integration
// B-4, sostituiamo `globalThis.EventSource` con un costruttore che throw, forzando
// il path `connect → catch → runReconnectLoop → fallback → WebSocketAdapter`.
//
// **Cycle-cap closure (Test 2)**: `maxAttempts` esauriti → strategy
// `isPermanentlyFailed()` true → publish `system.realtime.failed` con
// `reason='cycle-cap-exceeded'`. Pattern unit-tested in plan 04-07 Test 14.
// Qui smoke integration verifying l'event arriva al subscriber via inner.publish.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MockEventSource } from '../test-utils/mock-event-source'
import { MockWebSocket } from '../test-utils/mock-websocket'
import { createRealtimeBroker } from '../public-factory'

type GlobalES = { EventSource?: typeof EventSource }
type GlobalWS = { WebSocket?: typeof WebSocket }

describe('Auto-fallback SSE→WS effettivo (TEST-03 + D-107 + B-4 closure)', () => {
  let originalES: typeof EventSource | undefined
  let originalWS: typeof WebSocket | undefined

  beforeEach(() => {
    originalES = (globalThis as GlobalES).EventSource
    originalWS = (globalThis as GlobalWS).WebSocket
    MockEventSource.__reset()
    MockWebSocket.__reset()
  })

  afterEach(() => {
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
  })

  it('B-4 closure: SSE constructor throw → runReconnectLoop fallback → MockWebSocket istanziato', async () => {
    // FailingES throw al constructor → forza il path connect catch → runReconnectLoop.
    // Pattern allineato a plan 04-07 Test 13.
    class FailingMockEventSource extends MockEventSource {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init)
        throw new Error('simulated SSE failure (integration test)')
      }
    }
    ;(globalThis as GlobalES).EventSource = FailingMockEventSource as unknown as typeof EventSource
    ;(globalThis as GlobalWS).WebSocket = MockWebSocket as unknown as typeof WebSocket

    const broker = createRealtimeBroker()
    await broker.connectRealtime({
      name: 'auto',
      mode: 'sse',
      url: 'http://x/?_channel=auto',
      reconnect: { fallbackThreshold: 1, maxAttempts: 10, baseMs: 1, capMs: 5 },
    })

    // runReconnectLoop è async — flush microtask + macrotask round per consentire
    // il loop di completare 1 ciclo (fail SSE → fallback → WS connect success).
    await new Promise((r) => setTimeout(r, 50))
    await new Promise((r) => setTimeout(r, 50))
    await new Promise((r) => setTimeout(r, 50))

    // B-4 closure: MockWebSocket istanziato dopo il fallback effettivo.
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1)

    // Lo state del canale deve riflettere mode='websocket' dopo il fallback.
    const snap = broker.getDebugSnapshot()
    const channel = snap.realtime.channels.find((c) => c.name === 'auto')
    expect(channel).toBeDefined()
    expect(channel!.mode).toBe('websocket')
  })

  it('B-4 closure: cycle-cap → publish system.realtime.failed (reason=cycle-cap-exceeded)', async () => {
    // Sia SSE sia WS fail al constructor → maxAttempts esaurito → cycle-cap-exceeded.
    class FailingMockEventSource extends MockEventSource {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init)
        throw new Error('SSE fail')
      }
    }
    class FailingMockWebSocket extends MockWebSocket {
      constructor(url: string | URL, protocols?: string | readonly string[]) {
        super(url, protocols)
        throw new Error('WS fail')
      }
    }
    ;(globalThis as GlobalES).EventSource = FailingMockEventSource as unknown as typeof EventSource
    ;(globalThis as GlobalWS).WebSocket = FailingMockWebSocket as unknown as typeof WebSocket

    const broker = createRealtimeBroker()
    const failed: Array<{ payload: unknown }> = []
    broker.subscribe('system.realtime.failed', (ev: { payload: unknown }) => {
      failed.push({ payload: ev.payload })
    })

    await broker.connectRealtime({
      name: 'broken',
      mode: 'sse',
      url: 'http://x/?_channel=broken',
      reconnect: { maxAttempts: 2, fallbackThreshold: 1, baseMs: 1, capMs: 5 },
    })

    // Flush enough rounds per esaurire maxAttempts.
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 50))
    }

    expect(failed.length).toBeGreaterThanOrEqual(1)
    expect((failed[0]!.payload as { reason?: string }).reason).toBe('cycle-cap-exceeded')
  })
})
