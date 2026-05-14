/**
 * Tier-3 Scenario 2: bootstrap failure → component-stub fallback (no F15 adapter).
 *
 * Setup: MF con `descriptor.fallback.onBootstrapError.type='component'`. SERVICE_FRAMEWORK_ADAPTER
 * NON registrato (F15 mock assente) → graceful HTML stub `data-gz-fallback-stub`.
 *
 * Expected:
 *  - `console.warn` chiamato con stringa che riferisce framework adapter.
 *  - DOM contiene `[data-gz-fallback-stub]` con `data-gz-mf="analytics-widget"`.
 *  - Topic `microfrontend.fallback.rendered` emit con `fallbackType === 'component-stub'`.
 *
 * @see D-V2-F14-14 — Component-stub via SERVICE_FRAMEWORK_ADAPTER (F15 future)
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { setupF14Fixture, type TestFixture } from './playwright-setup.js'

describe('Tier-3 Scenario 2: bootstrap failure → component-stub fallback', () => {
  let fx: TestFixture | undefined

  afterEach(() => {
    fx?.cleanup()
    fx = undefined
  })

  it('no F15 adapter → console.warn + HTML stub data-gz-fallback-stub + topic emit fallbackType:component-stub', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fx = await setupF14Fixture()
    await fx.registerMf({
      id: 'analytics-widget',
      name: 'analytics-widget',
      version: '1.0.0',
      mount: { selector: '#root' },
      fallback: {
        onBootstrapError: {
          type: 'component',
          component: { _mock: 'MockReactComp' },
        },
      },
    })

    // recoverable:false → orchestrator chain skip retry branch e applica fallback diretto.
    // Scenario isola il path di render component-stub (NON il retry, coperto in scenario 5).
    fx.triggerFail('analytics-widget', 'bootstrap', 'bootstrap throw', false)

    const payload = (await fx.topicSeen(
      'microfrontend.fallback.rendered',
      (p) => (p as { fallbackType?: string }).fallbackType === 'component-stub',
    )) as { microFrontendId: string; fallbackType: string }

    expect(payload.microFrontendId).toBe('analytics-widget')
    expect(payload.fallbackType).toBe('component-stub')

    // Verify console.warn fired for missing adapter
    expect(warnSpy).toHaveBeenCalled()

    const stub = document.querySelector('[data-gz-fallback-stub]')
    expect(stub).not.toBeNull()
    expect(stub!.getAttribute('data-gz-mf')).toBe('analytics-widget')

    warnSpy.mockRestore()
  })
})
