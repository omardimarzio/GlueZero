/**
 * v1-bc-replay — PRD §42.2 API #5+#6 freeze: registerPlugin/unregisterPlugin cascade.
 *
 * D-26 LIFE-02: unregisterPlugin → bus.unsubscribeByOwner(pluginId) cascade.
 * Post-unregister `getDebugSnapshot()` ritorna alla baseline pre-registrazione
 * (stesso elenco topics, stesso subscriberCount, stesso pluginIds, ecc.).
 *
 * Il test NON usa `bus.unsubscribeByOwner` direttamente (API interna, esposta
 * pubblicamente solo in MIN-2 in W1-P03) — verifica la cascade indirettamente
 * via `unregisterPlugin` osservando l'effetto sul debug snapshot.
 *
 * @see .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-RESEARCH.md §7
 * @see D-V2-F8-08 suite content #3
 */

import { createBroker } from '@gluezero/core'
import { describe, expect, it, vi } from 'vitest'

// Tipo helper per accedere al subscribe esposto dal scoped broker
// (PluginContext.broker è tipato come `unknown` in plan 03 — vedi types/plugin.ts).
type ScopedBrokerLike = {
  subscribe: (
    pattern: string,
    handler: (e: unknown) => void,
    options?: { once?: boolean; deliveryMode?: 'sync' | 'async' },
  ) => { unsubscribe: () => void }
}

describe('v1-bc-replay: plugin registry cascade (API #5+#6, D-26)', () => {
  it('registerPlugin invokes onRegister + onMount; unregisterPlugin invokes onUnmount + onDestroy', async () => {
    const broker = createBroker({})
    const onRegister = vi.fn()
    const onMount = vi.fn()
    const onUnmount = vi.fn()
    const onDestroy = vi.fn()
    await broker.registerPlugin({
      id: 'bc-plugin',
      version: '1.0.0',
      onRegister,
      onMount,
      onUnmount,
      onDestroy,
    })
    expect(onRegister).toHaveBeenCalledOnce()
    expect(onMount).toHaveBeenCalledOnce()
    await broker.unregisterPlugin('bc-plugin')
    expect(onUnmount).toHaveBeenCalledOnce()
    expect(onDestroy).toHaveBeenCalledOnce()
  })

  it('unregisterPlugin cascades unsubscribe — getDebugSnapshot back to baseline (D-26 point 1)', async () => {
    const broker = createBroker({})
    const baseline = broker.getDebugSnapshot()
    await broker.registerPlugin({
      id: 'bc-plugin-subs',
      onMount: (ctx): void => {
        const scoped = ctx.broker as unknown as ScopedBrokerLike
        for (let i = 0; i < 5; i++) {
          scoped.subscribe(`topic.t${i}`, () => {})
        }
      },
    })
    // Mid-state: 5 nuovi topic + 1 plugin registered
    const middle = broker.getDebugSnapshot()
    expect(middle.pluginIds).toContain('bc-plugin-subs')
    expect(middle.topics.length).toBeGreaterThanOrEqual(5)

    await broker.unregisterPlugin('bc-plugin-subs')

    const after = broker.getDebugSnapshot()
    expect(after.pluginIds).toEqual(baseline.pluginIds)
    expect(after.topics).toEqual(baseline.topics)
    expect(after.subscriberCount).toEqual(baseline.subscriberCount)
    expect(after.pendingAsyncDelivery).toBe(baseline.pendingAsyncDelivery)
  })

  it('multiple plugins: unregister one does NOT affect others (scoped broker isolation)', async () => {
    const broker = createBroker({})
    await broker.registerPlugin({
      id: 'bc-p1',
      onMount: (ctx): void => {
        const scoped = ctx.broker as unknown as ScopedBrokerLike
        scoped.subscribe('bc.p1.topic', () => {})
      },
    })
    await broker.registerPlugin({
      id: 'bc-p2',
      onMount: (ctx): void => {
        const scoped = ctx.broker as unknown as ScopedBrokerLike
        scoped.subscribe('bc.p2.topic', () => {})
      },
    })
    await broker.unregisterPlugin('bc-p1')
    const snap = broker.getDebugSnapshot()
    expect(snap.pluginIds).toEqual(['bc-p2'])
    expect(snap.topics).toContain('bc.p2.topic')
    expect(snap.topics).not.toContain('bc.p1.topic')
  })
})
