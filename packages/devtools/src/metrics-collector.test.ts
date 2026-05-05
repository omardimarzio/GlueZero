/**
 * F6 metrics-collector.test.ts — Tier-1 jsdom (plan 06-06 Task 3).
 *
 * Validazione D-163/D-164/D-165/D-166 — chiude PRD §39 #10 (TOOL-05 metrics format):
 * - createMetricsCollector ritorna { increment, setGauge, observe, getMetrics, getMetricsDelta, tap }
 * - Counter atomic JS event loop carryover F5 worker-pool (single-threaded safe)
 * - Cumulative-only counters (D-164) + getMetricsDelta helper opzionale
 * - Gauges last-write-wins
 * - Histograms via reservoir Algorithm R + computeSummary
 * - Cardinality cap (D-166) + audit emit hook
 * - Naming Prometheus-friendly `sembridge.<package>.<metric>{<labels>}`
 *
 * Pattern primario: F5 worker-pool counter atomic + F5 task-tracker Map<key, state>.
 */

import type { EventTap } from '@sembridge/core'
import { describe, expect, it, vi } from 'vitest'
import { createMetricsCollector } from './metrics-collector'

describe('metrics-collector — counters/gauges/histograms (D-163/D-164/D-165/D-166)', () => {
  it('Test 1: createMetricsCollector({}) ritorna interface completa', () => {
    const m = createMetricsCollector({})
    expect(typeof m.increment).toBe('function')
    expect(typeof m.setGauge).toBe('function')
    expect(typeof m.observe).toBe('function')
    expect(typeof m.getMetrics).toBe('function')
    expect(typeof m.getMetricsDelta).toBe('function')
    expect(m.tap).toBeDefined()
  })

  it('Test 2: increment counter senza labels — 5 chiamate → counter === 5', () => {
    const m = createMetricsCollector()
    for (let i = 0; i < 5; i++) m.increment('m')
    expect(m.getMetrics().counters.m).toBe(5)
  })

  it('Test 3: increment con labels distinti → counter keys separati', () => {
    const m = createMetricsCollector()
    m.increment('m', { topic: 'a' }, 2)
    m.increment('m', { topic: 'b' }, 3)
    const snap = m.getMetrics()
    expect(snap.counters['m{topic="a"}']).toBe(2)
    expect(snap.counters['m{topic="b"}']).toBe(3)
  })

  it('Test 4: setGauge → gauges.g === 42', () => {
    const m = createMetricsCollector()
    m.setGauge('g', 42)
    expect(m.getMetrics().gauges.g).toBe(42)
  })

  it('Test 5: setGauge stessa key → ultimo valore vince (gauge semantics)', () => {
    const m = createMetricsCollector()
    m.setGauge('g', 10)
    m.setGauge('g', 99)
    expect(m.getMetrics().gauges.g).toBe(99)
  })

  it('Test 6: observe histogram — count + sum + p50 corretti', () => {
    const m = createMetricsCollector()
    m.observe('h', 100)
    m.observe('h', 200)
    m.observe('h', 300)
    const snap = m.getMetrics()
    expect(snap.histograms.h.count).toBe(3)
    expect(snap.histograms.h.sum).toBe(600)
    // pickIdx(0.5) = floor(3*0.5)=1 → sorted[1]=200
    expect(snap.histograms.h.p50).toBe(200)
  })

  it('Test 7: getMetrics() ritorna snapshot completo { counters, gauges, histograms }', () => {
    const m = createMetricsCollector()
    m.increment('c')
    m.setGauge('g', 1)
    m.observe('h', 50)
    const snap = m.getMetrics()
    expect(snap).toHaveProperty('counters')
    expect(snap).toHaveProperty('gauges')
    expect(snap).toHaveProperty('histograms')
    expect(snap.counters.c).toBe(1)
    expect(snap.gauges.g).toBe(1)
    expect(snap.histograms.h.count).toBe(1)
  })

  it('Test 8: getMetricsDelta(prev) — counter delta = current - prev', () => {
    const m = createMetricsCollector()
    m.increment('a', undefined, 5)
    const prev = m.getMetrics()
    m.increment('a', undefined, 3)
    m.increment('b', undefined, 7)
    const delta = m.getMetricsDelta(prev)
    expect(delta.counters.a).toBe(3) // 8 - 5
    expect(delta.counters.b).toBe(7) // 7 - 0
  })

  it('Test 9: cardinality cap maxLabelCombinations=2 → 3° distinct combo droppata', () => {
    const onCardinalityOverflow = vi.fn()
    const m = createMetricsCollector({ maxLabelCombinations: 2, onCardinalityOverflow })
    m.increment('x', { k: '1' })
    m.increment('x', { k: '2' })
    m.increment('x', { k: '3' }) // overflow
    const snap = m.getMetrics()
    expect(snap.counters['x{k="1"}']).toBe(1)
    expect(snap.counters['x{k="2"}']).toBe(1)
    expect(snap.counters['x{k="3"}']).toBeUndefined()
    expect(onCardinalityOverflow).toHaveBeenCalledTimes(1)
  })

  it('Test 10: onCardinalityOverflow callback invocato con info {baseName, droppedLabels}', () => {
    const onCardinalityOverflow = vi.fn()
    const m = createMetricsCollector({ maxLabelCombinations: 1, onCardinalityOverflow })
    m.increment('x', { k: 'a' })
    m.increment('x', { k: 'b' }) // overflow
    expect(onCardinalityOverflow).toHaveBeenCalledWith({
      baseName: 'x',
      droppedLabels: '{k="b"}',
    })
  })

  it('Test 11: naming Prometheus-friendly sembridge.<package>.<metric>{<labels>}', () => {
    const m = createMetricsCollector()
    m.increment('sembridge.cache.hits_total', { route_id: 'weather' })
    m.observe('sembridge.http.duration_ms', 123, { route_id: 'weather', status: '200' })
    const snap = m.getMetrics()
    expect(snap.counters['sembridge.cache.hits_total{route_id="weather"}']).toBe(1)
    expect(
      snap.histograms['sembridge.http.duration_ms{route_id="weather",status="200"}'],
    ).toBeDefined()
  })

  it('Test 12: histogram summary monotonicity — p50 <= p90 <= p99 sempre', () => {
    const m = createMetricsCollector()
    for (let i = 1; i <= 100; i++) m.observe('h', i)
    const summary = m.getMetrics().histograms.h
    expect(summary.p50).toBeLessThanOrEqual(summary.p90)
    expect(summary.p90).toBeLessThanOrEqual(summary.p99)
  })

  it('Test 13: getMetrics() su empty collector → { counters: {}, gauges: {}, histograms: {} }', () => {
    const m = createMetricsCollector()
    const snap = m.getMetrics()
    expect(snap.counters).toEqual({})
    expect(snap.gauges).toEqual({})
    expect(snap.histograms).toEqual({})
  })

  it('Test 14: getMetricsDelta su empty prev → tutti i counters delta === current', () => {
    const m = createMetricsCollector()
    m.increment('a', undefined, 7)
    const emptyPrev = { counters: {}, gauges: {}, histograms: {} } as const
    const delta = m.getMetricsDelta(emptyPrev)
    expect(delta.counters.a).toBe(7)
  })

  it('Test 15: increment con `by` negativo accept (decrement) — pattern accept (T-06-06-03)', () => {
    const m = createMetricsCollector()
    m.increment('m', undefined, 10)
    m.increment('m', undefined, -3)
    expect(m.getMetrics().counters.m).toBe(7)
  })

  it('Test 16: observe con value negativo accept (latency negativi raro ma not block)', () => {
    const m = createMetricsCollector()
    m.observe('h', 50)
    m.observe('h', -10)
    const snap = m.getMetrics()
    expect(snap.histograms.h.count).toBe(2)
    expect(snap.histograms.h.sum).toBe(40)
  })

  it('Test 17: tap exposed con onPipelineStep no-op (D-161 attivazione lazy)', () => {
    const m = createMetricsCollector()
    const tap: EventTap = m.tap
    expect(tap).toBeDefined()
    expect(typeof tap.onPipelineStep).toBe('function')
    // No-op: non throw, non altera state
    expect(() =>
      tap.onPipelineStep('event.received', {
        eventId: 'e1',
        topic: 't',
        step: 'event.received',
        timestamp: Date.now(),
        durationMs: 0,
      }),
    ).not.toThrow()
    // Counter NOT auto-incrementato dal tap (wiring esplicito in 06-08)
    expect(m.getMetrics().counters).toEqual({})
  })

  it('Test 18: getMetricsDelta con histogram — gauges + histograms = current snapshot (no delta semantica)', () => {
    const m = createMetricsCollector()
    m.observe('h', 100)
    m.setGauge('g', 1)
    const prev = m.getMetrics()
    m.observe('h', 200)
    m.setGauge('g', 2)
    const delta = m.getMetricsDelta(prev)
    // Histograms = current (no delta)
    expect(delta.histograms.h.count).toBe(2)
    // Gauges = current snapshot
    expect(delta.gauges.g).toBe(2)
  })

  it('Test 19: setGauge con labels → gauge keys separati Prometheus-style', () => {
    const m = createMetricsCollector()
    m.setGauge('g', 1, { region: 'eu' })
    m.setGauge('g', 2, { region: 'us' })
    const snap = m.getMetrics()
    expect(snap.gauges['g{region="eu"}']).toBe(1)
    expect(snap.gauges['g{region="us"}']).toBe(2)
  })

  it('Test 20: histograms cardinality cap — overflow droppato + onCardinalityOverflow', () => {
    const onCardinalityOverflow = vi.fn()
    const m = createMetricsCollector({ maxLabelCombinations: 1, onCardinalityOverflow })
    m.observe('h', 100, { route: 'a' })
    m.observe('h', 200, { route: 'b' }) // overflow
    const snap = m.getMetrics()
    expect(snap.histograms['h{route="a"}']).toBeDefined()
    expect(snap.histograms['h{route="b"}']).toBeUndefined()
    expect(onCardinalityOverflow).toHaveBeenCalledTimes(1)
  })
})
