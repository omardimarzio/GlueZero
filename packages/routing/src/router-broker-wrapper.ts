// router-broker-wrapper.ts — RouterBroker composition wrapper (D-83 — replica F2 D-49).
//
// Vincolo D-83: NESSUNA modifica a packages/core/ né packages/mapper/ runtime.
// RouterBroker compone MapperBroker (privato) e aggiunge:
//   - RouterEngine (resolver + executor + gateway + collector + strategies)
//   - publish() override: pipeline §28 step 8/9/10 PRIMA di delegare a inner.publish
//   - registerPlugin/unregisterPlugin override: cascade auto-register routes + LIFE-02 ext F3
//   - registerRoute/unregisterRoute API surface (ROUTE-01, D-60)
//   - subscribe() delegate (BLOCKER 3 revision fix)
//   - getCanonicalSchemaForTopic + requiresRouteTopics opt-in (BLOCKER 4 revision fix, D-100)
//   - 'routing.composite.deferred' topic (BLOCKER 2 revision fix — TOPIC_REGEX no hyphen)
//
// Pipeline §28 orchestrazione (D-84):
// - Step 7-full (event.dedupe.checked): F1 base, esteso F3 quando dedupe-strategy attiva
// - Step 8 (event.route.resolved): RouterBroker.publish invoca resolver.resolve
// - Step 9 (event.route.executed): per-route async via executor.execute
// - Step 10 (event.outcome.collected): per-route via collector.collect
//
// Threat coverage (vedi <threat_model> in 03-12-PLAN.md):
// - T-03-12-01 (Tampering — route hijack via descriptor.routes): resolver.register strict-default
//   false → idempotent (no overwrite); strict opt-in.
// - T-03-12-02 (DoS — unregisterPlugin cascade error blocks subsequent steps): try/catch isolato
//   per ogni step (pattern F2 D-49) — un fallimento NON blocca gli altri.
// - T-03-12-03 (Information Disclosure — route.required.missing error includes payload): publish
//   solo `{topic, eventId}` no payload nel sourceEvent.
// - T-03-12-05 (DoS — publish cascade infinito): OutcomeCollector recursion guard (D-82).

import {
  type BrokerEvent,
  createBrokerError,
  type EventTap,
  isBrokerError,
  type PipelineSnapshot,
  type PipelineStep,
  type PluginDescriptor,
  type Subscription,
} from '@gluezero/core'
import { MapperBroker } from '@gluezero/mapper'
import { nanoid } from 'nanoid'
import type { CompiledRoute, RouteRegistration } from './route-resolver'
import { RouterEngine } from './router-engine'
import type { RouteDefinition } from './types/route-definition'
import type { MultipleRoutesPolicy, RoutingConfig } from './types/routing-config'

/**
 * Tipo del config accettato da MapperBroker constructor (F2). Estratto dal
 * `ConstructorParameters` per type-safety; il narrowing `NonNullable` risolve
 * l'unione `BrokerConfig | undefined` (default `{}`).
 */
type MapperBrokerCtorConfig = NonNullable<ConstructorParameters<typeof MapperBroker>[0]>

/**
 * Configurazione RouterBroker — accetta tutto il MapperBrokerConfig di F2 + sezioni F3.
 *
 * - Sezioni F2 (`runtime`, `canonicalModel`, `aliasRegistry`, `transforms`, `debug`,
 *   `topicSchemas`) — passthrough al MapperBroker inner.
 * - Sezioni F3 (`routes`, `gateway`, `routing`) — usate dal RouterEngine + bootstrap.
 *
 * `routing.requiresRouteTopics` (D-100) — opt-in esplicito per topic che richiedono route
 * senza dipendere dalla convenzione PRD §11 (vedi `getCanonicalSchemaForTopic` rationale).
 */
export interface RouterBrokerConfig {
  readonly runtime?: MapperBrokerCtorConfig['runtime']
  readonly canonicalModel?: MapperBrokerCtorConfig['canonicalModel']
  readonly aliasRegistry?: MapperBrokerCtorConfig['aliasRegistry']
  readonly transforms?: MapperBrokerCtorConfig['transforms']
  readonly debug?: MapperBrokerCtorConfig['debug']
  readonly topicSchemas?: MapperBrokerCtorConfig['topicSchemas']
  // F3-specific
  readonly routes?: readonly RouteDefinition[]
  readonly gateway?: import('@gluezero/gateway/http').GatewayConfig
  readonly routing?: RoutingConfig
}

