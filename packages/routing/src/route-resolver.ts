// route-resolver.ts — Dispatch table pre-compilata per RouteDefinition (D-64, ROUTE-01).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-64: pre-compile al register; runtime O(segments) via TopicTrie<CompiledRoute>.
//   Pitfall #16 mitigation: NESSUNA compilation hot-path. compile(def) avviene UNA volta
//   al register.
// - D-66: 3 policy multi-route 'first-match' (default + warn dev) | 'priority-ordered' |
//   'all' (ROUTE-15, chiusura PRD §39 #6).
// - D-86: unregisterByOwner cascade per LIFE-02 ext F3 (chiusura PRD §39 #7).
// - D-87: register strict opt-in (default false → idempotent return existing).
// - D-96: requestBuilder pre-curried per route http (riuso `OutputMap` di F2 al run-time
//   nell'http-handler — qui solo pre-currying del thunk).
//
// Vincolo D-83: ZERO modifiche a packages/core/ + packages/mapper/ runtime. Il
// `internal/topic-trie.ts` è una copia mirror del F1 TopicTrie (≤120 LOC) per evitare
// cross-package internal coupling. Da rimuovere quando F1 esporrà subpath internal.
//
// Threat coverage:
// - T-03-05-01 (Tampering — RouteDefinition mutation post-register): `definition: Readonly<...>`
//   in CompiledRoute; runtime deepFreeze deferred al wrapper plan 03-12.
// - T-03-05-02 (Spoofing — route id collision): strict-mode opt-in con throw
//   `route.id.duplicate`; default idempotent ritorna esistente (no overwrite).
// - T-03-05-03 (DoS — trie unbounded): bounded by registerRoute API; ogni register è esplicito.
// - T-03-05-04 (Tampering — topic pattern injection): `validateTopicPattern` riusato dal
//   internal mirror del F1 trie.
// - T-03-05-05 (Information disclosure): `BrokerError.details` include solo routeId + topic.

import { createBrokerError } from '@sembridge/core'
import { TopicTrie, validateTopicPattern } from './internal/topic-trie'
import { allBroadcast } from './strategies/all-broadcast'
import { priorityOrdered } from './strategies/priority-ordered'
import type { RouteDefinition } from './types/route-definition'
import type { MultipleRoutesPolicy } from './types/routing-config'

/**
 * Route compilata (output di `RouteResolver.compile(def)`) — D-64.
 *
 * Il `definition` è readonly per prevenire mutation post-register (T-03-05-01).
 * Il `requestBuilder` è popolato SOLO per route `type: 'http'` (D-96 pre-curry).
 */
export interface CompiledRoute {
  readonly id: string
  readonly definition: Readonly<RouteDefinition>
  readonly ownerId: string | undefined
  /** Default 0 se omesso nella RouteDefinition. */
  readonly priority: number
  /**
   * Pre-curried per route http: `(canonical) => HttpRequestSpec`. Undefined per
   * `local`/`cache`/`composite`. Il vero mapping queryMap/bodyMap è invocato dall
   * http-handler con il MapperEngine — qui costruiamo solo un thunk closurizzato.
   */
  readonly requestBuilder?: (canonicalPayload: unknown) => unknown
}

/**
 * Handle ritornato da `RouteResolver.register(def)`.
 */
export interface RouteRegistration {
  readonly id: string
  unregister(): void
}

/**
 * Evento emesso al callback `onAmbiguousRoutes` quando N>1 route matchano lo stesso
 * topic in policy `'first-match'` (D-66 dev mode).
 */
export interface AmbiguousRouteEvent {
  readonly topic: string
  readonly candidateRouteIds: readonly string[]
  readonly selectedRouteId: string
}

/**
 * Opzioni del RouteResolver.
 *
 * - `strict` — default `false`: register idempotente su id duplicato (ritorna existing).
 *   `true` → throw `BrokerError 'route.id.duplicate'` (D-87).
 * - `onAmbiguousRoutes` — callback opt-in per dev-mode warning quando matches.length > 1
 *   con policy `'first-match'` (D-66). Default no-op (silent).
 */
