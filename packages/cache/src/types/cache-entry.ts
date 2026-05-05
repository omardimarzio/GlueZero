/**
 * F6 CacheEntry — readonly entry restituita da `CacheAdapter.get()`.
 *
 * Pattern di serializzazione: TTL via `expiresAt` epoch ms (Infinity se TTL non
 * settato). `setAt` per audit/Inspector.
 *
 * **D-158 carryover**: LRU eviction tracked via Map insertion order (idiomatic JS
 * since ECMAScript 2015 spec). TTL ortogonale a LRU — entry può essere evicted
 * prima della scadenza TTL se cache piena.
 *
 * @see RESEARCH §2.2 Map insertion order LRU.
 */
export interface CacheEntry<T = unknown> {
  /** Valore canonicalizzato cachato (post-mapper F2). */
  readonly value: T
  /** Epoch ms scadenza (Number.POSITIVE_INFINITY se TTL non settato). */
  readonly expiresAt: number
  /** Epoch ms timestamp di set — audit/Inspector. */
  readonly setAt: number
}