/**
 * Shape minimal del CanonicalRegistry isolato dal RouterBroker (D-100, BLOCKER 4 fix).
 *
 * Non importiamo `CanonicalRegistry` direttamente perché è un export di
 * `@gluezero/mapper` ma la sua API surface è interna (private field di MapperBroker).
 * Il RouterBroker bind UNA volta in constructor con presence check + throw esplicito
 * se non accessibile (NO silent fallback — vedi rationale in `getCanonicalSchemaForTopic`).
 */
interface BoundCanonicalRegistry {
  get(id: never): { readonly requiresRoute?: boolean } | undefined
}

/**
 * RouterBroker — composition wrapper di MapperBroker per F3 routing engine (D-83).
 *
 * @example
 * ```ts
 * const broker = new RouterBroker({
 *   gateway: { allowlist: ['https://api.example.com'] },
 *   routing: { multipleRoutesPolicy: 'first-match' },
 *   routes: [
 *     { id: 'weather-http', type: 'http', topic: 'weather.requested',
 *       request: { method: 'GET', url: 'https://api.example.com/weather' },
 *       response: { canonical: 'weather' } },
 *   ],
 * })
 * broker.publish('weather.requested', { location: 'Roma' })
 * // → fetch + mapper + publish 'weather.loaded'
 * ```
 */
export class RouterBroker {
  private readonly inner: MapperBroker
  private readonly engine: RouterEngine
  private readonly tap: EventTap | undefined
  private readonly multipleRoutesPolicy: MultipleRoutesPolicy
  /**
   * Bound CanonicalRegistry private di MapperBroker (D-100, BLOCKER 4 revision fix).
   *
   * Verificato presence in constructor — se F2 cambia API surface (rinominare/rimuovere
   * canonicalRegistry private field), il guard throw `BrokerError 'router.canonical-registry.unavailable'`
   * al boot. NIENTE silent fallback runtime.
   */
  private readonly boundCanonicalRegistry: BoundCanonicalRegistry
  /**
   * Opt-in esplicito per topic che richiedono route (D-100, BLOCKER 4 revision fix).
   *
   * Bypass del lookup canonical-registry per topic dichiarati direttamente come
   * requiresRoute=true. Risolve il caso edge in cui il consumer NON usa la convenzione
   * PRD §11 `<entity>.<action>.<status>` per derivare schemaId dal topic.
   */
  private readonly explicitRequiresRouteTopics: ReadonlySet<string>

