/**
 * Tier-3 Scenario 1: load failure → html fallback render
 *
 * Setup: MF con `descriptor.fallback.onLoadError.type='html'` registrato via real
 * `mfService.register()`. Trigger emit `microfrontend.load.failed` topic.
 *
 * Expected:
 *  - Topic `microfrontend.fallback.rendered` emit con `fallbackType === 'html'`.
 *  - DOM target (`#root`) innerHTML applicato con il contenuto html policy.
 *
 * @see D-V2-F14-13 — HTML target chain (a) mountElement → (b) querySelector → (c) null+warn
 * @see D-V2-F14-15 — Tier-3 6 scenari closure
 */
import { describe, it, expect, afterEach } from 'vitest'
import { setupF14Fixture, type TestFixture } from './playwright-setup.js'

describe('Tier-3 Scenario 1: load failure → html fallback', () => {
  let fx: TestFixture | undefined

  afterEach(() => {
    fx?.cleanup()
    fx = undefined
  })

  it('html innerHTML applicato + microfrontend.fallback.rendered emit fallbackType:html', async () => {
    fx = await setupF14Fixture()
    await fx.registerMf({
      id: 'product-grid',
      name: 'product-grid',
      version: '1.0.0',
      mount: { selector: '#root' },
      fallback: {
        onLoadError: {
          type: 'html',
          html: '<div class="grid-error">Catalog unavailable</div>',
        },
      },
    })

    // recoverable:false → orchestrator chain skip retry branch e applica fallback diretto.
    // Scenario isola il path di render html (NON il retry, coperto in scenario 5).
    fx.triggerFail('product-grid', 'load', 'loader rejected', false)

    const renderedPayload = (await fx.topicSeen(
      'microfrontend.fallback.rendered',
      (p) => (p as { fallbackType?: string }).fallbackType === 'html',
    )) as { microFrontendId: string; lifecyclePhase: string; fallbackType: string }

    expect(renderedPayload.microFrontendId).toBe('product-grid')
    expect(renderedPayload.lifecyclePhase).toBe('load')
    expect(renderedPayload.fallbackType).toBe('html')

    const target = document.querySelector('#root')
    expect(target).not.toBeNull()
    expect(target!.innerHTML).toContain('grid-error')
    expect(target!.innerHTML).toContain('Catalog unavailable')
  })
})
