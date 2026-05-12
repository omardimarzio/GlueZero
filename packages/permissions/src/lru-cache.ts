/**
 * F11 LRU cache `Map<string, boolean>` 500 entries + `clearByMfId`.
 *
 * D-V2-F11-07: NO TTL (D-V2-08 defer V2.1). Invalidation event-driven via
 * `clearByMfId` invocato da lifecycle-hooks su `microfrontend.unregistered` /
 * `microfrontend.unmounted` / `microfrontend.permissions.updated`.
 *
 * Pattern Map insertion-order LRU (coerente F6 `memory-cache-adapter.ts:86-108`
 * battle-tested) ma SEMPLIFICATO: no expiration policy, no stats, no CacheEntry wrapper,
 * no invalidate-by-pattern — solo prefix `clearByMfId`.
 *
 * Bundle target ~250 B minified.
 *
 * **D-30 anti-singleton mitigato**: lo stato module-level e legato al broker via
 * `permissionsModule().install()` (singolo broker = singola cache). Due broker
 * indipendenti condividerebbero pero questa cache: tradeoff accettato F11
 * (defer V2.1 per cache scoped-per-broker se community demand).
 *
 * Cover REQ-IDs: MF-PERM-05 (LRU cache 500 entries event-driven invalidation, P-02
 * publish overhead mitigation Pitfall HIGH).
 *
 * @see prd_2.0.0.md §19.7 — cache LRU permissions
 * @see packages/cache/src/memory-cache-adapter.ts (F6 D-158 — F11 SEMPLIFICA)
 * @see D-V2-F11-07 (LRU + clearByMfId, no expiration policy)
 */

const MAX_ENTRIES = 500
const cache = new Map<string, boolean>()

/**
 * Lookup entry LRU. Touch insertion order (re-insert in coda) per Most-Recently-Used.
 *
 * @param key Chiave LRU formato `mfId::action::resource`.
 * @returns valore boolean cached o `undefined` se miss.
 */
export function lruGet(key: string): boolean | undefined {
  if (!cache.has(key)) return undefined
  const v = cache.get(key)
  // LRU touch: re-insert in coda (Map mantiene insertion-order)
  cache.delete(key)
  cache.set(key, v as boolean)
  return v
}

/**
 * Set entry LRU con eviction LIFO oldest insertion al cap MAX_ENTRIES.
 *
 * @param key Chiave LRU formato `mfId::action::resource`.
 * @param value Boolean cached (true=allowed, false=denied).
 */
export function lruSet(key: string, value: boolean): void {
  if (cache.has(key)) {
    cache.delete(key)
  } else if (cache.size >= MAX_ENTRIES) {
    // Eviction oldest insertion (head Map iterator)
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, value)
}

/**
 * Invalidation event-driven prefix-scoped — rimuove tutte le entries con key
 * iniziante con `${mfId}::`.
 *
 * Invocato da lifecycle hooks W2-P04 su `microfrontend.unregistered` /
 * `microfrontend.unmounted` / `microfrontend.permissions.updated`.
 *
 * @param mfId MicroFrontend id da invalidare.
 * @returns Numero entries rimosse.
 */
export function lruClearByMfId(mfId: string): number {
  const prefix = `${mfId}::`
  let count = 0
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(prefix)) {
      cache.delete(k)
      count++
    }
  }
  return count
}

/** Svuota completamente la cache (test helper + module teardown). */
export function lruClearAll(): void {
  cache.clear()
}

/** @internal — test-only inspector per verifica eviction LIFO. */
export function __cacheSize(): number {
  return cache.size
}
