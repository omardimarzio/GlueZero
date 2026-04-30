// MapperBroker — composition wrapper di Broker (F1) con MapperEngine + Inspector (F2).
// Riferimento decisioni: D-31 (API), D-49 (no modify bus.ts), D-50 (5 step F2),
// D-51 (delivery loop applica inputMap), D-58 (mapping.error), D-26 ext (cascade).
//
// Strategia: composizione (NON subclass). Internamente compone:
//   - inner: Broker (F1) — delegato per pub/sub/lifecycle base
//   - canonical: CanonicalRegistry (Wave 3)
//   - alias: AliasRegistry (Wave 3)
//   - transforms: TransformPipeline (Wave 3)
//   - mapper: MapperEngine (Wave 4)
//   - inspector: MappingInspector (Wave 5)
//
// Surface pubblica F2 (wrapped F1 + F2 new):
//   publish<T>(topic, payload, options?): applica outputMap + canonical validation, poi inner.publish
//   subscribe(pattern, handler, options?): wrappa handler con applyInputMap del consumer
//   registerPlugin(desc): chiama inner + compileMappings + tracking ownership; wrappa hook lifecycle
//                         per sostituire ctx.broker con un Proxy mapper-aware (D-51)
//   unregisterPlugin(id): cascade — inner + alias.unregisterScopedAll +
//                         transforms.unregisterByOwner + mapper.unregisterPluginMappings (D-26 ext F2)
//   registerCanonicalSchema(schema): boolean (D-31)
//   registerTransform(name, fn, options?): void (D-31)
//   registerAlias(local, canonical, options?: { scope?: 'global' | string }): boolean (D-31)
//   getMappingInspector(): MappingInspector
//   getDebugSnapshot(): MapperBrokerDebugSnapshot esteso con sezione `mappings` (D-48)
//
// Vincolo D-49: NESSUNA modifica a packages/core/src/. Composition + wrapping del descriptor
// hooks per propagare il mapper-aware ctx.broker quando i plugin si sottoscrivono dentro
// onMount/onRegister.
//
// Threat coverage:
// - T-02-10-01 (DoS — mapping error storm): inspector ring buffer bounded (default 10).
// - T-02-10-02 (Tampering — descriptor mutation post-register): cycle detection register-time
//   (D-35) + plugin.id.duplicate F1 throw previene re-register accidentale.
// - T-02-10-03 (Repudiation — cascade incompleta): cascade ordinata indipendente — try/catch
//   isolato per ogni step (alias.unregisterScopedAll + transforms.unregisterByOwner +
//   mapper.unregisterPluginMappings) — se uno fallisce, gli altri procedono.
// - T-02-10-05 (DoS — mapping.error subscriber loop): F1 handler isolation (try/catch in
//   bus.deliver) previene cascade infinita; mapping.error subscribers sono trattati come
//   qualsiasi altro handler.
// - T-02-10-06 (Spoofing — alias global shadow): conflict throw da AliasRegistry.

import type {
  BrokerError,
  BrokerEvent,
  BrokerLogger,
  EventTap,
  PipelineSnapshot,
  PipelineStep,
  PluginContext,
  PluginDescriptor,
  SubscribeOptions,
  Subscription,
} from '@sembridge/core'
import { Broker, createBrokerError, isBrokerError, silentLogger } from '@sembridge/core'
import { AliasRegistry } from './alias-registry'
import { CanonicalRegistry } from './canonical-registry'
import { MappingInspector, wrapTap } from './inspector'
import { MapperEngine, type MapperPluginDescriptor } from './mapper-engine'
import { TransformPipeline } from './transform-pipeline'
import type { CanonicalSchema, CanonicalSchemaId } from './types/canonical-schema'
import type { TransformFn } from './types/transform'
import { valibotAdapter } from './valibot-adapter'

/**
 * Local no-op `EventTap` per mapper wrapper — coerente con `noopEventTap` di
 * `@sembridge/core` (event-tap.ts:19). Definito qui perché `noopEventTap` non è
 * ri-esportato dal barrel pubblico di core (D-49 — no modifiche a packages/core).
 */
const noopEventTap: EventTap = {
  onPipelineStep: (): void => {},
}

/**
 * Configurazione del MapperBroker — accetta tutto BrokerConfig di F1 (con augmentations F2)
 * tramite re-tipo da `@sembridge/core`. Le sezioni F2 (`canonicalModel`, `aliasRegistry`,
 * `transforms`) sono tipate via TS declaration merging in `augment.ts` (plan 02-09).
 */
type MapperBrokerConfig = ConstructorParameters<typeof Broker>[0]

/**
 * Opzioni per `registerAlias(local, canonical, options?)`.
 *
 * `scope: 'global'` (default) → registra in AliasRegistry globale (D-40 livello 3).
 * `scope: pluginId` → registra in scope plugin-specifico (D-40 livello 2).
 */
export interface RegisterAliasOptions {
  /** `'global'` (default) o `pluginId` per scoped. */
  readonly scope?: 'global' | string
}

