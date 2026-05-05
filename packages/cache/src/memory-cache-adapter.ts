/**
 * F6 MemoryCacheAdapter — LRU bounded cache adapter (D-158 default V1).
 *
 * **Pattern**: Map insertion order LRU (idiomatic JS, ECMAScript 2015 spec
 * universale Baseline). Re-insert on get → LRU touch. Eviction → drop primo
 * (oldest) via `cache.keys().next().value`. TTL ortogonale a LRU (entry può
 * essere evicted prima di scadenza TTL se cap raggiunto).
 *
 * **Caratteristiche**:
 * - Zero dependency esterna (pattern carryover F3 D-74 KeyBased dedupe)
 * - Cap predictable (maxEntries=1000 default, NON bytes — D-158)
 * - Atomic single-thread JS event loop (no race condition F5 D-133 carryover)
 * - Lazy TTL expiration (no proactive sweeper — RESEARCH §15.7)
 *
 * **NON adottato `lru-cache@11.3.6`** (RESEARCH §2.3): zero-dep priority +
 * budget bundle stretto.
 *
 * **Tampering caveat (T-06-02-03)**: la cache restituisce reference (NO deep
 * clone su get — perf consideration, 5-10ms overhead 500 entries rejected
 * RESEARCH §15.3). Il consumer è responsabile di NON mutare il valore restituito.
 * In dev può applicare `Object.freeze` (pattern F1 D-29 carryover).
 *
 * **Threat coverage**:
 * - T-06-02-01 (DoS cache illimitata) → cap maxEntries=1000 default + LRU drop oldest
 * - T-06-02-04 (TTL expiry race) → check `entry.expiresAt < Date.now()` atomic
 *   single-thread JS event loop, lazy expiration su read
 *
 * @example
 * ```ts
 * const cache = createMemoryCacheAdapter({ maxEntries: 500 })
 * cache.set('weather::a1b2', { temp: 20 }, 60_000)  // TTL 60s
 * const entry = cache.get('weather::a1b2')           // { value, expiresAt, setAt }
 * cache.stats()  // { hits: 1, misses: 0, evictions: 0, entries: 1 }
 * ```
 *
 * @see CacheAdapter interface in ./types/cache-adapter
 * @see RESEARCH §2 architettura cache + LRU implementation deep dive
 * @see prd.md §20 cache layer behavior
 * @packageDocumentation
 */

import type { CacheAdapter, CacheEntry, CacheStats } from './types'

/** D-158 cap default V1 — entries-based (NON bytes). */
const DEFAULT_MAX_ENTRIES = 1000

/**
 * Opzioni di costruzione per `createMemoryCacheAdapter`.
 */
export interface MemoryCacheAdapterOptions {
  /**
   * Cap di entries simultanee (D-158). Default 1000.
   * Quando raggiunto, eviction LRU drop oldest (Map.keys().next().value).
   */
  readonly maxEntries?: number
}

/**
 * Factory CacheAdapter LRU bounded (D-158 default V1 SemBridge).
 *
 * @param opts Opzioni di configurazione (default `maxEntries=1000`)
 * @returns Istanza `CacheAdapter` con stato cumulative isolato
 */
export function createMemoryCacheAdapter(
  opts: MemoryCacheAdapterOptions = {},
): CacheAdapter {
  const maxEntries = opts.maxEntries ?? DEFAULT_MAX_ENTRIES
  // Map insertion order = LRU order (oldest first → evicted first).
  const cache = new Map<string, CacheEntry>()
  let hits = 0
  let misses = 0
  let evictions = 0

  return {
    get<T>(key: string): CacheEntry<T> | undefined {
      const entry = cache.get(key)
      if (!entry) {
        misses++
        return undefined
      }
      // TTL expiry check (atomic single-thread, lazy expiration RESEARCH §15.7).
      if (entry.expiresAt < Date.now()) {
        cache.delete(key)
        evictions++
        misses++
        return undefined
      }
      // LRU touch: re-insert per portare in coda Map (insertion order = LRU order).
      cache.delete(key)
      cache.set(key, entry)
      hits++
      return entry as CacheEntry<T>
    },

    set<T>(key: string, value: T, ttlMs?: number): void {
      // Eviction LRU: se cap raggiunto e key NON esiste già → drop oldest.
      // Pattern Map.keys().next().value (oldest insertion) — RESEARCH §2.2.
      if (cache.size >= maxEntries && !cache.has(key)) {
        const oldestKey = cache.keys().next().value
        if (oldestKey !== undefined) {
          cache.delete(oldestKey)
          evictions++
        }
      }
      // Replace in-place: se key esiste già, set con nuovo value (NO eviction).
      // Map.set su key esistente NON cambia insertion order in alcune implementazioni
      // — qui delete+set per garantire LRU touch coerente.
      if (cache.has(key)) cache.delete(key)
      const expiresAt =
        ttlMs !== undefined ? Date.now() + ttlMs : Number.POSITIVE_INFINITY
      cache.set(key, { value, expiresAt, setAt: Date.now() })
    },

    delete(key: string): boolean {
      return cache.delete(key)
    },

    invalidate(pattern: string | RegExp | { readonly prefix: string }): number {
      let count = 0
      // Exact string match dispatch
      if (typeof pattern === 'string') {
        if (cache.delete(pattern)) count++
        return count
      }
      // RegExp pattern dispatch
      if (pattern instanceof RegExp) {
        for (const k of Array.from(cache.keys())) {
          if (pattern.test(k)) {
            cache.delete(k)
            count++
          }
        }
        return count
      }
      // { prefix } object form dispatch
      const prefix = pattern.prefix
      for (const k of Array.from(cache.keys())) {
        if (k.startsWith(prefix)) {
          cache.delete(k)
          count++
        }
      }
      return count
    },

    size(): number {
      return cache.size
    },

    clear(): void {
      cache.clear()
    },

    stats(): CacheStats {
      // Cumulative dal boot adapter (D-164 cumulative-only — clear NON resetta).
      return { hits, misses, evictions, entries: cache.size }
    },
  }
}
