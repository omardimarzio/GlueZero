// cache-handler.ts — F6 CacheHandler (plan 06-03 D-77 concretizzazione +
// 3-strategy dispatch + scope hybrid D-156 + D-157 missing scope auth bypass +
// cache-then-network ordering microtask + sanitized error D-80).
//
// **D-83 strict (CRITICO carryover F1-F5):** F6 NON modifica `route-executor.ts`,
// `cache-handler.ts` (F3 stub) né `composite-handler.ts` (F3) di
// `packages/routing/`. Wiring via composition wrapper plan 06-08 (Opzione B
// preferred via DI in `RouteExecutorDeps.cacheHandler` o Opzione B' fallback
// intercept publish PRE-RouterBroker per type='cache'/'composite').
//
// **Pattern Strategy F3 dispatch carryover (D-152 analog F5)**: factory ritorna
// handler con `execute(event, route)` che dispatcha per `route.strategy` 3-way:
//   - `cache-first` — lookup → HIT publish `{origin:'cache'}` | MISS fetch + cache.set
//   - `network-first` — fetch → success cache.set | error cache fallback
//   - `cache-then-network` — HIT queueMicrotask publish + fetch background publish replaces
//
// Pipeline §28 step 9 dispatch (D-152): cache lookup → strategy dispatch → publish
// outcome. Lifecycle events (D-161) emessi via tap optional injected:
//   - 'event.cache.lookup' — pre-cache check
//   - 'event.cache.hit' — entry trovata + TTL valido
//   - 'event.cache.miss' — entry assente o TTL expired
//   - 'event.cache.evicted' — LRU/TTL/invalidate eviction (delegato a adapter 06-02)
//
// Sanitized error shape (D-80 carryover F3 OutcomeCollector + F5 worker-handler):
//   `{ code, category, message, routeId, topic, eventId }` — NO originalError/stack/cause.
//
// Threat coverage:
//   - T-06-03-01 (Information Disclosure cross-tenant cache leak): mitigate via
//     scope hybrid D-156 + scope-missing audit D-157.
//   - T-06-03-02 (Logic flaw cache-then-network ordering inverted): mitigate via
//     queueMicrotask SYNC subito (RESEARCH §15.6).
//   - T-06-03-04 (Tampering route.cache.key callback throw): mitigate via try/catch
//     wrap + fallback default + audit emit.
//   - T-06-03-06 (Information Disclosure originalError leak): mitigate via sanitized
//     error shape D-80 (no originalError/stack/cause).

import { type BrokerEvent, createBrokerError, type EventTap } from '@gluezero/core'
import { cacheKey } from './stable-hash'
import type { CacheAdapter } from './types/cache-adapter'

/**
 * Function `publishFn` injected — riusa contratto F3/F5 publishFn pattern (analog
 * F5 worker-handler.ts:50-77). Accetta topic + payload + options con metadata
 * `origin: 'cache' | 'remote'` e `replaces?: string` per cache-then-network.
 */
export type CachePublishFn = (
  topic: string,
  payload: unknown,
  options?: {
    readonly source?: { readonly type: string; readonly id: string; readonly name?: string }
    readonly correlationId?: string
    readonly priority?: 'low' | 'normal' | 'high' | 'critical'
    readonly metadata?: { readonly origin?: 'cache' | 'remote'; readonly replaces?: string }
  },
) => void | Promise<void>

/**
 * httpHandler delegate — chiamato per cache-miss (cache-first) o per fetch
 * primario (network-first / cache-then-network). Pattern coerente con F3
 * RouteExecutor delegated handlers (gateway HTTP).
 *
 * Ritorna outcome shape:
 *   - `{ outcome: 'success', value }` su 2xx (response body parsato)
 *   - `{ outcome: 'error', error }` su 4xx/5xx/network-error (sanitized)
 */
export type CacheHttpDelegate = (
  event: BrokerEvent,
  route: RouteCacheCompiled,
  signal: AbortSignal,
) => Promise<{
  readonly outcome: 'success' | 'error'
  readonly value?: unknown
  readonly error?: unknown
}>

