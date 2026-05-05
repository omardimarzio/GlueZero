// Test suite per `public-factory.ts` — copre `createBroker(config)` factory
// (D-18 config validation, D-19 imperative API, D-30 no singleton) e
// le acceptance criteria pubbliche della classe `Broker` esposta:
// D-28 getDebugSnapshot, D-29 enableDebug/disableDebug, CORE-03 getTopicRegistry.
//
// Pattern RED: import da './public-factory' fallisce per modulo mancante (gate verificato).

import { describe, expect, it } from 'vitest'
import { Broker } from './core/broker'
import { createBroker } from './public-factory'

describe('createBroker', () => {
  it('returns a Broker instance with empty config', () => {
    const broker = createBroker()
    expect(broker).toBeInstanceOf(Broker)
  })

  it('returns independent instances (D-30 no singleton)', () => {
    const a = createBroker()
    const b = createBroker()
    expect(a).not.toBe(b)
  })

  it('accepts valid runtime.logLevel', () => {
    expect(() => createBroker({ runtime: { logLevel: 'debug' } })).not.toThrow()
    expect(() => createBroker({ runtime: { logLevel: 'silent' } })).not.toThrow()
    expect(() => createBroker({ runtime: { logLevel: 'trace' } })).not.toThrow()
  })

  it('throws on invalid runtime.logLevel (D-18)', () => {
    expect(() => createBroker({ runtime: { logLevel: 'invalid' as unknown as 'info' } })).toThrow(
      /Invalid BrokerConfig/,
    )
  })

  it('accepts F2-F6 placeholder sections as unknown via looseObject pass-through (CORE-14)', () => {
    // F1 BrokerConfig.topicSchemas è ancora `unknown` placeholder.
    // F2-F6 sezioni (canonicalModel, aliasRegistry, transforms, routes, transport, workers, cache)
    // sono aggiunte via TS declaration merging dai package downstream (D-56). Senza augment,
    // qui le passiamo come extra-prop che `v.looseObject` accetta (cast esplicito a
    // `unknown as BrokerConfig` per bypass del TS type-check del literal — è esattamente
    // ciò che fa il consumer F2 dopo aver fatto `import '@gluezero/mapper'`).
    const cfg = {
      topicSchemas: { x: 1 },
      canonicalModel: { y: 2 },
      aliasRegistry: { z: 3 },
      transforms: {},
      routes: [],
      transport: { http: {} },
      workers: { pool: 4 },
      cache: { ttl: 1000 },
    } as unknown as Parameters<typeof createBroker>[0]
    expect(() => createBroker(cfg)).not.toThrow()
  })

  it('accepts runtime config with all F1 fields', () => {
    expect(() =>
      createBroker({
        runtime: {
          debug: true,
          deepFreezeInDev: true,
          logLevel: 'silent',
        },
        debug: {
          enabled: true,
          snapshotPayloadsFull: false,
        },
      }),
    ).not.toThrow()
  })
})

describe('Broker — public API surface (via createBroker)', () => {
  it('Broker.publish + subscribe end-to-end (CORE-01 sanity)', () => {
    const broker = createBroker({ runtime: { logLevel: 'silent' } })
    const received: unknown[] = []
    broker.subscribe('test.topic', (e) => {
      received.push(e.payload)
    })
    broker.publish(
      'test.topic',
      { x: 1 },
      { source: { type: 'plugin', id: 'p1' }, deliveryMode: 'sync' },
    )
    expect(received).toEqual([{ x: 1 }])
  })

  it('Broker.getDebugSnapshot returns expected shape (D-28)', () => {
    const broker = createBroker({ runtime: { logLevel: 'silent' } })
    const snap = broker.getDebugSnapshot()
    expect(snap).toHaveProperty('topics')
    expect(snap).toHaveProperty('subscriberCount')
    expect(snap).toHaveProperty('pluginIds')
    expect(snap).toHaveProperty('pendingAsyncDelivery')
    expect(snap).toHaveProperty('logLevel')
    expect(snap).toHaveProperty('pipelineSteps')
    expect(snap.pipelineSteps).toEqual([
      'event.received',
      'event.metadata.enriched',
      'event.validated',
      'event.dedupe.checked',
      'event.delivered',
    ])
    expect(snap.logLevel).toBe('silent')
    expect(Array.isArray(snap.topics)).toBe(true)
    expect(Array.isArray(snap.pluginIds)).toBe(true)
    expect(snap.pendingAsyncDelivery).toBe(0)
  })

  it('enableDebug/disableDebug toggle does not throw (D-29)', () => {
    const broker = createBroker({ runtime: { logLevel: 'silent', debug: false } })
    broker.enableDebug()
    broker.disableDebug()
    expect(true).toBe(true)
  })

  it('getTopicRegistry returns published topics (CORE-03)', () => {
    const broker = createBroker({ runtime: { logLevel: 'silent' } })
    broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p1' }, deliveryMode: 'sync' })
    broker.publish('c.d', {}, { source: { type: 'plugin', id: 'p1' }, deliveryMode: 'sync' })
    const topics = broker.getTopicRegistry()
    expect(topics).toContain('a.b')
    expect(topics).toContain('c.d')
  })

  it('Broker.registerPlugin + unregisterPlugin lifecycle (CORE-04, CORE-05)', async () => {
    const broker = createBroker({ runtime: { logLevel: 'silent' } })
    const order: string[] = []
    await broker.registerPlugin({
      id: 'p1',
      onRegister: () => {
        order.push('register')
      },
      onMount: () => {
        order.push('mount')
      },
      onUnmount: () => {
        order.push('unmount')
      },
      onDestroy: () => {
        order.push('destroy')
      },
    })
    expect(order).toEqual(['register', 'mount'])
    expect(broker.getDebugSnapshot().pluginIds).toContain('p1')
    await broker.unregisterPlugin('p1')
    expect(order).toEqual(['register', 'mount', 'unmount', 'destroy'])
    expect(broker.getDebugSnapshot().pluginIds).not.toContain('p1')
  })

  it('Plugin scoped subscribe → cascade unsubscribe on unregisterPlugin (LIFE-02)', async () => {
    const broker = createBroker({ runtime: { logLevel: 'silent' } })
    await broker.registerPlugin({
      id: 'plug-a',
      onMount: (ctx) => {
        // Plugin uses scoped broker — ownerId auto-tagged
        const scoped = ctx.broker as {
          subscribe: (pattern: string, handler: () => void) => unknown
        }
        scoped.subscribe('topic.x', () => {})
        scoped.subscribe('topic.y', () => {})
      },
    })
    expect(broker.getDebugSnapshot().topics.length).toBe(2)
    await broker.unregisterPlugin('plug-a')
    // D-26 point 1 cascade: subscriptions removed
    expect(broker.getDebugSnapshot().topics.length).toBe(0)
  })

  it('Broker.setLogger swaps logger', () => {
    const broker = createBroker({ runtime: { logLevel: 'silent' } })
    const customLogger = {
      error: () => {},
      warn: () => {},
      info: () => {},
      debug: () => {},
      trace: () => {},
    }
    expect(() => broker.setLogger(customLogger)).not.toThrow()
  })
})
