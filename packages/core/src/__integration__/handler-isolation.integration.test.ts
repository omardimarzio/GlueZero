// Integration test — Handler isolation (CORE-12, ERR-03, D-16).
//
// Verifica end-to-end che un handler che throw NON collassi il broker:
//   - Sync handler throw → BrokerError code='plugin.handler.failed' wrapped +
//     publish system.error (deferred via queueMicrotask per evitare T-07-03 recursion)
//   - Async handler reject (Promise) → stessa pipeline error
//   - Sibling handlers sullo stesso topic continuano a essere invocati
//   - Broker resta usable dopo handler error (publish successivo OK)
//
// `system.error` payload shape: { error: BrokerError, originalEventId, originalTopic }
// (vedi bus.ts.handleHandlerError).

import { describe, expect, it, vi } from 'vitest'
import { createPipelineHarness } from '../test-utils/pipeline-harness'
import type { BrokerEvent } from '../types/broker-event'

const flush = (): Promise<void> => new Promise((r) => queueMicrotask(() => r()))

describe('Handler isolation (CORE-12, ERR-03, D-16)', () => {
  it('sync handler that throws does not crash broker; system.error published', async () => {
    const h = createPipelineHarness()
    const sysHandler = vi.fn()
    h.broker.subscribe('system.error', sysHandler)
    h.broker.subscribe('a.b', () => {
      throw new Error('plugin boom')
    })
    expect(() =>
      h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' }),
    ).not.toThrow()
    // system.error e' publish-deferred via queueMicrotask + delivery async, quindi
    // serve un doppio flush per drenare queueMicrotask di handleHandlerError + di
    // dispatchAsync.
    await flush()
    await flush()
    await flush()
    expect(sysHandler).toHaveBeenCalled()
    const sysEvent = sysHandler.mock.calls[0]?.[0] as BrokerEvent<{
      error: { code: string; category: string }
      originalEventId: string
      originalTopic: string
    }>
    expect(sysEvent.payload.error.category).toBe('plugin')
    expect(sysEvent.payload.error.code).toBe('plugin.handler.failed')
    expect(sysEvent.payload.originalTopic).toBe('a.b')
  })

  it('async handler with rejected Promise also caught + system.error published', async () => {
    const h = createPipelineHarness()
    const sysHandler = vi.fn()
    h.broker.subscribe('system.error', sysHandler)
    h.broker.subscribe('a.b', async () => {
      throw new Error('async boom')
    })
    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    await flush()
    await flush()
    await flush()
    expect(sysHandler).toHaveBeenCalled()
  })

  it('one handler throwing does not prevent other handlers from running', () => {
    const h = createPipelineHarness()
    const ok = vi.fn()
    h.broker.subscribe('a.b', () => {
      throw new Error('first plugin boom')
    })
    h.broker.subscribe('a.b', ok)
    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    expect(ok).toHaveBeenCalled()
  })

  it('broker continues to function after handler error (publish next event works)', async () => {
    const h = createPipelineHarness()
    h.broker.subscribe('a.b', () => {
      throw new Error('boom')
    })
    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    await flush()
    await flush()
    // Subsequent publish on different topic still works
    const ok = vi.fn()
    h.broker.subscribe('c.d', ok)
    h.broker.publish('c.d', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    expect(ok).toHaveBeenCalled()
  })
})
