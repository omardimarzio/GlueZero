// circuit-breaker.test.ts — Test deterministici per PerRouteCircuitBreaker (D-99 opt-in).
//
// Coverage:
// - State machine 3 states: closed → open → half-open → closed
// - canExecute: true in closed/half-open, false in open
// - recordFailure threshold → transition closed → open
// - recordSuccess in closed/half-open: reset counter / transition → closed
// - cooldownMs expiry → transition automatica open → half-open al canExecute
// - half-open + recordFailure → open ricaricato (cooldown reset)
// - Route diversi indipendenti (per-route state isolation)
// - DEFAULT DISABLED: createCircuitBreakerStrategy() senza config → pass-through
// - getState: ritorna stato corrente per Inspector debug
//
// Pattern: vi.useFakeTimers() per testare cooldown expiry deterministico.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCircuitBreakerStrategy } from './circuit-breaker'

describe('createCircuitBreakerStrategy — PerRouteCircuitBreaker (D-99 opt-in DISABLED default)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('Test 1: canExecute("r1") con state default "closed" → true', () => {
    const cb = createCircuitBreakerStrategy({
      config: { threshold: 5, cooldownMs: 100 },
    })
    expect(cb.canExecute('r1')).toBe(true)
    expect(cb.getState('r1')).toBe('closed')
  })

  it('Test 2: recordFailure() N=4 volte (threshold:5) → state still "closed" (canExecute true)', () => {
    const cb = createCircuitBreakerStrategy({
      config: { threshold: 5, cooldownMs: 100 },
    })
    for (let i = 0; i < 4; i++) {
      cb.recordFailure('r1')
    }
    expect(cb.canExecute('r1')).toBe(true)
    expect(cb.getState('r1')).toBe('closed')
  })

  it('Test 3: recordFailure() 5° volta (threshold) → state "open" (canExecute false)', () => {
    const cb = createCircuitBreakerStrategy({
      config: { threshold: 5, cooldownMs: 100 },
    })
    for (let i = 0; i < 5; i++) {
      cb.recordFailure('r1')
    }
    expect(cb.getState('r1')).toBe('open')
    expect(cb.canExecute('r1')).toBe(false)
  })

  it('Test 4: recordSuccess in "closed" → reset counter (4 fail + success + 5 fail → ancora closed)', () => {
    const cb = createCircuitBreakerStrategy({
      config: { threshold: 5, cooldownMs: 100 },
    })
    // 4 fail → still closed
    for (let i = 0; i < 4; i++) {
      cb.recordFailure('r1')
    }
    // success in closed → reset counter
    cb.recordSuccess('r1')
    // 4 fail di nuovo → still closed (counter reset, non raggiunge threshold)
    for (let i = 0; i < 4; i++) {
      cb.recordFailure('r1')
    }
    expect(cb.getState('r1')).toBe('closed')
    expect(cb.canExecute('r1')).toBe(true)
  })

  it('Test 5: state "open" + cooldownMs:100ms passati → canExecute("r1") true (transition "half-open")', () => {
    const cb = createCircuitBreakerStrategy({
      config: { threshold: 5, cooldownMs: 100 },
    })
    for (let i = 0; i < 5; i++) {
      cb.recordFailure('r1')
    }
    expect(cb.getState('r1')).toBe('open')

    // Avanza il timer oltre cooldownMs
    vi.advanceTimersByTime(101)

    expect(cb.canExecute('r1')).toBe(true)
    expect(cb.getState('r1')).toBe('half-open')
  })

  it('Test 6: state "half-open" + recordSuccess → state "closed", counter reset', () => {
    const cb = createCircuitBreakerStrategy({
      config: { threshold: 5, cooldownMs: 100 },
    })
    // Vai in open
    for (let i = 0; i < 5; i++) {
      cb.recordFailure('r1')
    }
    // Cooldown passato → half-open via canExecute
    vi.advanceTimersByTime(101)
    cb.canExecute('r1')
    expect(cb.getState('r1')).toBe('half-open')

    // success in half-open → closed
    cb.recordSuccess('r1')
    expect(cb.getState('r1')).toBe('closed')

    // counter reset: 4 fail → still closed (non raggiunge threshold)
    for (let i = 0; i < 4; i++) {
      cb.recordFailure('r1')
    }
    expect(cb.getState('r1')).toBe('closed')
  })

  it('Test 7: state "half-open" + recordFailure → state "open" ricaricato (cooldown reset)', () => {
    const cb = createCircuitBreakerStrategy({
      config: { threshold: 5, cooldownMs: 100 },
    })
    // Vai in open
    for (let i = 0; i < 5; i++) {
      cb.recordFailure('r1')
    }
    // Cooldown passato → half-open via canExecute
    vi.advanceTimersByTime(101)
    cb.canExecute('r1')
    expect(cb.getState('r1')).toBe('half-open')

    // failure in half-open → open ricaricato
    cb.recordFailure('r1')
    expect(cb.getState('r1')).toBe('open')
    expect(cb.canExecute('r1')).toBe(false)

    // Cooldown nuovo deve essere ricaricato — verifica con avanzo parziale: ancora open
    vi.advanceTimersByTime(50)
    expect(cb.getState('r1')).toBe('open')
    expect(cb.canExecute('r1')).toBe(false)
    // Avanzo completo → di nuovo half-open
    vi.advanceTimersByTime(60)
    expect(cb.canExecute('r1')).toBe(true)
    expect(cb.getState('r1')).toBe('half-open')
  })

  it('Test 8: route diversi indipendenti — recordFailure("r1") non influenza "r2"', () => {
    const cb = createCircuitBreakerStrategy({
      config: { threshold: 3, cooldownMs: 100 },
    })
    // r1 va in open
    for (let i = 0; i < 3; i++) {
      cb.recordFailure('r1')
    }
    expect(cb.getState('r1')).toBe('open')
    // r2 NON è influenzato
    expect(cb.getState('r2')).toBe('closed')
    expect(cb.canExecute('r2')).toBe(true)

    // recordFailure 2 volte su r2: ancora closed (threshold:3)
    cb.recordFailure('r2')
    cb.recordFailure('r2')
    expect(cb.getState('r2')).toBe('closed')
    expect(cb.canExecute('r2')).toBe(true)
  })

  it('Test 9: pass-through default — createCircuitBreakerStrategy() SENZA config → canExecute sempre true (DISABILITATO)', () => {
    const cb = createCircuitBreakerStrategy()

    // Senza config → ANY recordFailure NON influenza nulla
    for (let i = 0; i < 100; i++) {
      cb.recordFailure('r1')
    }
    expect(cb.canExecute('r1')).toBe(true)
    expect(cb.getState('r1')).toBe('closed')

    // Anche dopo lunghi delay
    vi.advanceTimersByTime(60_000)
    expect(cb.canExecute('r1')).toBe(true)
  })

  it('Test 10: getState("r1") ritorna stato corrente (closed/open/half-open)', () => {
    const cb = createCircuitBreakerStrategy({
      config: { threshold: 2, cooldownMs: 50 },
    })
    expect(cb.getState('r1')).toBe('closed')

    cb.recordFailure('r1')
    cb.recordFailure('r1')
    expect(cb.getState('r1')).toBe('open')

    vi.advanceTimersByTime(60)
    expect(cb.getState('r1')).toBe('half-open')

    cb.recordSuccess('r1')
    expect(cb.getState('r1')).toBe('closed')
  })
})