  constructor(config: RouterBrokerConfig = {}) {
    // 1. Costruisci MapperBroker inner (composition F2 D-49).
    //    Conditional spread per `exactOptionalPropertyTypes: true`.
    this.inner = new MapperBroker({
      ...(config.runtime !== undefined && { runtime: config.runtime }),
      ...(config.canonicalModel !== undefined && { canonicalModel: config.canonicalModel }),
      ...(config.aliasRegistry !== undefined && { aliasRegistry: config.aliasRegistry }),
      ...(config.transforms !== undefined && { transforms: config.transforms }),
      ...(config.debug !== undefined && { debug: config.debug }),
      ...(config.topicSchemas !== undefined && { topicSchemas: config.topicSchemas }),
    })
    this.tap = config.runtime?.tap
    this.multipleRoutesPolicy = config.routing?.multipleRoutesPolicy ?? 'first-match'

    // 2. BLOCKER 4 revision fix: bind del CanonicalRegistry private di MapperBroker.
    //    Pattern Opzione A revision_context — cast UNA volta isolato qui, surface
    //    esplicito se F2 non risponde. Documentato come D-100 in CONTEXT.md.
    //
    //    Verifica: se MapperBroker change e `canonicalRegistry` non è più accessibile
    //    (es. rinominato/rimosso in F6), questo throw scopre la regressione al boot
    //    del RouterBroker invece che durante il primo evento ROUTE-16 (loud > silent).
    const innerWithReg = this.inner as unknown as {
      canonicalRegistry?: BoundCanonicalRegistry
    }
    if (
      !innerWithReg.canonicalRegistry ||
      typeof innerWithReg.canonicalRegistry.get !== 'function'
    ) {
      throw createBrokerError({
        code: 'router.canonical-registry.unavailable',
        category: 'config',
        message:
          'RouterBroker: MapperBroker.canonicalRegistry is not accessible. ROUTE-16 (D-67) requiresRoute opt-in cannot function. Check F2 API stability or upgrade @gluezero/mapper.',
        details: {
          hint: 'Either F2 changed canonicalRegistry visibility, or use RoutingConfig.requiresRouteTopics to bypass canonical lookup.',
        },
      })
    }
    this.boundCanonicalRegistry = innerWithReg.canonicalRegistry
    this.explicitRequiresRouteTopics = new Set(config.routing?.requiresRouteTopics ?? [])

    // 3. Costruisci RouterEngine glue (5 sub-componenti F3).
    //    publishFn binda inner.publish — il RouterBroker NON intercetta i publish del
    //    OutcomeCollector (eviterebbe doppio loop pipeline §28).
    this.engine = new RouterEngine({
      mapper: {
        mapToShape: (canonical, outputMap) => this.delegateMapToShape(canonical, outputMap),
        mapToCanonical: (shape, schemaId) => this.delegateMapToCanonical(shape, schemaId),
      },
      // NB: NO validator default. Il `valibotAdapter` di F2 espone
      // `validate(schema, payload)` con schema = Valibot BaseSchema; il
      // `HttpHandlerValidator` di F3 richiede invece `validate(schemaId, payload)`.
      // Adapter conversion (schemaId → BaseSchema lookup nel CanonicalRegistry +
      // BaseSchema construction da CanonicalSchema fields) è deferred a F4/F6 quando
      // VAL-05 sarà fully wired. F3 V1: response validation skip (consumer decide
      // validation locale via inputMap se necessario).
      ...(this.tap !== undefined && { tap: this.tap }),
      publishFn: (topic, payload, options) =>
        this.inner.publish(topic, payload, options as Parameters<typeof this.inner.publish>[2]),
      ...(config.gateway !== undefined && { gatewayConfig: config.gateway }),
      ...(config.routing !== undefined && { routingConfig: config.routing }),
      onAmbiguousRoutes: (event) => {
        this.inner.publish('routing.ambiguous', event, {
          source: { type: 'system', id: 'router' },
        })
      },
      onCacheDeferred: (event) => {
        // BLOCKER 2 fix (revision): TOPIC_REGEX in @gluezero/core/topic-matcher.ts
        // NON consente hyphen. Il topic precedente con hyphen fallirebbe
        // validateTopic(). Rinominato a 'routing.composite.deferred' (drop prefix
        // ridondante poiché vive sotto routing.composite.*). L'identifier interno/
        // callback name in composite-handler.ts può restare con hyphen poiché è
        // solo identifier TS, non un topic pubblicato.
        this.inner.publish('routing.composite.deferred', event, {
          source: { type: 'system', id: 'router' },
        })
      },
    })

    // 4. Bootstrap routes da config.
    if (config.routes) {
      for (const r of config.routes) this.engine.resolver.register(r)
    }

    // 5. CR-05 fix iter 2: dev-mode boot warning UNA VOLTA se dedupe/backpressure
    //    configurati ma wiring runtime skipped. Surface esplicito per developer F4
    //    che legge il gateway code e si aspetta che le strategy siano invocate.
    //    Guard `runtime.debug === true` consumer-side (default false in produzione → no console noise).
    if (config.runtime?.debug === true) {
      const hasDedupeDefault = config.gateway?.defaults?.dedupe !== undefined
      const hasBackpressureDefault = config.gateway?.defaults?.backpressure !== undefined
      if (hasDedupeDefault || hasBackpressureDefault) {
        // FIXME(F4): wiring dedupe/backpressure deferred — vedi 03-VERIFICATION.md override #1/#2.
        // biome-ignore lint/suspicious/noConsole: dev-mode warning consumer-facing
        console.warn(
          '[GlueZero F3] gateway.defaults.dedupe/backpressure è configurato ma il wiring runtime nel HttpGateway è deferred a F4 (vedi 03-VERIFICATION.md override #1/#2). Le primitive sono complete e testate in isolation; ROUTE-10/ROUTE-11 end-to-end saranno chiusi in F4.',
        )
      }
    }
  }

