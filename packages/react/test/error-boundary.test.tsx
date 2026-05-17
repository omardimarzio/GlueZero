/**
 * Tier-1 jsdom tests per `<GlueZeroErrorBoundary>` (Task 4 — Phase 17 W2 P02).
 *
 * Verifica D-V2-F17-03:
 * - Renderizza children quando nessun errore
 * - Cattura errore e renderizza fallback default
 * - Custom fallback invocato con {error, reset}
 * - Publish topic F8 `microfrontend.runtime.failed` su broker
 * - Lookup SERVICE_FALLBACKS graceful degradation (NO throw se non installato)
 *
 * @see GlueZeroErrorBoundary
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
import { createBroker } from '@gluezero/core'
import type { BrokerEvent } from '@gluezero/core'
import { GlueZeroProvider, GlueZeroErrorBoundary } from '../src/index.js'

function Bomb(): never {
  throw new Error('boom')
}

describe('GlueZeroErrorBoundary', () => {
  it('renderizza children quando non c\'è errore', () => {
    const broker = createBroker({})
    render(
      <GlueZeroProvider broker={broker}>
        <GlueZeroErrorBoundary>
          <span data-testid="ok">ok</span>
        </GlueZeroErrorBoundary>
      </GlueZeroProvider>,
    )
    expect(screen.getByTestId('ok').textContent).toBe('ok')
  })

  it('cattura errore figlio + renderizza fallback default (role="alert")', () => {
    const broker = createBroker({})
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <GlueZeroProvider broker={broker}>
          <GlueZeroErrorBoundary>
            <Bomb />
          </GlueZeroErrorBoundary>
        </GlueZeroProvider>,
      )
      expect(screen.getByRole('alert').textContent).toContain('boom')
    } finally {
      spy.mockRestore()
    }
  })

  it('publica microfrontend.runtime.failed su broker quando errore catturato', () => {
    const broker = createBroker({})
    const received: BrokerEvent[] = []
    broker.subscribe('microfrontend.runtime.failed', (e) => {
      received.push(e)
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <GlueZeroProvider broker={broker}>
          <GlueZeroErrorBoundary microFrontendId="mf-test">
            <Bomb />
          </GlueZeroErrorBoundary>
        </GlueZeroProvider>,
      )
      expect(received).toHaveLength(1)
      const payload = received[0]?.payload as {
        microFrontendId?: string
        error?: { message?: string }
      }
      expect(payload?.microFrontendId).toBe('mf-test')
      expect(payload?.error?.message).toBe('boom')
    } finally {
      spy.mockRestore()
    }
  })

  it('invoca fallback prop custom quando errore catturato', () => {
    const broker = createBroker({})
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <GlueZeroProvider broker={broker}>
          <GlueZeroErrorBoundary
            fallback={({ error }) => (
              <span data-testid="custom">caught: {error.message}</span>
            )}
          >
            <Bomb />
          </GlueZeroErrorBoundary>
        </GlueZeroProvider>,
      )
      expect(screen.getByTestId('custom').textContent).toBe('caught: boom')
    } finally {
      spy.mockRestore()
    }
  })

  it('reset() ripristina lo stato del boundary (custom fallback retry pattern)', () => {
    const broker = createBroker({})
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      let resetFn: (() => void) | null = null
      const { rerender } = render(
        <GlueZeroProvider broker={broker}>
          <GlueZeroErrorBoundary
            fallback={({ error, reset }) => {
              resetFn = reset
              return <span data-testid="custom">err: {error.message}</span>
            }}
          >
            <Bomb />
          </GlueZeroErrorBoundary>
        </GlueZeroProvider>,
      )
      expect(screen.getByTestId('custom').textContent).toContain('boom')
      expect(typeof resetFn).toBe('function')
      // Reset boundary state
      resetFn!()
      // Re-render con children "safe"
      rerender(
        <GlueZeroProvider broker={broker}>
          <GlueZeroErrorBoundary
            fallback={({ error, reset }) => {
              resetFn = reset
              return <span data-testid="custom">err: {error.message}</span>
            }}
          >
            <span data-testid="safe">safe</span>
          </GlueZeroErrorBoundary>
        </GlueZeroProvider>,
      )
      expect(screen.queryByTestId('safe')?.textContent).toBe('safe')
    } finally {
      spy.mockRestore()
    }
  })

  it('NO throw se SERVICE_FALLBACKS non installato (graceful degradation)', () => {
    const broker = createBroker({})
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() =>
        render(
          <GlueZeroProvider broker={broker}>
            <GlueZeroErrorBoundary microFrontendId="mf-x">
              <Bomb />
            </GlueZeroErrorBoundary>
          </GlueZeroProvider>,
        ),
      ).not.toThrow()
    } finally {
      spy.mockRestore()
    }
  })

  it('delega SERVICE_FALLBACKS.onRuntimeError quando installato', () => {
    const broker = createBroker({})
    const onRuntimeErrorMock = vi.fn()
    // Inietta service mock direttamente (simula F14 fallbacksModule install)
    ;(broker as unknown as { getService: (key: string) => unknown }).getService = (key: string) => {
      if (key === 'fallbacks') {
        return { onRuntimeError: onRuntimeErrorMock }
      }
      return undefined
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      render(
        <GlueZeroProvider broker={broker}>
          <GlueZeroErrorBoundary microFrontendId="mf-test">
            <Bomb />
          </GlueZeroErrorBoundary>
        </GlueZeroProvider>,
      )
      expect(onRuntimeErrorMock).toHaveBeenCalledTimes(1)
      expect(onRuntimeErrorMock.mock.calls[0]?.[0]).toBe('mf-test')
      expect((onRuntimeErrorMock.mock.calls[0]?.[1] as Error).message).toBe('boom')
    } finally {
      spy.mockRestore()
    }
  })
})
