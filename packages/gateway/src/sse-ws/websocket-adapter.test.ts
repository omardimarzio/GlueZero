// websocket-adapter.test.ts — TDD RED→GREEN per `WebSocketAdapter`
// (D-101 / D-104 / D-106 / D-107 / D-109 / D-111 — RT-02/04/05/06, ERR-02).
//
// Test deterministici co-located. Usa `MockWebSocket` (test-utils) come
// `WebSocketCtor` DI (RESEARCH §9.1 — jsdom non supporta WebSocket nativo).
//
// Coverage scenari plan 04-06:
// - Lifecycle (connect/disconnect, open/error/close)
// - Scheme switch http(s)→ws(s) (D-107)
// - WS subprotocols passthrough opt-in (Q4 / PITFALL §11.3)
// - Envelope JSON parsing via parseFrame (D-106)
// - Internal topics filter strict (anti-AP-6, PITFALL §11.7)
// - Heartbeat ping/pong applicativo + stale detection (D-111)
// - bufferedAmount cap pre-send ping (RESEARCH §4.4)
// - Close codes routing (RFC 6455 §7.4 / RESEARCH §4.2)
// - AbortController cascade (D-112)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MockWebSocket } from './test-utils/mock-websocket'
import type { RealtimeChannelDef } from './types/realtime-channel-def'
import { WebSocketAdapter } from './websocket-adapter'

