// realtime-broker.test.ts — unit test del composition wrapper `RealtimeBroker`
// (D-101 / D-103 / D-112).
//
// Pattern test BEHAVIOR-VERIFICATING (B-3 closure post-revisione iter 2):
// - Tutti i test asseriscono side-effect osservabili (getDebugSnapshot,
//   subscribe callback ricevuto), mai presence-only `expect(typeof fn).toBe('function')`.
// - I test che richiedono SSE iniettano `MockEventSource` via `globalThis.EventSource`
//   patch + try/finally restore (pattern identico a realtime-harness ma puntuale per
//   evitare cross-test pollution).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RealtimeBroker } from './realtime-broker'
import { MockEventSource } from './test-utils/mock-event-source'

type GlobalES = { EventSource?: typeof EventSource }

function patchEventSource(): () => void {
  const original = (globalThis as GlobalES).EventSource
  ;(globalThis as GlobalES).EventSource = MockEventSource as unknown as typeof EventSource
  MockEventSource.__reset()
  return () => {
    ;(globalThis as GlobalES).EventSource = original
    MockEventSource.__reset()
  }
}

describe('RealtimeBroker (D-101 composition + D-103 + D-112)', () => {
  let restoreES: () => void

  beforeEach(() => {
    restoreES = patchEventSource()
  })

  afterEach(() => {
    restoreES()
  })

  it('Test 1 (D-101): constructor compone RouterBroker e accetta config vuota', async () => {
    const broker = new RealtimeBroker()
    // BEHAVIOR: il broker espone API publish + subscribe + connectRealtime
    // (delegate al RouterBroker inner + manager). Side-effect verifico via
    // publish/subscribe round-trip per confermare wiring del compose.
    let received: { topic: string; payload: unknown } | null = null
    broker.subscribe('test.topic', (ev: { topic: string; payload: unknown }) => {
      received = { topic: ev.topic, payload: ev.payload }
    })
    // F1 default deliveryMode='async' → microtask dispatch. Use 'sync' per test
    // deterministic — pattern coerente con F2/F3 unit test.
    broker.publish('test.topic', { value: 42 }, {
      source: { type: 'plugin', id: 'unit' },
      deliveryMode: 'sync',
    })
    expect(received).not.toBeNull()
    expect(received!.topic).toBe('test.topic')
    expect(received!.payload).toEqual({ value: 42 })
  })

  it('Test 2 (D-102 B-3): connectRealtime registra canale con ownerId="system" — verificato via getDebugSnapshot', async () => {
    const broker = new RealtimeBroker()
    await broker.connectRealtime({
      name: 'main',
      mode: 'sse',
      url: 'http://x/?_channel=main',
    })
    const snap = broker.getDebugSnapshot()
    const channel = snap.realtime.channels.find((c) => c.name === 'main')
    expect(channel).toBeDefined()
    expect(channel!.ownerId).toBe('system')
  })

  it('Test 3 (D-103): registerPlugin auto-registra realtimeChannels con ownerId=plugin.id', async () => {
    const broker = new RealtimeBroker()
    await broker.registerPlugin({
      id: 'orders-plugin',
      realtimeChannels: [
        { name: 'orders.feed', mode: 'sse', url: 'http://x/?_channel=orders.feed' },
      ],
    })
    const snap = broker.getDebugSnapshot()
    const channel = snap.realtime.channels.find((c) => c.name === 'orders.feed')
    expect(channel).toBeDefined()
    expect(channel!.ownerId).toBe('orders-plugin')
  })

  it('Test 4 (D-112 cascade): unregisterPlugin chiude SOLO i canali del plugin', async () => {
    const broker = new RealtimeBroker()
    await broker.registerPlugin({
      id: 'p1',
      realtimeChannels: [
        { name: 'p1.feed', mode: 'sse', url: 'http://x/?_channel=p1.feed' },
      ],
    })
    await broker.registerPlugin({
      id: 'p2',
      realtimeChannels: [
        { name: 'p2.feed', mode: 'sse', url: 'http://x/?_channel=p2.feed' },
      ],
    })
    await broker.unregisterPlugin('p1')
    const snap = broker.getDebugSnapshot()
    expect(snap.realtime.channels.find((c) => c.name === 'p1.feed')).toBeUndefined()
    expect(snap.realtime.channels.find((c) => c.name === 'p2.feed')).toBeDefined()
  })

  it('Test 5 (D-102 bootstrap): config.realtime.channels istanziati al constructor', async () => {
    const broker = new RealtimeBroker({
      realtime: {
        channels: [{ name: 'auto-1', mode: 'sse', url: 'http://x/?_channel=auto-1' }],
      },
    })
    // Bootstrap fire-and-forget — attendi microtask per consentire la registrazione.
    await new Promise((r) => queueMicrotask(r))
    const snap = broker.getDebugSnapshot()
    const channel = snap.realtime.channels.find((c) => c.name === 'auto-1')
    expect(channel).toBeDefined()
    expect(channel!.ownerId).toBe('system')
  })

  it('Test 6 (composition passthrough): publish delegate a inner.publish', () => {
    const broker = new RealtimeBroker()
    let received: unknown = null
    broker.subscribe('test.x', (ev: { payload: unknown }) => {
      received = ev.payload
    })
    broker.publish('test.x', { value: 1 }, {
      source: { type: 'plugin', id: 'test' },
      deliveryMode: 'sync',
    })
    expect(received).toEqual({ value: 1 })
  })

  it('Test 7 (D-102): disconnectRealtime() chiude tutti i canali', async () => {
    const broker = new RealtimeBroker()
    await broker.registerPlugin({
      id: 'p',
      realtimeChannels: [
        { name: 'a', mode: 'sse', url: 'http://x/?_channel=a' },
        { name: 'b', mode: 'sse', url: 'http://x/?_channel=b' },
      ],
    })
    expect(broker.getDebugSnapshot().realtime.channelCount).toBe(2)
    broker.disconnectRealtime()
    expect(broker.getDebugSnapshot().realtime.channelCount).toBe(0)
  })

  it('Test 8 (debug surface): getDebugSnapshot include sezione realtime + inner', () => {
    const broker = new RealtimeBroker()
    const snap = broker.getDebugSnapshot()
    expect(snap).toHaveProperty('inner')
    expect(snap).toHaveProperty('realtime')
    expect(snap.realtime).toHaveProperty('channelCount')
    expect(snap.realtime).toHaveProperty('visibilityActive')
    expect(snap.realtime).toHaveProperty('channels')
  })

  it('Test 9 (D-103 no side-effect): registerPlugin senza realtimeChannels — manager invariato', async () => {
    const broker = new RealtimeBroker()
    await broker.registerPlugin({ id: 'no-channels' })
    expect(broker.getDebugSnapshot().realtime.channelCount).toBe(0)
  })

  it('Test 10 (D-112 idempotency): unregisterPlugin di plugin senza channels non throw', async () => {
    const broker = new RealtimeBroker()
    await broker.registerPlugin({ id: 'p' })
    await expect(broker.unregisterPlugin('p')).resolves.toBeUndefined()
  })

  it('Test 11 (W-1 source preservation): subscriber riceve event.source.type="server" + name="sse" end-to-end', async () => {
    const broker = new RealtimeBroker()
    await broker.connectRealtime({
      name: 'orders',
      mode: 'sse',
      url: 'http://x/?_channel=orders',
    })
    const captured: Array<{ topic: string; source?: unknown }> = []
    broker.subscribe('orders', (ev: { topic: string; source?: unknown; payload: unknown }) => {
      captured.push({ topic: ev.topic, source: ev.source })
    })
    const es = MockEventSource.byChannelName.get('orders')
    expect(es).toBeDefined()
    es!.__open()
    es!.__message('{"x":1}', 'evt-1', 'message')
    // F1 default deliveryMode='async' → flush microtasks per consentire dispatch.
    await new Promise((r) => setTimeout(r, 10))
    const evt = captured.find((c) => c.topic === 'orders')
    expect(evt).toBeDefined()
    // W-1 closure: source preserved end-to-end (D-113 ingress + Broker.publish options.source).
    expect(evt!.source).toMatchObject({ type: 'server', name: 'sse' })
  })

  it('Test 12 (W-5): registerPlugin con realtimeChannel duplicate → publish system.warn, plugin still registered', async () => {
    const broker = new RealtimeBroker()
    const warns: Array<{ payload: unknown }> = []
    broker.subscribe('system.warn', (ev: { payload: unknown }) => {
      warns.push({ payload: ev.payload })
    })
    await broker.registerPlugin({
      id: 'p1',
      realtimeChannels: [
        { name: 'dup', mode: 'sse', url: 'http://x/?_channel=dup' },
      ],
    })
    // Stesso `name: 'dup'` → secondo connect throw → system.warn published.
    await broker.registerPlugin({
      id: 'p2',
      realtimeChannels: [
        { name: 'dup', mode: 'sse', url: 'http://x/?_channel=dup' },
      ],
    })
    // Flush microtasks per consentire dispatch async della publish.
    await new Promise((r) => setTimeout(r, 10))
    // W-5 closure: niente silent catch, system.warn emesso.
    expect(warns.length).toBeGreaterThanOrEqual(1)
    const reasons = warns.map((w) => (w.payload as { reason?: string }).reason)
    expect(reasons).toContain('realtime-channel-register-failed')
    // Verifica che il primo plugin abbia comunque il canale `dup` registrato (graceful degrade).
    const snap = broker.getDebugSnapshot()
    expect(snap.realtime.channels.find((c) => c.name === 'dup' && c.ownerId === 'p1')).toBeDefined()
  })
})
