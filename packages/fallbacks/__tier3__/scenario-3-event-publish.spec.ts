/**
 * Tier-3 Scenario 3: mount failure → event publish fallback
 *
 * Setup: MF con `descriptor.fallback.onMountError.type='event'` + custom topic.
 * Subscriber sul custom topic verifica payload `fallbackApplied: true`.
 *
 * Expected:
 *  - Custom topic riceve payload con `fallbackApplied: true` + `microFrontendId`.
 *  - Topic `microfrontend.fallback.rendered` emit con `fallbackType === 'event'`.
 *
 * @see D-V2-F14-15 — event publish + custom topic + source descriptor F1 D-23
 * @see prd_2.0.0.md §31.5 — fallbackApplied:true carryover marker
 */
import { describe, it, expect, afterEach } from 'vitest'
import { setupF14Fixture, type TestFixture } from './playwright-setup.js'

describe('Tier-3 Scenario 3: mount failure → event publish fallback', () => {
  let fx: TestFixture | undefined

  afterEach(() => {
    fx?.cleanup()
    fx = undefined
  })

  it('subscriber custom topic riceve payload con fallbackApplied: true', async () => {
    fx = await setupF14Fixture()

    let receivedPayload:
      | { readonly fallbackApplied?: boolean; readonly microFrontendId?: string }
      | undefined
    fx.broker.subscribe('app.fallback.notifications', (event: { topic: string; payload: unknown }) => {
      receivedPayload = event.payload as typeof receivedPayload
    })

    await fx.registerMf({
      id: 'notifications',
      name: 'notifications',
      version: '1.0.0',
      mount: { selector: '#root' },
      fallback: {
        onMountError: {
          type: 'event',
          topic: 'app.fallback.notifications',
        },
      },
    })

    fx.triggerFail('notifications', 'mount', 'mount throw', false)

    await fx.topicSeen(
      'microfrontend.fallback.rendered',
      (p) => (p as { fallbackType?: string }).fallbackType === 'event',
    )

    expect(receivedPayload).toBeDefined()
    expect(receivedPayload!.microFrontendId).toBe('notifications')
    expect(receivedPayload!.fallbackApplied).toBe(true)
  })
})