/**
 * Opzioni per `registerTransform(name, fn, options?)`.
 *
 * `ownerId` è il plugin proprietario per cascade D-26 ext F2 (cleanup auto al
 * `unregisterPlugin` via `transforms.unregisterByOwner`).
 */
export interface RegisterTransformWrapperOptions {
  readonly description?: string
  readonly ownerId?: string
}

/**
 * Opzioni per `registerCanonicalSchema(schema, options?)`.
 *
 * `ownerId` permette il cascade D-26 ext F2 cleanup automatico al `unregisterPlugin`
 * (canonical schemas registrati dal plugin vengono rimossi).
 */
export interface RegisterCanonicalSchemaOptions {
  readonly ownerId?: string
}

/**
 * Subscribe options esteso F2 — supporta `ownerId` per applyInputMap consumer-side (D-51).
 *
 * Quando un plugin consumer si sottoscrive (direttamente al MapperBroker o via
 * `ctx.broker`), il MapperBroker wrappa l'handler per applicare `applyInputMap(pluginId, ...)`
 * al payload canonico ricevuto, prima di consegnarlo al handler reale.
 */
export interface MapperSubscribeOptions extends SubscribeOptions {
  /** Plugin proprietario della sottoscrizione (cascade D-26 + applyInputMap consumer-side). */
  readonly ownerId?: string
}

/**
 * Snapshot debug esteso — include sezione `mappings` per D-48 (Inspector + counter).
 *
 * Replicato shape di `BrokerDebugSnapshot` di F1 + sezione `mappings` da
 * `MappingInspectorSnapshot` (D-48).
 */
export interface MapperBrokerDebugSnapshot {
  readonly topics: string[]
  readonly subscriberCount: Record<string, number>
  readonly pluginIds: string[]
  readonly pendingAsyncDelivery: number
  readonly logLevel: string
  readonly pipelineSteps: string[]
  readonly mappings: {
    readonly canonicalSchemas: number
    readonly registeredAliases: number
    readonly registeredTransforms: number
    readonly lastMappingErrors: BrokerError[]
  }
}

/** Tracking ownership per cascade D-26 ext F2 (LIFE-02 ext). */
interface OwnershipEntry {
  readonly canonicalSchemaIds: Set<string>
  readonly transformNames: Set<string>
}

/**
 * Shape dei publish options accettati da `MapperBroker.publish` — riusa il type signature di
 * `Broker.publish` (F1) per coerenza con EventSource literal union.
 *
 * F1 PublishParams<T>: `{ source?: EventSource, deliveryMode?, priority?, correlationId?, ttlMs?, dedupeKey?, ... }`
 * — `source.type` è la literal union `'plugin' | 'component' | 'server' | 'worker' | 'system'`.
 */
type MapperPublishOptions = Parameters<Broker['publish']>[2]

/** Shape del PluginContext.broker dopo F1 createPluginScopedBroker — espone subscribe + publish. */
interface ScopedBrokerLike {
  subscribe(
    pattern: string,
    handler: (event: BrokerEvent) => void | Promise<void>,
    options?: SubscribeOptions,
  ): Subscription
  [key: string]: unknown
}

/**
 * MapperBroker — composition wrapper di `Broker` (F1) per integrare `MapperEngine` + `MappingInspector`.
 *
 * Implementa la pipeline §28 estesa F2 (passi 4, 5, 6, 11, 12) tramite hook al `publish`
 * (canonicalize + canonical validation) e al `subscribe` (consumer mapping + final validation).
 *
 * Vincolo D-49: NON modifica `bus.ts` di F1. Solo composition + wrapping del descriptor hooks
 * per propagare il mapper-aware `ctx.broker` quando il plugin si sottoscrive dentro hooks.
 *
 * @example
 * ```ts
 * import { MapperBroker } from '@sembridge/mapper'
 *
 * const broker = new MapperBroker({ runtime: { logLevel: 'info' } })
 *
 * broker.registerCanonicalSchema({
 *   id: 'weather' as CanonicalSchemaId,
 *   fields: { location: { type: 'string', required: true } },
 * })
 *
 * await broker.registerPlugin({
 *   id: 'form',
 *   canonicalSchemaId: 'weather' as CanonicalSchemaId,
 *   outputMap: { location: { source: 'città' } },
 * })
 *
 * broker.publish('weather.requested', { città: 'Roma' }, {
 *   source: { type: 'plugin', id: 'form' },
 * })
 * // → consumer riceve { location: 'Roma' }
 * ```
 */
export class MapperBroker {
  private readonly inner: Broker
  private readonly canonicalRegistry: CanonicalRegistry
  private readonly aliasRegistry: AliasRegistry
  private readonly transformPipeline: TransformPipeline
  private readonly mapper: MapperEngine
  private readonly inspector: MappingInspector
  private readonly logger: BrokerLogger
  /**
   * Tap composto (D-50, CR-01) — invocato sui 4 step F2 della pipeline §28
   * (`event.mapped.canonical`, `event.canonical.validated`, `event.mapped.consumer`,
   * `event.final.validated`). Composizione `wrapTap(userTap, inspector)` applicata in
   * constructor: prima viene chiamato il tap utente, poi `inspector.recordSnapshot`.
   *
   * Vincolo architetturale (CLAUDE.md "EventTap interface deve essere instrumentata"):
   * gli step F2 sono **strumentati già in F2** anche con inspector no-op — F6
   * sostituirà il no-op `recordSnapshot` con full per-event snapshot SENZA retrofit.
   */
  private readonly tap: EventTap
  private readonly ownership = new Map<string, OwnershipEntry>()
  /**
   * CR-06 recursion guard: tracking delle pair `(sourceTopic, step)` attive durante
   * `handleMappingError`. Una pair già in-flight skip il re-publish per evitare loop
   * infiniti (es. subscriber `mapping.error` che a sua volta genera mapping error).
   */
  private readonly inFlightMappingErrors = new Set<string>()