export interface RouteResolverOptions {
  readonly strict?: boolean
  readonly onAmbiguousRoutes?: (event: AmbiguousRouteEvent) => void
}

/**
 * RouteResolver — dispatch table pre-compilata per RouteDefinition (D-64, ROUTE-01).
 *
 * Costruisce `Map<routeId, CompiledRoute>` + `TopicTrie<CompiledRoute>` per O(segments)
 * lookup runtime. `unregisterByOwner` chiude LIFE-02 ext F3 (D-86).
 *
 * @example
 * ```ts
 * const resolver = new RouteResolver({ strict: false })
 * const reg = resolver.register({
 *   id: 'weather-http',
 *   type: 'http',
 *   topic: 'weather.requested',
 *   request: { method: 'GET', url: '/api/weather', queryMap: {...} },
 *   response: { canonical: 'weather' },
 * }, { ownerId: 'plugin-form' })
 *
 * const matches = resolver.resolve('weather.requested') // [CompiledRoute]
 * resolver.unregisterByOwner('plugin-form')              // cascade D-86
 * ```
 */
export class RouteResolver {
  private readonly trie = new TopicTrie<CompiledRoute>()
  private readonly byId = new Map<string, CompiledRoute>()
  private readonly byOwner = new Map<string, Set<string>>()
  private readonly strict: boolean
  private readonly onAmbiguous: (event: AmbiguousRouteEvent) => void

  constructor(options: RouteResolverOptions = {}) {
    this.strict = options.strict ?? false
    this.onAmbiguous = options.onAmbiguousRoutes ?? ((): void => {})
  }

  /**
   * Registra una RouteDefinition nel dispatch table.
   *
   * - `validateTopicPattern(def.topic)` — riuso del check F1 (T-03-05-04).
   * - id duplicato + `strict: true` → throw `BrokerError 'route.id.duplicate'` (D-87).
   * - id duplicato + `strict: false` (default) → ritorna existing (idempotent).
   * - Successo → `compile(def)` produce `CompiledRoute` + insert in trie + byId + byOwner.
   *
   * @param def - RouteDefinition discriminata (local|http|cache|composite).
   * @param options - Opzioni (`ownerId?: string` per cascade D-86).
   * @returns RouteRegistration con `id` + `unregister()` callback.
   * @throws `BrokerError 'route.id.duplicate'` se strict + id già registrato.
   * @throws `BrokerError 'topic.pattern.invalid'` se topic pattern malformato.
   */
  register(def: RouteDefinition, options: { ownerId?: string } = {}): RouteRegistration {
    validateTopicPattern(def.topic)
    if (this.byId.has(def.id)) {
      if (this.strict) {
        throw createBrokerError({
          code: 'route.id.duplicate',
          category: 'config',
          message: `Route id "${def.id}" already registered`,
          details: { routeId: def.id, topic: def.topic },
        })
      }
      // idempotent: ritorna handle esistente, no double insert
      return { id: def.id, unregister: (): void => void this.unregister(def.id) }
    }
    const compiled = this.compile(def, options.ownerId)
    this.byId.set(def.id, compiled)
    this.trie.insert(def.topic, compiled)
    if (options.ownerId !== undefined) {
      const set = this.byOwner.get(options.ownerId) ?? new Set<string>()
      set.add(def.id)
      this.byOwner.set(options.ownerId, set)
    }
    return { id: def.id, unregister: (): void => void this.unregister(def.id) }
  }

  /**
   * Rimuove una route dal dispatch table.
   *
   * Cleanup completo: byId + trie + byOwner. Cleanup nodi trie depth-first
   * gestito internamente dal TopicTrie F1.
   *
   * @param routeId - id della route da rimuovere.
   * @returns `true` se rimossa, `false` se non esisteva.
   */
  unregister(routeId: string): boolean {
    const compiled = this.byId.get(routeId)
    if (!compiled) return false
    this.byId.delete(routeId)
    this.trie.remove(compiled.definition.topic, compiled)
    if (compiled.ownerId !== undefined) {
      const set = this.byOwner.get(compiled.ownerId)
      if (set) {
        set.delete(routeId)
        if (set.size === 0) this.byOwner.delete(compiled.ownerId)
      }
    }
    return true
  }

