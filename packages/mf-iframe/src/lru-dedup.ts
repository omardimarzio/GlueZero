/**
 * `lru-dedup.ts` — LRU dedup buffer custom impl + replay-guard 30s window dual-defense
 * (D-V2-F15-02 + D-V2-F15-03 lockati — closure D-V2-09 BLOCKING T-15-02..T-15-03).
 *
 * ## Architettura
 *
 * Mappa `Map<\`${origin}::${mfId}\`, TupleLru<messageId, timestamp>>` con cap **500 per
 * tuple `(origin, mfId)`**. Scoping per-tuple previene cross-MF id collision (UUID v4
 * birthday paradox / `microFrontendId` spoofing T-15-09).
 *
 * Memory peak ~50 KB su 100 MF concurrent (acceptable shared-window v2.0): 100 tuple ×
 * 500 entry × ~100 B (Map overhead + string id + number timestamp) = ~5 MB peak teorico
 * upper bound; realistico ~50 KB su tipico flow burst @100 msg/s 1s window dedup.
 *
 * NO `lru-cache` library (D-V2-F15-02 + RESEARCH.md §LRU custom rationale): pkg ~4 KB
 * bloat, viola bundle cap 10 KB stretto. Custom impl ~80 LoC tree-shake aggressivo.
 *
 * ## LRU policy
 *
 * Insertion-order eviction (Map spec ES2015): la prima chiave inserita è la prima
 * evicted quando size raggiunge cap. Replay attack su key evicted è mitigato da
 * timestamp window 30s (D-V2-F15-03 dual-defense — stale-message resurrection coverage).
 *
 * ## Replay-guard 30s window
 *
 * Dual-defense ID + timestamp:
 *  - (a) `messageId` già in LRU dedup buffer → reject (exact replay coverage).
 *  - (b) `Math.abs(now - msg.timestamp) > 30000ms` → reject (stale/future-dated
 *    coverage + clock-skew tolerance 30s ragionevole — RESEARCH.md §"Replay timestamp 30s").
 *
 * Check timestamp window FIRST (cheaper — single subtraction + abs vs Map.has): se fail,
 * NON aggiunge al LRU (evita pollution con stale id che resta valido per 500 entry).
 *
 * @see D-V2-F15-02 — LRU dedup 500 per (origin, mfId)
 * @see D-V2-F15-03 — Replay mitigation dual-defense ID + timestamp 30s
 * @see prd_2.0.0.md §26.6 — Replay attack mitigation
 * @see RESEARCH.md §LRU custom rationale
 */

/**
 * Cap LRU entries per tuple `(origin, mfId)` (D-V2-F15-02).
 *
 * Stima dimensione: 500 × ~100 B (string id 36 ch + Map entry overhead) ≈ 50 KB
 * upper-bound per tuple. Su 100 MF concurrent ≈ 5 MB peak teorico (acceptable
 * shared-window v2.0).
 */
export const LRU_CAP_PER_TUPLE = 500

/**
 * Timestamp window per replay guard (D-V2-F15-03 — clock-skew tolerance 30s).
 *
 * 30s è ragionevole per network latency + client clock drift. Tighter (es. 5s)
 * causerebbe false-positive su clock skew browser; wider (es. 300s) lascia replay
 * window troppo lunga.
 */
export const TIMESTAMP_WINDOW_MS = 30000

/**
 * TupleLru — LRU buffer interno per una specifica tuple `(origin, mfId)`.
 *
 * `Map<messageId, timestamp>` con insertion-order eviction (ES2015 Map spec).
 *
 * @internal
 */
class TupleLru {
  private readonly map = new Map<string, number>()

  /**
   * Verifica se `messageId` è già stato osservato in questa tuple.
   *
   * @returns true se già visto (exact replay), false altrimenti.
   */
  has(messageId: string): boolean {
    return this.map.has(messageId)
  }

  /**
   * Aggiunge `messageId` al buffer. Se size ≥ cap → evict primo (insertion-order).
   *
   * @param messageId - Id del messaggio (envelope `id`).
   * @param timestamp - Timestamp del messaggio (envelope `timestamp`).
   */
  add(messageId: string, timestamp: number): void {
    if (this.map.size >= LRU_CAP_PER_TUPLE) {
      // Evict primo entry inserito (insertion-order Map spec)
      const firstKey = this.map.keys().next().value
      if (firstKey !== undefined) {
        this.map.delete(firstKey)
      }
    }
    this.map.set(messageId, timestamp)
  }

  /** Reset buffer per testing/cleanup. */
  clear(): void {
    this.map.clear()
  }

  /** Size corrente (per testing). */
  get size(): number {
    return this.map.size
  }
}

/**
 * `DedupRegistry` — Registry centralizzato LRU dedup + replay guard dual-defense.
 *
 * Mappa per-tuple `(origin, mfId)` con cap 500 per tuple (D-V2-F15-02). Replay guard
 * 30s window (D-V2-F15-03) checked FIRST cheaper short-circuit.
 *
 * Usato module-level shared in `iframe-loader.ts` (single instance per-process).
 *
 * @example
 * ```ts
 * const dedup = new DedupRegistry()
 * const isReplay = dedup.isReplay('https://iframe.com', 'mf-x', 'msg-id-1', Date.now())
 * if (isReplay) {
 *   broker.publish('microfrontend.iframe.replay-detected', {...})
 *   return
 * }
 * // procede dispatch
 * ```
 */
export class DedupRegistry {
  private readonly buffers = new Map<string, TupleLru>()

  /**
   * Verifica replay dual-defense (D-V2-F15-02 + D-V2-F15-03).
   *
   * Step (1) timestamp window 30s (cheaper): `Math.abs(now - timestamp) > 30000ms` →
   * return true. NON aggiunge al LRU (evita pollution stale).
   *
   * Step (2) LRU lookup: se `messageId` già in buffer → return true.
   *
   * Step (3) altrimenti aggiunge al LRU + return false.
   *
   * @param origin - `event.origin` postMessage.
   * @param mfId - `microFrontendId` envelope.
   * @param messageId - `id` envelope.
   * @param timestamp - `timestamp` envelope (ms da epoch).
   * @param now - Current time (default `Date.now()`); override per testing.
   * @returns true se replay (ID o timestamp), false se primo-visto valido.
   */
  isReplay(
    origin: string,
    mfId: string,
    messageId: string,
    timestamp: number,
    now: number = Date.now(),
  ): boolean {
    // Step (1) timestamp window check FIRST (cheaper short-circuit)
    if (Math.abs(now - timestamp) > TIMESTAMP_WINDOW_MS) {
      return true
    }

    // Step (2) LRU lookup
    const key = `${origin}::${mfId}`
    let buffer = this.buffers.get(key)
    if (buffer === undefined) {
      buffer = new TupleLru()
      this.buffers.set(key, buffer)
    }

    if (buffer.has(messageId)) {
      return true
    }

    // Step (3) primo-visto: aggiunge + return false
    buffer.add(messageId, timestamp)
    return false
  }

  /**
   * Cleanup buffer per una specifica tuple `(origin, mfId)`.
   *
   * Usato in `iframeLoader.unload` per evitare memory leak su MF unmount.
   */
  clearForMf(origin: string, mfId: string): void {
    const key = `${origin}::${mfId}`
    const buffer = this.buffers.get(key)
    if (buffer !== undefined) {
      buffer.clear()
      this.buffers.delete(key)
    }
  }

  /** Reset completo per testing. */
  clearAll(): void {
    this.buffers.clear()
  }

  /** Numero di tuple tracciate (per testing/observability). */
  get tupleCount(): number {
    return this.buffers.size
  }
}
