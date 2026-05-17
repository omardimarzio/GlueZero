/**
 * Tier-3 Scenario 4: runtime failure → custom async handler
 *
 * Setup: MF con `descriptor.fallback.onRuntimeError.type='custom'` + async handler.
 *
 * Test 1 (success path): handler async che await Promise → `fallbackType:'custom'`.
 *
 * Test 2 (throw path): handler che throw → `console.error` + `fallbackType:'custom-failed'`.
 *
 * Importante: runtime/update phase NON triggera retry (OQ-1 D-V2-F14-10-AMENDED).
 * Il fallback è dispatchato direttamente.
 *
 * @see D-V2-F14-15 — custom await + try/catch + console.error
 * @see D-V2-F14-10-AMENDED — runtime/update retry skip
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { setupF14Fixture, type TestFixture } from './playwright-setup.js'

describe('Tier-3 Scenario 4: runtime failure → custom async handler', () => {
  let fx: TestFixture | undefined

  afterEach(() => {
    fx?.cleanup()
    fx = undefined
  })

  it('handler async Promise await + completion topic emit fallbackType:custom', async () => {
    fx = await setupF14Fixture()
    let handlerInvoked = false
    let asyncCompleted = false
    const handler = async (_err: unknown): Promise<void> => {
      handlerInvoked = true
      await new Promise((r) => setTimeout(r, 20))
      asyncCompleted = true
    }

    await fx.registerMf({
      id: 'legacy-checkout',
      name: 'legacy-checkout',
      version: '1.0.0',
      mount: { selector: '#root' },
      fallback: {
        onRuntimeError: { type: 'custom', handler },
      },
    })

    fx.triggerFail('legacy-checkout', 'runtime', 'runtime throw', true)

    await fx.topicSeen(
      'microfrontend.fallback.rendered',
      (p) => (p as { fallbackType?: string }).fallbackType === 'custom',
    )

    expect(handlerInvoked).toBe(true)
    expect(asyncCompleted).toBe(true)
  })

  it('handler throw → console.error + fallbackType:custom-failed', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fx = await setupF14Fixture()

    await fx.registerMf({
      id: 'broken-handler',
      name: 'broken-handler',
      version: '1.0.0',
      mount: { selector: '#root' },
      fallback: {
        onRuntimeError: {
          type: 'custom',
          handler: async () => {
            throw new Error('handler boom')
          },
        },
      },
    })

    fx.triggerFail('broken-handler', 'runtime', 'runtime throw', true)

    const payload = (await fx.topicSeen(
      'microfrontend.fallback.rendered',
      (p) => (p as { fallbackType?: string }).fallbackType === 'custom-failed',
    )) as { fallbackType: string }

    expect(payload.fallbackType).toBe('custom-failed')
    expect(errSpy).toHaveBeenCalled()

    errSpy.mockRestore()
  })
})
