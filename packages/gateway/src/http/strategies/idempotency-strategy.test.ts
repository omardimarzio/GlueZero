// idempotency-strategy.test.ts — Test deterministici per AutoIdempotency (D-70 + Pitfall 3).
//
// Coverage:
// - Factory shape (generate + headerName methods)
// - nanoid generation (default 21-char URL-safe)
// - Token persistence per eventId (Pitfall 3 fix — chiave riusata sui retry)
// - Diversi eventId → diversi token
// - headerName default 'Idempotency-Key' (Stripe/AWS standard) + custom override
// - tokenFactory custom override per test determinismo
// - LRU bounded (maxEventsTracked) per evitare memory leak

import { describe, expect, it } from 'vitest'
import { createIdempotencyStrategy } from './idempotency-strategy'

describe('createIdempotencyStrategy — AutoIdempotency (D-70 + Pitfall 3)', () => {
  it('Test 1: createIdempotencyStrategy() ritorna istanza con generate + headerName methods', () => {
    const strategy = createIdempotencyStrategy()
    expect(strategy).toBeDefined()
    expect(typeof strategy.generate).toBe('function')
    expect(typeof strategy.headerName).toBe('function')
  })

  it('Test 2: generate(eventId) ritorna stringa nanoid 21-char default', () => {
    const strategy = createIdempotencyStrategy()
    const token = strategy.generate('event-1')
    expect(typeof token).toBe('string')
    // nanoid default size = 21 chars
    expect(token.length).toBe(21)
  })

  it('Test 3: generate("event-1") chiamato 3 volte ritorna SEMPRE lo STESSO token (Pitfall 3 persistence)', () => {
    const strategy = createIdempotencyStrategy()
    const tokenA = strategy.generate('event-1')
    const tokenB = strategy.generate('event-1')
    const tokenC = strategy.generate('event-1')
    expect(tokenA).toBe(tokenB)
    expect(tokenB).toBe(tokenC)
  })

  it('Test 4: generate("event-1") !== generate("event-2") (diversi eventId → diversi token)', () => {
    const strategy = createIdempotencyStrategy()
    const tokenA = strategy.generate('event-1')
    const tokenB = strategy.generate('event-2')
    expect(tokenA).not.toBe(tokenB)
  })

  it('Test 5: headerName() ritorna "Idempotency-Key" default (Stripe/AWS standard)', () => {
    const strategy = createIdempotencyStrategy()
    expect(strategy.headerName()).toBe('Idempotency-Key')
  })

  it('Test 6: createIdempotencyStrategy({ headerName: "X-Idempotency" }) → headerName ritorna custom', () => {
    const strategy = createIdempotencyStrategy({ headerName: 'X-Idempotency' })
    expect(strategy.headerName()).toBe('X-Idempotency')
  })

  it('Test 7: createIdempotencyStrategy({ tokenFactory: () => "fixed-test-token" }) → generate ritorna fixed', () => {
    const strategy = createIdempotencyStrategy({ tokenFactory: () => 'fixed-test-token' })
    expect(strategy.generate('event-1')).toBe('fixed-test-token')
    // Persistence ancora rispettata: stesso eventId → stesso token (anche se factory deterministica)
    expect(strategy.generate('event-1')).toBe('fixed-test-token')
  })

  it('Test 8: dopo 1000 generate distinti con maxEventsTracked:100 → Map size limited a 100 (LRU bounded)', () => {
    let counter = 0
    const strategy = createIdempotencyStrategy({
      tokenFactory: () => `token-${counter++}`,
      maxEventsTracked: 100,
    })
    // Genera 1000 eventId distinti
    for (let i = 0; i < 1000; i++) {
      strategy.generate(`event-${i}`)
    }
    // Verifica indirettamente la cap: il primo eventId NON deve più persistere
    // (è stato evicted) → nuova generate ritorna NUOVO token (counter incrementa)
    const counterBefore = counter
    strategy.generate('event-0')
    // Se 'event-0' è stato evicted, viene generato un nuovo token (counter++)
    expect(counter).toBe(counterBefore + 1)
  })
})
