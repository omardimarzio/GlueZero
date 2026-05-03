// backpressure-strategy.ts — Backpressure policy 6 types + priority-aware bypass
// (D-75, ROUTE-10 chiusura, Pitfall 4 + Pitfall 6 fix).
//
// Policy supportate (D-75 / RoutePolicies.BackpressurePolicyConfig):
// - 'queue-bounded' { max: N } — accoda fino a N inflight, drop-new (default) o
//   drop-oldest (opt-in). Su overflow con drop-new: throw BrokerError 'backpressure.dropped'.
// - 'drop' — drop fast: solo 1 task in volo per route, secondi rejected immediato.
// - 'throttle' { perSec: N } — rate-limit token bucket: max N task/sec con finestra 1s.
// - 'debounce' { waitMs: N } — esegue solo dopo N ms di silenzio (consecutive collapse).
// - 'latest-only' — abort precedenti pending, esegui nuovo task.
// - 'merge'/'coalesce' — V1 minimal alias di latest-only (full coalescing rinviato a V1.x).
//
// CRITICAL bypass: priority='critical' (es. system.error) BYPASSA tutte le policy
// — chiusura Pitfall 4 (PRD §22.3 critical events sempre delivered).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-75: BackpressureStrategy priority-aware (PITFALLS #4: 'critical' bypassa).
// - Pattern Strategy DI (D-68): factory createBackpressureStrategy iniettata da plan
//   03-12 nel HttpGateway via HttpGatewayStrategies bundle.
//
// Threat coverage:
// - T-03-10-02 (DoS — backpressure queue cresce illimitato): default policy
//   'queue-bounded' max: 100 se nessuna config esplicita.
// - T-03-10-03 (DoS via critical): accept — critical events sono trusted (system.* origin),
//   plan 03-12 enforce non-system topic priority cap.

import { createBrokerError } from '@sembridge/core'
import type { BackpressurePolicyConfig } from '@sembridge/routing'
import type { BackpressureStrategy } from '../types/http-strategies'

/** Stato per-route mutabile. */
type RouteState = {
  readonly policy: BackpressurePolicyConfig
  /** Pending tasks (per dropOldest abort cascade in queue-bounded e latest-only). */
  pending: Array<{
    readonly controller: AbortController
    readonly reject: (e: unknown) => void
  }>
  /** Numero task in volo correntemente. */
  inFlight: number
  /** Window start timestamp per throttle policy. */
  throttleWindowStart: number
  /** Counter task eseguiti nella finestra corrente per throttle. */
  throttleCount: number
  /** Timer pendente per debounce (cancellato su nuovo schedule). */
  debounceTimer: ReturnType<typeof setTimeout> | null
}

/**
 * Opzioni di configurazione per `createBackpressureStrategy`.
 *
 * Il `defaultPolicy` viene applicato a route senza policy esplicita; `resolvePolicy`
 * permette lookup per-route (plan 03-12 inietta resolver basato su `RouteDefinition.policies.backpressure`).
 */
export interface BackpressureStrategyOptions {
  /** Policy default applicata a tutte le route senza override esplicito. */
  readonly defaultPolicy?: BackpressurePolicyConfig
  /** Resolver per-route: il plan 03-12 inietta resolver basato su RouteDefinition. */
  readonly resolvePolicy?: (routeId: string) => BackpressurePolicyConfig | undefined
  /**
   * Solo per 'queue-bounded': se `true`, su overflow abort il task più vecchio invece
   * di rejectare il nuovo. Default `false` (drop-new).
   */
  readonly dropOldest?: boolean
}

