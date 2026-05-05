// augment.test.ts — verifica TS declaration merging F4 SSE/WS (D-101..D-104, D-115).
//
// Test prevalentemente compile-time: se `augment.ts` non esegue correttamente il
// declaration merging, il typecheck di questo file fallisce (TS error 2339 "Property X
// does not exist on type Y" o 2322 "Type X is not assignable to Y").
//
// Test runtime minimal: `__augmentSseWsLoaded` const verifica che il side-effect import
// non venga tree-shaken e non lanci errori a load time (T-04-01-01 mitigation).
//
// Pattern F3 gateway / F3 routing replicato (vedi packages/gateway/src/augment.test.ts e
// packages/routing/src/augment.test.ts).

import type { BrokerConfig, PluginDescriptor } from '@gluezero/core'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { __augmentSseWsLoaded, type F4PipelineStep } from './augment'
import type { RealtimeChannelDef } from './types/realtime-channel-def'
import type { RealtimeConfig } from './types/realtime-config'

describe('sse-ws/augment.ts (F4 TS declaration merging — plan 04-01)', () => {
  it('Test 1: __augmentSseWsLoaded marker is literal true (T-04-01-01 tree-shake guard)', () => {
    expect(__augmentSseWsLoaded).toBe(true)
  })

  it('Test 2: F4PipelineStep accetta i 3 literal definiti (D-113 ingress steps)', () => {
    const steps: F4PipelineStep[] = [
      'event.realtime.received',
      'event.realtime.frame-parsed',
      'event.realtime.reconnecting',
    ]
    expect(steps).toHaveLength(3)
    expect(steps[0]).toBe('event.realtime.received')
  })

  it('Test 3: BrokerConfig decl merging — realtime?: RealtimeConfig accetta channels (D-102)', () => {
    // Type-level assertion: dopo l'augmentation F4, la sezione `realtime` è tipizzata
    // `RealtimeConfig | undefined` (chiude placeholder F1). Smoke runtime sul literal.
    expectTypeOf<BrokerConfig>().toHaveProperty('realtime')
    expectTypeOf<BrokerConfig['realtime']>().toMatchTypeOf<RealtimeConfig | undefined>()

    const channelDef: RealtimeChannelDef = { name: 'orders', mode: 'auto' }
    const config: RealtimeConfig = { channels: [channelDef] }
    const cfg: BrokerConfig = { realtime: config }

    expect(cfg.realtime?.channels).toHaveLength(1)
    expect(cfg.realtime?.channels?.[0]?.name).toBe('orders')
    expect(cfg.realtime?.channels?.[0]?.mode).toBe('auto')
  })

  it('Test 4: BrokerConfig.realtime accetta defaults (reconnect/heartbeat/visibility) — D-109/D-110/D-111', () => {
    const cfgFull: BrokerConfig = {
      realtime: {
        defaults: {
          reconnect: { baseMs: 1_000, capMs: 30_000, fallbackThreshold: 3, globalCycleCap: 5 },
          heartbeat: { intervalMs: 30_000, staleTimeoutMs: 60_000 },
          visibility: { toleranceMultiplier: 3 },
        },
        channels: [
          {
            name: 'meteo',
            mode: 'sse',
            url: '/sse',
            eventTypes: ['weather.update', 'weather.alert'],
            sseHeartbeatEventTypes: ['heartbeat'],
          },
        ],
      },
    }
    expect(cfgFull.realtime?.defaults?.reconnect?.baseMs).toBe(1_000)
    expect(cfgFull.realtime?.defaults?.heartbeat?.staleTimeoutMs).toBe(60_000)
    expect(cfgFull.realtime?.defaults?.visibility?.toleranceMultiplier).toBe(3)
    expect(cfgFull.realtime?.channels?.[0]?.eventTypes).toHaveLength(2)
    expect(cfgFull.realtime?.channels?.[0]?.sseHeartbeatEventTypes).toEqual(['heartbeat'])
  })

  it('Test 5: PluginDescriptor decl merging — realtimeChannels è opzionale readonly (D-103, RT-01)', () => {
    expectTypeOf<PluginDescriptor>().toHaveProperty('realtimeChannels')
    expectTypeOf<PluginDescriptor['realtimeChannels']>().toMatchTypeOf<
      readonly RealtimeChannelDef[] | undefined
    >()

    const desc: PluginDescriptor = {
      id: 'orders-plugin',
      realtimeChannels: [
        {
          name: 'orders-stream',
          mode: 'auto',
          buildUrl: async () => '/events?token=abc',
          wsSubprotocols: ['gluezero-v1'],
        },
      ],
    }
    expect(desc.realtimeChannels).toHaveLength(1)
    expect(desc.realtimeChannels?.[0]?.name).toBe('orders-stream')
    expect(desc.realtimeChannels?.[0]?.wsSubprotocols).toEqual(['gluezero-v1'])
  })

  it('Test 6: PluginDescriptor without realtimeChannels still valid (backward-compat F1+F2+F3)', () => {
    // Il field `realtimeChannels` è opzionale — descriptor minimale F1 rimane valido
    // dopo l'augmentation F4 (T-04-01-03 mitigation: augmentation additive non-breaking).
    const desc: PluginDescriptor = { id: 'minimal' }
    expect(desc.realtimeChannels).toBeUndefined()
  })

  it('Test 7: BrokerConfig.realtime coexists with gateway/routing/canonicalModel sections (T-04-01-02)', () => {
    // Verifica che l'augment F4 non collida con augment F3 gateway, F3 routing, F2 mapper.
    // I 4 augment lavorano sulla stessa interface `BrokerConfig` ma su FIELD DISGIUNTI:
    // F2 (canonicalModel/aliasRegistry/transforms) + F3 routing (routes/routing) +
    // F3 gateway (gateway) + F4 (realtime) — TS unifica le declaration merging additive.
    const cfgAll: BrokerConfig = {
      runtime: { debug: false },
      canonicalModel: { schemas: [] },
      routes: [],
      routing: { multipleRoutesPolicy: 'first-match' },
      gateway: { auth: { getToken: async () => 'token' } },
      realtime: { channels: [{ name: 'orders' }] },
    }
    expect(cfgAll.canonicalModel?.schemas).toEqual([])
    expect(cfgAll.routes).toEqual([])
    expect(cfgAll.routing?.multipleRoutesPolicy).toBe('first-match')
    expect(cfgAll.gateway?.auth).toBeDefined()
    expect(cfgAll.realtime?.channels).toHaveLength(1)
  })

  it('Test 8: RealtimeChannelDef.backpressure accetta BackpressurePolicyConfig di F3 (D-115 riuso)', () => {
    // D-115: BackpressurePolicyConfig (F3 D-75) riusato 1:1 senza modifiche.
    const def: RealtimeChannelDef = {
      name: 'storm-channel',
      backpressure: { policy: 'queue-bounded', maxSize: 500 },
    }
    expect(def.backpressure?.policy).toBe('queue-bounded')
    if (def.backpressure?.policy === 'queue-bounded') {
      expect(def.backpressure.maxSize).toBe(500)
    }
  })
})
