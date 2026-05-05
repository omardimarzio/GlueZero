import type { CacheEntry } from './cache-entry'

/**
 * F6 CacheAdapter — contract per cache implementations.
 *
 * Default V1: `MemoryCacheAdapter` (LRU bounded `maxEntries=1000` D-158, plan 06-02).
 *
 * Swap V1.x: `@gluezero/cache-idb` IndexedDB adapter (deferred — CONTEXT.md
 * Deferred Ideas).
 *
 * @see RESEARCH §2 architettura cache + LRU implementation deep dive.
 */
export interface CacheAdapter {
  /** Lookup entry per chiave; ritorna `undefined` su miss / TTL expired. */
  get<T = unknown>(key: string): CacheEntry<T> | undefined
  /** Set entry con TTL opzionale (ms). Se `ttlMs` undefined → TTL infinito. */
  set<T = unknown>(key: string, value: T, ttlMs?: number): void
  /** Delete singola entry; ritorna `true` se rimossa, `false` se non esisteva. */
  delete(key: string): boolean
  /**
   * Invalidate batch matching pattern. Ritorna numero di entry rimosse.
   * Pattern supportati: string esatta, RegExp, prefix object `{ prefix: string }`.
   */
  invalidate(pattern: string | RegExp | { readonly prefix: string }): number
  /** Numero entries correnti (≤ `maxEntries` per MemoryCacheAdapter). */
  size(): number
  /** Clear totale (zero entries). Cumulative stats `clears`/`evictions` non resettati. */
  clear(): void
  /** Statistiche cumulative dal boot dell'adapter (D-164 cumulative-only). */
  stats(): CacheStats
}

/**
 * Statistiche cumulative dal boot dell'adapter (D-164 cumulative-only).
 *
 * Consumate dal MetricsCollector F6 (plan 06-06) via gauge
 * `gluezero.cache.entries_count` + counter `gluezero.cache.{hits,misses,evictions}_total`.
 */
export interface CacheStats {
  readonly hits: number
  readonly misses: number
  readonly evictions: number
  readonly entries: number
}
