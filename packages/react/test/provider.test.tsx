/**
 * Tier-1 jsdom tests per `<GlueZeroProvider>` + `useGlueZero` + `useMicroFrontendContext`
 * + `useRuntimeContext` (Task 2 — Phase 17 W2 P02).
 *
 * @see GlueZeroProvider
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { createBroker } from '@gluezero/core'

afterEach(() => {
  cleanup()
})
import {
  GlueZeroProvider,
  useGlueZero,
  useGlueZeroBroker,
  useMicroFrontendContext,
  useRuntimeContext,
} from '../src/index.js'

describe('GlueZeroProvider', () => {
  it('renderizza children senza errori', () => {
    const broker = createBroker({})
    render(
      <GlueZeroProvider broker={broker}>
        <span data-testid="child">hello</span>
      </GlueZeroProvider>,
    )
    expect(screen.getByTestId('child').textContent).toBe('hello')
  })

  it('useGlueZero() ritorna il broker passato a Provider (reference-equal)', () => {
    const broker = createBroker({})
    function Probe() {
      const b = useGlueZero()
      return <span data-testid="probe">{b === broker ? 'ok' : 'fail'}</span>
    }
    render(
      <GlueZeroProvider broker={broker}>
        <Probe />
      </GlueZeroProvider>,
    )
    expect(screen.getByTestId('probe').textContent).toBe('ok')
  })

  it('useGlueZeroBroker() alias ritorna il broker (reference-equal)', () => {
    const broker = createBroker({})
    function Probe() {
      const b = useGlueZeroBroker()
      return <span data-testid="probe">{b === broker ? 'ok' : 'fail'}</span>
    }
    render(
      <GlueZeroProvider broker={broker}>
        <Probe />
      </GlueZeroProvider>,
    )
    expect(screen.getByTestId('probe').textContent).toBe('ok')
  })

  it('useGlueZero() fuori Provider lancia Error', () => {
    function Bad() {
      useGlueZero()
      return null
    }
    // Suppress React error log per chiarezza output test
    const origError = console.error
    console.error = () => {}
    try {
      expect(() => render(<Bad />)).toThrow(/GlueZeroProvider/)
    } finally {
      console.error = origError
    }
  })

  it('useMicroFrontendContext() ritorna null se mfContext non passato', () => {
    const broker = createBroker({})
    function Probe() {
      const mf = useMicroFrontendContext()
      return <span data-testid="probe">{mf === null ? 'null' : 'set'}</span>
    }
    render(
      <GlueZeroProvider broker={broker}>
        <Probe />
      </GlueZeroProvider>,
    )
    expect(screen.getByTestId('probe').textContent).toBe('null')
  })

  it('useMicroFrontendContext() ritorna mfContext se passato', () => {
    const broker = createBroker({})
    const mfContext = {
      id: 'mf-1',
      descriptor: {} as never,
      broker,
      publish: () => {},
      subscribe: () => ({ unsubscribe: () => {} }),
    } as never
    function Probe() {
      const mf = useMicroFrontendContext()
      return <span data-testid="probe">{(mf as { id?: string } | null)?.id ?? 'null'}</span>
    }
    render(
      <GlueZeroProvider broker={broker} mfContext={mfContext}>
        <Probe />
      </GlueZeroProvider>,
    )
    expect(screen.getByTestId('probe').textContent).toBe('mf-1')
  })

  it('useRuntimeContext() ritorna stesso valore di useMicroFrontendContext()', () => {
    const broker = createBroker({})
    const mfContext = {
      id: 'mf-runtime',
      descriptor: {} as never,
      broker,
      publish: () => {},
      subscribe: () => ({ unsubscribe: () => {} }),
    } as never
    function Probe() {
      const mf = useMicroFrontendContext()
      const rt = useRuntimeContext()
      return (
        <span data-testid="probe">{mf === rt ? 'same' : 'different'}</span>
      )
    }
    render(
      <GlueZeroProvider broker={broker} mfContext={mfContext}>
        <Probe />
      </GlueZeroProvider>,
    )
    expect(screen.getByTestId('probe').textContent).toBe('same')
  })

  it('useRuntimeContext() ritorna null fuori MF', () => {
    const broker = createBroker({})
    function Probe() {
      const rt = useRuntimeContext()
      return <span data-testid="probe">{rt === null ? 'null' : 'set'}</span>
    }
    render(
      <GlueZeroProvider broker={broker}>
        <Probe />
      </GlueZeroProvider>,
    )
    expect(screen.getByTestId('probe').textContent).toBe('null')
  })
})
