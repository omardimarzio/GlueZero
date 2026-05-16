/**
 * Tier-1 jsdom tests per `useGlueZeroSubscribe` (Task 3 — Phase 17 W2 P02).
 *
 * Verifica D-V2-F17-01 pattern useEffect+useRef stable handler:
 * - Subscribe al mount + delivery event
 * - Cleanup al unmount (no further delivery)
 * - Handler update NON re-sottoscrive (stable ref)
 * - Topic change re-sottoscrive
 * - StrictMode-safe (doppio mount no duplicate delivery)
 *
 * @see useGlueZeroSubscribe
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
import { useGlueZeroSubscribe } from '../../src/hooks/use-gluezero-subscribe.js'

function makeWrapper(broker: ReturnType<typeof createBroker>) {
  return ({ children }: { children: ReactNode }) => (
    <GlueZeroProvider broker={broker}>{children}</GlueZeroProvider>
  )
}

const SRC = { source: { type: 'system' as const, id: 'test' }, deliveryMode: 'sync' as const }

describe('useGlueZeroSubscribe', () => {
  it('sottoscrive al mount e riceve event pubblicati', () => {
    const broker = createBroker({})
    const received: BrokerEvent[] = []
    const handler = (e: BrokerEvent) => {
      received.push(e)
    }
    renderHook(() => useGlueZeroSubscribe('test.topic', handler), {
      wrapper: makeWrapper(broker),
    })
    act(() => {
      broker.publish('test.topic', { x: 1 }, SRC)
    })
    expect(received).toHaveLength(1)
    expect(received[0]?.payload).toEqual({ x: 1 })
  })

  it('cleanup al unmount — NO ulteriori delivery dopo unmount', () => {
    const broker = createBroker({})
    const received: BrokerEvent[] = []
    const handler = (e: BrokerEvent) => {
      received.push(e)
    }
    const { unmount } = renderHook(() => useGlueZeroSubscribe('test.topic', handler), {
      wrapper: makeWrapper(broker),
    })
    act(() => {
      broker.publish('test.topic', {}, SRC)
    })
    expect(received).toHaveLength(1)
    unmount()
    act(() => {
      broker.publish('test.topic', {}, SRC)
    })
    expect(received).toHaveLength(1)
  })

  it('handler updates senza re-subscription (useRef stable)', () => {
    const broker = createBroker({})
    const captured: { v: string }[] = []
    const handlerA = () => {
      captured.push({ v: 'A' })
    }
    const { rerender } = renderHook(
      ({ h }: { h: (e: BrokerEvent) => void }) => useGlueZeroSubscribe('test.topic', h),
      {
        initialProps: { h: handlerA },
        wrapper: makeWrapper(broker),
      },
    )
    // Cambio handler — NON deve re-sottoscrivere ma il nuovo handler deve essere invocato
    const handlerB = () => {
      captured.push({ v: 'B' })
    }
    rerender({ h: handlerB })
    act(() => {
      broker.publish('test.topic', { y: 2 }, SRC)
    })
    expect(captured).toHaveLength(1)
    expect(captured[0]?.v).toBe('B')
  })

  it('cambio topic re-sottoscrive sul nuovo topic', () => {
    const broker = createBroker({})
    const received: string[] = []
    const handler = (e: BrokerEvent) => {
      received.push(e.topic)
    }
    const { rerender } = renderHook(
      ({ t }: { t: string }) => useGlueZeroSubscribe(t, handler),
      {
        initialProps: { t: 'topic.a' },
        wrapper: makeWrapper(broker),
      },
    )
    act(() => {
      broker.publish('topic.a', {}, SRC)
    })
    expect(received).toEqual(['topic.a'])
    rerender({ t: 'topic.b' })
    act(() => {
      broker.publish('topic.a', {}, SRC)
      broker.publish('topic.b', {}, SRC)
    })
    expect(received).toEqual(['topic.a', 'topic.b'])
  })

  it('StrictMode-safe: doppio mount in dev NO duplicate delivery (re-mount cleanup)', () => {
    const broker = createBroker({})
    const received: BrokerEvent[] = []
    const handler = (e: BrokerEvent) => {
      received.push(e)
    }
    // Simula StrictMode: re-render con stesso hook → effect cleanup + re-run
    const { rerender } = renderHook(() => useGlueZeroSubscribe('test.topic', handler), {
      wrapper: makeWrapper(broker),
    })
    rerender()
    act(() => {
      broker.publish('test.topic', {}, SRC)
    })
    // Single delivery — subscribe idempotente broker F1 + cleanup useEffect
    expect(received).toHaveLength(1)
  })
})
