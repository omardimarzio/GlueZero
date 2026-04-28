// Test suite per `plugin-registry.ts` — copre `PluginRegistry` class
// (CORE-04, CORE-05, CORE-11, LIFE-02 — chiusura PRD §39 #7) e
// `createPluginScopedBroker` helper (D-26 punto 1 enforcement).
//
// Scenari critici:
// - register(descriptor) invoca onRegister + onMount nell'ordine; final state mounted (D-25)
// - register con id duplicato → BrokerError code='plugin.id.duplicate' (D-17)
// - register con onRegister throw → rollback (state unmounted, plugin removed)
// - register con onMount throw → state failed, plugin RIMANE in registry per debug
// - unregister invoca onUnmount → cascade (unsubscribeByOwner + abort) → onDestroy
// - unregister id sconosciuto → BrokerError code='plugin.not-found'
// - CASCADE D-26 punto 1: subscription via createPluginScopedBroker auto-tagged → rimosse
// - CASCADE: AbortController firea (signal.aborted === true) DOPO onUnmount, DURING onDestroy
// - CASCADE procede anche se onUnmount throw (D-26 must always run)
// - createPluginScopedBroker propagates ownerId al bus.subscribe; delega altri metodi al root
//
// Pattern RED: import da './plugin-registry' fallisce per modulo mancante (gate verificato).

import { describe, expect, it, vi } from 'vitest'
import type { PluginContext, PluginDescriptor } from '../types/plugin'
import { isBrokerError } from './broker-error'
import { EventBus } from './bus'
import { noopEventTap } from './event-tap'
import { silentLogger } from './logger'
import { PluginRegistry, createPluginScopedBroker } from './plugin-registry'

const buildBus = (): EventBus => new EventBus(silentLogger, noopEventTap, { debug: false })

const buildContextFactory =
  (bus: EventBus): ((id: string, signal: AbortSignal) => PluginContext) =>
  (id, signal) => ({ id, logger: silentLogger, broker: bus as unknown, signal })

