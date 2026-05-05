/**
 * F6 MetricsCollector — counters cumulative + gauges + histograms simil-OpenMetrics
 * (D-163/D-164/D-165/D-166).
 *
 * **Chiude PRD §39 #10 (TOOL-05 metrics format)** — schema
 * `{ counters, gauges, histograms }` simil-OpenMetrics, naming
 * `sembridge.<package>.<metric>{<labels>}` Prometheus-friendly.
 *
 * Pattern primario carryover: F5 `worker-pool.ts:113-160` (counter atomic JS
 * event loop single-threaded) + F5 `task-tracker.ts:140-220` (Map<key, state>).
 *
 * **Decisioni adottate:**
 * - D-163: naming dot.case `sembridge.<package>.<metric>` con suffix `_total`
 *   (counter), `_ms` (duration histogram). Labels Prometheus-style flatten.
 * - D-164: cumulative-only counters (mai resettati). Helper opzionale
 *   `getMetricsDelta(prev)` per consumer che vogliono delta.
 * - D-165: histograms via reservoir Algorithm R (Vitter 1985) inline ~50 LOC,
 *   default 1024 samples per metric (vedi `reservoir-sampling.ts`).
 * - D-166: cardinality cap default 100 distinct combinations per base name +
 *   audit emit `system.metrics.cardinality-overflow` (T-06-06-01 mitigation).
 *
 * **EventTap pre-instrumented (D-161 lazy):** `tap` è esposto come no-op default.
 * Il consumer 06-08 wiring DevtoolsBroker collega il tap a step 14 della pipeline
 * (`event.observed`) per auto-increment lifecycle metrics. Il MetricsCollector
 * standalone NON dipende dal broker — può essere usato in isolamento (es. test).
 *
 * @example Counter increment + cumulative readback (D-164)
 * ```ts
 * const metrics = createMetricsCollector()
 * metrics.increment('sembridge.cache.hits_total', { routeId: 'weather' })
 * metrics.increment('sembridge.cache.hits_total', { routeId: 'weather' })
 * const snap = metrics.getMetrics()
 * console.log(snap.counters['sembridge.cache.hits_total{routeId="weather"}']) // → 2
 * ```
 *
 * @example Gauge last-write-wins
 * ```ts
 * metrics.setGauge('sembridge.cache.entries_count', 42, { tenant: 'acme' })
 * metrics.setGauge('sembridge.cache.entries_count', 50, { tenant: 'acme' }) // overwrite
 * // → snap.gauges['sembridge.cache.entries_count{tenant="acme"}'] === 50
 * ```
 *
 * @example Histogram observe + reservoir summary (D-165)
 * ```ts
 * for (let i = 0; i < 1000; i++) {
 *   metrics.observe('sembridge.routing.dispatch_duration_ms', Math.random() * 100)
 * }
 * const summary = metrics.getMetrics().histograms['sembridge.routing.dispatch_duration_ms']
 * console.log(`p50=${summary.p50}, p90=${summary.p90}, p99=${summary.p99}, n=${summary.count}`)
 * ```
 *
 * @see RESEARCH §7 MetricsCollector impl deep dive
 * @see CONTEXT D-163, D-164, D-165, D-166
 * @see types/metrics.ts — `MetricsSnapshot` + `HistogramSummary` + `MetricsDelta`
 */

import type { EventTap } from '@sembridge/core'
import { createCardinalityTracker, flatLabels } from './cardinality-cap'
import {
  computeSummary,
  createReservoir,
  type ReservoirState,
  reservoirAdd,
} from './reservoir-sampling'
import type { HistogramSummary, MetricsDelta, MetricsSnapshot } from './types/metrics'

/**
 * Public surface MetricsCollector — runtime hook + read-only snapshot helpers.
 *
 * **Mutability contract:**
 * - `increment / setGauge / observe` — mutating side-effects (entry update + cardinality check)
 * - `getMetrics / getMetricsDelta` — read-only snapshot via `Object.fromEntries`
 *   (defensive copy) — consumer NON può mutare lo state interno.
 */
export interface MetricsCollector {
  /**
   * Incrementa counter cumulative `name{flatLabels(labels)}`.
   *
   * @param name nome base (es. `sembridge.cache.hits_total`)
   * @param labels opzionali — flatten Prometheus-style alphabetical sort
   * @param by default 1; negativo accept (decrement permesso T-06-06-03 pattern accept)
   */
  increment(name: string, labels?: Readonly<Record<string, string>>, by?: number): void
  /**
   * Imposta gauge last-write-wins `name{flatLabels(labels)}`.
   */
  setGauge(name: string, value: number, labels?: Readonly<Record<string, string>>): void
  /**
   * Osserva un valore in histogram `name{flatLabels(labels)}` (D-165 reservoir).
   *
   * Lazy-create dello state reservoir al primo observe per metric key.
   */
  observe(name: string, value: number, labels?: Readonly<Record<string, string>>): void
  /**
   * Snapshot cumulative `MetricsSnapshot { counters, gauges, histograms }`.
   *
   * Counters cumulative dal boot (D-164). Histograms via `computeSummary` —
   * cost: O(n log n) sort per metric key (lazy on-demand, NON ad ogni observe).
   */
  getMetrics(): MetricsSnapshot
  /**
   * D-164 helper: calcola delta `current - prev` per counters (gauges +
   * histograms = current snapshot, no delta semantica per gauge/quantile).
   */
  getMetricsDelta(prev: MetricsSnapshot): MetricsDelta
  /**
   * D-161 lifecycle tap — exposed for wiring in 06-08 composition wrapper.
   *
   * Default: no-op (lazy mode). 06-08 può sostituire o wrappare per
   * auto-increment su step 14 `event.observed` lifecycle.
   */
  readonly tap: EventTap
}

