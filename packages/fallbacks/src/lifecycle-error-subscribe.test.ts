/**
 * `lifecycle-error-subscribe.test.ts` — Tier-1 unit suite (jsdom) per `installErrorSubscribe`.
 *
 * Cover REQ-IDs: MF-FALLBACK-04 entry-point dispatch chain (W2 P02 closure).
 *
 * 16 test totali:
 *  1. Subscribe esattamente 7 volte (uno per MF_ERROR_TOPIC).
 *  2. Ogni subscribe usa `deliveryMode:"sync"` (carryover F11 pattern).
 *  3-9. Dispatch con phase narrowing per ognuno dei 7 phase (load/bootstrap/mount/runtime/update/unmount/destroy).
 * 10. Payload.phase preferito su topic-literal split (defensive).
 * 11. AbortSignal cascade: ctrl.abort() → 7 unsubscribe.
 * 12. AbortSignal pre-abortito: teardown immediato alla install.
 * 13. Handle.unsubscribeAll() per cleanup manuale.
 * 14. Dispatch chiamato esattamente 1 volta per evento (no double-dispatch).
 * 15. Topic NON-MF_ERROR non triggera dispatch (subscribe isolation).
 * 16. Per-MF isolation: 2 eventi con mfId diversi → 2 dispatch separati.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  installErrorSubscribe,
  type ErrorChainArgs,
} from './lifecycle-error-subscribe.js'

/**
 * Mock minimale di Broker.subscribe per Tier-1 unit isolato.
 * Pattern carryover F13 `lifecycle-register-hook.test.ts`.
 */
function createMockBroker() {
  type Handler = (event: { topic: string; payload: unknown }) => void
  const handlers = new Map<string, Set<Handler>>()
  const subscriptions: Array<{ topic: string; handler: Handler; opts?: unknown }> = []
  const unsubscribeFn = vi.fn()

  const subscribe = vi.fn((topic: string, handler: Handler, opts?: unknown) => {
    if (!handlers.has(topic)) handlers.set(topic, new Set())
    handlers.get(topic)!.add(handler)
    subscriptions.push({ topic, handler, opts })
    return {
      unsubscribe: () => {
        handlers.get(topic)?.delete(handler)
        unsubscribeFn()
      },
    }
  })

  function publish(topic: string, payload: unknown): void {
    const set = handlers.get(topic)
    if (!set) return
    for (const h of set) h({ topic, payload })
  }

  return {
    subscribe,
    publish,
    unsubscribeFn,
    subscriptions,
  }
}

describe('installErrorSubscribe', () => {
  let broker: ReturnType<typeof createMockBroker>
  let dispatch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    broker = createMockBroker()
    dispatch = vi.fn()
  })

  it('subscribes exactly 7 times — one per MF_ERROR_TOPIC', () => {
    installErrorSubscribe(broker as never, { dispatch })
    expect(broker.subscribe).toHaveBeenCalledTimes(7)
  })

  it('uses deliveryMode:"sync" on every subscribe call', () => {
    installErrorSubscribe(broker as never, { dispatch })
    for (const sub of broker.subscriptions) {
      expect(sub.opts).toMatchObject({ deliveryMode: 'sync' })
    }
  })

  const phases = [
    ['microfrontend.load.failed', 'load'],
    ['microfrontend.bootstrap.failed', 'bootstrap'],
    ['microfrontend.mount.failed', 'mount'],
    ['microfrontend.runtime.failed', 'runtime'],
    ['microfrontend.update.failed', 'update'],
    ['microfrontend.unmount.failed', 'unmount'],
    ['microfrontend.destroy.failed', 'destroy'],
  ] as const

  for (const [topic, phase] of phases) {
    it(`dispatches with phase="${phase}" on topic="${topic}"`, () => {
      installErrorSubscribe(broker as never, { dispatch })
      broker.publish(topic, {
        id: 'mf-x',
        phase,
        error: { message: 'err' },
        recoverable: true,
        timestamp: Date.now(),
      })
      expect(dispatch).toHaveBeenCalledTimes(1)
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ mfId: 'mf-x', phase, recoverable: true }),
      )
    })
  }

  it('prefers payload.phase over topic-literal split for phase derivation', () => {
    installErrorSubscribe(broker as never, { dispatch })
    // Emit on load topic but payload.phase = bootstrap (legacy/edge case)
    broker.publish('microfrontend.load.failed', {
      id: 'mf-x',
      phase: 'bootstrap',
      error: { message: 'err' },
      recoverable: false,
      timestamp: Date.now(),
    })
    const call = dispatch.mock.calls[0]![0] as ErrorChainArgs
    expect(call.phase).toBe('bootstrap')
  })

  it('AbortSignal cascade: ctrl.abort() unsubscribes all 7 handlers', () => {
    const ctrl = new AbortController()
    installErrorSubscribe(broker as never, { dispatch, signal: ctrl.signal })
    ctrl.abort()
    expect(broker.unsubscribeFn).toHaveBeenCalledTimes(7)
    // Successive emit non triggera dispatch
    broker.publish('microfrontend.load.failed', {
      id: 'mf-x',
      phase: 'load',
      error: { message: 'err' },
      recoverable: true,
      timestamp: 0,
    })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('AbortSignal already aborted: immediate unsubscribe at install', () => {
    const ctrl = new AbortController()
    ctrl.abort()
    installErrorSubscribe(broker as never, { dispatch, signal: ctrl.signal })
    expect(broker.unsubscribeFn).toHaveBeenCalledTimes(7)
  })

  it('returns handle with unsubscribeAll() for manual cleanup', () => {
    const handle = installErrorSubscribe(broker as never, { dispatch })
    expect(typeof handle.unsubscribeAll).toBe('function')
    handle.unsubscribeAll()
    expect(broker.unsubscribeFn).toHaveBeenCalledTimes(7)
  })

  it('dispatch invoked exactly once per event (no double-dispatch)', () => {
    installErrorSubscribe(broker as never, { dispatch })
    broker.publish('microfrontend.mount.failed', {
      id: 'mf-1',
      phase: 'mount',
      error: { message: 'm' },
      recoverable: true,
      timestamp: 0,
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('non-MF_ERROR_TOPIC events do not trigger dispatch (subscribe isolation)', () => {
    installErrorSubscribe(broker as never, { dispatch })
    broker.publish('microfrontend.fallback.rendered', {
      microFrontendId: 'mf-x',
      lifecyclePhase: 'load',
      fallbackType: 'html',
      timestamp: 0,
    })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('per-MF dispatch isolation: 2 events different mfIds → 2 separate dispatches', () => {
    installErrorSubscribe(broker as never, { dispatch })
    broker.publish('microfrontend.load.failed', {
      id: 'mf-A',
      phase: 'load',
      error: { message: 'a' },
      recoverable: true,
      timestamp: 0,
    })
    broker.publish('microfrontend.load.failed', {
      id: 'mf-B',
      phase: 'load',
      error: { message: 'b' },
      recoverable: true,
      timestamp: 0,
    })
    expect(dispatch).toHaveBeenCalledTimes(2)
    const ids = dispatch.mock.calls.map((c) => (c[0] as ErrorChainArgs).mfId)
    expect(ids).toEqual(['mf-A', 'mf-B'])
  })
})