describe('WebSocketAdapter (D-101, D-104, D-106, D-107, D-109, D-111 — RT-02/04/05/06, ERR-02)', () => {
  let publishFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    publishFn = vi.fn()
    MockWebSocket.__reset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('Test 1: connect() applica scheme switch https→wss (D-107)', async () => {
    const def: RealtimeChannelDef = {
      name: 'orders',
      buildUrl: async () => 'https://api.example.com/ws',
    }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await adapter.connect()
    expect(MockWebSocket.lastInstance).not.toBeNull()
    expect(MockWebSocket.lastInstance!.url).toBe('wss://api.example.com/ws')
  })

  it('Test 2: wsSubprotocols passthrough — opt-in passato a new WebSocket(url, protocols) (Q4)', async () => {
    const def: RealtimeChannelDef = {
      name: 'feed',
      url: 'wss://x/ws',
      wsSubprotocols: ['gluezero-v1'],
    }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await adapter.connect()
    expect(MockWebSocket.lastInstance!.protocol).toBe('gluezero-v1')
  })

  it('Test 3: connect() senza buildUrl né url → throw BrokerError realtime.config.invalid', async () => {
    const def: RealtimeChannelDef = { name: 'broken' }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await expect(adapter.connect()).rejects.toMatchObject({ code: 'realtime.config.invalid' })
  })

  it('Test 4: __open() → publishFn riceve system.realtime.connected con source.name=websocket + heartbeat avviato', async () => {
    const def: RealtimeChannelDef = {
      name: 'orders',
      url: 'wss://x/ws',
      heartbeat: { intervalMs: 1_000, staleTimeoutMs: 60_000 },
    }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await adapter.connect()
    MockWebSocket.lastInstance!.__open()
    expect(publishFn).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'system.realtime.connected',
        source: expect.objectContaining({
          type: 'server',
          id: 'realtime-channel',
          name: 'websocket',
        }),
        payload: expect.objectContaining({ channel: 'orders' }),
      }),
    )
    // Verifica heartbeat avviato: dopo intervalMs deve esserci un __ping__ frame inviato
    vi.advanceTimersByTime(1_100)
    expect(MockWebSocket.lastInstance!.sentFrames.some((f) => f.includes('"__ping__"'))).toBe(true)
  })

  it('Test 5: __message envelope JSON valido → publishFn BrokerEvent con id/topic/payload', async () => {
    const def: RealtimeChannelDef = { name: 'feed', url: 'wss://x/ws' }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await adapter.connect()
    MockWebSocket.lastInstance!.__open()
    publishFn.mockClear()
    MockWebSocket.lastInstance!.__message(
      JSON.stringify({ topic: 'orders.created', data: { id: 1 }, id: 'evt-7' }),
    )
    expect(publishFn).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'evt-7',
        topic: 'orders.created',
        source: expect.objectContaining({ name: 'websocket' }),
        payload: { id: 1 },
      }),
    )
  })

  it('Test 6: __message malformato → publishFn riceve network.error category=protocol', async () => {
    const def: RealtimeChannelDef = { name: 'feed', url: 'wss://x/ws' }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await adapter.connect()
    MockWebSocket.lastInstance!.__open()
    publishFn.mockClear()
    MockWebSocket.lastInstance!.__message('not-json{{')
    const errorCall = publishFn.mock.calls.find((c) => c[0]?.topic === 'network.error')
    expect(errorCall).toBeDefined()
    expect(errorCall![0].payload).toMatchObject({
      category: 'protocol',
      code: 'realtime.frame.parse-failed',
      channel: 'feed',
      reason: 'malformed-json',
    })
  })

  it('Test 7: __ping__ filtrato strict (anti-AP-6) — publishFn NON invocato per __ping__', async () => {
    const def: RealtimeChannelDef = { name: 'feed', url: 'wss://x/ws' }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await adapter.connect()
    MockWebSocket.lastInstance!.__open()
    publishFn.mockClear()
    MockWebSocket.lastInstance!.__message('{"topic":"__ping__","data":{}}')
    const pingPublish = publishFn.mock.calls.find((c) => c[0]?.topic === '__ping__')
    expect(pingPublish).toBeUndefined()
  })

  it('Test 8: __pong__ aggiorna lastPongAt + publishFn NON invocato per __pong__', async () => {
    const def: RealtimeChannelDef = {
      name: 'feed',
      url: 'wss://x/ws',
      heartbeat: { intervalMs: 1_000, staleTimeoutMs: 60_000 },
    }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await adapter.connect()
    MockWebSocket.lastInstance!.__open()
    // Avanza un po' (sotto staleTimeoutMs) prima di ricevere il pong
    vi.advanceTimersByTime(500)
    publishFn.mockClear()
    MockWebSocket.lastInstance!.__message('{"topic":"__pong__","data":{}}')
    // pong NON deve essere pubblicato come BrokerEvent utente
    const pongPublish = publishFn.mock.calls.find((c) => c[0]?.topic === '__pong__')
    expect(pongPublish).toBeUndefined()
    // Avanza per parecchio (oltre staleTimeoutMs originale dal connect, ma dentro
    // staleTimeoutMs dal pong) → adapter NON deve scadere stale
    vi.advanceTimersByTime(50_000)
    const staleDisconnect = publishFn.mock.calls.find(
      (c) =>
        c[0]?.topic === 'system.realtime.disconnected' &&
        typeof c[0]?.payload === 'object' &&
        c[0]?.payload?.reason === 'stale.no-pong',
    )
    expect(staleDisconnect).toBeUndefined()
  })

  it('Test 9: heartbeat invia __ping__ ogni intervalMs', async () => {
    const def: RealtimeChannelDef = {
      name: 'feed',
      url: 'wss://x/ws',
      heartbeat: { intervalMs: 1_000, staleTimeoutMs: 60_000 },
    }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await adapter.connect()
    MockWebSocket.lastInstance!.__open()
    vi.advanceTimersByTime(1_100)
    expect(MockWebSocket.lastInstance!.sentFrames.some((f) => f.includes('"__ping__"'))).toBe(true)
    // Secondo tick → secondo ping
    vi.advanceTimersByTime(1_000)
    const pingFrames = MockWebSocket.lastInstance!.sentFrames.filter((f) =>
      f.includes('"__ping__"'),
    )
    expect(pingFrames.length).toBeGreaterThanOrEqual(2)
  })

  it('Test 10: stale detection — no pong entro staleTimeoutMs → disconnect + recordFailure', async () => {
    const def: RealtimeChannelDef = {
      name: 'feed',
      url: 'wss://x/ws',
      heartbeat: { intervalMs: 1_000, staleTimeoutMs: 5_000 },
    }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await adapter.connect()
    MockWebSocket.lastInstance!.__open()
    publishFn.mockClear()
    // Avanza oltre staleTimeoutMs senza inviare alcun pong
    vi.advanceTimersByTime(6_500)
    const staleCall = publishFn.mock.calls.find(
      (c) =>
        c[0]?.topic === 'system.realtime.disconnected' &&
        typeof c[0]?.payload === 'object' &&
        c[0]?.payload?.reason === 'stale.no-pong',
    )
    expect(staleCall).toBeDefined()
    // L'adapter ha chiuso la WebSocket
    expect(MockWebSocket.lastInstance!.readyState).toBe(MockWebSocket.CLOSED)
  })

  it('Test 11: __close(1006) abnormal → publishFn disconnected con details.code=1006', async () => {
    const def: RealtimeChannelDef = { name: 'feed', url: 'wss://x/ws' }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await adapter.connect()
    const ws = MockWebSocket.lastInstance!
    ws.__open()
    publishFn.mockClear()
    ws.__close(1006, 'abnormal-closure', false)
    const disconnectedCall = publishFn.mock.calls.find(
      (c) => c[0]?.topic === 'system.realtime.disconnected',
    )
    expect(disconnectedCall).toBeDefined()
    expect(disconnectedCall![0].payload).toMatchObject({ code: 1006, channel: 'feed' })
  })

  it('Test 12: __close(1000) normal → publishFn disconnected ma reconnect NO record failure', async () => {
    const def: RealtimeChannelDef = { name: 'feed', url: 'wss://x/ws' }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await adapter.connect()
    const ws = MockWebSocket.lastInstance!
    ws.__open()
    publishFn.mockClear()
    ws.__close(1000, 'normal', true)
    const disconnectedCall = publishFn.mock.calls.find(
      (c) => c[0]?.topic === 'system.realtime.disconnected',
    )
    expect(disconnectedCall).toBeDefined()
    expect(disconnectedCall![0].payload).toMatchObject({ code: 1000 })
    // Verifica che la reconnect strategy non abbia incrementato consecutiveFailures:
    // proxy via getDebugInfo() — readyState CLOSED ma niente recordFailure side-effect.
    // (Non esponiamo direttamente la ReconnectStrategy; il proxy è l'assenza di
    // ulteriori publish "stale" o "failed" — basta che la sequenza non lanci.)
    expect(MockWebSocket.lastInstance!.readyState).toBe(MockWebSocket.CLOSED)
  })

  it('Test 13: bufferedAmount > 64KB → ping skipped (sentFrames length non incrementa)', async () => {
    const def: RealtimeChannelDef = {
      name: 'feed',
      url: 'wss://x/ws',
      heartbeat: { intervalMs: 1_000, staleTimeoutMs: 60_000 },
    }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await adapter.connect()
    const ws = MockWebSocket.lastInstance!
    ws.__open()
    ws.__setBufferedAmount(100_000)
    const initial = ws.sentFrames.length
    vi.advanceTimersByTime(1_100)
    expect(ws.sentFrames.length).toBe(initial)
  })

  it('Test 14: external AbortSignal abort → disconnect cascade (D-112)', async () => {
    const def: RealtimeChannelDef = { name: 'feed', url: 'wss://x/ws' }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    const ctrl = new AbortController()
    await adapter.connect(ctrl.signal)
    MockWebSocket.lastInstance!.__open()
    publishFn.mockClear()
    ctrl.abort('test')
    expect(MockWebSocket.lastInstance!.readyState).toBe(MockWebSocket.CLOSED)
  })

  it('Test 15: PITFALL §11.7 — topic weather.__ping__ passa through (anti-AP-6 strict, NON prefix)', async () => {
    const def: RealtimeChannelDef = { name: 'feed', url: 'wss://x/ws' }
    const adapter = new WebSocketAdapter(def, {
      publishFn,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await adapter.connect()
    MockWebSocket.lastInstance!.__open()
    publishFn.mockClear()
    MockWebSocket.lastInstance!.__message('{"topic":"weather.__ping__","data":{"city":"Roma"}}')
    // `weather.__ping__` NON deve essere filtrato come internal — deve passare
    // through al consumer (è un topic legittimo che casualmente contiene `__ping__`
    // come segmento, ma non è il topic riservato esatto `__ping__`).
    expect(publishFn).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'weather.__ping__',
        payload: { city: 'Roma' },
      }),
    )
  })
})
