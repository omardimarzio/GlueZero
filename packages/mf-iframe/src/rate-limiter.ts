/**
 * `rate-limiter.ts` — Rate limit 100 msg/s per `mfId` fixed-window pattern
 * (D-V2-F15-04 + REQ MF-SEC-04 lockati — closure D-V2-09 BLOCKING T-15-06).
 *
 * ## Comportamento
 *
 * Quando un mfId riceve > 100 msg in un window 1000 ms:
 *  - drop **silently** lato bridge handler (NO throw cascade — anti-DoS amplification).
 *  - emit topic `microfrontend.iframe.bridge.rate-limited` **UNA volta per window**
 *    (`warned` flag) con payload `{mfId, origin, droppedCount, windowMs, timestamp}`.
 *
 * Su nuovo window (>= 1000 ms dall'inizio): reset `count = 1`, `warned = false`.
 *
 * ## Tradeoff fixed-window vs sliding-window vs token-bucket
 *
 * Fixed-window è scelto (RESEARCH.md §456-486):
 *  - Sliding-window: O(log n) implementazione + memoria proporzionale al rate cap.
 *  - Token-bucket: bursty allowance non desiderato (vogliamo enforcement strict 100/s).
 *  - Fixed-window: O(1) increment + reset on window roll; semplice + bundle-friendly.
 *
 * Worst-case edge: 100 msg @ t=999ms + 100 msg @ t=1001ms (totale 200 msg in 2ms al
 * window boundary). Acceptable per use case bridge browser-side (rate limit è governance,
 * non DoS hard prevention).
 *
 * ## Anti-amplification
 *
 * Drop silently (no throw) per evitare DoS amplification: un attaccante che floda il
 * bridge non riceve N error throw cascade (CPU + log spam). UNA emit topic per window
 * fornisce observability sufficient senza amplification.
 *
 * @see D-V2-F15-04 — Rate limit drop + emit policy
 * @see REQ MF-SEC-04 — 100 msg/s per mfId enforcement
 * @see RESEARCH.md §"Rate limiter fixed vs sliding vs token-bucket"
 */
import type { Broker } from '@gluezero/core'

/**
 * Cap messaggi per window per mfId (D-V2-F15-04).
 *
 * 100/s è coerente con REQ MF-SEC-04 lockato. Burst allowance fino a 100 msg @100ms è
 * acceptable (use case bridge realistic 5-20 msg/s steady).
 */
export const RATE_LIMIT_MSG_PER_SEC = 100

/**
 * Window length per rate limit fixed-window (1000 ms = 1s).
 */
export const WINDOW_MS = 1000

/**
 * Stato per-mfId del rate limiter.
 *
 * @internal
 */
interface RateLimitWindow {
  count: number
  windowStart: number
  warned: boolean
}

/**
 * Topic emit per rate-limited drop (literal coerente con `topics.ts`).
 *
 * @internal
 */
const TOPIC_RATE_LIMITED = 'microfrontend.iframe.bridge.rate-limited'

/**
 * `RateLimiter` — Fixed-window 100 msg/s per mfId token-bucket implementation.
 *
 * Storage `Map<mfId, RateLimitWindow>` con O(1) check su ogni call `shouldDrop`.
 *
 * @example
 * ```ts
 * const limiter = new RateLimiter()
 * if (limiter.shouldDrop('mf-x', 'https://iframe.com', broker)) {
 *   return // drop silently
 * }
 * // procede dispatch
 * ```
 */
export class RateLimiter {
  private readonly windows = new Map<string, RateLimitWindow>()

  /**
   * Verifica se il messaggio deve essere dropped per rate limit.
   *
   * Side-effect: emit topic `microfrontend.iframe.bridge.rate-limited` UNA volta per
   * window (`warned` flag) quando count supera cap.
   *
   * @param mfId - `microFrontendId` envelope.
   * @param origin - `event.origin` postMessage (per topic payload observability).
   * @param broker - Broker reference per emit topic (no cascade — silent drop).
   * @param now - Current time (default `Date.now()`); override per testing.
   * @returns true se da droppare, false se entro window cap.
   */
  shouldDrop(
    mfId: string,
    origin: string,
    broker: Broker,
    now: number = Date.now(),
  ): boolean {
    let cur = this.windows.get(mfId)

    // Inizializza o reset window se scaduto
    if (cur === undefined || now - cur.windowStart > WINDOW_MS) {
      cur = { count: 1, windowStart: now, warned: false }
      this.windows.set(mfId, cur)
      return false
    }

    cur.count += 1

    // Drop quando count supera cap
    if (cur.count > RATE_LIMIT_MSG_PER_SEC) {
      // Emit topic UNA volta per window (anti-amplification — anti-DoS)
      if (!cur.warned) {
        cur.warned = true
        try {
          broker.publish(TOPIC_RATE_LIMITED, {
            mfId,
            origin,
            droppedCount: cur.count - RATE_LIMIT_MSG_PER_SEC,
            windowMs: WINDOW_MS,
            timestamp: now,
          })
        } catch {
          // No-op — broker.publish errors NON devono affossare il bridge handler
          // (defensive — se publish fail, il drop comunque deve succedere).
        }
      }
      return true
    }

    return false
  }

  /**
   * Cleanup window per mfId su unmount (`iframeLoader.unload`).
   */
  clearForMf(mfId: string): void {
    this.windows.delete(mfId)
  }

  /** Reset completo per testing. */
  clearAll(): void {
    this.windows.clear()
  }

  /** Snapshot count corrente per mfId (per testing/observability). */
  getCountForMf(mfId: string): number {
    return this.windows.get(mfId)?.count ?? 0
  }
}
