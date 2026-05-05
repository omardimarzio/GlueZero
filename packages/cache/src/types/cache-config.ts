import type { BrokerEvent } from '@sembridge/core'
import type { CacheAdapter } from './cache-adapter'

/**
 * F6 CacheConfig — sezione `BrokerConfig.cache` (D-155/D-156/D-158).
 *
 * Pattern decl merging via `augment.ts` (analog `WorkerConfig` F5).
 *
 * @see RESEARCH §3 stable hash + §4 cache route handler concretizza F3 D-77.
 */
export interface CacheConfig {
  /**
   * D-158: cap entries LRU eviction. Default 1000.
   * Override per swap completo via `adapter`.
   */
  readonly maxEntries?: number
  /**
   * D-158: adapter custom (V1.x — `@sembridge/cache-idb` o consumer-defined).
   * Default: `createMemoryCacheAdapter({ maxEntries })` plan 06-02.
   */
  readonly adapter?: CacheAdapter
  /**
   * D-156 hybrid: scope provider config-level (default per tutte le route).
   * Route-level override via `RouteDefinition.cache.scope`. Cache key finale:
   * `${scope}::${baseKey}` (anti cross-tenant leakage).
   *
   * Ritorna `null`/`undefined` → D-157 missing scope su route auth: skip cache
   * (zero hit, zero write) + emit `system.cache.scope-missing` audit.
   */
  readonly scopeProvider?: (event: BrokerEvent) => string | null | undefined
}
