// composite-handler.ts — F6 CompositeHandler (plan 06-03 — concretizza il
// sotto-step `cache` SKIPPED di F3 `routing/route-handlers/composite-handler.ts`).
//
// **D-83 strict (CRITICO carryover F1-F5):** F6 NON modifica F3 composite-handler.ts
// né `route-executor.ts`. Wiring via composition wrapper plan 06-08 (Opzione B
// preferred via DI in `RouteExecutorDeps.compositeCacheStep` o Opzione B'
// fallback intercept publish PRE-RouterBroker per type='composite' con cache step).
//
// **Pattern primario carryover**: F3 composite-handler.ts:67-130 factory + closure
// flag `cacheWarnEmitted: boolean` per warning UNA volta. F6 elimina il warning
// (cache step ora concretizzato — chiama `cacheHandler.execute()` reale invece
// di emettere `routing.composite.cache-deferred`).
//
// **Workflow F6:**
//   1. Trova step `'cache'` nel route.steps. Se presente + cacheRoute → invoca
//      `cacheHandler.execute(event, cacheRoute)`. HIT → ritorna outcome cache,
//      skip http step. MISS / error → continue a http step.
//   2. Trova step `'http'`. Se presente → invoca `httpHandler.execute(event,
//      step)`. Success → outcome remote. Error → outcome error.
//   3. Edge case: solo cache step + MISS / no http fallback → outcome error
//      `composite.no-fallback`.
//
// **Graceful fallback (T-06-03-XX):** se `cacheHandler.execute` throws (cache
// adapter failure), il composite cattura silently e delega a http step (zero
// disruption del workflow user-facing). Pattern coerente con F3 `RouteExecutor`
// fail-soft semantics.
//
// Threat coverage:
// - T-06-03-05 (Logic flaw composite-handler skipped F3 silently NON warna user):
//   mitigate — F6 concretizza cache step + elimina warn F3.
// - T-06-03-06 (Information Disclosure): outcome shape NO originalError leak —
//   error sanitization è responsabilità del cacheHandler / httpHandler delegati
//   (D-80 carryover).

import type { BrokerEvent } from '@sembridge/core'
import type { CacheHandlerF6, RouteCacheCompiled } from './cache-handler'

/**
 * RouteCompositeStep — subset minimal di `RouteCompositeDefinition.steps` di F3
 * (`packages/routing/src/types/route-definition.ts`). F3 fornisce shape
 * completa con `route` reference + altri field type-specifici; qui usiamo
 * subset richiesto dal composite F6 (type discriminator + cacheRoute compiled
 * per cache step).
 */
export interface RouteCompositeStep {
  readonly type: 'cache' | 'http' | 'worker' | 'local'
  /** Required quando `type === 'cache'` — RouteCacheCompiled passato al cacheHandler. */
  readonly cacheRoute?: RouteCacheCompiled
  // Altri field type-specifici (route reference, worker config, ecc.) sono
  // forniti dal RouteResolver F3 in V1.x — qui non utilizzati direttamente.
}

/**
 * RouteCompositeCompiled — shape minimal richiesta dal CompositeHandler F6.
 * Subset di `RouteCompositeDefinition` di F3 (id + topic + steps array).
 */
export interface RouteCompositeCompiled {
  readonly id: string
  readonly topic: string
  readonly steps: readonly RouteCompositeStep[]
}

/**
 * Outcome ritornato da `execute()`. `source` indica origine finale del workflow:
 *   - `'cache'` — cache HIT short-circuit
 *   - `'remote'` — http step success o error
 *   - `'composite'` — config error (es. solo cache step + MISS no fallback)
 */
export interface CompositeHandlerOutcome {
  readonly outcome: 'success' | 'error' | 'skipped'
  readonly source: 'cache' | 'remote' | 'composite'
}

/**
 * httpStep delegate — invocato dal composite quando cache MISS / error / step
 * cache assente. Pattern coerente con F3 `RouteExecutor` delegated handlers.
 *
 * Ritorna outcome shape compatibile con cacheHandler.httpHandler delegate:
 *   - `{ outcome: 'success', value }` su 2xx
 *   - `{ outcome: 'error', error }` su 4xx/5xx/network-error
 */