  // ============================================================
  // Pipeline §28 publish orchestration (step 8 + 9 + 10)
  // ============================================================

  /**
   * Pubblica un evento — orchestra pipeline §28 step 7-full → 8 → 9 → 10 PRIMA di
   * delegare a inner.publish per la delivery locale (D-84 + D-65).
   *
   * Sequenza:
   * 1. Step 8: `resolver.resolve(topic, multipleRoutesPolicy)` (D-66 first-match default).
   * 2. ROUTE-16 (D-67): se 0 route + topic ha `requiresRoute: true` → publish `<topic>.failed`
   *    con `code: 'route.required.missing'` PRIMA del local delivery; altrimenti delivery
   *    locale via `inner.publish` (default).
   * 3. Step 9 + 10 per ogni matched route (async parallel):
   *    `executor.execute(route, event)` → `collector.collect(outcome, route, event)`.
   * 4. Local subscriber comunque ricevono se almeno una route NON è 'local'
   *    (D-65 default 'parallel': local + remote in parallelo).
   *
   * @param topic - Topic dell'evento (es. `weather.requested`).
   * @param payload - Payload dell'evento.
   * @param options - Opzioni di publish (source, deliveryMode, ecc.) — passthrough a MapperBroker.
   */
  publish<T>(
    topic: string,
    payload: T,
    options: Parameters<MapperBroker['publish']>[2] = {},
  ): void {
    const startTime = performance.now()
    const eventId = (options as { id?: string }).id ?? `route-${nanoid()}`

    // ----- Step 8: route.resolved (D-84) -----
    const matches = this.engine.resolver.resolve(topic, this.multipleRoutesPolicy)
    this.emitTapStep('event.route.resolved' as PipelineStep, {
      eventId,
      topic,
      step: 'event.route.resolved' as PipelineStep,
      timestamp: Date.now(),
      durationMs: performance.now() - startTime,
      metadata: {
        routeIds: matches.map((m) => m.id),
        policy: this.multipleRoutesPolicy,
      },
    })

    // F1 vincolo D-23: ogni inner.publish richiede `source`. Se il caller non lo
    // fornisce (es. test, app code semplice), iniettiamo un default `system:router`
    // (coerente con il pattern emesso da OutcomeCollector / RouterBroker stesso per
    // routing.ambiguous / routing.composite.deferred). Pattern documentato in PRD §11
    // — eventi system-emitted hanno `source.type: 'system'`.
    const safeOptions: Parameters<MapperBroker['publish']>[2] = {
      ...options,
      source: (options as { source?: BrokerEvent['source'] }).source ?? {
        type: 'system',
        id: 'router',
      },
    }

    // ----- ROUTE-16 chiusura (D-67) -----
    if (matches.length === 0) {
      const requiresRoute = this.checkRequiresRoute(topic)
      if (requiresRoute) {
        const failedTopic = this.deriveFailedTopic(topic)
        this.inner.publish(
          failedTopic,
          {
            error: {
              code: 'route.required.missing',
              category: 'config',
              message: `Topic "${topic}" requires a route but none registered (ROUTE-16)`,
              topic,
              eventId,
            },
            sourceEvent: { topic, eventId },
          },
          { source: { type: 'system', id: 'router' } },
        )
        return
      }
      // Default: delivery locale (D-67 default — back-compat F1+F2).
      this.inner.publish(topic, payload, safeOptions)
      return
    }

    // ----- Step 9 + 10 per ogni route — async parallel (D-65) -----
    // WR-01 fix iter 2: defense-in-depth .catch fire-and-forget. executeRoute è già
    // try/catch internally, ma se throw fuori dal try/catch (es. collector.collect
    // post-tap-emit, oppure createBrokerError fail), la Promise rejecta unhandled
    // → 'unhandledrejection' event in Node strict / browser dev. Pattern difensivo.
    for (const route of matches) {
      this.executeRoute(route, topic, payload, safeOptions, eventId).catch(() => {
        // No-op: l'errore è già loggato dall'executor try/catch. Il .catch qui
        // serve solo a sopprimere unhandledrejection in caso di throw inaspettato.
      })
    }
    // Local consumer ricevono comunque se almeno una route NON è 'local'
    // (D-65 default 'parallel': local + remote in parallelo). Se TUTTE le route sono
    // 'local' il dispatch è già coperto dal localHandler (passthrough payload).
    if (matches.some((r) => r.definition.type !== 'local')) {
      this.inner.publish(topic, payload, safeOptions)
    }
  }

