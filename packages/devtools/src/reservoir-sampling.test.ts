/**
 * F6 reservoir-sampling.test.ts — Tier-1 jsdom (plan 06-06 Task 1).
 *
 * Validazione Algorithm R Vitter 1985 inline (D-165 + RESEARCH §8.2 cite C2):
 * - Fase fill (count < capacity) → assignment diretto
 * - Fase replace (count >= capacity) → Math.random*((count+1)) → if j<capacity replace
 * - count cumulative non-capped, samples capped a capacity
 * - computeSummary p50/p90/p99 quantile pick + edge case empty
 * - Determinismo via Math.random mock (T-06-06-05 mitigation)
 * - Distribuzione uniforme (soft assertion ±10%)
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeSummary, createReservoir, reservoirAdd } from './reservoir-sampling'

describe('reservoir-sampling — Algorithm R Vitter 1985 (D-165)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Test 1: createReservoir(10) ritorna state iniziale corretto', () => {
    const s = createReservoir(10)
    expect(s.capacity).toBe(10)
    expect(s.count).toBe(0)
    expect(s.sum).toBe(0)
    expect(s.samples).toHaveLength(10)
  })

  it('Test 2: fase fill — primi N add popolano direttamente samples[0..N-1]', () => {
    const s = createReservoir(10)
    for (let i = 1; i <= 10; i++) reservoirAdd(s, i)
    expect(s.count).toBe(10)
    expect(s.samples.slice(0, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('Test 3: fase replace — 11° add con Math.random mock j<capacity sostituisce', () => {
    const s = createReservoir(10)
    for (let i = 1; i <= 10; i++) reservoirAdd(s, i)
    // Math.random mock: ritorna 0.0 → j = floor(0.0 * 11) = 0 < 10 → sostituisce samples[0]
    vi.spyOn(Math, 'random').mockReturnValue(0.0)
    reservoirAdd(s, 999)
    expect(s.count).toBe(11)
    expect(s.samples[0]).toBe(999)
  })

  it('Test 3b: fase replace — Math.random mock j>=capacity scarta', () => {
    const s = createReservoir(10)
    for (let i = 1; i <= 10; i++) reservoirAdd(s, i)
    // Math.random mock: ritorna 0.99 → j = floor(0.99 * 11) = 10 (NOT < 10) → scarta
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    reservoirAdd(s, 999)
    expect(s.count).toBe(11)
    expect(s.samples).not.toContain(999)
  })

  it('Test 4: count cresce indefinitamente (NOT capped da capacity)', () => {
    const s = createReservoir(5)
    for (let i = 0; i < 100; i++) reservoirAdd(s, i)
    expect(s.count).toBe(100)
    expect(s.samples).toHaveLength(5)
  })

  it('Test 5: 5000 add con capacity 1024 → samples.length === 1024', () => {
    const s = createReservoir(1024)
    for (let i = 0; i < 5000; i++) reservoirAdd(s, i)
    expect(s.count).toBe(5000)
    expect(s.samples).toHaveLength(1024)
  })

  it('Test 6: sum cumulative — sum di 1..100 === 5050', () => {
    const s = createReservoir(50)
    for (let i = 1; i <= 100; i++) reservoirAdd(s, i)
    expect(s.sum).toBe(5050)
  })

  it('Test 7: computeSummary su 0 samples → tutti 0', () => {
    const s = createReservoir(10)
    const summary = computeSummary(s)
    expect(summary).toEqual({ count: 0, sum: 0, p50: 0, p90: 0, p99: 0 })
  })

  it('Test 8: computeSummary p50 su [1..100] sorted → 50', () => {
    const s = createReservoir(100)
    for (let i = 1; i <= 100; i++) reservoirAdd(s, i)
    const summary = computeSummary(s)
    // pickIdx(0.5) = floor(100*0.5) = 50 → sorted[50] = 51 (sorted è 1..100)
    expect(summary.p50).toBe(51)
    expect(summary.count).toBe(100)
    expect(summary.sum).toBe(5050)
  })

  it('Test 9: computeSummary p90 su [1..100] → 91', () => {
    const s = createReservoir(100)
    for (let i = 1; i <= 100; i++) reservoirAdd(s, i)
    const summary = computeSummary(s)
    // pickIdx(0.9) = floor(100*0.9) = 90 → sorted[90] = 91
    expect(summary.p90).toBe(91)
  })

  it('Test 10: computeSummary p99 su [1..100] → 100', () => {
    const s = createReservoir(100)
    for (let i = 1; i <= 100; i++) reservoirAdd(s, i)
    const summary = computeSummary(s)
    // pickIdx(0.99) = floor(100*0.99) = 99 → sorted[99] = 100
    expect(summary.p99).toBe(100)
  })

  it('Test 11: determinismo via Math.random mock — seed fissato → reservoir deterministico', () => {
    // Math.random sequence deterministica: 0.0, 0.1, 0.2, ...
    let seed = 0
    vi.spyOn(Math, 'random').mockImplementation(() => {
      seed = (seed + 0.1) % 1
      return seed
    })

    const sA = createReservoir(5)
    for (let i = 0; i < 20; i++) reservoirAdd(sA, i)

    seed = 0 // reset
    const sB = createReservoir(5)
    for (let i = 0; i < 20; i++) reservoirAdd(sB, i)

    expect(sA.samples).toEqual(sB.samples)
  })

  it('Test 12: distribuzione uniforme soft — 10000 add 1..10000 + capacity 1000 → mean ≈ 5000 ±10%', () => {
    const s = createReservoir(1000)
    for (let i = 1; i <= 10000; i++) reservoirAdd(s, i)
    expect(s.samples).toHaveLength(1000)
    const mean = s.samples.reduce((a, b) => a + b, 0) / 1000
    // Soft assertion: 4500 < mean < 5500 (Algorithm R uniform sampling property)
    expect(mean).toBeGreaterThan(4500)
    expect(mean).toBeLessThan(5500)
  })
})
