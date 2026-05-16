/**
 * Tier-1 jsdom tests per `useGlueZeroPublish` (Task 3 — Phase 17 W2 P02).
 *
 * Verifica:
 * - Funzione publish stable identity across re-render
 * - Auto-iniezione `metadata.microFrontendId` quando mfContext presente
 * - NO auto-iniezione quando mfContext assente
 *
 * @see useGlueZeroPublish
 */
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
import type { ReactNode } from 'react'
import { createBroker } from '@gluezero/core'
import type { BrokerEvent } from '@gluezero/core'
import { GlueZeroProvider } from '../../src/index.js'
import { useGlueZeroPublish } from '../../src/hooks/use-gluezero-publish.js'

function makeWrapper(broker: ReturnType<typeof createBroker>, mfContext?: unknown) {
  return ({ children }: { children: ReactNode }) =>
    mfContext !== undefined ? (
      <GlueZeroProvider broker={broker} mfContext={mfContext as never}>
        {children}
      </GlueZeroProvider>
    ) : (
      <GlueZeroProvider broker={broker}>{children}</GlueZeroProvider>
    )
}

describe('useGlueZeroPublish', () => {
  it('ritorna funzione che invoca broker.publish', () => {
    const broker = createBroker({})
    const received: BrokerEvent[] = []
    broker.subscribe('test.topic', (e) => {
      received.push(e)
    })
    const { result } = renderHook(() => useGlueZeroPublish(), {
      wrapper: makeWrapper(broker),
    })
    act(() => {
      result.current('test.topic', { a: 1 }, { source: { type: 'component', id: 'test' }, deliveryMode: 'sync' })
    })
    expect(received).toHaveLength(1)
    expect(received[0]?.payload).toEqual({ a: 1 })
  })

  it('auto-inietta metadata.microFrontendId quando mfContext presente', () => {
    const broker = createBroker({})
    const received: BrokerEvent[] = []
    broker.subscribe('test.topic', (e) => {
      received.push(e)
    })
    const mfContext = {
      id: 'mf-cart',
      descriptor: {} as never,
      broker,
      publish: () => {},
      subscribe: () => ({ unsubscribe: () => {} }),
    }
    const { result } = renderHook(() => useGlueZeroPublish(), {
      wrapper: makeWrapper(broker, mfContext),
    })
    act(() => {
      result.current('test.topic', { sku: 'X' }, { source: { type: 'component', id: 'test' }, deliveryMode: 'sync' })
    })
    expect((received[0]?.metadata as { microFrontendId?: string } | undefined)?.microFrontendId).toBe(
      'mf-cart',
    )
  })

  it('NON auto-inietta metadata.microFrontendId quando mfContext assente', () => {
    const broker = createBroker({})
    const received: BrokerEvent[] = []
    broker.subscribe('test.topic', (e) => {
      received.push(e)
    })
    const { result } = renderHook(() => useGlueZeroPublish(), {
      wrapper: makeWrapper(broker),
    })
    act(() => {
      result.current('test.topic', { sku: 'X' }, { source: { type: 'component', id: 'test' }, deliveryMode: 'sync' })
    })
    expect((received[0]?.metadata as { microFrontendId?: string } | undefined)?.microFrontendId).toBeUndefined()
  })

  it('ritorna funzione stable identità across re-render', () => {
    const broker = createBroker({})
    const { result, rerender } = renderHook(() => useGlueZeroPublish(), {
      wrapper: makeWrapper(broker),
    })
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })

  it('metadata custom forniti dal caller vengono preservati', () => {
    const broker = createBroker({})
    const received: BrokerEvent[] = []
    broker.subscribe('test.topic', (e) => {
      received.push(e)
    })
    const mfContext = {
      id: 'mf-cart',
      descriptor: {} as never,
      broker,
      publish: () => {},
      subscribe: () => ({ unsubscribe: () => {} }),
    }
    const { result } = renderHook(() => useGlueZeroPublish(), {
      wrapper: makeWrapper(broker, mfContext),
    })
    act(() => {
      result.current(
        'test.topic',
        { x: 1 },
        {
          source: { type: 'component', id: 'test' },
          metadata: { customKey: 'customValue' },
          deliveryMode: 'sync',
        },
      )
    })
    const meta = received[0]?.metadata as {
      microFrontendId?: string
      customKey?: string
    } | undefined
    expect(meta?.microFrontendId).toBe('mf-cart')
    expect(meta?.customKey).toBe('customValue')
  })
})