  constructor(config: MapperBrokerConfig = {}) {
    this.logger = config.runtime?.logger ?? silentLogger
    this.canonicalRegistry = new CanonicalRegistry()
    this.aliasRegistry = new AliasRegistry()
    this.transformPipeline = new TransformPipeline()
    this.mapper = new MapperEngine({
      canonicalRegistry: this.canonicalRegistry,
      aliasRegistry: this.aliasRegistry,
      transformPipeline: this.transformPipeline,
      validator: valibotAdapter,
      logger: this.logger,
    })
    this.inspector = new MappingInspector({
      canonicalRegistry: this.canonicalRegistry,
      aliasRegistry: this.aliasRegistry,
      transformPipeline: this.transformPipeline,
    })
    this.inner = new Broker(config)

    // CR-01 fix: compose tap utente con inspector (D-50). Il tap composto viene
    // invocato sui 4 step F2 dal wrapper. Gli step F1 restano gestiti dal Broker
    // interno (che usa il tap originale del config — coerente con D-49 no modifiche
    // a bus.ts).
    const userTap: EventTap = config.runtime?.tap ?? noopEventTap
    this.tap = wrapTap(userTap, this.inspector)

    // WR-02 fix: warn se topicSchemas è presente ma F2 V2 deferred — accept silently
    // ignored ma logger.warn per visibilità (T-02-09-02).
    if ((config as { topicSchemas?: unknown }).topicSchemas !== undefined) {
      this.logger.warn(
        'MapperBroker: config.topicSchemas è riservato per F2 V2 (deferred); attualmente ignorato',
      )
    }

    // Bootstrap from config (D-56 wired) — sezioni F2 augmented al BrokerConfig.
    this.bootstrapFromConfig(config)
  }

  /**
   * Costruisce un `PipelineSnapshot` minimo per gli step F2 della pipeline §28
   * (CR-01 fix). Compatibile con il pattern F1 `safeTapStep + startStep` di
   * `@sembridge/core/core/event-tap.ts`.
   *
   * Note D-48: `payloadBefore`/`payloadAfter` sono full per-event snapshot
   * deferred a F6. F2 V1 emette snapshot leggero (eventId placeholder topic-based,
   * step, timestamp, durationMs=0).
   */
  private makeF2Snapshot(
    step: PipelineStep,
    topic: string,
    extras: Partial<PipelineSnapshot> = {},
  ): PipelineSnapshot {
    return {
      eventId: `f2:${topic}:${step}`,
      topic,
      step,
      timestamp: Date.now(),
      durationMs: 0,
      ...extras,
    }
  }

  /**
   * Invoca `tap.onPipelineStep` per uno step F2 con try/catch (pattern F1
   * `safeTapStep`). Errori del tap vengono swallowed — un tap che fallisce non
   * deve rompere la pipeline (T-04-01 mitigation).
   */
  private emitF2Tap(
    step: PipelineStep,
    topic: string,
    extras: Partial<PipelineSnapshot> = {},
  ): void {
    try {
      this.tap.onPipelineStep(step, this.makeF2Snapshot(step, topic, extras))
    } catch (err) {
      // Pattern F1 safeTapStep: swallow per non rompere il chain (T-04-01).
      this.logger.error('MapperBroker: tap throw on F2 step', { step, topic, error: err })
    }
  }

  // === F1 surface delegated + wrapped ===

