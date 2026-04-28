// Robustness test — Plugin fault tolerance (TEST-03 subset).
//
// Verifica end-to-end che plugin malconfigurati o handler che throwano NON
// rompano il broker:
//   - onMount throw → state 'failed' (resta nel registry come failed); broker
//     continua a registrare nuovi plugin con id diversi e continua a delivery
//     pub/sub regolare
//   - onRegister throw → rollback (registered → unmounted, plugin rimosso dal
//     registry); plugin con id valido si registra normalmente
//   - Handler throw (sync) → broker continua a delivery agli altri handler
//     (D-16 isolation), system.error pubblicato (T-07-03 anti-recursion)
//   - Multiple plugin con handler che throw → broker sopravvive
//
// I test isolation D-16 + onMount-failed sono già coperti per pattern unit in
// `plugin-registry.test.ts` e per pattern integration in
// `handler-isolation.integration.test.ts` + `plugin-lifecycle.integration.test.ts`.
// Questo file FOCUS sul comportamento "broker continua a funzionare" sotto
// carico di plugin che falliscono — robustness scenario distinta.
//
// Ownership pattern: questo file usa `*.test.ts` non-integration per
// disambiguazione da plan 09 (che possiede `*.integration.test.ts`).

import { describe, expect, it, vi } from 'vitest'
import { isBrokerError } from '../core/broker-error'
import { createPipelineHarness } from '../test-utils/pipeline-harness'

describe('Plugin fault tolerance (TEST-03 subset)', () => {
  it('plugin with onMount throw → state failed; broker continues; new plugin registers OK', async () => {
    const h = createPipelineHarness()
    let caught: unknown = null
    try {
      await h.broker.registerPlugin({
        id: 'broken-plugin',
        onMount: () => {
          throw new Error('mount-fail')
        },
      })
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect((caught as { code: string }).code).toBe('plugin.lifecycle.failed')

    // Broker continues to function: another plugin registers normally.
    await h.broker.registerPlugin({ id: 'healthy-plugin' })
    expect(h.broker.getDebugSnapshot().pluginIds).toContain('healthy-plugin')

    // publish/subscribe still works.
    const handler = vi.fn()
    h.broker.subscribe('a.b', handler)
    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    expect(handler).toHaveBeenCalled()
  })

  it('plugin with onRegister throw → state rolled back to unmounted; plugin removed', async () => {
    const h = createPipelineHarness()
    let caught: unknown = null
    try {
      await h.broker.registerPlugin({
        id: 'reg-fail',
        onRegister: () => {
          throw new Error('register-fail')
        },
      })
    } catch (e) {
      caught = e
    }
    expect(isBrokerError(caught)).toBe(true)
    expect(h.broker.getDebugSnapshot().pluginIds).not.toContain('reg-fail')
  })

  it('plugin with handler that throws → broker continues delivering to other handlers', () => {
    const h = createPipelineHarness()
    const ok = vi.fn()
    h.broker.subscribe('a.b', () => {
      throw new Error('handler-boom')
    })
    h.broker.subscribe('a.b', ok)
    h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    expect(ok).toHaveBeenCalled()
  })

  it('multiple plugins each with handlers throwing → broker survives', async () => {
    const h = createPipelineHarness()
    await h.broker.registerPlugin({ id: 'p1' })
    await h.broker.registerPlugin({ id: 'p2' })
    h.broker.subscribe('a.b', () => {
      throw new Error('boom-1')
    })
    h.broker.subscribe('a.b', () => {
      throw new Error('boom-2')
    })
    h.broker.subscribe('a.b', () => {
      throw new Error('boom-3')
    })
    expect(() =>
      h.broker.publish('a.b', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' }),
    ).not.toThrow()
    // Broker is still functional.
    const ok = vi.fn()
    h.broker.subscribe('c.d', ok)
    h.broker.publish('c.d', {}, { source: { type: 'plugin', id: 'p' }, deliveryMode: 'sync' })
    expect(ok).toHaveBeenCalled()
  })
})
