/**
 * `@gluezero/gluezero` — aggregato pubblico (Phase 6 milestone v1.0).
 *
 * Single import surface per consumer — re-exporta `createGlueZero(config)`
 * factory aggregato (Wave 4b plan 06-08b) + tipi pubblici + re-export pubblico
 * delle API surface dei sub-package F6 cache + devtools.
 *
 * **Wave 4b populated (plan 06-08b)**:
 * - Side-effect re-export per attivare augment di tutti i sub-package
 *   (cache + devtools — gli altri augment sono già caricati via dipendenze
 *   transitive del routing/gateway/worker/cache/devtools).
 * - `createGlueZero(config)` factory aggregato chain composition CHAIN
 *   COMPLETA F1+F2+F3+F4+F5+F6 (D-30 no singleton + RESEARCH §11.3 Opzione B
 *   + BLOCKER-2 fix).
 * - Re-export pubblico API surface dei sub-package F6.
 *
 * **Plan 06-09 final gate** popola anche `packages/gluezero/README.md` (DOC-02
 * + DOC-05) e `packages/gluezero/EXAMPLES.md` (DOC-05 esempi end-to-end).
 *
 * @example Quick start (default chain F1+F2+F3+F4+F5+F6 attivi)
 * ```ts
 * import { createGlueZero } from '@gluezero/gluezero'
 *
 * const broker = createGlueZero({
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
import '@gluezero/cache'
import '@gluezero/devtools'

// ---------- Re-export pubblico API surface F6 cache ----------
export {
  type CacheAdapter,
  CacheBroker,
  type CacheBrokerConfig,
  type CacheConfig,
  type CacheEntry,
  type CacheStats,
  cacheKey,
  createCacheBroker,
  createMemoryCacheAdapter,
  stableHash,
} from '@gluezero/cache'
// ---------- Re-export pubblico API surface F6 devtools ----------
export {
  createDevtoolsBroker,
  createEventInspector,
  createMetricsCollector,
  createMultiplexTap,
  createPauseController,
  createRouteInspector,
  createTapRegistry,
  type DebugSnapshot,
  DevtoolsBroker,
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
} from '@gluezero/devtools'
// ---------- Wave 4b plan 06-08b — runtime factory aggregato ----------
export { createGlueZero, type GlueZero, type GlueZeroThemeAugment } from './glue-zero'
// ---------- Type re-export ----------
export type { GlueZeroConfig, GlueZeroFeatures } from './types/gluezero-config'

// ---------- v1.1.0 ext F7 (D-F7-07) — Optional theme layer type re-export ----------
// Type-only re-export per ergonomic import. Zero runtime dep su `@gluezero/theme`
// (peer optional via `peerDependenciesMeta`). Consumer che NON installa
// @gluezero/theme NON paga costo bundle e NON ha import error a runtime — solo
// se prova a costruire `createGlueZero({ theme })` TS richiederà install esplicito.
export type { Theme, CreateThemeOptions } from '@gluezero/theme/factory'
export type { BrokerLike } from '@gluezero/theme'
