/**
 * F6 MetricsSnapshot — schema simil-OpenMetrics ritornato da `getMetrics()`
 * (TOOL-05 closure PRD §39 #10).
 *
 * **Naming convention** (D-163): `gluezero.<package>.<metric>{<labels>}` formato
 * Prometheus-style flatten. Esempi:
 * - Counter: `gluezero.broker.events_published_total{topic="weather.requested"}`
 * - Gauge: `gluezero.cache.entries_count`
 * - Histogram: `gluezero.http.duration_ms{route_id="weather"}`
 *
 * **Cumulative-only** (D-164): counters crescono dal boot, mai resettati.
 * Helper opzionale `getMetricsDelta(prev)` calcola differenze lato consumer.
 *
 * @see RESEARCH §7 MetricsCollector impl deep dive.
 */
export interface MetricsSnapshot {
  /** D-163: counters cumulative `_total` suffix (Prometheus convention). */
  readonly counters: Readonly<Record<string, number>>
  /** D-163: gauge current value (no suffix Prometheus convention). */
  readonly gauges: Readonly<Record<string, number>>
  /** D-165: histogram quantile summary `_ms` suffix per duration. */
  readonly histograms: Readonly<Record<string, HistogramSummary>>
}

/**
 * F6 HistogramSummary — quantile summary (D-165 reservoir Algorithm R Vitter 1985,
 * plan 06-06).
 *
 * `count` = total observations (NOT capacity reservoir). `sum` per calcolo media.
 * `p50/p90/p99` quantile sample-based.
 */
export interface HistogramSummary {
  readonly count: number
  readonly sum: number
  readonly p50: number
  readonly p90: number
  readonly p99: number
}

/**
 * F6 MetricsDelta — ritornato da `getMetricsDelta(prev: MetricsSnapshot)`.
 *
 * Counters delta (current - prev). Gauges = current snapshot. Histograms =
 * current snapshot (no delta semantica per quantile aggregati).
 */
export interface MetricsDelta {
  readonly counters: Readonly<Record<string, number>>
  readonly gauges: Readonly<Record<string, number>>
  readonly histograms: Readonly<Record<string, HistogramSummary>>
}