/**
 * RouteCacheCompiled — shape minimal richiesta dal CacheHandler. Il route runtime
 * F3 fornirà compiled route più completa; qui usiamo subset (topic, strategy, ttl,
 * key, scope, auth) — pattern coerente con DI minimal di F3/F5.
 */
export interface RouteCacheCompiled {
  readonly id: string
  readonly topic: string
  readonly strategy: 'cache-first' | 'network-first' | 'cache-then-network'
  readonly ttl?: number
  readonly key?: (event: BrokerEvent) => string
  readonly scope?: (event: BrokerEvent) => string | null | undefined
  readonly auth?: boolean
}

/**
 * Dependency injection per `createCacheHandlerF6` — cache adapter + publishFn +
 * httpHandler delegate + scopeProvider config-level + tap optional D-161.
 */
export interface CacheHandlerF6Deps {
  readonly cache: CacheAdapter
  readonly publishFn: CachePublishFn
  readonly httpHandler: CacheHttpDelegate
  readonly scopeProvider?: (event: BrokerEvent) => string | null | undefined
  readonly tap?: EventTap
}

/**
 * Outcome ritornato da `execute()`. `source` indica origine finale (cache vs
 * remote); `cacheHit` discrimina HIT/MISS in cache-first/cache-then-network.
 */
export interface CacheHandlerOutcome {
  readonly status: 'success' | 'error' | 'skipped'
  readonly source: 'cache' | 'remote'
  readonly cacheHit?: boolean
  readonly errorCode?: string
}

/**
 * Interface pubblica del CacheHandler F6 — single entry-point `execute(event,
 * route, signal?)`. Tutti i path async terminano con publish outcome.
 */
export interface CacheHandlerF6 {
  execute(
    event: BrokerEvent,
    route: RouteCacheCompiled,
    signal?: AbortSignal,
  ): Promise<CacheHandlerOutcome>
}

/**
 * Helper: deriva topic outcome da topic source (analog F5 D-146 deriveTopic
 * suffix-replace logic).
 *
 * Convention `<entity>.<action>.requested` → `<entity>.<action>.<suffix>`:
 *   - `weather.requested` → `weather.loaded` / `.failed`
 *   - `report.generation.requested` → `report.generation.loaded`
 *   - `singleword` (no dots) → `singleword.<suffix>` (append fallback)
 *
 * @param sourceTopic Topic originale (es. `weather.requested`).
 * @param suffix Outcome suffix (`loaded` | `failed`).
 * @returns Topic derivato per outcome publish.
 */
export function deriveTopicFromCache(sourceTopic: string, suffix: 'loaded' | 'failed'): string {
  const parts = sourceTopic.split('.')
  if (parts.length === 1) return `${sourceTopic}.${suffix}`
  parts[parts.length - 1] = suffix
  return parts.join('.')
}

/**
 * Resolve scope: route-level override > config-level fallback (D-156).
 * Pattern coerente con F3 D-69/D-79 timeout/auth hierarchy.
 *
 * @internal
 */
function resolveScope(
  event: BrokerEvent,
  route: RouteCacheCompiled,
  deps: CacheHandlerF6Deps,
): string | null {
  if (route.scope) {
    const v = route.scope(event)
    return v ?? null
  }
  const v = deps.scopeProvider?.(event)
  return v ?? null
}

/**
 * Resolve cache key: route-level callback > default `cacheKey()` (D-155).
 * try/catch wrap fallback a default + audit emit (T-06-03-04 mitigation).
 *
 * @internal
 */
function resolveCacheKey(
  event: BrokerEvent,
  route: RouteCacheCompiled,
  scope: string | null,
  deps: CacheHandlerF6Deps,
): string {
  if (route.key) {
    try {
      return route.key(event)
    } catch {
      void deps.publishFn('system.cache.key-callback-failed', {
        routeId: route.id,
        topic: event.topic,
        eventId: event.id,
      })
      // Fallback to default below
    }
  }
  return cacheKey({ topic: event.topic, payload: event.payload, scope })
}