  /**
   * Rimuove TUTTE le route registrate con il dato ownerId (D-86, LIFE-02 ext F3,
   * chiusura PRD §39 #7).
   *
   * Cascade invocata dal `RouterBroker.unregisterPlugin` (plan 03-12).
   *
   * @param ownerId - id del plugin/owner che ha registrato le route.
   * @returns Array di routeId rimossi (vuoto se nessuna route per l'owner).
   */
  unregisterByOwner(ownerId: string): readonly string[] {
    const ids = Array.from(this.byOwner.get(ownerId) ?? new Set<string>())
    for (const id of ids) this.unregister(id)
    return ids
  }

  /**
   * Risolve le route applicabili al topic via dispatch table + multipleRoutesPolicy.
   *
   * Lookup O(segments) tramite `TopicTrie.match`. La policy `'first-match'` emette
   * `routing.ambiguous` callback se matches.length > 1 (D-66 dev mode warning).
   *
   * @param topic - Topic concreto da risolvere (es. `weather.requested`).
   * @param policy - Strategia di selezione: `'first-match'` (default), `'priority-ordered'`, `'all'`.
   * @returns Array di CompiledRoute selezionati dalla strategy.
   */
  resolve(topic: string, policy: MultipleRoutesPolicy = 'first-match'): readonly CompiledRoute[] {
    const matches = this.trie.match(topic)
    if (matches.length === 0) return []
    if (policy === 'first-match') {
      if (matches.length > 1) {
        this.onAmbiguous({
          topic,
          candidateRouteIds: matches.map((r) => r.id),
          // biome-ignore lint/style/noNonNullAssertion: matches.length > 1 guaranteed
          selectedRouteId: matches[0]!.id,
        })
      }
      // biome-ignore lint/style/noNonNullAssertion: matches.length > 0 guaranteed by guard above
      return [matches[0]!]
    }
    if (policy === 'priority-ordered') return priorityOrdered(matches)
    return allBroadcast(matches)
  }

  /**
   * Conta le route registrate per un dato ownerId (helper per cascade testing).
   *
   * @param ownerId - id del plugin/owner.
   * @returns Numero di route registrate per l'owner (0 se nessuna).
   */
  countByOwner(ownerId: string): number {
    return this.byOwner.get(ownerId)?.size ?? 0
  }

  /**
   * Lista delle route compilate (debug helper — riusato da Inspector F6).
   *
   * @returns Array readonly di tutte le CompiledRoute attualmente registrate.
   */
  list(): readonly CompiledRoute[] {
    return Array.from(this.byId.values())
  }

  /**
   * Pre-compila la RouteDefinition in CompiledRoute (D-64, D-96 pre-curry).
   *
   * Per route `type: 'http'` produce un `requestBuilder` thunk closurizzato sul
   * queryMap/bodyMap della route. Il vero mapping canonico→server tramite
   * `MapperEngine.mapToShape` (F2) è risolto dall'http-handler in plan 03-08+.
   *
   * @internal
   */
  private compile(def: RouteDefinition, ownerId: string | undefined): CompiledRoute {
    const priority = def.priority ?? 0
    let requestBuilder: ((canonical: unknown) => unknown) | undefined
    if (def.type === 'http') {
      const httpDef = def
      requestBuilder = (canonical: unknown): unknown => {
        const result: Record<string, unknown> = {
          method: httpDef.request.method,
          url: httpDef.request.url,
          canonical,
        }
        if (httpDef.request.queryMap !== undefined) result['queryMap'] = httpDef.request.queryMap
        if (httpDef.request.bodyMap !== undefined) result['bodyMap'] = httpDef.request.bodyMap
        return result
      }
    }
    // Conditional spread per `exactOptionalPropertyTypes: true` (omette il field se undefined)
    const compiled: CompiledRoute = {
      id: def.id,
      definition: def,
      ownerId,
      priority,
      ...(requestBuilder !== undefined && { requestBuilder }),
    }
    return compiled
  }
}
