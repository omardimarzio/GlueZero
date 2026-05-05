/**
 * `@sembridge/cache` — Cache layer entry point pubblico (Phase 6).
 *
 * Espone la superficie F6 type-level (Wave 1 plan 06-01). Wave 2-4 popolerà
 * runtime exports:
 * - W2 (plan 06-02) — `createMemoryCacheAdapter`, `stableHash`, `cacheKey` (LRU
 *   bounded D-158 + stable hash key default D-155).
 * - W2-bis (plan 06-03) — `createCacheHandlerF6`, `createCompositeHandlerF6`
 *   (concretizza F3 D-77 placeholder cache/composite route handler).
 * - W4 (plan 06-08) — `CacheBroker`, `createCacheBroker`, composition wrapper di
 *   `RouterBroker` / `WorkerBroker` (D-83 strict carryover — F6 vive solo in
 *   `packages/cache/src/`).
 *
 * **Pattern S1 anti tree-shake (T-06-01-01 mitigation):** il side-effect import
 * `./augment` è preservato dal `package.json#sideEffects` glob
 * `**\/augment.{ts,js}` + dal re-export `__augmentCacheLoaded`. Audit:
 * `grep "__augmentCacheLoaded" dist/index.js` exit 0.
 *
 * Vincolo D-83 strict (carryover F1-F5): zero modifiche a F1-F5 runtime.
 * Composition wrapper invocato dal factory pubblico `createCacheBroker` (Wave 4
 * plan 06-08).
 *
 * @example
 * ```ts
 * // Wave 1 — type-level scaffold (esempi runtime in W2 plan 06-02):
 * import type { CacheAdapter, CacheConfig, CacheEntry } from '@sembridge/cache'
 *
 * const config: CacheConfig = {
 *   maxEntries: 500,
 *   scopeProvider: (event) => event.metadata?.userId ?? null,
 * }
 * ```
 *
 * @packageDocumentation
 */

// Side-effect import — abilita TS declaration merging per BrokerConfig.cache
// (D-155/D-156/D-158). Pattern S1 anti tree-shaking (riferimento PATTERNS.md §3.2).
// Wave 4 plan 06-08 estenderà runtime con composition wrapper.
export { __augmentCacheLoaded, type F6CachePipelineStep } from './augment'

// ---------- Public types F6 cache ----------
export type { CacheAdapter, CacheConfig, CacheEntry, CacheStats } from './types'

// ---------- W2 plan 06-02 — memory-cache-adapter + stable-hash (D-155/D-158) ----------
export {
  createMemoryCacheAdapter,
  type MemoryCacheAdapterOptions,
} from './memory-cache-adapter'
export { cacheKey, fnv1a32, stableHash, stableStringify } from './stable-hash'

// ---------- W2-bis plan 06-03 — cache-handler + composite-handler (concretizza F3 D-77) ----------
export {
  createCacheHandlerF6,
  deriveTopicFromCache,
  type CacheHandlerF6,
  type CacheHandlerF6Deps,
  type CacheHandlerOutcome,
  type CacheHttpDelegate,
  type CachePublishFn,
  type RouteCacheCompiled,
} from './cache-handler'
export {
  createCompositeHandlerF6,
  type CompositeHandlerF6,
  type CompositeHandlerF6Deps,
  type CompositeHandlerOutcome,
  type CompositeHttpDelegate,
  type RouteCompositeCompiled,
  type RouteCompositeStep,
} from './composite-handler'

// ---------- Wave 4 plan 06-08 — composition wrapper Opzione B + factory pubblico ----------
// export { CacheBroker, type CacheBrokerConfig } from './cache-broker'
// export { createCacheBroker } from './public-factory'
