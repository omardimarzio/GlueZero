// realtime-channel-manager.test.ts — TDD RED→GREEN per `RealtimeChannelManager`
// (D-102 / D-110 / D-112 — RT-01/02/03/04/05, ERR-02).
//
// Test deterministici co-located. Usa `MockEventSource` + `MockWebSocket` (test-utils)
// come `EventSourceCtor` / `WebSocketCtor` DI (RESEARCH §9.1 — jsdom non supporta
// EventSource/WebSocket nativi). Mock Document custom per visibility detector test.
//
// Coverage scenari plan 04-07:
// - Lazy init Visibility detector al primo connect (D-110).
// - Factory dispatch per def.mode (sse / websocket / auto → sse).
// - Duplicate guard `realtime.channel.duplicate`.
// - Cascade cleanup `disconnectByOwner` (D-112) — pattern http-gateway abortInFlightByOwner.
// - Teardown visibility automatico al last disconnect.
// - `getDebugInfo()` shape.
// - **B-4 closure D-107 auto-fallback effettivo:** dopo N fail SSE, runReconnectLoop
//   rebinda a WebSocketAdapter (MockWebSocket istanziato).
// - **B-4 cycle-cap:** maxAttempts esaurito → publishFn riceve `system.realtime.failed`
//   con `reason: 'cycle-cap-exceeded'`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  RealtimeChannelManager,
  type RealtimeManagerClock,
} from './realtime-channel-manager'
import { MockEventSource } from './test-utils/mock-event-source'
import { MockWebSocket } from './test-utils/mock-websocket'
import type { RealtimeChannelDef } from './types/realtime-channel-def'

/**
 * Helper: crea un mock `Document` minimale per VisibilityDetector test.
 * Espone `__setState` per cambiare lo stato e `__dispatch` per triggerare la
 * `visibilitychange` listener registrata.
 */
function makeMockDoc(): Document & {
  __setState: (s: 'visible' | 'hidden') => void
  __dispatch: () => void
  __listenerCount: () => number
} {
  const listeners = new Set<EventListener>()
  let state: 'visible' | 'hidden' = 'visible'
  return {
    get visibilityState() {
      return state
    },
    addEventListener: vi.fn((t: string, fn: EventListener) => {
      if (t === 'visibilitychange') listeners.add(fn)
    }),
    removeEventListener: vi.fn((t: string, fn: EventListener) => {
      if (t === 'visibilitychange') listeners.delete(fn)
    }),
    __setState(s: 'visible' | 'hidden') {
      state = s
    },
    __dispatch() {
      for (const fn of listeners) fn(new Event('visibilitychange'))
    },
    __listenerCount() {
      return listeners.size
    },
  } as unknown as Document & {
    __setState: (s: 'visible' | 'hidden') => void
    __dispatch: () => void
    __listenerCount: () => number
  }
}

/**
 * Helper: clock injection deterministico per `runReconnectLoop` test.
 * `sleep` resolve immediatamente — NESSUN setTimeout reale (test sync).
 */
function makeImmediateClock(): RealtimeManagerClock {
  return { sleep: () => Promise.resolve() }
}

