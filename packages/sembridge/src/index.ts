/**
 * `@sembridge/sembridge` — aggregato pubblico (Phase 6 milestone v1.0).
 *
 * Single import surface per consumer — re-exporta `createSemBridge(config)`
 * factory aggregato (Wave 4b plan 06-08b) + tipi pubblici + re-export pubblico
 * delle API surface dei sub-package F6 cache + devtools.
 *
 * **Wave 4b populated (plan 06-08b)**:
 * - Side-effect re-export per attivare augment di tutti i sub-package
 *   (cache + devtools — gli altri augment sono già caricati via dipendenze
 *   transitive del routing/gateway/worker/cache/devtools).
 * - `createSemBridge(config)` factory aggregato chain composition CHAIN
 *   COMPLETA F1+F2+F3+F4+F5+F6 (D-30 no singleton + RESEARCH §11.3 Opzione B
 *   + BLOCKER-2 fix).
 * - Re-export pubblico API surface dei sub-package F6.
 *
 * **Plan 06-09 final gate** popola anche `packages/sembridge/README.md` (DOC-02
 * + DOC-05) e `packages/sembridge/EXAMPLES.md` (DOC-05 esempi end-to-end).
 *
 * @example Quick start (default chain F1+F2+F3+F4+F5+F6 attivi)
 * ```ts
 * import { createSemBridge } from '@sembridge/sembridge'
 *
 * const broker = createSemBridge({
 *   cache: { maxEntries: 500 },
 *   devtools: { enableByDefault: true },
 * })
 * broker.publish('weather.requested', { location: 'Roma' })
 * ```
 *
 * @packageDocumentation
 */

// Side-effect re-export per attivare augment dei sub-package F6 (declaration
// merging BrokerConfig.cache + BrokerConfig.devtools + BrokerConfig.taps).
import '@sembridge/cache'
import '@sembridge/devtools'

// ---------- Type re-export ----------
export type { SemBridgeConfig, SemBridgeFeatures } from './types/sembridge-config'

// ---------- Wave 4b plan 06-08b — runtime factory aggregato ----------
export { createSemBridge, type SemBridge } from './sem-bridge'

// ---------- Re-export pubblico API surface F6 cache ----------
export {
  CacheBroker,
  cacheKey,
  createCacheBroker,
  createMemoryCacheAdapter,
  stableHash,
  type CacheAdapter,
  type CacheBrokerConfig,
  type CacheConfig,
  type CacheEntry,
  type CacheStats,
} from '@sembridge/cache'

// ---------- Re-export pubblico API surface F6 devtools ----------
export {
  createDevtoolsBroker,
  createEventInspector,
  createMetricsCollector,
  createMultiplexTap,
  createPauseController,
  createRouteInspector,
  createTapRegistry,
  DevtoolsBroker,
  type DebugSnapshot,
  type DevtoolsBrokerConfig,
  type DevtoolsConfig,
  type EventInspector,
  type FlushQueueResult,
  type HistogramSummary,
  type MetricsCollector,
  type MetricsDelta,
  type MetricsSnapshot,
  type PauseAction,
  type PauseController,
  type PauseControllerSnapshot,
  type RouteInspector,
} from '@sembridge/devtools'