export interface MetricsCollectorOptions {
  /** D-165 reservoir cap samples per histogram metric key. Default 1024. */
  readonly histogramSamples?: number
  /** D-166 cap distinct label combinations per base name. Default 100. */
  readonly maxLabelCombinations?: number
  /**
   * D-166 audit hook su cardinality overflow. Wired dal consumer 06-08 a
   * `broker.publish('system.metrics.cardinality-overflow', info)`.
   */
  readonly onCardinalityOverflow?: (info: { baseName: string; droppedLabels: string }) => void
}

const DEFAULT_HISTOGRAM_SAMPLES = 1024 // D-165
const DEFAULT_MAX_LABEL_COMBINATIONS = 100 // D-166

/**
 * Factory MetricsCollector — istanzia counters/gauges/histograms Map + cardinality
 * tracker + tap no-op.
 *
 * **Performance characteristics:**
 * - `increment / setGauge`: O(1) avg (Map set + cardinality check)
 * - `observe`: O(1) amortized (reservoir add — Math.random + assignment)
 * - `getMetrics`: O(N + M log M) dove N = total entries, M = max samples per
 *   histogram (default 1024). Cost concentrato in `computeSummary`.
 * - `getMetricsDelta`: O(N) lookup per counter delta computation.
 *
 * **Memory bounds:**
 * - Counters / gauges: cap implicito via cardinality tracker (D-166 → 100 per base)
 * - Histograms: cap esplicito `histogramSamples` (D-165 → 1024 per key) — total
 *   memory ≈ `maxLabelCombinations * histogramSamples * 8 bytes` per metric key.
 *   Con default = 100 * 1024 * 8 = ~800KB per metric base name (acceptable).
 */
export function createMetricsCollector(opts: MetricsCollectorOptions = {}): MetricsCollector {
  const samplesCap = opts.histogramSamples ?? DEFAULT_HISTOGRAM_SAMPLES
  const cardinality = createCardinalityTracker(
    opts.onCardinalityOverflow !== undefined
      ? {
          cap: opts.maxLabelCombinations ?? DEFAULT_MAX_LABEL_COMBINATIONS,
          onOverflow: opts.onCardinalityOverflow,
        }
      : { cap: opts.maxLabelCombinations ?? DEFAULT_MAX_LABEL_COMBINATIONS },
  )

  // Single-threaded JS event loop guarantee → counter atomic by construction
  // (carryover F5 worker-pool.ts:113-160 D-133 atomic state machine pattern).
  const counters = new Map<string, number>()
  const gauges = new Map<string, number>()
  const histograms = new Map<string, ReservoirState>()

  return {
    increment(name, labels, by = 1) {
      const sig = flatLabels(labels)
      if (!cardinality.check(name, sig)) return
      const key = `${name}${sig}`
      counters.set(key, (counters.get(key) ?? 0) + by)
    },

    setGauge(name, value, labels) {
      const sig = flatLabels(labels)
      if (!cardinality.check(name, sig)) return
      gauges.set(`${name}${sig}`, value)
    },

    observe(name, value, labels) {
      const sig = flatLabels(labels)
      if (!cardinality.check(name, sig)) return
      const key = `${name}${sig}`
      let state = histograms.get(key)
      if (!state) {
        state = createReservoir(samplesCap)
        histograms.set(key, state)
      }
      reservoirAdd(state, value)
    },

    getMetrics(): MetricsSnapshot {
      return {
        counters: Object.fromEntries(counters),
        gauges: Object.fromEntries(gauges),
        histograms: Object.fromEntries(
          Array.from(histograms.entries()).map(
            ([k, v]) => [k, computeSummary(v)] as [string, HistogramSummary],
          ),
        ),
      }
    },

    getMetricsDelta(prev): MetricsDelta {
      const cur = this.getMetrics()
      const counterDelta: Record<string, number> = {}
      for (const [k, v] of Object.entries(cur.counters)) {
        counterDelta[k] = v - (prev.counters[k] ?? 0)
      }
      // Gauges + histograms = current snapshot (no delta semantica per quantile aggregati)
      return { counters: counterDelta, gauges: cur.gauges, histograms: cur.histograms }
    },

    // D-161 lazy tap — no-op default. Wiring downstream in 06-08 per attivare
    // step 14 `event.observed` (auto-increment lifecycle metrics dal broker).
    tap: {
      onPipelineStep() {
        // No-op intenzionale. Il MetricsCollector standalone è agnostico al broker —
        // 06-08 DevtoolsBroker può wrappare o sostituire questo tap per binding
        // automatico su lifecycle events (route.dispatched, cache.hit, etc).
      },
    },
  }
}