/**
 * Emit lifecycle event via tap (D-161). Cast required perché
 * `F6CachePipelineStep` literal union NON è merge-ata in `PipelineStep` F1
 * (limitazione TS R4 — RESEARCH §17). Consumer dichiara `AllSteps = PipelineStep
 * | F6CachePipelineStep` localmente.
 *
 * @internal
 */
function emitTap(
  tap: EventTap | undefined,
  event: BrokerEvent,
  step: 'event.cache.lookup' | 'event.cache.hit' | 'event.cache.miss' | 'event.cache.evicted',
): void {
  if (!tap) return
  try {
    // Cast: F6 step literal NON in PipelineStep F1 — D-161 carryover augment.ts
    tap.onPipelineStep(step as unknown as 'event.received', {
      eventId: event.id,
      topic: event.topic,
      step: step as unknown as 'event.received',
      timestamp: Date.now(),
      durationMs: 0,
    })
  } catch {
    // Errori del tap sono swallowed (D-20 carryover F1)
  }
}

/**
 * Sanitized error D-80 shape — payload publishFailure SENZA originalError/stack/cause.
 *
 * @internal
 */
function buildSanitizedError(opts: {
  readonly code: string
  readonly message: string
  readonly routeId: string
  readonly topic: string
  readonly eventId: string
}): {
  readonly code: string
  readonly category: 'route'
  readonly message: string
  readonly routeId: string
  readonly topic: string
  readonly eventId: string
} {
  // Use createBrokerError to produce a BrokerError-shaped object, then strip to
  // sanitized shape (no originalError/stack/cause).
  const err = createBrokerError({
    code: opts.code,
    message: opts.message,
    category: 'route',
    routeId: opts.routeId,
    topic: opts.topic,
    eventId: opts.eventId,
  })
  return {
    code: err.code,
    category: 'route',
    message: err.message,
    routeId: opts.routeId,
    topic: opts.topic,
    eventId: opts.eventId,
  }
}

/**
 * F6 createCacheHandlerF6 — Strategy F3 dispatch (D-152 analog F5) + scope hybrid
 * D-156 + D-157 missing scope auth bypass + D-77 concretizzazione F3 stub.
 *
 * **D-83 strict (CRITICO):** F6 NON modifica F3 `route-executor.ts` né F3
 * `cache-handler.ts` stub. Wiring via composition wrapper plan 06-08.
 *
 * **Strategy 3-way dispatch:**
 *   - `cache-first` — cache.get → HIT publish | MISS httpHandler + cache.set
 *   - `network-first` — httpHandler → success cache.set | error cache.get fallback
 *   - `cache-then-network` — cache.get HIT → queueMicrotask publish + fetch
 *     background publish remote replaces (RESEARCH §15.6 ordering)
 *
 * **D-157 missing scope auth bypass:** se `route.auth === true` e scope risolto
 * a `null`, skip cache (zero hit, zero write) + emit `system.cache.scope-missing`
 * audit + cold fetch sempre — sicuro by default zero leakage.
 *
 * **Sanitized error shape D-80:** payload publishFailure SENZA originalError/stack.
 *
 * @param deps - Cache adapter + publishFn + httpHandler + scopeProvider opt + tap opt.
 * @returns `CacheHandlerF6` con metodo `execute(event, route, signal?)`.
 *
 * @example Strategy dispatch (consumer interno CacheBroker plan 06-08)
 * ```ts
 * const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })
 * await handler.execute(event, route)
 * // → publish '<topic>.loaded' (success) | '<topic>.failed' (error sanitized)
 * ```
 *
 * @example Cache-then-network ordering (RESEARCH §15.6 anti-flicker UI)
 * ```ts
 * // strategy 'cache-then-network' HIT branch — microtask publish PRIMA della fetch:
 * const route = { type: 'cache', id: 'r', topic: 'weather.requested',
 *                 strategy: 'cache-then-network', ttl: 60_000 }
 * // Subscriber order garantito: 'cache' → 'remote' (anche con fetch istantanea/mock)
 * ```
 *
 * @example Missing scope auth bypass (D-157 fail-secure)
 * ```ts
 * const handler = createCacheHandlerF6({ cache, publishFn, httpHandler })
 * await handler.execute(event, { ...route, auth: true, scope: () => null })
 * // → emit 'system.cache.scope-missing' audit + cold fetch sempre (NO cache lookup)
 * ```
 *
 * @throws {never} La factory non solleva sincrono — tutti gli errori runtime sono
 *   convertiti in `<topic>.failed` payload via `buildSanitizedError` (sanitized
 *   shape D-80, NO originalError/stack/cause). Errori di config (route.strategy
 *   sconosciuto) → `cache.strategy.unknown` codice come failure event payload.
 *
 * @see ./composite-handler.ts — orchestrator workflow F6 concretizza F3 stub
 * @see RESEARCH §4 cache route handler concretizza F3 D-77
 * @see RESEARCH §15.6 cache-then-network ordering microtask Pitfall
 */
