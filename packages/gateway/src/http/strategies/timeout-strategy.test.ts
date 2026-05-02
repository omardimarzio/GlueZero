// timeout-strategy.test.ts — Test deterministici per FixedTimeout (D-68 default).
//
// Coverage:
// - Factory ritorna istanza con `signal(ms)` method
// - `signal(ms)` ritorna AbortSignal valido (ES2022 nativo)
// - signal abort dopo il timeout specificato
// - signal(0) abort immediato (next microtask)

import { describe, expect, it } from 'vitest'
import { createTimeoutStrategy } from './timeout-strategy'

describe('createTimeoutStrategy — FixedTimeout (D-68)', () => {
  it('Test 1: createTimeoutStrategy() ritorna istanza con signal(ms) method', () => {
    const strategy = createTimeoutStrategy()
    expect(strategy).toBeDefined()
    expect(typeof strategy.signal).toBe('function')
  })

  it('Test 2: signal(100) ritorna AbortSignal valido', () => {
    const strategy = createTimeoutStrategy()
    const sig = strategy.signal(100)
    expect(sig).toBeDefined()
    // AbortSignal istanza check
    expect(sig).toBeInstanceOf(AbortSignal)
    // Initially not aborted
    expect(sig.aborted).toBe(false)
  })

  it('Test 3: signal(50) aborts dopo ~50ms', async () => {
    const strategy = createTimeoutStrategy()
    const sig = strategy.signal(50)
    expect(sig.aborted).toBe(false)
    // Wait > 50ms
    await new Promise<void>((resolve) => setTimeout(resolve, 80))
    expect(sig.aborted).toBe(true)
  })

  it('Test 4: signal(0) aborts immediatamente (entro 1 macrotask)', async () => {
    const strategy = createTimeoutStrategy()
    const sig = strategy.signal(0)
    // Wait 1 macrotask per dar tempo al timer 0ms di scattare
    await new Promise<void>((resolve) => setTimeout(resolve, 5))
    expect(sig.aborted).toBe(true)
  })
})
