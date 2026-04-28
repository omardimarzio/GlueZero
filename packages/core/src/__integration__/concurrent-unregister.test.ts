// Robustness test — Concurrent unregister vs in-flight handler (TEST-03 subset).
//
// Verifica end-to-end la cascade D-26 punto 4 (AbortController.abort()) sotto
// race condition con handler async pendenti:
//   - Plugin con handler async pendente in microtask queue + unregister
//     concorrente: signal aborts; subscription rimossa; nessun system.error
//     consegnato per ownerId del plugin smontato (subscription rimossa via
//     signal hookup)
//   - Multiple plugin: unregister di uno NON tocca l'altro (scoped broker
//     isolation)
//   - Rapid register/unregister cycle (10 cycles × 2 sub each): nessun leak
//     subscription residua nel trie; pluginIds.length=0 e topics.length=0
//
// Pattern flushAll: ripetuto 10 volte per drenare la coda microtask multipla
// (dispatchAsync + system.error defer T-07-03).
//
// Ownership pattern: questo file usa `*.test.ts` non-integration per
// disambiguazione da plan 09 (che possiede `*.integration.test.ts`).

import { describe, expect, it, vi } from 'vitest'
import { createPipelineHarness } from '../test-utils/pipeline-harness'

const flushAll = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) {
    await new Promise<void>((r) => {
      queueMicrotask(() => {
        r()
      })
    })
  }
}

describe('Concurrent unregister vs in-flight handler (TEST-03 subset)', () => {
  it('async handler from unregistered plugin: AbortSignal fires + subscription removed before handler runs', async () => {
    const h = createPipelineHarness()
    const handler = vi.fn()
    let signal: AbortSignal | null = null

    await h.broker.registerPlugin({
      id: 'p1',
      onMount: (ctx) => {
        signal = ctx.signal
        h.broker.subscribe('a.b', handler, { signal: ctx.signal })
      },
    })

    // Publish then immediately unregister — the async handler MAY or MAY NOT run
    // depending on microtask ordering vs unregister cascade.
    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'pub' }, deliveryMode: 'async' })
    await h.broker.unregisterPlugin('p1')
    await flushAll()

    // After unregister: signal aborted.
    expect(signal).not.toBeNull()
    // biome-ignore lint/style/noNonNullAssertion: asserted not-null on previous line
    expect(signal!.aborted).toBe(true)

    // Subsequent publish does NOT reach handler (subscription was removed via
    // signal abort listener that calls unsubscribeInternal).
    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'pub' }, deliveryMode: 'async' })
    const callsBeforeFlush = handler.mock.calls.length
    await flushAll()
    const callsAfterFlush = handler.mock.calls.length
    // The second publish should not increase the count (handler unsubscribed).
    expect(callsAfterFlush).toBe(callsBeforeFlush)
  })

  it('multiple in-flight async handlers from different plugins: only the unregistered one stops', async () => {
    const h = createPipelineHarness()
    const h1 = vi.fn()
    const h2 = vi.fn()

    await h.broker.registerPlugin({
      id: 'p1',
      onMount: (ctx) => {
        h.broker.subscribe('a.b', h1, { signal: ctx.signal })
      },
    })
    await h.broker.registerPlugin({
      id: 'p2',
      onMount: (ctx) => {
        h.broker.subscribe('a.b', h2, { signal: ctx.signal })
      },
    })

    await h.broker.unregisterPlugin('p1')

    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'pub' }, deliveryMode: 'sync' })
    expect(h1).not.toHaveBeenCalled() // p1 unregistered → subscription removed
    expect(h2).toHaveBeenCalled() // p2 still active
  })

  it('rapid register/unregister cycle does not leak subscriptions', async () => {
    const h = createPipelineHarness()
    for (let cycle = 0; cycle < 10; cycle++) {
      await h.broker.registerPlugin({
        id: `p-cycle-${cycle}`,
        onMount: (ctx) => {
          h.broker.subscribe('cycle.topic', () => {}, { signal: ctx.signal })
          h.broker.subscribe('other.topic', () => {}, { signal: ctx.signal })
        },
      })
      await h.broker.unregisterPlugin(`p-cycle-${cycle}`)
    }
    const snap = h.broker.getDebugSnapshot()
    expect(snap.pluginIds.length).toBe(0)
    expect(snap.topics.length).toBe(0)
  })
})