  /**
   * Pubblica un evento — applica outputMap del plugin source (passo 5) prima di delegare
   * al `Broker` interno (passi 1-3, 7, 13 F1).
   *
   * Quando `options.source.id` identifica un plugin con `outputMap` compilato, il payload
   * viene canonicalizzato via `mapper.applyOutputMap`. Su mapping error (transform throw +
   * onFailure 'block', field required missing, cycle detected runtime), publica `mapping.error`
   * (D-58) e SKIP la delivery (D-59).
   *
   * @typeParam T - Tipo del payload (passa invariato al canonical post-mapping).
   */
  publish<T>(topic: string, payload: T, options: MapperPublishOptions = {}): void {
    const sourcePluginId = options.source?.id
    let canonicalPayload: unknown = payload

    if (sourcePluginId !== undefined && this.mapper.hasCompiled(sourcePluginId)) {
      try {
        // Step 5: applyOutputMap (locale → canonical)
        canonicalPayload = this.mapper.applyOutputMap(sourcePluginId, payload)
        // CR-01 fix: invoca tap dopo step 5 (event.mapped.canonical, D-50).
        this.emitF2Tap('event.mapped.canonical' as PipelineStep, topic, {
          metadata: { pluginId: sourcePluginId },
        })
        // Step 6: canonical validation (structural pass V1 — D-39 + REQ MAP-11)
        const compiledSchemaId = this.mapper.getCanonicalSchemaIdFor(sourcePluginId)
        if (compiledSchemaId !== undefined) {
          const validation = this.mapper.validateCanonical(compiledSchemaId, canonicalPayload)
          if (!validation.ok) {
            // Costruisco un BrokerError mapping.canonical.validation.failed coerente con D-58.
            const validationError = this.makeValidationError(
              'mapping.canonical.validation.failed',
              `Canonical validation failed for plugin "${sourcePluginId}" on topic "${topic}"`,
              { pluginId: sourcePluginId, topic, issues: validation.issues },
            )
            this.handleMappingError(validationError, topic, 'event.canonical.validated')
            return // D-59: NO delivery
          }
          // CR-01 fix: invoca tap dopo step 6 (event.canonical.validated, D-50).
          this.emitF2Tap('event.canonical.validated' as PipelineStep, topic, {
            metadata: { pluginId: sourcePluginId, canonicalSchemaId: compiledSchemaId },
          })
        }
      } catch (err) {
        if (isBrokerError(err)) {
          this.handleMappingError(err, topic, 'event.mapped.canonical')
          return // D-59: NO delivery
        }
        throw err
      }
    }

    this.inner.publish(topic, canonicalPayload, options)
  }

  /**
   * Sottoscrivi un pattern — quando `options.ownerId` identifica un plugin consumer con
   * `inputMap` compilato, l'handler reale è wrappato per applicare `applyInputMap`
   * al payload canonico ricevuto (passo 11 pipeline §28).
   *
   * Su consumer-side mapping error (transform throw del inputMap, ecc.), publica
   * `mapping.error` (D-58) e SKIP la delivery a quel consumer (D-26 — gli altri matched
   * subscribers ricevono comunque).
   */
  subscribe(
    pattern: string,
    handler: (event: BrokerEvent) => void | Promise<void>,
    options: MapperSubscribeOptions = {},
  ): Subscription {
    const consumerPluginId = options.ownerId
    if (consumerPluginId === undefined || !this.mapper.hasInputMap(consumerPluginId)) {
      // Direct subscribe — nessun mapping consumer-side da applicare. Pass-through al bus.
      return this.inner.subscribe(pattern, handler, options)
    }
    const wrappedHandler = this.wrapConsumerHandler(consumerPluginId, handler)
    return this.inner.subscribe(pattern, wrappedHandler, options)
  }

  /**
   * Registra un plugin — pre-compile mapping (cycle detection register-time D-35), wrappa
   * gli hook lifecycle per propagare un `ctx.broker` mapper-aware (D-51), poi delega al
   * `Broker` F1 per il flow lifecycle standard (transitionState, onRegister, onMount).
   *
   * @throws BrokerError `mapping.cycle.detected` se inputMap/outputMap contengono cicli (D-35).
   * @throws BrokerError `plugin.id.duplicate` (F1) se un plugin con lo stesso id è già registrato.
   */
  async registerPlugin(descriptor: PluginDescriptor): Promise<void> {
    // D-35: cycle detection register-time (BEFORE any state mutation).
    const mp = descriptor as MapperPluginDescriptor
    if (mp.outputMap !== undefined || mp.inputMap !== undefined) {
      this.mapper.compileMappings(mp)
    }
    // Wrappa hook lifecycle per propagare ctx.broker mapper-aware (D-51).
    const wrapped = this.wrapDescriptorHooks(descriptor)
    await this.inner.registerPlugin(wrapped)
    this.ownership.set(descriptor.id, {
      canonicalSchemaIds: new Set(),
      transformNames: new Set(),
    })
  }

  /**
   * Unregister un plugin — cascade D-26 ext F2 cleanup:
   *   1. inner.unregisterPlugin (F1 LIFE-02 — onUnmount + bus.unsubscribeByOwner + abort)
   *   2. aliasRegistry.unregisterScopedAll(id) — alias plugin-scoped
   *   3. transformPipeline.unregisterByOwner(id) — transform con ownerId === id
   *   4. mapper.unregisterPluginMappings(id) — dispatch table compilata
   *   5. canonicalRegistry.unregister per gli schema con ownership === id
   *   6. ownership.delete(id)
   *
   * Ogni step è indipendente — il fallimento di uno non blocca gli altri (T-02-10-03).
   */
  async unregisterPlugin(id: string): Promise<void> {
    await this.inner.unregisterPlugin(id)
    // Cascade D-26 ext F2 (LIFE-02 ext) — try/catch swallow per ogni step (T-02-10-03).
    // WR-06 fix: gli errori sono propagati ANCHE all'Inspector ring buffer (oltre al
    // logger.error) per visibilità debug consumer-side via getDebugSnapshot().mappings.
    const recordCascadeError = (step: string, err: unknown): void => {
      this.logger.error(`MapperBroker: ${step} cascade failed`, { pluginId: id, error: err })
      const wrapped =
        isBrokerError(err)
          ? err
          : createBrokerError({
              code: 'plugin.cascade.failed',
              category: 'plugin',
              message: `Plugin "${id}" cascade step "${step}" failed`,
              ...(err instanceof Error && { originalError: err }),
              details: { pluginId: id, step },
            })
      this.inspector.recordError(wrapped)
    }
    try {
      this.aliasRegistry.unregisterScopedAll(id)
    } catch (err) {
      recordCascadeError('alias', err)
    }
    try {
      this.transformPipeline.unregisterByOwner(id)
    } catch (err) {
      recordCascadeError('transforms', err)
    }
    try {
      this.mapper.unregisterPluginMappings(id)
    } catch (err) {
      recordCascadeError('mapper', err)
    }
    const own = this.ownership.get(id)
    if (own) {
      for (const schemaId of own.canonicalSchemaIds) {
        try {
          this.canonicalRegistry.unregister(schemaId as CanonicalSchemaId)
        } catch (err) {
          recordCascadeError(`canonical-schema:${schemaId}`, err)
        }
      }
      this.ownership.delete(id)
    }
  }