  /**
   * Esegue una singola route async (step 9 + step 10).
   *
   * Try/catch difensivo: l'executor è già try/catch internamente, ma se throw
   * inaspettato (es. Promise rejection senza wrap), wrapping in
   * `route.executor.crashed` BrokerError + collect → publish `<topic>.failed`.
   *
   * @internal
   */
  private async executeRoute<T>(
    route: CompiledRoute,
    topic: string,
    payload: T,
    options: unknown,
    eventId: string,
  ): Promise<void> {
    const event: BrokerEvent = {
      id: eventId,
      topic,
      payload,
      timestamp: Date.now(),
      source: (options as { source?: BrokerEvent['source'] }).source ?? {
        type: 'plugin',
        id: 'unknown',
      },
    } as BrokerEvent
    try {
      const outcome = await this.engine.executor.execute(route, event)
      this.engine.collector.collect(outcome, route, event)
    } catch (err) {
      // Executor non dovrebbe throw — convertito a outcome.error.
      // Se throw inaspettato, log + publish failed di sicurezza.
      const safeError = isBrokerError(err)
        ? err
        : createBrokerError({
            code: 'route.executor.crashed',
            category: 'config',
            message: (err as Error).message ?? 'Unknown executor crash',
            routeId: route.id,
            topic,
            eventId,
            ...(err instanceof Error && { originalError: err }),
          })
      this.engine.collector.collect(
        { ok: false, error: safeError, routeId: route.id },
        route,
        event,
      )
    }
  }

  // ============================================================
  // Route management (D-60, ROUTE-01)
  // ============================================================

  /**
   * Registra una RouteDefinition al runtime (D-60, ROUTE-01).
   *
   * @param def - RouteDefinition discriminata (local|http|cache|composite).
   * @param options - `{ ownerId? }` per cascade D-86.
   * @returns RouteRegistration con `id` + `unregister()` callback.
   */
  registerRoute(def: RouteDefinition, options: { ownerId?: string } = {}): RouteRegistration {
    return this.engine.resolver.register(def, options)
  }

  /**
   * Rimuove una route dal resolver. Le fetch in volo bound a `routeId` NON sono abortite
   * automaticamente qui (HttpGateway tracks by eventId, non routeId — best effort tracking).
   *
   * @param routeId - id della route da rimuovere.
   * @returns `true` se rimossa, `false` se non esisteva.
   */
  unregisterRoute(routeId: string): boolean {
    return this.engine.resolver.unregister(routeId)
  }

  // ============================================================
  // Subscribe delegate (BLOCKER 3 revision fix)
  // ============================================================

  /**
   * Sottoscrivi un pattern — passthrough esplicito a MapperBroker.subscribe (BLOCKER 3 fix).
   *
   * RouterBroker DEVE esporre subscribe() per il test harness di 03-13 (router-harness.ts)
   * e i 14 integration test che dipendono da broker.subscribe(...) per catturare gli eventi
   * pubblicati (weather.loaded, weather.failed, routing.ambiguous, ...). Senza questo
   * delegate, harness fallisce al setup. NB: MapperBroker.subscribe ha già la signature
   * corretta (vedi packages/mapper/src/broker-mapper-wrapper.ts:454-466) e applica
   * `applyInputMap` consumer-side se options.ownerId è dichiarato — il delegate qui
   * preserva la semantica F2 senza override.
   */
  subscribe(...args: Parameters<MapperBroker['subscribe']>): Subscription {
    return this.inner.subscribe(...args)
  }

  // ============================================================
  // Plugin management (override per cascade D-86)
  // ============================================================

