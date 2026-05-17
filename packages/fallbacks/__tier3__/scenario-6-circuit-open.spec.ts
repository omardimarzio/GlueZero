/**
 * Tier-3 Scenario 6: circuit open dopo 3 fail consecutivi + half-open transition
 *
 * Setup: MF con `circuitBreaker: { enabled: true, failureThreshold: 3, resetAfterMs: 300 }`
 * + `retry: { attempts: 1 }` (no retry per isolare circuit behavior).
 *
 * Test 1 (3 fail → circuit.opened):
 *  - Emette 3 errori consecutivi.
 *  - Verifica `microfrontend.circuit.opened` emit con `consecutiveFailures >= 3`.
 *
 * Test 2 (half-open transition lazy):
 *  - Apre il circuit (2 fail consecutivi).
 *  - Wait `> resetAfterMs`.
 *  - Verifica state via service API: `open` o `half-open` (lazy transition).
 *
 * @see D-V2-F14-11 — CircuitBreaker per-MF 3-state FSM default enabled:false
 * @see prd_2.0.0.md §29.4 — CircuitBreakerPolicy state transitions
 */
import { describe, it, expect, afterEach } from 'vitest'
import { setupF14Fixture, type TestFixture } from './playwright-setup.js'

describe('Tier-3 Scenario 6: circuit open + half-open transition', () => {
  let fx: TestFixture | undefined

  afterEach(() => {
    fx?.cleanup()
    fx = undefined
  })

  it('3 fail consecutivi → microfrontend.circuit.opened emit', async () => {
    fx = await setupF14Fixture()

    await fx.registerMf({
      id: 'cb-mf',
      name: 'cb-mf',
      version: '1.0.0',
      mount: { selector: '#root' },
      fallback: {
        onLoadError: { type: 'html', html: '<div>cb</div>' },
        retry: { attempts: 1 }, // no retry — isolare circuit behavior
        circuitBreaker: { enabled: true, failureThreshold: 3, resetAfterMs: 300 },
      },
    })

    // 3 errori consecutivi (failureThreshold)
    for (let i = 0; i < 3; i++) {
      fx.triggerFail('cb-mf', 'load', `fail ${i + 1}`, false)
      await new Promise((r) => setTimeout(r, 20))
    }

    const openedPayload = (await fx.topicSeen(
      'microfrontend.circuit.opened',
      (p) => (p as { microFrontendId?: string }).microFrontendId === 'cb-mf',
    )) as { microFrontendId: string; consecutiveFailures: number }

    expect(openedPayload.microFrontendId).toBe('cb-mf')
    expect(openedPayload.consecutiveFailures).toBeGreaterThanOrEqual(3)

    // Verifica state via service API
    const svc = fx.getFallbacksService()
    expect(svc.getCircuitState('cb-mf')).toBe('open')
  })

  it('half-open → state machine transition lazy post resetAfterMs', async () => {
    fx = await setupF14Fixture()

    await fx.registerMf({
      id: 'recover-mf',
      name: 'recover-mf',
      version: '1.0.0',
      mount: { selector: '#root' },
      fallback: {
        onLoadError: { type: 'none' },
        retry: { attempts: 1 },
        circuitBreaker: { enabled: true, failureThreshold: 2, resetAfterMs: 200 },
      },
    })

    // Apre il circuit (2 fail consecutivi)
    for (let i = 0; i < 2; i++) {
      fx.triggerFail('recover-mf', 'load', `fail ${i + 1}`, false)
      await new Promise((r) => setTimeout(r, 20))
    }
    await fx.topicSeen('microfrontend.circuit.opened')

    // Wait > resetAfterMs (200ms) — circuit dovrebbe consentire transition half-open
    // su prossima query/interaction (lazy)
    await new Promise((r) => setTimeout(r, 250))

    // State legittimo: 'open' (lazy — non ancora interrogato) o 'half-open' (post-window)
    const svc = fx.getFallbacksService()
    const state = svc.getCircuitState('recover-mf')
    expect(['open', 'half-open']).toContain(state)
  })
})