describe('PluginRegistry.register', () => {
  it('invokes onRegister then onMount in order; final state mounted (D-25)', async () => {
    const bus = buildBus()
    const reg = new PluginRegistry(bus, silentLogger, buildContextFactory(bus))
    const order: string[] = []
    const desc: PluginDescriptor = {
      id: 'p1',
      onRegister: () => {
        order.push('register')
      },
      onMount: () => {
        order.push('mount')
      },
    }
    await reg.register(desc)
    expect(order).toEqual(['register', 'mount'])
    expect(reg.get('p1')?.state).toBe('mounted')
  })

  it('passes PluginContext with id, logger, broker, signal', async () => {
    const bus = buildBus()
    const reg = new PluginRegistry(bus, silentLogger, buildContextFactory(bus))
    let captured: PluginContext | null = null
    await reg.register({
      id: 'p1',
      onRegister: (ctx) => {
        captured = ctx
      },
    })
    expect(captured).not.toBeNull()
    expect(captured?.id).toBe('p1')
    expect(captured?.logger).toBe(silentLogger)
    expect(captured?.signal).toBeInstanceOf(AbortSignal)
    expect(captured?.broker).toBeDefined()
  })

  it('throws plugin.id.duplicate (D-17) on second register with same id', async () => {
    const bus = buildBus()
    const reg = new PluginRegistry(bus, silentLogger, buildContextFactory(bus))
    await reg.register({ id: 'p1' })
    let caught: unknown = null
    try {
      await reg.register({ id: 'p1' })
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('plugin.id.duplicate')
  })

  it('rolls back when onRegister throws (state unmounted, plugin removed)', async () => {
    const bus = buildBus()
    const reg = new PluginRegistry(bus, silentLogger, buildContextFactory(bus))
    let caught: unknown = null
    try {
      await reg.register({
        id: 'p1',
        onRegister: () => {
          throw new Error('register-fail')
        },
      })
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect(reg.get('p1')).toBeUndefined()
  })

  it('marks failed when onMount throws; plugin remains in registry for debug', async () => {
    const bus = buildBus()
    const reg = new PluginRegistry(bus, silentLogger, buildContextFactory(bus))
    let caught: unknown = null
    try {
      await reg.register({
        id: 'p1',
        onMount: () => {
          throw new Error('mount-fail')
        },
      })
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect(reg.get('p1')?.state).toBe('failed')
  })
})

describe('PluginRegistry.unregister', () => {
  it('invokes onUnmount then onDestroy in order; transitions to destroyed', async () => {
    const bus = buildBus()
    const reg = new PluginRegistry(bus, silentLogger, buildContextFactory(bus))
    const order: string[] = []
    await reg.register({
      id: 'p1',
      onUnmount: () => {
        order.push('unmount')
      },
      onDestroy: () => {
        order.push('destroy')
      },
    })
    await reg.unregister('p1')
    expect(order).toEqual(['unmount', 'destroy'])
    expect(reg.get('p1')).toBeUndefined()
  })

  it('throws plugin.not-found on unknown id', async () => {
    const bus = buildBus()
    const reg = new PluginRegistry(bus, silentLogger, buildContextFactory(bus))
    let caught: unknown = null
    try {
      await reg.unregister('ghost')
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('plugin.not-found')
  })

  it('CASCADE D-26 point 1: subscriptions via scoped broker are auto-tagged and removed (LIFE-02)', async () => {
    // Build a contextFactory that mirrors the real Broker class behavior:
    // it wraps broker with createPluginScopedBroker so that hooks subscribe
    // with ownerId=pluginId automatically.
    const bus = buildBus()
    const scopedFactory = (id: string, signal: AbortSignal): PluginContext => ({
      id,
      logger: silentLogger,
      broker: createPluginScopedBroker(
        {
          subscribe: () => {
            throw new Error('root-subscribe-not-used')
          },
        },
        bus,
        id,
      ),
      signal,
    })
    const reg = new PluginRegistry(bus, silentLogger, scopedFactory)
    await reg.register({
      id: 'p1',
      onMount: (ctx) => {
        // Plugin uses public API surface — no direct bus access
        const scoped = ctx.broker as {
          subscribe: (pattern: string, handler: () => void) => unknown
        }
        scoped.subscribe('a.b', () => {})
        scoped.subscribe('c.d', () => {})
        scoped.subscribe('e.f', () => {})
        scoped.subscribe('g.h', () => {})
        scoped.subscribe('i.j', () => {})
      },
    })
    expect(bus.getStats().topics.length).toBe(5)
    await reg.unregister('p1')
    // D-26 point 1: unsubscribeByOwner('p1') removed all 5
    expect(bus.getStats().topics.length).toBe(0)
  })

  it('CASCADE: AbortController fires (signal.aborted === true after unregister)', async () => {
    const bus = buildBus()
    const reg = new PluginRegistry(bus, silentLogger, buildContextFactory(bus))
    let capturedSignal: AbortSignal | null = null
    await reg.register({
      id: 'p1',
      onMount: (ctx) => {
        capturedSignal = ctx.signal
      },
    })
    expect(capturedSignal?.aborted).toBe(false)
    await reg.unregister('p1')
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('cascade procedes even if onUnmount throws; D-26 point 1 still runs', async () => {
    const errorLog = vi.fn()
    const logger = { ...silentLogger, error: errorLog }
    const bus = new EventBus(logger, noopEventTap, { debug: false })
    const scopedFactory = (id: string, signal: AbortSignal): PluginContext => ({
      id,
      logger,
      broker: createPluginScopedBroker(
        {
          subscribe: () => {
            throw new Error('root-subscribe-not-used')
          },
        },
        bus,
        id,
      ),
      signal,
    })
    const reg = new PluginRegistry(bus, logger, scopedFactory)
    await reg.register({
      id: 'p1',
      onMount: (ctx) => {
        const scoped = ctx.broker as {
          subscribe: (p: string, h: () => void) => unknown
        }
        scoped.subscribe('a.b', () => {})
      },
      onUnmount: () => {
        throw new Error('unmount-fail')
      },
    })
    await reg.unregister('p1')
    // onUnmount error logged
    expect(errorLog).toHaveBeenCalledWith(
      'Plugin onUnmount threw',
      expect.objectContaining({ id: 'p1' }),
    )
    // cascade still ran (D-26 point 1)
    expect(bus.getStats().topics.length).toBe(0)
  })

  it('cascade procedes even if onDestroy throws (cascade already complete, only log)', async () => {
    const errorLog = vi.fn()
    const logger = { ...silentLogger, error: errorLog }
    const bus = new EventBus(logger, noopEventTap, { debug: false })
    const ctxFactory: (id: string, signal: AbortSignal) => PluginContext = (id, signal) => ({
      id,
      logger,
      broker: bus as unknown,
      signal,
    })
    const reg = new PluginRegistry(bus, logger, ctxFactory)
    await reg.register({
      id: 'p1',
      onDestroy: () => {
        throw new Error('destroy-fail')
      },
    })
    await reg.unregister('p1')
    expect(errorLog).toHaveBeenCalledWith(
      'Plugin onDestroy threw',
      expect.objectContaining({ id: 'p1' }),
    )
    expect(reg.get('p1')).toBeUndefined()
  })

  it('signal.aborted is FALSE during onUnmount but TRUE during onDestroy (RESEARCH Open Q 5)', async () => {
    const bus = buildBus()
    const reg = new PluginRegistry(bus, silentLogger, buildContextFactory(bus))
    let unmountAborted = false
    let destroyAborted = false
    await reg.register({
      id: 'p1',
      onUnmount: (ctx) => {
        unmountAborted = ctx.signal.aborted
      },
      onDestroy: (ctx) => {
        destroyAborted = ctx.signal.aborted
      },
    })
    await reg.unregister('p1')
    expect(unmountAborted).toBe(false)
    expect(destroyAborted).toBe(true)
  })
})

describe('createPluginScopedBroker', () => {
  it('propagates ownerId to bus.subscribe so unsubscribeByOwner removes it', () => {
    const bus = buildBus()
    const scoped = createPluginScopedBroker(
      {
        subscribe: () => {
          throw new Error('root-subscribe-not-used')
        },
      },
      bus,
      'plugin-X',
    ) as { subscribe: (p: string, h: () => void) => unknown }
    scoped.subscribe('a.b', () => {})
    scoped.subscribe('c.d', () => {})
    expect(bus.getStats().topics.length).toBe(2)
    const removed = bus.unsubscribeByOwner('plugin-X')
    expect(removed).toBe(2)
    expect(bus.getStats().topics.length).toBe(0)
  })

  it('delegates non-subscribe methods to root broker', () => {
    const bus = buildBus()
    const root = {
      publish: (topic: string): string => `published:${topic}`,
      getDebugSnapshot: (): { marker: string } => ({ marker: 'root' }),
    }
    const scoped = createPluginScopedBroker(root, bus, 'p1') as typeof root
    expect(scoped.publish('test.topic')).toBe('published:test.topic')
    expect(scoped.getDebugSnapshot()).toEqual({ marker: 'root' })
  })

  it('subscribe via scoped broker with no signal still tags ownerId', () => {
    const bus = buildBus()
    const scoped = createPluginScopedBroker(
      { subscribe: () => null },
      bus,
      'p-scoped',
    ) as { subscribe: (p: string, h: () => void) => unknown }
    scoped.subscribe('topic.x', () => {})
    // verify ownerId by checking unsubscribeByOwner returns 1
    expect(bus.unsubscribeByOwner('p-scoped')).toBe(1)
  })

  it('non-function properties on root are returned as-is', () => {
    const bus = buildBus()
    const root = {
      version: '1.2.3',
      subscribe: (): null => null,
    }
    const scoped = createPluginScopedBroker(root, bus, 'p1') as typeof root
    expect(scoped.version).toBe('1.2.3')
  })
})

describe('PluginRegistry.list', () => {
  it('returns array of registered plugin ids', async () => {
    const bus = buildBus()
    const reg = new PluginRegistry(bus, silentLogger, buildContextFactory(bus))
    await reg.register({ id: 'p1' })
    await reg.register({ id: 'p2' })
    expect(reg.list()).toEqual(['p1', 'p2'])
  })

  it('returns empty array when no plugins registered', () => {
    const bus = buildBus()
    const reg = new PluginRegistry(bus, silentLogger, buildContextFactory(bus))
    expect(reg.list()).toEqual([])
  })

  it('removes id from list after unregister', async () => {
    const bus = buildBus()
    const reg = new PluginRegistry(bus, silentLogger, buildContextFactory(bus))
    await reg.register({ id: 'p1' })
    await reg.register({ id: 'p2' })
    await reg.unregister('p1')
    expect(reg.list()).toEqual(['p2'])
  })
})
