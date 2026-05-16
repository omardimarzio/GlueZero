/**
 * Tier-3 Playwright Chromium scenario: `GlueZeroErrorBoundary` cattura + publish
 * `microfrontend.runtime.failed`.
 *
 * Verifica error boundary integration in real browser (`componentDidCatch` reale
 * + React 19 error reporting). Tier-1 jsdom NON garantisce stesso comportamento
 * di error boundary su React 19 + Strict + concurrent rendering.
 *
 * @see MF-TEST-03 scenario (React-specific gap-filling)
 * @see D-V2-F17-03 ErrorBoundary built-in class component
 */
import { describe, it, expect, vi } from 'vitest'
import { createBroker } from '@gluezero/core'
import { createReactMicroFrontendLifecycle } from '../../src/factory.js'

function CrashingComponent(): JSX.Element {
  throw new Error('boom in browser')
}

describe('GlueZeroErrorBoundary integration mount — Tier-3 Playwright Chromium', () => {
  it('cattura errore + publica microfrontend.runtime.failed con microFrontendId', async () => {
    const broker = createBroker({})
    const received: Array<{
      payload?: { microFrontendId?: string; error?: { message?: string } }
    }> = []
    broker.subscribe('microfrontend.runtime.failed', (e) => {
      received.push(
        e as unknown as {
          payload?: { microFrontendId?: string; error?: { message?: string } }
        },
      )
    })

    const lifecycle = createReactMicroFrontendLifecycle(CrashingComponent)
    // Minimal mfContext: cast a tipo lifecycle.bootstrap parametro 2
    const mfContext = { id: 'mf-crash' } as unknown as Parameters<
      typeof lifecycle.bootstrap
    >[1]
    const target = document.createElement('div')
    document.body.appendChild(target)

    // Sopprimi React error logs (atteso — il componente crash è intenzionale)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      /* swallow */
    })

    try {
      await lifecycle.bootstrap(broker, mfContext)
      await lifecycle.mount(target)

      // Wait React error boundary stack flush (real browser timing).
      // 2 RAF + setTimeout maggiore — error boundary in React 19 può
      // richiedere fino a 2-3 commit per finalizzarsi.
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => setTimeout(r, 30))

      // ErrorBoundary pubblica con deliveryMode='sync' → received già pieno
      expect(received).toHaveLength(1)
      expect(received[0]?.payload?.microFrontendId).toBe('mf-crash')
      expect(received[0]?.payload?.error?.message).toBe('boom in browser')

      // Default fallback rendered con role="alert"
      const alert = target.querySelector('[role="alert"]')
      expect(alert).not.toBeNull()

      await lifecycle.destroy()
    } finally {
      errorSpy.mockRestore()
      document.body.removeChild(target)
    }
  })
})
