// sse-adapter.test.ts — TDD RED→GREEN per `SseAdapter` (D-101 / D-104 / D-109 / D-113).
//
// Test deterministici co-located. Usa `MockEventSource` (test-utils) come
// `EventSourceCtor` DI (RESEARCH §9.1 — jsdom non supporta EventSource nativo).
//
// Coverage scenari plan 04-05:
// - Lifecycle (connect/disconnect, open/error)
// - Last-Event-ID injection via query string al re-connect (RESEARCH §3.2 / RT-07)
// - Custom event types W-4 SC-1 (chiusura ROADMAP scenario meteo `event: weather.update`)
// - Heartbeat eventTypes B-5 Q5 (server SSE freshness senza topic spam)
// - Topic validation regex F1 (RESEARCH §3.7 — invalid → network.error category protocol)
// - Backpressure DI (D-115)
// - AbortController cascade (D-112)
// - checkFreshness API per visibility orchestration (D-110)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SseAdapter } from './sse-adapter'
import { MockEventSource } from './test-utils/mock-event-source'
import type { RealtimeChannelDef } from './types/realtime-channel-def'

describe('SseAdapter (D-101, D-104, D-109, D-113 — RT-01/04/05/06/07, ERR-02)', () => {
  let publishFn: ReturnType<typeof vi.fn>

  beforeEach(() => {
    publishFn = vi.fn()
    MockEventSource.__reset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Test 1: connect() crea EventSource con URL da buildUrl + withCredentials true', async () => {
    const def: RealtimeChannelDef = {
      name: 'orders',
      buildUrl: async () => 'https://api.example.com/events',
    }
    const adapter = new SseAdapter(def, {
      publishFn,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await adapter.connect()
    expect(MockEventSource.lastInstance).not.toBeNull()
    expect(MockEventSource.lastInstance!.url).toBe('https://api.example.com/events')
    expect(MockEventSource.lastInstance!.withCredentials).toBe(true)
  })

  it('Test 2: connect() con url statico (no buildUrl) → MockEventSource creato con quello statico', async () => {
    const def: RealtimeChannelDef = { name: 'feed', url: 'https://static.example.com/sse' }
    const adapter = new SseAdapter(def, {
      publishFn,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await adapter.connect()
    expect(MockEventSource.lastInstance!.url).toBe('https://static.example.com/sse')
  })

  it('Test 3: connect() senza buildUrl né url → throw BrokerError realtime.config.invalid', async () => {
    const def: RealtimeChannelDef = { name: 'broken' }
    const adapter = new SseAdapter(def, {
      publishFn,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await expect(adapter.connect()).rejects.toMatchObject({ code: 'realtime.config.invalid' })
  })

  it('Test 4: __open() → publishFn riceve system.realtime.connected con source.name=sse', async () => {
    const def: RealtimeChannelDef = { name: 'orders', url: 'https://x/sse' }
    const adapter = new SseAdapter(def, {
      publishFn,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await adapter.connect()
    MockEventSource.lastInstance!.__open()
    expect(publishFn).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'system.realtime.connected',
        source: expect.objectContaining({ type: 'server', id: 'realtime-channel', name: 'sse' }),
        payload: expect.objectContaining({ channel: 'orders' }),
      }),
    )
  })

  it('Test 5: __message() default eventType=message → publishFn riceve BrokerEvent con id da lastEventId + topic = def.name', async () => {
    const def: RealtimeChannelDef = { name: 'feed', url: 'https://x/sse' }
    const adapter = new SseAdapter(def, {
      publishFn,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await adapter.connect()
    MockEventSource.lastInstance!.__open()
    publishFn.mockClear()
    MockEventSource.lastInstance!.__message('{"k":"v"}', 'evt-1', 'message')
    expect(publishFn).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'evt-1',
        topic: 'feed',
        source: expect.objectContaining({ name: 'sse' }),
      }),
    )
  })

  it('Test 6: lastEventId tracking — secondo connect appende ?lastEventId=evt-1 (RESEARCH §3.2 / RT-07)', async () => {
    const def: RealtimeChannelDef = { name: 'feed', buildUrl: async () => 'https://x/sse' }
    const adapter = new SseAdapter(def, {
      publishFn,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await adapter.connect()
    MockEventSource.lastInstance!.__message('{}', 'evt-1', 'message')
    adapter.disconnect()
    await adapter.connect()
    expect(MockEventSource.lastInstance!.url).toContain('lastEventId=evt-1')
  })

  it('Test 7: __error() → publishFn riceve system.realtime.disconnected + es.close (no native reconnect)', async () => {
    const def: RealtimeChannelDef = { name: 'orders', url: 'https://x/sse' }
    const adapter = new SseAdapter(def, {
      publishFn,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await adapter.connect()
    const es = MockEventSource.lastInstance!
    es.__open()
    publishFn.mockClear()
    es.__error()
    expect(es.readyState).toBe(MockEventSource.CLOSED)
    const disconnectedCall = publishFn.mock.calls.find(
      (c) => c[0]?.topic === 'system.realtime.disconnected',
    )
    expect(disconnectedCall).toBeDefined()
  })

  it('Test 8: backpressure DI — schedule invocato per message events (D-115)', async () => {
    const backpressure = {
      schedule: vi.fn(
        (_routeId: string, _pri: string, task: (signal?: AbortSignal) => Promise<unknown>) => task(),
      ),
      queueLength: vi.fn(() => 0),
    }
    const def: RealtimeChannelDef = { name: 'feed', url: 'https://x/sse' }
    const adapter = new SseAdapter(def, {
      publishFn,
      backpressure,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await adapter.connect()
    MockEventSource.lastInstance!.__open()
    publishFn.mockClear()
    backpressure.schedule.mockClear()
    MockEventSource.lastInstance!.__message('{}', undefined, 'message')
    expect(backpressure.schedule).toHaveBeenCalled()
    // Verify routeId è def.name e priority è 'normal'
    const firstCall = backpressure.schedule.mock.calls[0]!
    expect(firstCall[0]).toBe('feed')
    expect(firstCall[1]).toBe('normal')
  })

  it('Test 9: topic invalid (regex F1 fail) → publishFn riceve network.error category protocol, no crash', async () => {
    const def: RealtimeChannelDef = {
      name: 'feed',
      url: 'https://x/sse',
      eventTypes: ['WEATHER.UPDATE'], // Uppercase viola la regex F1 lowercase-only
    }
    const adapter = new SseAdapter(def, {
      publishFn,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await adapter.connect()
    MockEventSource.lastInstance!.__open()
    publishFn.mockClear()
    MockEventSource.lastInstance!.__message('{}', undefined, 'WEATHER.UPDATE')
    const errorCall = publishFn.mock.calls.find((c) => c[0]?.topic === 'network.error')
    expect(errorCall).toBeDefined()
    expect(errorCall![0].payload).toMatchObject({
      category: 'protocol',
      code: 'realtime.topic.invalid',
      channel: 'feed',
      rawTopic: 'WEATHER.UPDATE',
    })
  })

  it('Test 10: disconnect() chiude EventSource + publish disconnected', async () => {
    const def: RealtimeChannelDef = { name: 'feed', url: 'https://x/sse' }
    const adapter = new SseAdapter(def, {
      publishFn,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await adapter.connect()
    MockEventSource.lastInstance!.__open()
    const es = MockEventSource.lastInstance!
    publishFn.mockClear()
    adapter.disconnect()
    expect(es.readyState).toBe(MockEventSource.CLOSED)
    expect(publishFn).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'system.realtime.disconnected' }),
    )
  })

  it('Test 11: checkFreshness — < staleTimeoutMs ritorna true', async () => {
    const def: RealtimeChannelDef = { name: 'feed', url: 'https://x/sse' }
    const adapter = new SseAdapter(def, {
      publishFn,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await adapter.connect()
    expect(adapter.checkFreshness(60_000)).toBe(true)
    MockEventSource.lastInstance!.__message('{}', undefined, 'message')
    expect(adapter.checkFreshness(60_000)).toBe(true)
  })

  it('Test 12: external AbortSignal abort → disconnect cascade (D-112)', async () => {
    const def: RealtimeChannelDef = { name: 'feed', url: 'https://x/sse' }
    const adapter = new SseAdapter(def, {
      publishFn,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    const ctrl = new AbortController()
    await adapter.connect(ctrl.signal)
    MockEventSource.lastInstance!.__open()
    publishFn.mockClear()
    ctrl.abort('test')
    expect(MockEventSource.lastInstance!.readyState).toBe(MockEventSource.CLOSED)
  })

  it('Test 13: W-4 SC-1 closure — def.eventTypes=[weather.update] → topic=weather.update (NOT def.name)', async () => {
    const def: RealtimeChannelDef = {
      name: 'meteo',
      url: 'https://x/sse',
      eventTypes: ['weather.update'],
    }
    const adapter = new SseAdapter(def, {
      publishFn,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await adapter.connect()
    MockEventSource.lastInstance!.__open()
    publishFn.mockClear()
    // Server invia `event: weather.update\ndata: {"city":"Roma"}`
    MockEventSource.lastInstance!.__message('{"city":"Roma"}', 'evt-7', 'weather.update')
    expect(publishFn).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'weather.update', // NON 'meteo' (def.name)
        id: 'evt-7',
      }),
    )
    // Default 'message' listener NON registrato — un eventuale `event: message` non triggera publish utente
    publishFn.mockClear()
    MockEventSource.lastInstance!.__message('{"shouldNotPublish":true}', undefined, 'message')
    const messageCall = publishFn.mock.calls.find(
      (c) =>
        c[0]?.topic === 'meteo' &&
        c[0]?.payload &&
        typeof c[0].payload === 'object' &&
        'shouldNotPublish' in c[0].payload,
    )
    expect(messageCall).toBeUndefined()
  })

  it('Test 14: B-5 Q5 closure — sseHeartbeatEventTypes=[heartbeat] aggiorna lastEventReceivedAt SENZA publish', async () => {
    const def: RealtimeChannelDef = {
      name: 'feed',
      url: 'https://x/sse',
      // sseHeartbeatEventTypes default = ['heartbeat'] (omesso → fallback default)
    }
    const adapter = new SseAdapter(def, {
      publishFn,
      EventSourceCtor: MockEventSource as unknown as typeof EventSource,
    })
    await adapter.connect()
    MockEventSource.lastInstance!.__open()
    publishFn.mockClear()
    // Server invia `event: heartbeat` — adapter aggiorna freshness ma NON publish utente
    MockEventSource.lastInstance!.__message('', undefined, 'heartbeat')
    expect(publishFn).not.toHaveBeenCalled()
    expect(adapter.checkFreshness(60_000)).toBe(true)
  })
})
