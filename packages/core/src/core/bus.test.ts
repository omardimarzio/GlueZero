import { describe, expect, it, vi } from 'vitest'
import type { BrokerEvent } from '../types/broker-event'
import type { BrokerLogger } from '../types/logger'
import type { EventTap, PipelineSnapshot, PipelineStep } from '../types/tap'
import { isBrokerError } from './broker-error'
import { EventBus } from './bus'
import { noopEventTap } from './event-tap'
import { silentLogger } from './logger'

const makeBus = (opts: { debug?: boolean; tap?: EventTap; logger?: BrokerLogger } = {}): EventBus =>
  new EventBus(opts.logger ?? silentLogger, opts.tap ?? noopEventTap, {
    debug: opts.debug ?? false,
  })

const makeEvent = <T>(
  topic: string,
  payload: T,
  overrides: Partial<BrokerEvent<T>> = {},
): BrokerEvent<T> =>
  ({
    id: 'evt-1',
    topic,
    timestamp: Date.now(),
    source: { type: 'plugin', id: 'p1' },
    payload: payload as never,
    deliveryMode: 'sync',
    priority: 'normal',
    ...overrides,
  }) as BrokerEvent<T>

const flush = (): Promise<void> => new Promise<void>((r) => queueMicrotask(() => r()))