export type CompositeHttpDelegate = (
  event: BrokerEvent,
  step: RouteCompositeStep,
) => Promise<{
  readonly outcome: 'success' | 'error'
  readonly value?: unknown
  readonly error?: unknown
}>

/**
 * Dependency injection per `createCompositeHandlerF6` — cacheHandler reale F6
 * + httpHandler delegate F3. `resolveSubRoute` deferred a wiring 06-08.
 */
export interface CompositeHandlerF6Deps {
  readonly cacheHandler: CacheHandlerF6
  readonly httpHandler: CompositeHttpDelegate
  // resolveSubRoute deferred a 06-08 wiring (V1.x — in V1 il composite invoca
  // direttamente httpHandler con step type, senza sub-route resolution).
}

/**
 * Interface pubblica del CompositeHandler F6 — single entry-point `execute(event,
 * route)`. Tutti i path async terminano con outcome shape (no throw fuori).
 */
export interface CompositeHandlerF6 {
  execute(
    event: BrokerEvent,
    route: RouteCompositeCompiled,
  ): Promise<CompositeHandlerOutcome>
}

/**
 * F6 createCompositeHandlerF6 — orchestrator workflow cache-then-http che
 * concretizza il sotto-step `cache` SKIPPED di F3.
 *
 * **D-83 strict (CRITICO):** F6 NON modifica F3 `composite-handler.ts`. Wiring
 * via composition wrapper plan 06-08 (Opzione B preferred via DI o Opzione B'
 * intercept publish PRE-RouterBroker).
 *
 * **Pattern factory + closure** (analog F3 composite-handler.ts:67-130): F6 NON
 * usa più `cacheWarnEmitted` flag perché il cache step è ora concretizzato
 * (regression guard T-06-03-05).
 *
 * **Graceful fallback:** `cacheHandler.execute` throws → caught silently →
 * delegate a http step. Cache adapter failure NON rompe il workflow.
 *
 * @param deps - cacheHandler F6 + httpHandler delegate.
 * @returns `CompositeHandlerF6` con metodo `execute(event, route)`.
 *
 * @example Concretizzazione F3 stub (consumer interno CacheBroker plan 06-08)
 * ```ts
 * const cacheHandler = createCacheHandlerF6({ cache, publishFn, httpHandler })
 * const composite = createCompositeHandlerF6({ cacheHandler, httpHandler: httpStepDelegate })
 * await composite.execute(event, compositeRoute)
 * // → outcome { outcome: 'success', source: 'cache' | 'remote' }
 * ```
 *
 * @see ./cache-handler.ts — cacheHandler F6 invocato per cache step
 * @see packages/routing/src/route-handlers/composite-handler.ts:67-130 (analog F3)
 * @see RESEARCH §4.2 concretizzazione F6 + Opzione B/B' analysis
 */
export function createCompositeHandlerF6(deps: CompositeHandlerF6Deps): CompositeHandlerF6 {
  return {
    async execute(
      event: BrokerEvent,
      route: RouteCompositeCompiled,
    ): Promise<CompositeHandlerOutcome> {
      const cacheStep = route.steps.find((s) => s.type === 'cache')
      const httpStep = route.steps.find((s) => s.type === 'http')

      // 1. Try cache lookup if cache step present + cacheRoute compiled
      if (cacheStep && cacheStep.cacheRoute) {
        try {
          const cacheOutcome = await deps.cacheHandler.execute(event, cacheStep.cacheRoute)
          if (cacheOutcome.status === 'success' && cacheOutcome.cacheHit === true) {
            // Cache HIT short-circuit — skip http step (workflow done)
            return { outcome: 'success', source: 'cache' }
          }
          // Cache MISS / cache outcome non-hit → continue to http step (fall through)
        } catch {
          // Graceful fallback: cache adapter failure → delegate http step
          // (T-06-03-XX). Pattern coerente con F3 fail-soft semantics.
        }
      }

      // 2. Fallback to http step (or primary path se solo http step presente)
      if (httpStep) {
        const httpResult = await deps.httpHandler(event, httpStep)
        if (httpResult.outcome === 'success') {
          return { outcome: 'success', source: 'remote' }
        }
        return { outcome: 'error', source: 'remote' }
      }

      // 3. Edge case: solo cache step + MISS → no fallback path
      // composite.no-fallback semantic — workflow incomplete by config.
      return { outcome: 'error', source: 'composite' }
    },
  }
}
