/**
 * F6 DevtoolsConfig — sezione `BrokerConfig.devtools` (D-160/D-167/D-170).
 *
 * Default-driven: tutti i field sono opzionali con default sensati (CONTEXT.md
 * Claude's Discretion).
 *
 * @see RESEARCH §16.1 budget defaults proposta.
 */
export interface DevtoolsConfig {
  /**
   * D-160: Toggle automatico `enableDebug()` al boot.
   * Default: `NODE_ENV !== 'production'` → true (DX dev-friendly).
   * Production build: false (zero overhead).
   */
  readonly enableByDefault?: boolean
  /** D-167: ring buffer EventInspector cap (default 500 eventi). */
  readonly eventBufferSize?: number
  /** D-167: ring buffer RouteInspector cap (default 500 routes). */
  readonly routeBufferSize?: number
  /** D-165: reservoir samples per histogram (default 1024). */
  readonly histogramSamples?: number
  /** D-166: cap distinct label combinations per metric base name (default 100). */
  readonly maxLabelCombinations?: number
  /** D-170: cap pauseTopic queue per topic (default 1000). */
  readonly pauseQueueMaxSize?: number
}