  /** Delegate F1: lista dei topic mai pubblicati o sottoscritti. */
  getTopicRegistry(): readonly string[] {
    return this.inner.getTopicRegistry()
  }

  /** Delegate F1: sostituisce il logger runtime. */
  setLogger(logger: BrokerLogger): void {
    this.inner.setLogger(logger)
  }

  /** Delegate F1: abilita debug mode (deep-freeze + verbose tap snapshots). */
  enableDebug(): void {
    this.inner.enableDebug()
  }

  /** Delegate F1: disabilita debug mode (production default). */
  disableDebug(): void {
    this.inner.disableDebug()
  }

  /**
   * Snapshot debug esteso F2 — include sezione `mappings` (D-48) con counter dei tre
   * registry (canonical schemas, alias globali, transform) e ring buffer ultimi errori
   * `mapping.*` registrati via `inspector.recordError`.
   */
  getDebugSnapshot(): MapperBrokerDebugSnapshot {
    const inner = this.inner.getDebugSnapshot()
    const insp = this.inspector.getSnapshot()
    return {
      topics: inner.topics,
      subscriberCount: inner.subscriberCount,
      pluginIds: inner.pluginIds,
      pendingAsyncDelivery: inner.pendingAsyncDelivery,
      logLevel: inner.logLevel,
      pipelineSteps: [...inner.pipelineSteps],
      mappings: {
        canonicalSchemas: insp.canonicalSchemas,
        registeredAliases: insp.registeredAliases,
        registeredTransforms: insp.registeredTransforms,
        lastMappingErrors: insp.lastMappingErrors,
      },
    }
  }

  // === F2 new API surface (D-31) ===

  /**
   * Registra un canonical schema (D-31, REQ MAP-02).
   *
   * @returns `true` se nuovo schema, `false` se già registrato (idempotent default).
   * @throws `BrokerError 'canonical.requires.unresolved'` se `requires` non risolti (D-36).
   */
  registerCanonicalSchema(
    schema: CanonicalSchema,
    options: RegisterCanonicalSchemaOptions = {},
  ): boolean {
    const ok = this.canonicalRegistry.register(schema)
    if (ok && options.ownerId !== undefined) {
      const own = this.ownership.get(options.ownerId)
      if (own) own.canonicalSchemaIds.add(schema.id)
    }
    return ok
  }

  /**
   * Registra un transform (D-31, REQ MAP-12).
   *
   * @throws `BrokerError 'transform.id.duplicate'` se `name` già registrato (T-02-10-06).
   */
  registerTransform(
    name: string,
    fn: TransformFn,
    options: RegisterTransformWrapperOptions = {},
  ): void {
    const opts: { description?: string; ownerId?: string } = {}
    if (options.description !== undefined) opts.description = options.description
    if (options.ownerId !== undefined) opts.ownerId = options.ownerId
    this.transformPipeline.register(name, fn, opts)
    if (options.ownerId !== undefined) {
      const own = this.ownership.get(options.ownerId)
      if (own) own.transformNames.add(name)
    }
  }

  /**
   * Registra un alias localField → canonicalField (D-31, REQ MAP-16/MAP-17).
   *
   * `scope: 'global'` (default) → AliasRegistry globale.
   * `scope: pluginId` → AliasRegistry plugin-scoped (cascade D-26 ext F2).
   *
   * @returns `true` se nuovo alias, `false` se già registrato identico (idempotent).
   * @throws `Error('alias.{global,scoped}.conflict: ...')` su conflict.
   */
  registerAlias(
    localField: string,
    canonicalField: string,
    options: RegisterAliasOptions = {},
  ): boolean {
    const scope = options.scope ?? 'global'
    if (scope === 'global') {
      return this.aliasRegistry.registerGlobal(localField, canonicalField)
    }
    return this.aliasRegistry.registerScoped(scope, localField, canonicalField)
  }