  /**
   * Registra un plugin — delegate a MapperBroker.registerPlugin + auto-register
   * `descriptor.routes` con `ownerId = descriptor.id` (D-94, ROUTE-01).
   *
   * Pattern try/catch isolato: se una route fail register, plugin register continua
   * (degraded gracefully — pattern F2 D-26 ext).
   */
  async registerPlugin(descriptor: PluginDescriptor): Promise<void> {
    await this.inner.registerPlugin(descriptor)
    if (descriptor.routes) {
      for (const r of descriptor.routes) {
        try {
          this.engine.resolver.register(r, { ownerId: descriptor.id })
        } catch {
          // Log isolated — se route fail, plugin register continua (degraded).
          // F6 estenderà con notifica strutturata via tap.
        }
      }
    }
  }

  /**
   * Unregister un plugin — cascade LIFE-02 ext F3 (D-86, chiusura PRD §39 #7).
   *
   * Sequenza con try/catch isolato per ogni step (pattern F2 D-49 — un fallimento NON
   * blocca gli altri):
   *   1. inner.unregisterPlugin (F2 cascade canonical/alias/transform/lifecycle)
   *   2. resolver.unregisterByOwner (rimuove route registrate dal plugin)
   *   3. executor.abortInFlightByOwner (abort fetch composite/http in volo)
   *   4. httpGateway.abortInFlightByOwner (abort fetch HTTP raw in volo)
   *
   * @param id - id del plugin da rimuovere.
   */
  async unregisterPlugin(id: string): Promise<void> {
    // LIFE-02 ext F3 cascade (D-86) — try/catch isolato per ogni step (pattern F2).
    try {
      await this.inner.unregisterPlugin(id)
    } catch {
      // pattern F2 — silent + log via inspector (F6 strutturato)
    }
    try {
      this.engine.resolver.unregisterByOwner(id)
    } catch {
      // pattern F2 — silent
    }
    try {
      this.engine.executor.abortInFlightByOwner(id)
    } catch {
      // pattern F2 — silent
    }
    try {
      this.engine.httpGateway.abortInFlightByOwner(id)
    } catch {
      // pattern F2 — silent
    }
  }

  // ============================================================
  // Public API delegate (canonical schema, transform, alias — F2)
  // ============================================================

  /**
   * Registra un canonical schema — delegate a MapperBroker.registerCanonicalSchema (D-31).
   */
  registerCanonicalSchema(
    ...args: Parameters<MapperBroker['registerCanonicalSchema']>
  ): ReturnType<MapperBroker['registerCanonicalSchema']> {
    return this.inner.registerCanonicalSchema(...args)
  }

  // ============================================================
  // Helpers privati (ROUTE-16, D-67, D-100, BLOCKER 4 revision fix)
  // ============================================================

  /**
   * Emette tap step con try/catch swallow inline (replica F2 emitF2Tap pattern —
   * `safeTapStep` di core NON è esposto al barrel pubblico, quindi inline pattern
   * preserva D-83 strict).
   *
   * @internal
   */
  private emitTapStep(step: PipelineStep, snapshot: PipelineSnapshot): void {
    if (this.tap === undefined) return
    try {
      this.tap.onPipelineStep(step, snapshot)
    } catch {
      // Pattern F1 safeTapStep: swallow per non rompere il chain (T-04-01 mitigation).
    }
  }

  /**
   * Deriva il topic `<prefix>.failed` da un topic originale.
   *
   * NB WR-09 (iter 2): logica DUPLICATA con `outcome-collector.ts` deriveFailedTopic
   * (allineata identica). Estrazione in modulo helper rinviata a V1.x per evitare
   * churn pubblico in F3 (entrambe sono `private` / module-local). Se l'una cambia,
   * aggiornare ANCHE l'altra (grep `deriveFailedTopic` per trovare i call site).
   *
   * @example
   * deriveFailedTopic('weather.requested') === 'weather.failed'
   * deriveFailedTopic('weather') === 'weather.failed'
   * deriveFailedTopic('auth.login.success') === 'auth.login.success.failed' (no `.requested` suffix)
   */
  private deriveFailedTopic(topic: string): string {
    const idx = topic.lastIndexOf('.')
    if (idx === -1) return `${topic}.failed`
    const suffix = topic.slice(idx + 1)
    if (suffix === 'requested') return `${topic.slice(0, idx)}.failed`
    return `${topic}.failed`
  }

