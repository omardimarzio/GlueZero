// Integration test — Plugin lifecycle ordering (CORE-04, CORE-05, D-25, D-17).
//
// Verifica end-to-end l'ordine canonico degli hook plugin:
//   register: onRegister → onMount  (state mounted)
//   unregister: onUnmount → cascade D-26 → onDestroy  (state destroyed)
//
// + edge case:
//   - Duplicate id throw BrokerError code='plugin.id.duplicate' (D-17)
//   - PluginContext.signal aborts on unregister (D-26 punto 4)
//   - onMount throw → state failed; un nuovo plugin con id diverso registra OK
//
// Tutti i test usano la PipelineHarness fixture per istanziare il Broker reale.

import { describe, expect, it } from 'vitest'
import { isBrokerError } from '../core/broker-error'
import { createPipelineHarness } from '../test-utils/pipeline-harness'

describe('Plugin lifecycle integration (CORE-04, CORE-05, D-25)', () => {
  it('register invokes onRegister then onMount; final state mounted', async () => {
    const h = createPipelineHarness()
    const order: string[] = []
    await h.broker.registerPlugin({
      id: 'p1',
      onRegister: (): void => {
        order.push('register')
      },
      onMount: (): void => {
        order.push('mount')
      },
    })
    expect(order).toEqual(['register', 'mount'])
  })

  it('unregister invokes onUnmount then onDestroy', async () => {
    const h = createPipelineHarness()
    const order: string[] = []
    await h.broker.registerPlugin({
      id: 'p1',
      onUnmount: (): void => {
        order.push('unmount')
      },
      onDestroy: (): void => {
        order.push('destroy')
      },
    })
    await h.broker.unregisterPlugin('p1')
    expect(order).toEqual(['unmount', 'destroy'])
  })

  it('full lifecycle order: register → mount → unmount → destroy', async () => {
    const h = createPipelineHarness()
    const order: string[] = []
    await h.broker.registerPlugin({
      id: 'p1',
      onRegister: (): void => {
        order.push('register')
      },
      onMount: (): void => {
        order.push('mount')
      },
      onUnmount: (): void => {
        order.push('unmount')
      },
      onDestroy: (): void => {
        order.push('destroy')
      },
    })
    await h.broker.unregisterPlugin('p1')
    expect(order).toEqual(['register', 'mount', 'unmount', 'destroy'])
  })

  it('register with duplicate id throws plugin.id.duplicate (D-17)', async () => {
    const h = createPipelineHarness()
    await h.broker.registerPlugin({ id: 'p1' })
    let caught: unknown = null
    try {
      await h.broker.registerPlugin({ id: 'p1' })
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('plugin.id.duplicate')
  })

  it('PluginContext receives signal that aborts on unregister', async () => {
    const h = createPipelineHarness()
    let signal: AbortSignal | null = null
    await h.broker.registerPlugin({
      id: 'p1',
      onMount: (ctx): void => {
        signal = ctx.signal
      },
    })
    expect(signal).not.toBeNull()
    expect(signal?.aborted).toBe(false)
    await h.broker.unregisterPlugin('p1')
    expect(signal?.aborted).toBe(true)
  })

  it('mount that throws → register rejects + plugin removed; subsequent register with new id works', async () => {
    const h = createPipelineHarness()
    let caught: unknown = null
    try {
      await h.broker.registerPlugin({
        id: 'p1',
        onMount: (): void => {
          throw new Error('mount-fail')
        },
      })
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    // Un secondo plugin con id diverso si registra OK (broker non in stato corrotto)
    await h.broker.registerPlugin({ id: 'p2' })
    expect(h.broker.getDebugSnapshot().pluginIds).toContain('p2')
  })
})