  /**
   * Ritorna l'istanza `MappingInspector` per consumo da test/debug consumer-side.
   *
   * L'Inspector è composto col tap utente in constructor via `wrapTap(userTap, inspector)`
   * (CR-01 fix) — i 4 step F2 della pipeline §28 (`event.mapped.canonical`,
   * `event.canonical.validated`, `event.mapped.consumer`, `event.final.validated`) invocano
   * questo tap composto, garantendo che sia il tap utente sia l'Inspector vedano gli stessi
   * step. F6 sostituirà `recordSnapshot` no-op con full per-event snapshot SENZA retrofit
   * (vincolo architetturale CLAUDE.md).
   */
  getMappingInspector(): MappingInspector {
    return this.inspector
  }

  // === Private helpers ===

  /**
   * Bootstrap del registry/pipeline da `BrokerConfig` augmented (D-56).
   *
   * CR-05 fix: ogni step è ora wrapped con try/catch + logger.error; gli errori
   * vengono ri-lanciati come `BrokerError` con context (sezione, id, ecc.) per
   * permettere al consumer di gestirli. Inoltre `canonicalModel.schemas` viene
   * topologicamente ordinato per `requires` PRIMA del register (no dependency
   * sull'ordine dell'array config; cicli canonical.requires throw esplicito).
   *
   * @throws `BrokerError` con `category: 'config'` o `'mapping'` su qualunque
   *         step del bootstrap (canonical / alias / transforms).
   */
  private bootstrapFromConfig(config: MapperBrokerConfig): void {
    if (!config) return
    if (config.canonicalModel?.schemas) {
      const sorted = this.topologicalSortSchemas(config.canonicalModel.schemas)
      for (const schema of sorted) {
        try {
          this.canonicalRegistry.register(schema)
        } catch (err) {
          this.logger.error('MapperBroker bootstrap: canonical register failed', {
            schemaId: schema.id,
            error: err,
          })
          if (isBrokerError(err)) throw err
          throw createBrokerError({
            code: 'bootstrap.canonical.failed',
            category: 'config',
            message: `Bootstrap failed registering canonical schema "${schema.id}"`,
            ...(err instanceof Error && { originalError: err }),
            details: { section: 'canonicalModel', schemaId: schema.id },
          })
        }
      }
    }
    if (config.aliasRegistry?.global) {
      for (const [local, canonical] of Object.entries(config.aliasRegistry.global)) {
        try {
          this.aliasRegistry.registerGlobal(local, canonical)
        } catch (err) {
          this.logger.error('MapperBroker bootstrap: global alias register failed', {
            local,
            canonical,
            error: err,
          })
          throw createBrokerError({
            code: 'bootstrap.alias.global.failed',
            category: 'config',
            message: `Bootstrap failed registering global alias "${local}" → "${canonical}"`,
            ...(err instanceof Error && { originalError: err }),
            details: { section: 'aliasRegistry.global', local, canonical },
          })
        }
      }
    }
    if (config.aliasRegistry?.scoped) {
      for (const [pluginId, scopeMap] of Object.entries(config.aliasRegistry.scoped)) {
        for (const [local, canonical] of Object.entries(scopeMap)) {
          try {
            this.aliasRegistry.registerScoped(pluginId, local, canonical)
          } catch (err) {
            this.logger.error('MapperBroker bootstrap: scoped alias register failed', {
              pluginId,
              local,
              canonical,
              error: err,
            })
            throw createBrokerError({
              code: 'bootstrap.alias.scoped.failed',
              category: 'config',
              message: `Bootstrap failed registering scoped alias for plugin "${pluginId}": "${local}" → "${canonical}"`,
              ...(err instanceof Error && { originalError: err }),
              details: { section: 'aliasRegistry.scoped', pluginId, local, canonical },
            })
          }
        }
      }
    }
    if (config.transforms) {
      for (const [name, fn] of Object.entries(config.transforms)) {
        try {
          this.transformPipeline.register(name, fn)
        } catch (err) {
          this.logger.error('MapperBroker bootstrap: transform register failed', {
            name,
            error: err,
          })
          if (isBrokerError(err)) throw err
          throw createBrokerError({
            code: 'bootstrap.transform.failed',
            category: 'config',
            message: `Bootstrap failed registering transform "${name}"`,
            ...(err instanceof Error && { originalError: err }),
            details: { section: 'transforms', name },
          })
        }
      }
    }
  }