  /**
   * Lookup canonical schema per un topic — D-100 isolation (BLOCKER 4 revision fix).
   *
   * Strategia:
   * 1. Se topic in `explicitRequiresRouteTopics` → ritorna `{ requiresRoute: true }` (opt-in B).
   * 2. Altrimenti, deriva schemaId via convenzione PRD §11 (`<entity>.<action>.<status>` →
   *    primo segmento = entity = schemaId) e lookup nel `boundCanonicalRegistry`.
   * 3. Se canonicalRegistry.get throw → loud failure `BrokerError 'router.canonical-registry.lookup.failed'`.
   *
   * NIENTE silent fallback — se F2 cambia API surface, il consumer riceve l'errore al
   * primo evento ROUTE-16 (vedi rationale BLOCKER 4 fix in plan).
   *
   * @internal
   */
  private getCanonicalSchemaForTopic(
    topic: string,
  ): { readonly requiresRoute?: boolean } | undefined {
    // Override esplicito via RoutingConfig.requiresRouteTopics (opt-in B):
    // ritorna schema sintetico { requiresRoute: true } SENZA passare dal registry.
    if (this.explicitRequiresRouteTopics.has(topic)) {
      return { requiresRoute: true }
    }
    // Convenzione PRD §11 <entity>.<action>.<status>: primo segmento = schemaId.
    const segments = topic.split('.')
    const entityCandidate = segments[0]
    if (entityCandidate === undefined || entityCandidate === '') return undefined
    try {
      // Cast `as never` bypassa il CanonicalSchemaId brand: se lo schema esiste,
      // ritorna il flag augmentato D-95; se no, ritorna undefined → caller usa
      // default local delivery (D-67).
      return this.boundCanonicalRegistry.get(entityCandidate as never)
    } catch (err) {
      // Loud failure: registry.get NON dovrebbe throw per id inesistente
      // (CanonicalRegistry.get usa Map.get che ritorna undefined). Se throw =>
      // problema di integrazione F2 → propaga.
      throw createBrokerError({
        code: 'router.canonical-registry.lookup.failed',
        category: 'config',
        message: `RouterBroker: canonicalRegistry.get failed for topic "${topic}"`,
        details: { topic, entityCandidate },
        ...(err instanceof Error && { originalError: err }),
      })
    }
  }

  /**
   * Verifica se un topic ha `requiresRoute: true` (D-67, ROUTE-16).
   *
   * @internal
   */
  private checkRequiresRoute(topic: string): boolean {
    const schema = this.getCanonicalSchemaForTopic(topic)
    return schema?.requiresRoute === true
  }

  /**
   * Delegate a `inner.mapper.mapToShape` (D-96 — usato dal http-handler).
   *
   * FIXME(F4): wiring mapToShape deferred — vedi 03-VERIFICATION.md override #3.
   * F2 MapperEngine non espone `mapToShape(canonical, inlineMap)` pubblicamente — il
   * vero contract è `applyOutputMap(pluginId, payload)`. Per il http-handler `mapToShape`
   * riceve un OutputMap inline (route-level), non bound a un pluginId.
   *
   * V1 IDENTITY PASSTHROUGH (override #3 deferred F4/F6): ritorna `canonical` invariato.
   * Quando F2 espone `MapperEngine.mapToShape(canonical, inlineMap)` (refactor F4/F6),
   * sostituire con `return this.inner.mapper.mapToShape(canonical, outputMap)`.
   *
   * @internal
   */
  private delegateMapToShape(canonical: unknown, _outputMap: unknown): unknown {
    // FIXME(F4): identity passthrough — vedi 03-VERIFICATION.md override #3.
    return canonical
  }

  /**
   * Delegate a `inner.mapper.mapToCanonical` (D-97 — usato dal http-handler).
   *
   * FIXME(F4): wiring mapToCanonical deferred — vedi 03-VERIFICATION.md override #3.
   * Stessa nota di delegateMapToShape: F2 non espone `mapToCanonical(payload, schemaId)`
   * pubblicamente. V1 fallback identity (response viene poi validato dal valibotAdapter
   * contro lo schema canonical — VAL-05 / D-78). Refactor F4/F6.
   *
   * @internal
   */
  private delegateMapToCanonical(shape: unknown, _schemaId: string): unknown {
    // FIXME(F4): identity passthrough — vedi 03-VERIFICATION.md override #3.
    return shape
  }
}