export function createCacheHandlerF6(deps: CacheHandlerF6Deps): CacheHandlerF6 {
  return {
    async execute(
      event: BrokerEvent,
      route: RouteCacheCompiled,
      signal?: AbortSignal,
    ): Promise<CacheHandlerOutcome> {
      const scope = resolveScope(event, route, deps)
      const effectiveSignal = signal ?? new AbortController().signal

      // D-157: missing scope su route auth → skip cache + audit + cold fetch
      if (route.auth === true && scope === null) {
        void deps.publishFn('system.cache.scope-missing', {
          routeId: route.id,
          topic: event.topic,
          eventId: event.id,
        })
        // Cold fetch sempre — bypass cache lookup e cache.set
        const httpResult = await deps.httpHandler(event, route, effectiveSignal)
        if (httpResult.outcome === 'success') {
          void deps.publishFn(deriveTopicFromCache(event.topic, 'loaded'), httpResult.value, {
            metadata: { origin: 'remote' },
          })
          return { status: 'success', source: 'remote' }
        }
        const sanitized = buildSanitizedError({
          code: 'cache.network.failed',
          message: 'Network fetch failed (cache bypassed due to missing scope)',
          routeId: route.id,
          topic: event.topic,
          eventId: event.id,
        })
        void deps.publishFn(deriveTopicFromCache(event.topic, 'failed'), { error: sanitized })
        return { status: 'error', source: 'remote', errorCode: 'cache.network.failed' }
      }

      const key = resolveCacheKey(event, route, scope, deps)
      emitTap(deps.tap, event, 'event.cache.lookup')

      // Strategy dispatch
      switch (route.strategy) {
        case 'cache-first': {
          const hit = deps.cache.get(key)
          if (hit) {
            emitTap(deps.tap, event, 'event.cache.hit')
            void deps.publishFn(deriveTopicFromCache(event.topic, 'loaded'), hit.value, {
              metadata: { origin: 'cache' },
            })
            return { status: 'success', source: 'cache', cacheHit: true }
          }
          emitTap(deps.tap, event, 'event.cache.miss')
          // MISS → fetch + cache.set
          const httpResult = await deps.httpHandler(event, route, effectiveSignal)
          if (httpResult.outcome === 'success') {
            deps.cache.set(key, httpResult.value, route.ttl)
            void deps.publishFn(deriveTopicFromCache(event.topic, 'loaded'), httpResult.value, {
              metadata: { origin: 'remote' },
            })
            return { status: 'success', source: 'remote', cacheHit: false }
          }
          const sanitized = buildSanitizedError({
            code: 'cache.network.failed',
            message: 'Cache miss + network fetch failed',
            routeId: route.id,
            topic: event.topic,
            eventId: event.id,
          })
          void deps.publishFn(deriveTopicFromCache(event.topic, 'failed'), { error: sanitized })
          return { status: 'error', source: 'remote', errorCode: 'cache.network.failed' }
        }

        case 'network-first': {
          const httpResult = await deps.httpHandler(event, route, effectiveSignal)
          if (httpResult.outcome === 'success') {
            deps.cache.set(key, httpResult.value, route.ttl)
            void deps.publishFn(deriveTopicFromCache(event.topic, 'loaded'), httpResult.value, {
              metadata: { origin: 'remote' },
            })
            return { status: 'success', source: 'remote' }
          }
          // Network error → fallback cache lookup
          const fallbackHit = deps.cache.get(key)
          if (fallbackHit) {
            emitTap(deps.tap, event, 'event.cache.hit')
            void deps.publishFn(deriveTopicFromCache(event.topic, 'loaded'), fallbackHit.value, {
              metadata: { origin: 'cache' },
            })
            return { status: 'success', source: 'cache', cacheHit: true }
          }
          emitTap(deps.tap, event, 'event.cache.miss')
          const sanitized = buildSanitizedError({
            code: 'cache.network.failed',
            message: 'Network failed + cache empty',
            routeId: route.id,
            topic: event.topic,
            eventId: event.id,
          })
          void deps.publishFn(deriveTopicFromCache(event.topic, 'failed'), { error: sanitized })
          return { status: 'error', source: 'remote', errorCode: 'cache.network.failed' }
        }

        case 'cache-then-network': {
          const hit = deps.cache.get(key)
          if (hit) {
            emitTap(deps.tap, event, 'event.cache.hit')
            // RESEARCH §15.6: queueMicrotask SYNC subito — garantisce cache hit
            // arriva PRIMA del network response (guard out-of-order).
            queueMicrotask(() => {
              void deps.publishFn(deriveTopicFromCache(event.topic, 'loaded'), hit.value, {
                metadata: { origin: 'cache' },
              })
            })
            // Fetch background — quando risolve, publish remote with replaces
            const httpResult = await deps.httpHandler(event, route, effectiveSignal)
            if (httpResult.outcome === 'success') {
              deps.cache.set(key, httpResult.value, route.ttl)
              void deps.publishFn(deriveTopicFromCache(event.topic, 'loaded'), httpResult.value, {
                metadata: { origin: 'remote', replaces: event.id },
              })
            }
            return { status: 'success', source: 'cache', cacheHit: true }
          }
          emitTap(deps.tap, event, 'event.cache.miss')
          // MISS → solo fetch (no replaces — niente cache event da rimpiazzare)
          const httpResult = await deps.httpHandler(event, route, effectiveSignal)
          if (httpResult.outcome === 'success') {
            deps.cache.set(key, httpResult.value, route.ttl)
            void deps.publishFn(deriveTopicFromCache(event.topic, 'loaded'), httpResult.value, {
              metadata: { origin: 'remote' },
            })
            return { status: 'success', source: 'remote', cacheHit: false }
          }
          const sanitized = buildSanitizedError({
            code: 'cache.network.failed',
            message: 'Cache miss + network fetch failed',
            routeId: route.id,
            topic: event.topic,
            eventId: event.id,
          })
          void deps.publishFn(deriveTopicFromCache(event.topic, 'failed'), { error: sanitized })
          return { status: 'error', source: 'remote', errorCode: 'cache.network.failed' }
        }

        default: {
          // Unknown strategy → config error sanitized
          const sanitized = buildSanitizedError({
            code: 'cache.strategy.unknown',
            message: `Unknown cache strategy: ${(route as { strategy?: string }).strategy ?? 'undefined'}`,
            routeId: route.id,
            topic: event.topic,
            eventId: event.id,
          })
          void deps.publishFn(deriveTopicFromCache(event.topic, 'failed'), { error: sanitized })
          return { status: 'error', source: 'cache', errorCode: 'cache.strategy.unknown' }
        }
      }
    },
  }
}