describe('RealtimeChannelManager (D-102, D-110, D-112 — RT-01/02/03/04/05, ERR-02)', () => {
  let publishFn: ReturnType<typeof vi.fn>
  let mockDoc: ReturnType<typeof makeMockDoc>

  beforeEach(() => {
    publishFn = vi.fn()
    MockEventSource.__reset()
    MockWebSocket.__reset()
    mockDoc = makeMockDoc()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================================================
  // Test 1 — Constructor lazy init
  // ============================================================================
  it('Test 1: constructor non attiva visibility detector (lazy init D-110)', () => {
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    expect(m.getDebugInfo().visibilityActive).toBe(false)
    expect(m.getDebugInfo().channelCount).toBe(0)
    expect(mockDoc.__listenerCount()).toBe(0)
  })

  // ============================================================================
  // Test 2 — Factory dispatch SSE
  // ============================================================================
  it('Test 2: connect() mode=sse (default auto) → SseAdapter creato + visibility attiva', async () => {
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await m.connect({ name: 'orders', mode: 'sse', url: 'https://x/sse' })
    expect(MockEventSource.lastInstance).not.toBeNull()
    expect(MockWebSocket.lastInstance).toBeNull()
    expect(m.getDebugInfo().visibilityActive).toBe(true)
    expect(mockDoc.__listenerCount()).toBe(1)
  })

  // ============================================================================
  // Test 3 — Factory dispatch WS
  // ============================================================================
  it('Test 3: connect() mode=websocket → WebSocketAdapter creato', async () => {
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    })
    await m.connect({ name: 'feed', mode: 'websocket', url: 'wss://x/ws' })
    expect(MockWebSocket.lastInstance).not.toBeNull()
    expect(MockEventSource.lastInstance).toBeNull()
    const info = m.getDebugInfo()
    expect(info.channels[0]!.mode).toBe('websocket')
  })

  // ============================================================================
  // Test 4 — Duplicate name guard
  // ============================================================================
  it('Test 4: connect() duplicate name → throw realtime.channel.duplicate', async () => {
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await m.connect({ name: 'dup', mode: 'sse', url: 'https://x/sse' })
    await expect(
      m.connect({ name: 'dup', mode: 'sse', url: 'https://x/sse' }),
    ).rejects.toMatchObject({ code: 'realtime.channel.duplicate', category: 'config' })
  })

  // ============================================================================
  // Test 5 — Multi-channel registration with ownerId
  // ============================================================================
  it('Test 5: connect() N canali con stesso ownerId → tutti tracked', async () => {
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await m.connect({ name: 'a', url: 'https://x/sse' }, 'plugin-1')
    await m.connect({ name: 'b', url: 'https://x/sse' }, 'plugin-1')
    await m.connect({ name: 'c', url: 'https://x/sse' }, 'plugin-1')
    const info = m.getDebugInfo()
    expect(info.channelCount).toBe(3)
    expect(info.channels.every((c) => c.ownerId === 'plugin-1')).toBe(true)
  })

  // ============================================================================
  // Test 6 — Disconnect singolo (parziale, visibility ancora attiva)
  // ============================================================================
  it('Test 6: disconnect(name) chiude solo quel canale, visibility ancora attiva', async () => {
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await m.connect({ name: 'a', url: 'https://x/sse' })
    await m.connect({ name: 'b', url: 'https://x/sse' })
    m.disconnect('a')
    expect(m.getDebugInfo().channelCount).toBe(1)
    expect(m.getDebugInfo().channels[0]!.name).toBe('b')
    expect(m.getDebugInfo().visibilityActive).toBe(true)
  })

  // ============================================================================
  // Test 7 — Disconnect all + visibility teardown
  // ============================================================================
  it('Test 7: disconnect() (no arg) chiude tutti i canali + teardown visibility', async () => {
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await m.connect({ name: 'a', url: 'https://x/sse' })
    await m.connect({ name: 'b', url: 'https://x/sse' })
    expect(m.getDebugInfo().visibilityActive).toBe(true)
    m.disconnect()
    expect(m.getDebugInfo().channelCount).toBe(0)
    expect(m.getDebugInfo().visibilityActive).toBe(false)
    expect(mockDoc.__listenerCount()).toBe(0)
  })

  // ============================================================================
  // Test 8 — Cascade D-112 disconnectByOwner
  // ============================================================================
  it('Test 8: disconnectByOwner(ownerId) chiude solo canali del plugin (cascade D-112)', async () => {
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await m.connect({ name: 'a', url: 'https://x/sse' }, 'plugin-1')
    await m.connect({ name: 'b', url: 'https://x/sse' }, 'plugin-2')
    await m.connect({ name: 'c', url: 'https://x/sse' }, 'plugin-1')
    const closed = m.disconnectByOwner('plugin-1')
    expect(closed).toBe(2)
    expect(m.getDebugInfo().channelCount).toBe(1)
    expect(m.getDebugInfo().channels[0]!.ownerId).toBe('plugin-2')
    expect(m.getDebugInfo().channels[0]!.name).toBe('b')
  })

  // ============================================================================
  // Test 9 — disconnectByOwner non-existent
  // ============================================================================
  it('Test 9: disconnectByOwner(unknown) ritorna 0, no side effects', async () => {
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await m.connect({ name: 'a', url: 'https://x/sse' }, 'plugin-1')
    expect(m.disconnectByOwner('plugin-NOT-EXIST')).toBe(0)
    expect(m.getDebugInfo().channelCount).toBe(1)
  })

  // ============================================================================
  // Test 10 — Visibility on-visible callback invokes checkFreshnessAll
  // ============================================================================
  it('Test 10: visibility visible → checkFreshnessAll non crasha (canali fresh restano attivi)', async () => {
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await m.connect({ name: 'a', url: 'https://x/sse' })
    MockEventSource.lastInstance!.__open()
    // Stato già 'visible' alla mock init; trigger visibilitychange a 'visible' senza
    // staleness fa restare il canale (lastEventReceivedAt=0 → checkFreshness ritorna true).
    mockDoc.__setState('visible')
    mockDoc.__dispatch()
    expect(m.getDebugInfo().channelCount).toBe(1)
  })

  // ============================================================================
  // Test 11 — Auto-teardown visibility al last disconnect
  // ============================================================================
  it('Test 11: visibility detector teardown automatico al last disconnect', async () => {
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await m.connect({ name: 'a', url: 'https://x/sse' })
    expect(m.getDebugInfo().visibilityActive).toBe(true)
    m.disconnect('a')
    expect(m.getDebugInfo().visibilityActive).toBe(false)
    expect(mockDoc.__listenerCount()).toBe(0)
  })

  // ============================================================================
  // Test 12 — getDebugInfo shape
  // ============================================================================
  it('Test 12: getDebugInfo() shape — { channelCount, visibilityActive, channels: [{ name, ownerId, mode, debug }] }', async () => {
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await m.connect({ name: 'orders', url: 'https://x/sse' }, 'plugin-1')
    const info = m.getDebugInfo()
    expect(info.channelCount).toBe(1)
    expect(info.visibilityActive).toBe(true)
    expect(info.channels).toHaveLength(1)
    expect(info.channels[0]).toMatchObject({
      name: 'orders',
      ownerId: 'plugin-1',
      mode: 'sse',
    })
    // `debug` deve esistere e contenere la shape getDebugInfo dell'adapter SSE
    expect(info.channels[0]!.debug).toMatchObject({
      name: 'orders',
      mode: 'sse',
    })
  })

  // ============================================================================
  // Test 13 — B-4 closure D-107 auto-fallback effettivo
  //
  // Setup: `fallbackThreshold: 1` (per ridurre il numero di fail richiesti) e
  // mode='sse'. Il primo `connect()` riesce (MockEventSource), poi simuliamo
  // `__error()` → l'adapter chiama `recordFailure()` sulla SUA strategy interna,
  // ma il manager deve avere la SUA strategy, e il loop di reconnect si attiva
  // dopo che il manager rileva il disconnected.
  //
  // Il pattern semplificato per il test: forziamo il fallimento del FIRST connect
  // facendo throw a connect, e verifichiamo che runReconnectLoop venga invocato e
  // dopo `fallbackThreshold` fail, l'adapter venga rebinded a WebSocketAdapter.
  //
  // Approccio: usare un `EventSourceCtor` che throw nel constructor → connect()
  // fail → strategy.recordFailure() → runReconnectLoop. `fallbackThreshold: 1` →
  // shouldFallback() true al prossimo retry → fallback() → mode='websocket' →
  // nuovo adapter è MockWebSocket. Verifichiamo `MockWebSocket.lastInstance !== null`.
  // ============================================================================
  it('Test 13: B-4 D-107 auto-fallback — dopo fallbackThreshold fail SSE, runReconnectLoop rebinda a WebSocket', async () => {
    // EventSourceCtor che fallisce sempre nel constructor → simula connect failure persistente.
    // Wrap MockEventSource per fare throw al primo connect, e poi usare normale al fallback.
    let sseInvocations = 0
    class FailingMockEventSource extends MockEventSource {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init)
        sseInvocations += 1
        // Throw sempre — il manager attiverà runReconnectLoop.
        throw new Error('simulated SSE failure')
      }
    }

    const clock = makeImmediateClock()
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: FailingMockEventSource as unknown as typeof EventSource,
      WebSocketCtor: MockWebSocket as unknown as typeof WebSocket,
      clock,
    })

    // Override fallbackThreshold a 1 per accelerare il test; cap globale 5 default.
    await m.connect({
      name: 'orders',
      mode: 'sse',
      url: 'https://x/sse',
      reconnect: { fallbackThreshold: 1, maxAttempts: 10 },
    })

    // runReconnectLoop è async — diamo il tempo a tutte le microtask di completare.
    // Con clock immediate sleep e SSE fail persistente, il loop:
    //   - attempt 1 connect SSE: fail (record 1) → shouldFallback() true → fallback to WS
    //   - attempt 2 connect WS: success (MockWebSocket non throw) → recordSuccess + return
    // Aspettiamo flush microtasks.
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))

    // Asserzione B-4 closure: MockWebSocket istanziato dopo il fallback.
    expect(MockWebSocket.lastInstance).not.toBeNull()
    expect(sseInvocations).toBeGreaterThanOrEqual(1)

    // Lo state del canale deve riflettere mode='websocket' dopo il fallback.
    const info = m.getDebugInfo()
    expect(info.channels[0]!.mode).toBe('websocket')

    // publishFn deve aver ricevuto system.realtime.reconnecting (almeno 1) durante il loop.
    const reconnectingCalls = publishFn.mock.calls.filter(
      (c) => (c[0] as { topic: string }).topic === 'system.realtime.reconnecting',
    )
    expect(reconnectingCalls.length).toBeGreaterThanOrEqual(1)
  })

  // ============================================================================
  // Test 14 — B-4 cycle-cap exceeded
  //
  // Setup: `maxAttempts: 2` → dopo 2 fail consecutivi, strategy.isPermanentlyFailed()
  // ritorna true → runReconnectLoop publish `system.realtime.failed` con
  // reason='cycle-cap-exceeded'. Per forzare il path: EventSourceCtor + WebSocketCtor
  // entrambi failing.
  // ============================================================================
  it('Test 14: B-4 cycle-cap — maxAttempts esauriti → publish system.realtime.failed reason=cycle-cap-exceeded', async () => {
    class FailingMockEventSource extends MockEventSource {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init)
        throw new Error('simulated SSE failure')
      }
    }
    class FailingMockWebSocket extends MockWebSocket {
      constructor(url: string | URL, protocols?: string | readonly string[]) {
        super(url, protocols)
        throw new Error('simulated WS failure')
      }
    }

    const clock = makeImmediateClock()
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: FailingMockEventSource as unknown as typeof EventSource,
      WebSocketCtor: FailingMockWebSocket as unknown as typeof WebSocket,
      clock,
    })

    await m.connect({
      name: 'flaky',
      mode: 'sse',
      url: 'https://x/sse',
      reconnect: { fallbackThreshold: 1, maxAttempts: 2 },
    })

    // Flush microtasks più volte per permettere al loop di esaurire maxAttempts.
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setImmediate(resolve))
    }

    // publishFn deve aver ricevuto `system.realtime.failed` con reason cycle-cap-exceeded.
    const failedCalls = publishFn.mock.calls.filter(
      (c) => (c[0] as { topic: string }).topic === 'system.realtime.failed',
    )
    expect(failedCalls.length).toBeGreaterThanOrEqual(1)
    const failedEvent = failedCalls[0]![0] as { payload: { reason: string; channel: string } }
    expect(failedEvent.payload.reason).toBe('cycle-cap-exceeded')
    expect(failedEvent.payload.channel).toBe('flaky')
  })

  // ============================================================================
  // Test 15 — Manual disconnect blocca runReconnectLoop attivo
  //
  // Verifica: se l'utente chiama `disconnect(name)` mentre il loop sta retrying,
  // il loop si interrompe (entry.manuallyClosed=true → while-condition false).
  // ============================================================================
  it('Test 15: disconnect manuale durante runReconnectLoop interrompe il loop', async () => {
    let invocations = 0
    class FailingMockEventSource extends MockEventSource {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init)
        invocations += 1
        throw new Error('simulated SSE failure')
      }
    }

    const clock = makeImmediateClock()
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: FailingMockEventSource as unknown as typeof EventSource,
      clock,
    })

    await m.connect({
      name: 'aborted',
      mode: 'sse',
      url: 'https://x/sse',
      reconnect: { fallbackThreshold: 100, maxAttempts: 100 },
    })

    // Disconnect immediatamente — blocca il loop al prossimo check.
    m.disconnect('aborted')

    const invocationsBeforeFlush = invocations
    // Flush microtasks per dar tempo al loop di processare.
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setImmediate(resolve))
    }
    // Dopo il disconnect manuale, il loop deve essersi fermato — il counter non
    // dovrebbe crescere indefinitamente. Permettiamo +1 per la race tra check e
    // increment, ma non +5.
    expect(invocations - invocationsBeforeFlush).toBeLessThanOrEqual(1)
    expect(m.getDebugInfo().channelCount).toBe(0)
  })

  // ============================================================================
  // Test 16 — checkFreshnessAll chiama adapter.disconnect su canali stale
  // ============================================================================
  it('Test 16: checkFreshnessAll() invoca disconnect su canali stale', async () => {
    const m = new RealtimeChannelManager({
      publishFn,
      document: mockDoc,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
      staleTimeoutMs: 1, // forza staleness
    })
    await m.connect({ name: 'a', url: 'https://x/sse' })
    const adapter = MockEventSource.lastInstance!
    adapter.__open()
    adapter.__message('{"x":1}', 'evt-1')

    // Aspetta abbastanza perché lastEventReceivedAt diventi "vecchio".
    await new Promise((resolve) => setTimeout(resolve, 5))

    const closeSpy = vi.spyOn(adapter, 'close')
    m.checkFreshnessAll()
    expect(closeSpy).toHaveBeenCalled()
  })
})
