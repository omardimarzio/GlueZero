/**
 * F6 CardinalityCap — guard contro metric explosion (D-166 + T-06-06-01).
 *
 * Pattern primario carryover: F5 `worker-registry.ts:39+104-180` (D-128 cap pool 8
 * + console.warn audit) + F5 `worker-pool.ts:113-160`. Stessa shape: cap default
 * costante + emit hook + idempotent insert-or-skip.
 *
 * **Decisioni adottate:**
 * - D-166: cap default 100 distinct combinations per metric base name
 * - T-06-06-01: overflow → drop + emit `system.metrics.cardinality-overflow`
 *   (audit hook iniettato dal consumer 06-08 al broker.publish)
 * - Empty labelSig → sempre accept (metric senza labels NON ha cardinality issue)
 *
 * **Naming Prometheus-style** (D-163): le label combinations sono identificate
 * dal flatten string `{k1="v1",k2="v2"}` (key alphabetical sort + double quote
 * values). Il flatten è deterministico → cardinality count stabile cross-call.
 *
 * @see RESEARCH §9 cardinality cap + audit
 * @see CONTEXT D-166
 */

/** D-166: default cap 100 distinct label combinations per metric base name. */
const DEFAULT_CARDINALITY_CAP = 100

/**
 * Prometheus-style flatten labels in deterministic alphabetical sort.
 *
 * Output formato esatto: `{key1="value1",key2="value2"}` con keys ordinate
 * alfabeticamente. Values via `JSON.stringify` per escape automatico di
 * double-quote / backslash / unicode (sicurezza: prevenire label injection
 * verso parsers downstream Prometheus-text-format).
 *
 * @example
 * flatLabels(undefined) // → ''
 * flatLabels({}) // → ''
 * flatLabels({ route_id: 'weather' }) // → '{route_id="weather"}'
 * flatLabels({ status: '200', route_id: 'weather' })
 *   // → '{route_id="weather",status="200"}' (alphabetical)
 */
export function flatLabels(labels?: Readonly<Record<string, string>>): string {
  if (!labels) return ''
  const keys = Object.keys(labels).sort()
  if (keys.length === 0) return ''
  return `{${keys.map((k) => `${k}=${JSON.stringify(labels[k] ?? '')}`).join(',')}}`
}

/** Info passata al callback `onOverflow` quando una nuova combo viene droppata. */
export interface CardinalityOverflowInfo {
  readonly baseName: string
  readonly droppedLabels: string
}

export interface CardinalityTrackerOptions {
  /** Cap distinct combinations per base name. Default 100 (D-166). */
  readonly cap?: number
  /**
   * Hook invocato a ogni drop per overflow. Wired dal consumer 06-08 a
   * `broker.publish('system.metrics.cardinality-overflow', info)`.
   *
   * Pattern carryover: F5 worker-registry D-128 console.warn → F6 emette via
   * broker.publish per uniformità con audit channel sembridge.
   */
  readonly onOverflow?: (info: CardinalityOverflowInfo) => void
}

export interface CardinalityTracker {
  /**
   * @param baseName metric name senza labels (es. `sembridge.cache.hits_total`)
   * @param labelSig output di `flatLabels(labels)` — empty string = no labels
   * @returns `true` accept (combo new aggiunta o esistente), `false` drop (cap raggiunto)
   */
  check(baseName: string, labelSig: string): boolean
}

/**
 * Crea un tracker stateful per il cap di label combinations.
 *
 * Lifecycle:
 * 1. Per ogni `(baseName, labelSig)` in input, lookup `Map<baseName, Set<labelSig>>`.
 * 2. Se `labelSig` empty → accept (no cardinality concern).
 * 3. Se `labelSig` ∈ set esistente → accept (idempotent, no double-count).
 * 4. Se `labelSig` nuovo + size < cap → add + accept.
 * 5. Se size >= cap → drop + emit `onOverflow` (T-06-06-01 mitigation).
 *
 * Pattern Map-of-Set è O(1) avg per check (lookup hash + Set.has hash).
 */
export function createCardinalityTracker(
  opts: CardinalityTrackerOptions = {},
): CardinalityTracker {
  const cap = opts.cap ?? DEFAULT_CARDINALITY_CAP
  const cardinality = new Map<string, Set<string>>()

  return {
    check(baseName, labelSig) {
      // Empty labels = no cardinality concern (metric senza labels)
      if (!labelSig) return true

      let set = cardinality.get(baseName)
      if (!set) {
        set = new Set()
        cardinality.set(baseName, set)
      }

      // Combo già nota → idempotent accept
      if (set.has(labelSig)) return true

      // Cap raggiunto → drop + emit audit
      if (set.size >= cap) {
        opts.onOverflow?.({ baseName, droppedLabels: labelSig })
        return false
      }

      set.add(labelSig)
      return true
    },
  }
}