/**
 * Crea una `BackpressureStrategy` con priority-aware bypass per eventi `'critical'`.
 *
 * @example
 * ```ts
 * const strategy = createBackpressureStrategy({
 *   defaultPolicy: { type: 'queue-bounded', max: 100 },
 *   resolvePolicy: (routeId) => routeRegistry.get(routeId)?.policies?.backpressure,
 * })
 *
 * // Invocato dal middleware backpressure di plan 03-12
 * const result = await strategy.schedule(route.id, event.priority, () => httpGateway.execute(...))
 * ```
 *
 * @param options - Configurazione (vedi `BackpressureStrategyOptions`).
 * @returns Istanza `BackpressureStrategy` con `schedule` + `queueLength`.
 */
export function createBackpressureStrategy(
  options: BackpressureStrategyOptions = {},
): BackpressureStrategy {
  const states = new Map<string, RouteState>()
  const dropOldest = options.dropOldest ?? false

  function getState(routeId: string): RouteState {
    let s = states.get(routeId)
    if (!s) {
      const policy = options.resolvePolicy?.(routeId) ??
        options.defaultPolicy ?? { type: 'queue-bounded', max: 100 }
      s = {
        policy,
        pending: [],
        inFlight: 0,
        throttleWindowStart: 0,
        throttleCount: 0,
        debounceTimer: null,
      }
      states.set(routeId, s)
    }
    return s
  }

  async function executeTracked<T>(state: RouteState, task: () => Promise<T>): Promise<T> {
    state.inFlight++
    try {
      return await task()
    } finally {
      state.inFlight--
    }
  }

  return {
    async schedule<T>(
      routeId: string,
      priority: 'critical' | 'high' | 'normal' | 'low',
      task: () => Promise<T>,
    ): Promise<T> {
      // CRITICAL bypass — Pitfall 4 fix.
      // Eventi system.error (priority: 'critical') vengono SEMPRE eseguiti, indipendente
      // dalla policy della route. Il consumer è responsabile dell'enforcement che critical
      // sia riservato a topic trusted (plan 03-12 wrapper).
      if (priority === 'critical') {
        return await task()
      }

      const state = getState(routeId)

      switch (state.policy.type) {
        case 'queue-bounded': {
          const max = state.policy.max
          // Se siamo al limite: drop-new (default) o drop-oldest (opt-in).
          if (state.inFlight >= max) {
            if (dropOldest && state.pending.length > 0) {
              // Abort il pending più vecchio.
              const oldest = state.pending.shift()
              if (oldest !== undefined) {
                oldest.controller.abort('backpressure.dropped-oldest')
                oldest.reject(
                  createBrokerError({
                    code: 'backpressure.dropped',
                    category: 'config',
                    message: 'Dropped oldest by queue-bounded',
                    details: { routeId, type: 'queue-bounded', drop: 'oldest' },
                  }),
                )
              }
              // Nuovo task viene tracciato in pending per consentire abort futuri
              const controller = new AbortController()
              return await new Promise<T>((resolve, reject) => {
                const entry = { controller, reject }
                state.pending.push(entry)
                executeTracked(state, task)
                  .then((v) => {
                    // Rimuovi entry dopo esecuzione
                    const idx = state.pending.indexOf(entry)
                    if (idx >= 0) state.pending.splice(idx, 1)
                    resolve(v)
                  })
                  .catch((e: unknown) => {
                    const idx = state.pending.indexOf(entry)
                    if (idx >= 0) state.pending.splice(idx, 1)
                    reject(e)
                  })
              })
            }
            // Drop-new (default): reject il nuovo task.
            throw createBrokerError({
              code: 'backpressure.dropped',
              category: 'config',
              message: `Queue full (max ${max})`,
              details: { routeId, max, type: 'queue-bounded', drop: 'new' },
            })
          }
          // Sotto il cap: track + esegui. Tracciamo in pending per consentire abort
          // futuri da policy 'latest-only' o dropOldest.
          const controller = new AbortController()
          return await new Promise<T>((resolve, reject) => {
            const entry = { controller, reject }
            state.pending.push(entry)
            executeTracked(state, task)
              .then((v) => {
                const idx = state.pending.indexOf(entry)
                if (idx >= 0) state.pending.splice(idx, 1)
                resolve(v)
              })
              .catch((e: unknown) => {
                const idx = state.pending.indexOf(entry)
                if (idx >= 0) state.pending.splice(idx, 1)
                reject(e)
              })
          })
        }

        case 'drop': {
          // Drop fast: solo 1 task in volo per route.
          if (state.inFlight > 0) {
            throw createBrokerError({
              code: 'backpressure.dropped',
              category: 'config',
              message: 'Drop policy: in-flight already exists',
              details: { routeId, type: 'drop' },
            })
          }
          return await executeTracked(state, task)
        }

        case 'throttle': {
          const perSec = state.policy.perSec
          const now = Date.now()
          // Reset finestra se passato 1s
          if (now - state.throttleWindowStart >= 1000) {
            state.throttleWindowStart = now
            state.throttleCount = 0
          }
          if (state.throttleCount >= perSec) {
            throw createBrokerError({
              code: 'backpressure.dropped',
              category: 'config',
              message: `Throttle: max ${perSec}/sec`,
              details: { routeId, perSec, type: 'throttle' },
            })
          }
          state.throttleCount++
          return await executeTracked(state, task)
        }

        case 'debounce': {
          const waitMs = state.policy.waitMs
          // Cancella timer precedente — ogni nuovo schedule resetta il quiet period.
          if (state.debounceTimer !== null) {
            clearTimeout(state.debounceTimer)
            state.debounceTimer = null
          }
          return await new Promise<T>((resolve, reject) => {
            state.debounceTimer = setTimeout(() => {
              state.debounceTimer = null
              executeTracked(state, task).then(resolve).catch(reject)
            }, waitMs)
          })
        }

        case 'latest-only': {
          // Abort tutti i pending precedenti — il nuovo task vince.
          for (const entry of state.pending) {
            entry.controller.abort('backpressure.latest-only')
            entry.reject(
              createBrokerError({
                code: 'backpressure.dropped',
                category: 'config',
                message: 'Latest-only: superseded by newer task',
                details: { routeId, type: 'latest-only' },
              }),
            )
          }
          state.pending = []
          // Esegui il nuovo task tracciandolo per future abort cascade.
          const controller = new AbortController()
          return await new Promise<T>((resolve, reject) => {
            const entry = { controller, reject }
            state.pending.push(entry)
            executeTracked(state, task)
              .then((v) => {
                const idx = state.pending.indexOf(entry)
                if (idx >= 0) state.pending.splice(idx, 1)
                resolve(v)
              })
              .catch((e: unknown) => {
                const idx = state.pending.indexOf(entry)
                if (idx >= 0) state.pending.splice(idx, 1)
                reject(e)
              })
          })
        }

        case 'merge':
        case 'coalesce': {
          // V1 minimal: alias di latest-only (full coalescing con mergeFn rinviato a V1.x).
          for (const entry of state.pending) {
            entry.controller.abort('backpressure.coalesce')
            entry.reject(
              createBrokerError({
                code: 'backpressure.dropped',
                category: 'config',
                message: 'Coalesce: superseded by newer task',
                details: { routeId, type: state.policy.type },
              }),
            )
          }
          state.pending = []
          const controller = new AbortController()
          return await new Promise<T>((resolve, reject) => {
            const entry = { controller, reject }
            state.pending.push(entry)
            executeTracked(state, task)
              .then((v) => {
                const idx = state.pending.indexOf(entry)
                if (idx >= 0) state.pending.splice(idx, 1)
                resolve(v)
              })
              .catch((e: unknown) => {
                const idx = state.pending.indexOf(entry)
                if (idx >= 0) state.pending.splice(idx, 1)
                reject(e)
              })
          })
        }
      }
    },
    queueLength(routeId: string): number {
      return states.get(routeId)?.pending.length ?? 0
    },
  }
}
