/**
 * `CircuitBreaker` test suite Tier-1 (jsdom, vi.useFakeTimers + mock broker).
 *
 * 20+ test scenari coverage MF-FALLBACK-03:
 * - Default `enabled:false` → pass-through (canExecute=true, no state change, no emit).
 * - State machine 3-state: `closed → open` (su threshold), `open → half-open` (lazy
 *   post `resetAfterMs`), `half-open → closed` (su recordSuccess), `half-open →
 *   open` (su recordFailure re-open + emit nuovo opened).
 * - Topic emit `microfrontend.circuit.opened` + `microfrontend.circuit.closed` con
 *   source descriptor F1 D-23 (`{id:'fallbacks', name:'@gluezero/fallbacks'}`) +
 *   `deliveryMode:'sync'`.
 * - Debounce double-emit (no re-emit su ulteriori failure in open).
 * - Per-MF isolation (Map<mfId, CircuitState>).
 * - dispose(mfId) cleanup P-02 (memory leak on unregister).
 *
 * @see packages/fallbacks/src/circuit-breaker.ts — Implementation under test
 * @see D-V2-F14-11 — CircuitBreaker per-MF state machine
 * @see D-V2-F14-12 — Circuit→retry order
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCircuitBreaker } from './circuit-breaker.js'

function createMockBroker(): { publish: ReturnType<typeof vi.fn> } {
  return { publish: vi.fn() }
}

describe('CircuitBreaker — disabled (enabled:false)', () => {
  let broker: ReturnType<typeof createMockBroker>
  let cb: ReturnType<typeof createCircuitBreaker>

  beforeEach(() => {
    broker = createMockBroker()
    cb = createCircuitBreaker(broker as never)
  })

  it('canExecute sempre true quando MF mai visto', () => {
    expect(cb.canExecute('mf-X')).toBe(true)
  })

  it('recordFailure con enabled:false è no-op (no state change, no topic emit)', () => {
    const policy = {
      enabled: false,
      failureThreshold: 3,
      resetAfterMs: 1000,
    }
    cb.recordFailure('mf-A', policy)
    cb.recordFailure('mf-A', policy)
    cb.recordFailure('mf-A', policy)
    expect(cb.getState('mf-A')).toBe('closed')
    expect(broker.publish).not.toHaveBeenCalled()
  })

  it('recordSuccess con enabled:false è no-op', () => {
    const policy = {
      enabled: false,
      failureThreshold: 3,
      resetAfterMs: 1000,
    }
    cb.recordSuccess('mf-A', policy)
    expect(cb.getState('mf-A')).toBe('closed')
    expect(broker.publish).not.toHaveBeenCalled()
  })
})

describe('CircuitBreaker — closed → open transition', () => {
  let broker: ReturnType<typeof createMockBroker>
  let cb: ReturnType<typeof createCircuitBreaker>
  const policy = { enabled: true, failureThreshold: 3, resetAfterMs: 1000 }

  beforeEach(() => {
    broker = createMockBroker()
    cb = createCircuitBreaker(broker as never)
  })

  it('1 failure: state="closed", no emit', () => {
    cb.recordFailure('mf-A', policy)
    expect(cb.getState('mf-A')).toBe('closed')
    expect(broker.publish).not.toHaveBeenCalled()
  })

  it('2 failures: state="closed", no emit', () => {
    cb.recordFailure('mf-A', policy)
    cb.recordFailure('mf-A', policy)
    expect(cb.getState('mf-A')).toBe('closed')
    expect(broker.publish).not.toHaveBeenCalled()
  })

  it('3 failures: state="open" + emit microfrontend.circuit.opened exactly once', () => {
    cb.recordFailure('mf-A', policy)
    cb.recordFailure('mf-A', policy)
    cb.recordFailure('mf-A', policy)
    expect(cb.getState('mf-A')).toBe('open')
    expect(broker.publish).toHaveBeenCalledTimes(1)
    expect(broker.publish).toHaveBeenCalledWith(
      'microfrontend.circuit.opened',
      expect.objectContaining({
        microFrontendId: 'mf-A',
        consecutiveFailures: 3,
      }),
      expect.objectContaining({
        source: expect.objectContaining({
          id: 'fallbacks',
          name: '@gluezero/fallbacks',
        }),
        deliveryMode: 'sync',
      }),
    )
  })

  it('payload include openedAt + timestamp', () => {
    for (let i = 0; i < 3; i++) cb.recordFailure('mf-A', policy)
    const call = broker.publish.mock.calls[0]
    expect(call[1]).toHaveProperty('openedAt')
    expect(call[1]).toHaveProperty('timestamp')
    expect(typeof (call[1] as { openedAt: number }).openedAt).toBe('number')
    expect(typeof (call[1] as { timestamp: number }).timestamp).toBe('number')
  })

  it('ulteriori recordFailure in stato open NON re-emettono opened (debounce)', () => {
    for (let i = 0; i < 5; i++) cb.recordFailure('mf-A', policy)
    expect(broker.publish).toHaveBeenCalledTimes(1)
  })

  it('canExecute=false in stato open', () => {
    for (let i = 0; i < 3; i++) cb.recordFailure('mf-A', policy)
    expect(cb.canExecute('mf-A')).toBe(false)
  })

  it('source descriptor F1 D-23 type=plugin obbligatorio', () => {
    for (let i = 0; i < 3; i++) cb.recordFailure('mf-A', policy)
    const call = broker.publish.mock.calls[0]
    const opts = call[2] as { source: { type: string; id: string; name: string } }
    expect(opts.source.type).toBe('plugin')
    expect(opts.source.id).toBe('fallbacks')
    expect(opts.source.name).toBe('@gluezero/fallbacks')
  })
})

describe('CircuitBreaker — lazy transition open → half-open', () => {
  let broker: ReturnType<typeof createMockBroker>
  let cb: ReturnType<typeof createCircuitBreaker>
  const policy = { enabled: true, failureThreshold: 3, resetAfterMs: 1000 }

  beforeEach(() => {
    broker = createMockBroker()
    cb = createCircuitBreaker(broker as never)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lazy transition: dopo resetAfterMs, next recordSuccess → state="closed" + emit closed', () => {
    for (let i = 0; i < 3; i++) cb.recordFailure('mf-A', policy)
    expect(cb.getState('mf-A')).toBe('open')
    vi.advanceTimersByTime(1100)
    cb.recordSuccess('mf-A', policy)
    expect(cb.getState('mf-A')).toBe('closed')
    expect(broker.publish).toHaveBeenCalledWith(
      'microfrontend.circuit.closed',
      expect.objectContaining({ microFrontendId: 'mf-A' }),
      expect.any(Object),
    )
  })

  it('half-open + failure → re-open + emit nuovo opened (timer reset)', () => {
    for (let i = 0; i < 3; i++) cb.recordFailure('mf-A', policy)
    expect(broker.publish).toHaveBeenCalledTimes(1) // 1° opened
    vi.advanceTimersByTime(1100)
    cb.recordFailure('mf-A', policy)
    expect(cb.getState('mf-A')).toBe('open')
    // 1° opened + 2° opened (re-open) — debounce solo se gia open
    expect(broker.publish).toHaveBeenCalledTimes(2)
  })

  it('payload circuit.closed include closedAt + timestamp', () => {
    for (let i = 0; i < 3; i++) cb.recordFailure('mf-A', policy)
    vi.advanceTimersByTime(1100)
    cb.recordSuccess('mf-A', policy)
    const closedCall = broker.publish.mock.calls.find(
      (c) => c[0] === 'microfrontend.circuit.closed',
    )
    expect(closedCall).toBeDefined()
    expect(closedCall?.[1]).toHaveProperty('closedAt')
    expect(closedCall?.[1]).toHaveProperty('timestamp')
  })
})

describe('CircuitBreaker — closed state recordSuccess resets counter', () => {
  let broker: ReturnType<typeof createMockBroker>
  let cb: ReturnType<typeof createCircuitBreaker>
  const policy = { enabled: true, failureThreshold: 3, resetAfterMs: 1000 }

  beforeEach(() => {
    broker = createMockBroker()
    cb = createCircuitBreaker(broker as never)
  })

  it('2 fail + 1 success resets counter (no open on next 2 fail)', () => {
    cb.recordFailure('mf-A', policy)
    cb.recordFailure('mf-A', policy)
    cb.recordSuccess('mf-A', policy)
    cb.recordFailure('mf-A', policy)
    cb.recordFailure('mf-A', policy)
    expect(cb.getState('mf-A')).toBe('closed')
    expect(broker.publish).not.toHaveBeenCalled()
  })

  it('recordSuccess in closed NON emette circuit.closed', () => {
    cb.recordSuccess('mf-A', policy)
    expect(broker.publish).not.toHaveBeenCalled()
  })
})

describe('CircuitBreaker — per-MF isolation', () => {
  let broker: ReturnType<typeof createMockBroker>
  let cb: ReturnType<typeof createCircuitBreaker>
  const policy = { enabled: true, failureThreshold: 3, resetAfterMs: 1000 }

  beforeEach(() => {
    broker = createMockBroker()
    cb = createCircuitBreaker(broker as never)
  })

  it('mf-A open NON influenza mf-B closed', () => {
    for (let i = 0; i < 3; i++) cb.recordFailure('mf-A', policy)
    expect(cb.getState('mf-A')).toBe('open')
    expect(cb.getState('mf-B')).toBe('closed')
    expect(cb.canExecute('mf-B')).toBe(true)
  })

  it('getState per mfId mai visto ritorna closed default', () => {
    expect(cb.getState('mf-X')).toBe('closed')
  })
})

describe('CircuitBreaker — dispose cleanup P-02', () => {
  let broker: ReturnType<typeof createMockBroker>
  let cb: ReturnType<typeof createCircuitBreaker>
  const policy = { enabled: true, failureThreshold: 3, resetAfterMs: 1000 }

  beforeEach(() => {
    broker = createMockBroker()
    cb = createCircuitBreaker(broker as never)
  })

  it('dispose(mfId) rimuove state — getState ritorna closed default', () => {
    for (let i = 0; i < 3; i++) cb.recordFailure('mf-A', policy)
    expect(cb.getState('mf-A')).toBe('open')
    cb.dispose('mf-A')
    expect(cb.getState('mf-A')).toBe('closed')
    expect(cb.canExecute('mf-A')).toBe(true)
  })

  it('dispose su mfId mai visto è no-op (no throw)', () => {
    expect(() => cb.dispose('mf-X')).not.toThrow()
  })
})

describe('CircuitBreaker — custom threshold override', () => {
  let broker: ReturnType<typeof createMockBroker>
  let cb: ReturnType<typeof createCircuitBreaker>

  beforeEach(() => {
    broker = createMockBroker()
    cb = createCircuitBreaker(broker as never)
  })

  it('failureThreshold:2 apre dopo 2 fail', () => {
    const policy = { enabled: true, failureThreshold: 2, resetAfterMs: 500 }
    cb.recordFailure('mf-A', policy)
    cb.recordFailure('mf-A', policy)
    expect(cb.getState('mf-A')).toBe('open')
  })

  it('failureThreshold:1 apre dopo 1 fail (aggressive)', () => {
    const policy = { enabled: true, failureThreshold: 1, resetAfterMs: 500 }
    cb.recordFailure('mf-A', policy)
    expect(cb.getState('mf-A')).toBe('open')
  })
})

describe('CircuitBreaker — anti-singleton D-30', () => {
  it('2 createCircuitBreaker indipendenti hanno state Map separati', () => {
    const brokerA = createMockBroker()
    const brokerB = createMockBroker()
    const cbA = createCircuitBreaker(brokerA as never)
    const cbB = createCircuitBreaker(brokerB as never)
    const policy = { enabled: true, failureThreshold: 1, resetAfterMs: 500 }
    cbA.recordFailure('mf-A', policy)
    expect(cbA.getState('mf-A')).toBe('open')
    expect(cbB.getState('mf-A')).toBe('closed')
  })
})