  /**
   * CR-05 fix: ordina topologicamente gli schema canonici per `requires` in modo
   * che ogni schema venga registrato dopo i suoi requires.
   *
   * Algoritmo Kahn's BFS su grafo direzionato schema→requires:
   * 1. Calcola in-degree (numero di requires non ancora registrati per ogni schema).
   * 2. Inizia dai nodi senza requires (in-degree 0).
   * 3. Per ogni nodo processato, decrementa in-degree dei suoi dipendenti.
   * 4. Se rimangono nodi non processati → ciclo nel grafo requires → throw.
   *
   * `requires` che puntano a schema NON presenti nel config sono lasciati al
   * register (CanonicalRegistry.register throw `canonical.requires.unresolved`
   * — propagato come `bootstrap.canonical.failed` dal caller).
   *
   * @throws `BrokerError 'bootstrap.canonical.requires.cycle'` se il grafo ha cicli.
   */
  private topologicalSortSchemas(
    schemas: readonly CanonicalSchema[],
  ): readonly CanonicalSchema[] {
    const idToSchema = new Map<string, CanonicalSchema>()
    for (const s of schemas) idToSchema.set(s.id, s)

    // In-degree: numero di requires PRESENTI nel config (gli external sono ignorati
    // — il register li gestirà come canonical.requires.unresolved).
    const inDegree = new Map<string, number>()
    const dependents = new Map<string, string[]>() // requires.id → [dipendenti.id]
    for (const s of schemas) {
      const internalReqs = (s.requires ?? []).filter((r) => idToSchema.has(r))
      inDegree.set(s.id, internalReqs.length)
      for (const r of internalReqs) {
        if (!dependents.has(r)) dependents.set(r, [])
        dependents.get(r)?.push(s.id)
      }
    }
    const queue: string[] = []
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id)
    }
    const result: CanonicalSchema[] = []
    while (queue.length > 0) {
      const id = queue.shift()
      if (id === undefined) break
      const schema = idToSchema.get(id)
      if (schema) result.push(schema)
      for (const dep of dependents.get(id) ?? []) {
        const deg = (inDegree.get(dep) ?? 0) - 1
        inDegree.set(dep, deg)
        if (deg === 0) queue.push(dep)
      }
    }
    if (result.length !== schemas.length) {
      const remaining = schemas.filter((s) => !result.find((r) => r.id === s.id)).map((s) => s.id)
      throw createBrokerError({
        code: 'bootstrap.canonical.requires.cycle',
        category: 'config',
        message: `Bootstrap canonical schemas have a cycle in 'requires': ${remaining.join(', ')}`,
        details: { section: 'canonicalModel', cyclicSchemaIds: remaining },
      })
    }
    return result
  }

  /**
   * Wrappa gli hook lifecycle del descriptor per sostituire `ctx.broker` con un Proxy
   * mapper-aware (D-51). Quando il plugin si sottoscrive via `ctx.broker.subscribe`,
   * l'handler è automaticamente wrappato per applicare `applyInputMap(pluginId, ...)`.
   *
   * Conditional spread per `exactOptionalPropertyTypes` compliance — i field opzionali
   * assenti NON sono `undefined` espliciti.
   */
  private wrapDescriptorHooks(descriptor: PluginDescriptor): PluginDescriptor {
    const pluginId = descriptor.id
    const wrapAsyncHook = (
      hook: (ctx: PluginContext) => void | Promise<void>,
    ): ((ctx: PluginContext) => void | Promise<void>) => {
      return (ctx: PluginContext) => hook(this.wrapPluginContext(ctx, pluginId))
    }
    const wrapSyncHook = (hook: (ctx: PluginContext) => void): ((ctx: PluginContext) => void) => {
      return (ctx: PluginContext): void => {
        hook(this.wrapPluginContext(ctx, pluginId))
      }
    }
    const wrapped: PluginDescriptor = {
      ...descriptor,
      ...(descriptor.onRegister !== undefined && {
        onRegister: wrapAsyncHook(descriptor.onRegister),
      }),
      ...(descriptor.onMount !== undefined && { onMount: wrapAsyncHook(descriptor.onMount) }),
      ...(descriptor.onUnmount !== undefined && {
        onUnmount: wrapAsyncHook(descriptor.onUnmount),
      }),
      ...(descriptor.onDestroy !== undefined && {
        onDestroy: wrapSyncHook(descriptor.onDestroy),
      }),
    }
    return wrapped
  }

  /**
   * Wrappa `ctx.broker.subscribe` per applicare `applyInputMap(pluginId, ...)` al payload
   * canonico ricevuto, prima di invocare l'handler reale del plugin.
   *
   * Il `ctx.broker` originale è il `PluginScopedBroker` di F1 (Proxy che auto-tagga
   * `ownerId=pluginId` su ogni subscribe). Il MapperBroker lo wrappa ulteriormente per
   * applicare l'inputMap consumer-side (D-51).
   *
   * WR-01 fix: il Proxy precedente faceva `value.bind(target)` su ogni metodo accessed,
   * comportamento corretto ma fragile (intercetta TUTTI i getter, non differenzia tra
   * funzioni e getter properties). Sostituito con un Proxy più narrow che intercetta
   * SOLO `subscribe` e delega tutto il resto via `Reflect.get` + `bind` esplicito.
   * In questo modo l'intercept esplicita la firma assunta della scoped broker e
   * future modifiche di F3+ alle altre method signatures verranno rilevate dal type
   * checker invece che silently fallire.
   */
  private wrapPluginContext(ctx: PluginContext, pluginId: string): PluginContext {
    const inner = ctx.broker as ScopedBrokerLike
    const wrappedBroker = new Proxy(inner, {
      get: (target, prop, receiver): unknown => {
        // Intercetta SOLO il method `subscribe` per applyInputMap consumer-side (D-51).
        if (prop === 'subscribe') {
          return (
            pattern: string,
            handler: (event: BrokerEvent) => void | Promise<void>,
            options: SubscribeOptions = {},
          ): Subscription => {
            if (this.mapper.hasInputMap(pluginId)) {
              const wrappedHandler = this.wrapConsumerHandler(pluginId, handler)
              return target.subscribe(pattern, wrappedHandler, options)
            }
            return target.subscribe(pattern, handler, options)
          }
        }
        // Per tutto il resto, forwarda con bind esplicito SOLO se il valore è una
        // funzione (preserva `this` binding al target originale). Getter properties
        // restituiscono il valore così com'è (NB: questo significa che future scoped
        // broker properties non funzione sono lette al tempo di accesso, NON freezate).
        const value = Reflect.get(target, prop, receiver)
        if (typeof value === 'function') {
          return (value as (...args: unknown[]) => unknown).bind(target)
        }
        return value
      },
    })
    return { ...ctx, broker: wrappedBroker }
  }

  /**
   * Costruisce un wrapped handler che applica `applyInputMap(pluginId, payload)` (passo 11)
   * + `validateCanonical` final (passo 12 V1 — structural) prima di invocare l'handler reale.
   *
   * Su mapping error consumer-side: pubblica `mapping.error` (D-58) e SKIP la delivery
   * a questo consumer (D-26 — gli altri matched subscribers ricevono comunque).
   */
  private wrapConsumerHandler(
    pluginId: string,
    handler: (event: BrokerEvent) => void | Promise<void>,
  ): (event: BrokerEvent) => void | Promise<void> {
    return (event: BrokerEvent): void | Promise<void> => {
      try {
        // Passo 11: applyInputMap consumer-side
        const mappedPayload = this.mapper.applyInputMap(pluginId, event.payload)
        const mappedEvent: BrokerEvent = { ...event, payload: mappedPayload as never }
        // CR-01 fix: invoca tap dopo step 11 (event.mapped.consumer, D-50).
        this.emitF2Tap('event.mapped.consumer' as PipelineStep, event.topic, {
          metadata: { pluginId, eventId: event.id },
        })
        // Passo 12: final validation (structural pass V1 — D-39).
        // F2 V1 emette il tap senza ri-validare: il payload canonico è già stato
        // validato al passo 6 publisher-side. F6 estenderà con consumer-shape
        // validation se Inspector consumer-shaped schema sarà disponibile.
        this.emitF2Tap('event.final.validated' as PipelineStep, event.topic, {
          metadata: { pluginId, eventId: event.id },
        })
        return handler(mappedEvent)
      } catch (err) {
        if (isBrokerError(err)) {
          this.handleMappingError(err, event.topic, 'event.mapped.consumer')
          return // D-26: NO delivery a questo consumer; gli altri matched ricevono
        }
        throw err
      }
    }
  }

  /**
   * Gestisce un errore mapping: registra nell'Inspector ring buffer + pubblica `mapping.error`
   * (D-58). NON propaga l'errore al caller — la pipeline è interrotta per il consumer affetto
   * (D-59 — no `<topic>.failed` da F2).
   *
   * CR-06 fix:
   * 1. Sanitize del payload: estrae solo i field sicuri (`code`, `category`, `message`, `details`)
   *    dal `BrokerError`, escludendo `originalError`, `cause`, `stack` (potenzialmente
   *    ricorsivi e non serializable). Il consumer subscriber riceve un POJO sicuro.
   * 2. Recursion guard: tracking via `inFlightMappingErrors` Set delle coppie
   *    `(sourceTopic, step)` attive. Se una stessa pair è già in-flight (es. il subscriber
   *    mapping.error genera a sua volta un mapping.error), il publish viene skipped.
   */
  private handleMappingError(err: BrokerError, sourceTopic: string, step: string): void {
    this.inspector.recordError(err)
    // CR-06 recursion guard: skip se la pair (sourceTopic, step) è già in-flight.
    const key = `${sourceTopic}::${step}`
    if (this.inFlightMappingErrors.has(key)) {
      this.logger.warn(
        'MapperBroker: mapping.error recursion guard activated, skipping re-publish',
        { sourceTopic, step },
      )
      return
    }
    this.inFlightMappingErrors.add(key)
    try {
      // CR-06 sanitization: payload safe (no originalError, no cause, no stack ricorsivi).
      const safeError = {
        code: err.code,
        category: err.category,
        message: err.message,
        details: err.details,
      }
      try {
        this.inner.publish(
          'mapping.error',
          { error: safeError, sourceEvent: sourceTopic, step },
          {
            source: { type: 'system', id: 'mapper' },
            deliveryMode: 'async',
          },
        )
      } catch (pubErr) {
        // Fallback log se il publish stesso fallisce (no retry — T-02-10-05).
        this.logger.error('MapperBroker: failed to publish mapping.error', {
          originalError: safeError,
          publishError: pubErr,
        })
      }
    } finally {
      this.inFlightMappingErrors.delete(key)
    }
  }

  /** Costruisce un BrokerError mapping.* per validation failure (D-58). */
  private makeValidationError(
    code: string,
    message: string,
    details: Record<string, unknown>,
  ): BrokerError {
    return createBrokerError({
      code,
      category: 'mapping',
      message,
      details,
    })
  }
}