describe('EventBus.publish + subscribe (CORE-01)', () => {
  it('delivers sync event to subscriber', () => {
    const bus = makeBus()
    const handler = vi.fn()
    bus.subscribe('weather.requested', handler)
    bus.publish(makeEvent('weather.requested', { city: 'Roma' }))
    expect(handler).toHaveBeenCalledTimes(1)
    const received = handler.mock.calls[0]?.[0] as BrokerEvent<{ city: string }>
    expect(received.payload).toEqual({ city: 'Roma' })
  })

  it('delivers wildcard match (CORE-09)', () => {
    const bus = makeBus()
    const handler = vi.fn()
    bus.subscribe('weather.*', handler)
    bus.publish(makeEvent('weather.requested', { x: 1 }))
    bus.publish(makeEvent('weather.loaded', { y: 2 }))
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('async delivery (D-01) defers handler to microtask', async () => {
    const bus = makeBus()
    const handler = vi.fn()
    bus.subscribe('a.b', handler)
    bus.publish(makeEvent('a.b', {}, { deliveryMode: 'async' }))
    expect(handler).not.toHaveBeenCalled()
    await flush()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('worker fallback to async + warn (D-03)', async () => {
    const warn = vi.fn()
    const logger: BrokerLogger = { ...silentLogger, warn }
    const bus = new EventBus(logger, noopEventTap, { debug: false })
    const handler = vi.fn()
    bus.subscribe('a.b', handler)
    bus.publish(makeEvent('a.b', {}, { deliveryMode: 'worker' }))
    expect(warn).toHaveBeenCalledWith(
      'mapping.delivery.fallback',
      expect.objectContaining({ mode: 'worker', fallback: 'async' }),
    )
    await flush()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('remote fallback to async + warn (D-03)', async () => {
    const warn = vi.fn()
    const logger: BrokerLogger = { ...silentLogger, warn }
    const bus = new EventBus(logger, noopEventTap, { debug: false })
    const handler = vi.fn()
    bus.subscribe('a.b', handler)
    bus.publish(makeEvent('a.b', {}, { deliveryMode: 'remote' }))
    expect(warn).toHaveBeenCalledWith(
      'mapping.delivery.fallback',
      expect.objectContaining({ mode: 'remote', fallback: 'async' }),
    )
    await flush()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('preserves FIFO order under async delivery', async () => {
    const bus = makeBus()
    const log: number[] = []
    bus.subscribe('a.b', (e) => {
      log.push((e.payload as { n: number }).n)
    })
    bus.publish(makeEvent('a.b', { n: 1 }, { deliveryMode: 'async' }))
    bus.publish(makeEvent('a.b', { n: 2 }, { deliveryMode: 'async' }))
    bus.publish(makeEvent('a.b', { n: 3 }, { deliveryMode: 'async' }))
    await flush()
    await flush()
    expect(log).toEqual([1, 2, 3])
  })
})

describe('Subscription handle (D-27)', () => {
  it('unsubscribe is idempotent', () => {
    const bus = makeBus()
    const handler = vi.fn()
    const sub = bus.subscribe('a.b', handler)
    sub.unsubscribe()
    sub.unsubscribe()
    bus.publish(makeEvent('a.b', {}))
    expect(handler).not.toHaveBeenCalled()
  })

  it('exposes id, topic, active', () => {
    const bus = makeBus()
    const sub = bus.subscribe('a.b', () => {})
    expect(typeof sub.id).toBe('string')
    expect(sub.id.length).toBeGreaterThan(0)
    expect(sub.topic).toBe('a.b')
    expect(sub.active).toBe(true)
    sub.unsubscribe()
    expect(sub.active).toBe(false)
  })

  it('after unsubscribe, publish does not invoke the handler', () => {
    const bus = makeBus()
    const handler = vi.fn()
    const sub = bus.subscribe('a.b', handler)
    sub.unsubscribe()
    bus.publish(makeEvent('a.b', {}))
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('AbortSignal hookup (D-26)', () => {
  it('aborts the subscription when signal fires', () => {
    const bus = makeBus()
    const ac = new AbortController()
    const handler = vi.fn()
    const sub = bus.subscribe('a.b', handler, { signal: ac.signal })
    ac.abort()
    bus.publish(makeEvent('a.b', {}))
    expect(handler).not.toHaveBeenCalled()
    expect(sub.active).toBe(false)
  })
})

describe('Handler isolation (CORE-12, ERR-03, D-16)', () => {
  it('sync handler that throws does not crash broker', async () => {
    const errorLog = vi.fn()
    const logger: BrokerLogger = { ...silentLogger, error: errorLog }
    const bus = new EventBus(logger, noopEventTap, { debug: false })
    const sysHandler = vi.fn()
    bus.subscribe('system.error', sysHandler)
    bus.subscribe('a.b', () => {
      throw new Error('boom')
    })
    expect(() => bus.publish(makeEvent('a.b', {}))).not.toThrow()
    expect(errorLog).toHaveBeenCalled()
    await flush()
    await flush()
    expect(sysHandler).toHaveBeenCalled()
    const sysEvent = sysHandler.mock.calls[0]?.[0] as BrokerEvent<{
      error: { code: string; category: string }
      originalEventId: string
      originalTopic: string
    }>
    expect(sysEvent.topic).toBe('system.error')
    expect(sysEvent.payload.error.code).toBe('plugin.handler.failed')
    expect(sysEvent.payload.error.category).toBe('plugin')
    expect(sysEvent.payload.originalTopic).toBe('a.b')
    expect(sysEvent.payload.originalEventId).toBe('evt-1')
  })

  it('async handler with rejected Promise also caught', async () => {
    const errorLog = vi.fn()
    const logger: BrokerLogger = { ...silentLogger, error: errorLog }
    const bus = new EventBus(logger, noopEventTap, { debug: false })
    bus.subscribe('a.b', async () => {
      throw new Error('async boom')
    })
    bus.publish(makeEvent('a.b', {}))
    await flush()
    await flush()
    expect(errorLog).toHaveBeenCalled()
  })

  it('preserves BrokerError when handler throws one (no re-wrap)', async () => {
    const bus = makeBus()
    const sysHandler = vi.fn()
    bus.subscribe('system.error', sysHandler)
    bus.subscribe('a.b', () => {
      const err = new Error('original') as Error & { code: string; category: string }
      err.name = 'BrokerError'
      err.code = 'custom.preserved'
      err.category = 'plugin'
      throw err
    })
    bus.publish(makeEvent('a.b', {}))
    await flush()
    await flush()
    expect(sysHandler).toHaveBeenCalled()
    const sysEvent = sysHandler.mock.calls[0]?.[0] as BrokerEvent<{
      error: { code: string }
    }>
    expect(sysEvent.payload.error.code).toBe('custom.preserved')
  })
})

describe('Tap orchestration — 5 F1 steps (CORE-13, D-20)', () => {
  it('invokes tap on all 5 F1 steps in order', () => {
    const steps: PipelineStep[] = []
    const tap: EventTap = {
      onPipelineStep: (step) => {
        steps.push(step)
      },
    }
    const bus = makeBus({ tap })
    bus.subscribe('a.b', () => {})
    bus.publish(makeEvent('a.b', {}))
    expect(steps).toEqual([
      'event.received',
      'event.metadata.enriched',
      'event.validated',
      'event.dedupe.checked',
      'event.delivered',
    ])
  })

  it('event.delivered snapshot includes subscriberCount', () => {
    const captured: PipelineSnapshot[] = []
    const tap: EventTap = {
      onPipelineStep: (_step, snap) => {
        if (snap.step === 'event.delivered') captured.push(snap)
      },
    }
    const bus = makeBus({ tap })
    bus.subscribe('a.b', () => {})
    bus.subscribe('a.b', () => {})
    bus.publish(makeEvent('a.b', {}))
    expect(captured[0]?.metadata).toEqual({ subscriberCount: 2 })
  })

  it('a tap that throws does not break the pipeline (D-20)', () => {
    const tap: EventTap = {
      onPipelineStep: () => {
        throw new Error('tap blew up')
      },
    }
    const bus = makeBus({ tap })
    const handler = vi.fn()
    bus.subscribe('a.b', handler)
    expect(() => bus.publish(makeEvent('a.b', {}))).not.toThrow()
    expect(handler).toHaveBeenCalled()
  })
})

describe('Debug mode + deep-freeze (D-04)', () => {
  it('debug:true freezes payload before delivery', () => {
    const bus = makeBus({ debug: true })
    let caughtTypeError = false
    bus.subscribe('a.b', (e) => {
      try {
        ;(e.payload as { x: number }).x = 999
      } catch (err) {
        if (err instanceof TypeError) caughtTypeError = true
      }
    })
    bus.publish(makeEvent('a.b', { x: 1 }))
    expect(caughtTypeError).toBe(true)
  })

  it('debug:false does not freeze (production performance)', () => {
    const bus = makeBus({ debug: false })
    let mutated = false
    bus.subscribe('a.b', (e) => {
      try {
        ;(e.payload as { x: number }).x = 999
        mutated = true
      } catch {
        // unexpected in non-debug
      }
    })
    bus.publish(makeEvent('a.b', { x: 1 }))
    expect(mutated).toBe(true)
  })
})

describe('unsubscribeByOwner (cascade for plan 08)', () => {
  it('removes all subscriptions for given ownerId, returns count', () => {
    const bus = makeBus()
    bus.subscribe('a.b', () => {}, {}, 'p1')
    bus.subscribe('c.d', () => {}, {}, 'p1')
    bus.subscribe('e.f', () => {}, {}, 'p1')
    bus.subscribe('g.h', () => {}, {}, 'p2')
    bus.subscribe('i.j', () => {}, {}, 'p2')
    expect(bus.unsubscribeByOwner('p1')).toBe(3)
    expect(bus.getStats().topics.length).toBe(2)
  })

  it('returns 0 if no subscription matches the ownerId', () => {
    const bus = makeBus()
    bus.subscribe('a.b', () => {}, {}, 'p1')
    expect(bus.unsubscribeByOwner('unknown')).toBe(0)
  })
})

describe('once option (plan 03 decision)', () => {
  it('invokes handler at most once then auto-unsubscribes', () => {
    const bus = makeBus()
    const handler = vi.fn()
    bus.subscribe('a.b', handler, { once: true })
    bus.publish(makeEvent('a.b', { n: 1 }))
    bus.publish(makeEvent('a.b', { n: 2 }))
    expect(handler).toHaveBeenCalledTimes(1)
  })
})

describe('validation failure at publish (VAL-01)', () => {
  it('invalid event throws and skips delivery', () => {
    const bus = makeBus()
    const handler = vi.fn()
    bus.subscribe('a.b', handler)
    const invalidEvent = makeEvent('a.b', {})
    const broken = { ...invalidEvent, id: '' } as BrokerEvent
    let caught: unknown = null
    try {
      bus.publish(broken)
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('event.validation.failed')
    expect(handler).not.toHaveBeenCalled()
  })

  it('invalid event does not emit event.delivered tap', () => {
    const steps: PipelineStep[] = []
    const tap: EventTap = {
      onPipelineStep: (step) => {
        steps.push(step)
      },
    }
    const bus = makeBus({ tap })
    const broken = { ...makeEvent('a.b', {}), id: '' } as BrokerEvent
    try {
      bus.publish(broken)
    } catch {
      // expected
    }
    expect(steps).not.toContain('event.delivered')
    expect(steps).not.toContain('event.validated')
  })
})

describe('getStats', () => {
  it('reports topics and subscriber counts', () => {
    const bus = makeBus()
    bus.subscribe('a.b', () => {})
    bus.subscribe('a.b', () => {})
    bus.subscribe('c.d', () => {})
    const stats = bus.getStats()
    expect(stats.topics.sort()).toEqual(['a.b', 'c.d'])
    expect(stats.subscriberCount['a.b']).toBe(2)
    expect(stats.subscriberCount['c.d']).toBe(1)
    expect(stats.pendingAsyncDelivery).toBe(0)
  })
})

describe('setDebugMode', () => {
  it('toggles debug mode at runtime', () => {
    const bus = makeBus({ debug: false })
    let mutated = false
    bus.subscribe('a.b', (e) => {
      try {
        ;(e.payload as { x: number }).x = 999
        mutated = true
      } catch {
        // expected after debug mode flip
      }
    })
    bus.publish(makeEvent('a.b', { x: 1 }))
    expect(mutated).toBe(true)

    bus.setDebugMode(true)
    let caughtTypeError = false
    bus.subscribe('c.d', (e) => {
      try {
        ;(e.payload as { y: number }).y = 999
      } catch (err) {
        if (err instanceof TypeError) caughtTypeError = true
      }
    })
    bus.publish(makeEvent('c.d', { y: 1 }))
    expect(caughtTypeError).toBe(true)
  })
})
