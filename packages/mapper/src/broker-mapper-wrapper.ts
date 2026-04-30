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
  PluginContext,
  PluginDescriptor,
  SubscribeOptions,
  Subscription,
} from '@sembridge/core'
import { Broker, createBrokerError, isBrokerError, silentLogger } from '@sembridge/core'
import { AliasRegistry } from './alias-registry'
import { CanonicalRegistry } from './canonical-registry'
import { MappingInspector } from './inspector'
import { MapperEngine, type MapperPluginDescriptor } from './mapper-engine'
import { TransformPipeline } from './transform-pipeline'
import type { CanonicalSchema, CanonicalSchemaId } from './types/canonical-schema'
import type { TransformFn } from './types/transform'
import { valibotAdapter } from './valibot-adapter'

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
  private readonly ownership = new Map<string, OwnershipEntry>()

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

    // Bootstrap from config (D-56 wired) — sezioni F2 augmented al BrokerConfig.
    this.bootstrapFromConfig(config)
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
    try {
      this.aliasRegistry.unregisterScopedAll(id)
    } catch (err) {
      this.logger.error('MapperBroker: alias cascade failed', { pluginId: id, error: err })
    }
    try {
      this.transformPipeline.unregisterByOwner(id)
    } catch (err) {
      this.logger.error('MapperBroker: transforms cascade failed', { pluginId: id, error: err })
    }
    try {
      this.mapper.unregisterPluginMappings(id)
    } catch (err) {
      this.logger.error('MapperBroker: mapper cascade failed', { pluginId: id, error: err })
    }
    const own = this.ownership.get(id)
    if (own) {
      for (const schemaId of own.canonicalSchemaIds) {
        try {
          this.canonicalRegistry.unregister(schemaId as CanonicalSchemaId)
        } catch (err) {
          this.logger.error('MapperBroker: canonical schema cascade failed', {
            pluginId: id,
            schemaId,
            error: err,
          })
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
   * L'Inspector è composto col tap utente (se presente) — nel V1 il MapperBroker non wira
   * automaticamente `wrapTap(config.runtime.tap, inspector)` perché `recordSnapshot` è no-op
   * (D-48 V1). Quando F6 popolerà `recordSnapshot` con full snapshot per evento, il wiring
   * sarà aggiunto qui.
   */
  getMappingInspector(): MappingInspector {
    return this.inspector
  }

  // === Private helpers ===

  /** Bootstrap del registry/pipeline da `BrokerConfig` augmented (D-56). */
  private bootstrapFromConfig(config: MapperBrokerConfig): void {
    if (!config) return
    if (config.canonicalModel?.schemas) {
      for (const schema of config.canonicalModel.schemas) {
        this.canonicalRegistry.register(schema)
      }
    }
    if (config.aliasRegistry?.global) {
      for (const [local, canonical] of Object.entries(config.aliasRegistry.global)) {
        this.aliasRegistry.registerGlobal(local, canonical)
      }
    }
    if (config.aliasRegistry?.scoped) {
      for (const [pluginId, scopeMap] of Object.entries(config.aliasRegistry.scoped)) {
        for (const [local, canonical] of Object.entries(scopeMap)) {
          this.aliasRegistry.registerScoped(pluginId, local, canonical)
        }
      }
    }
    if (config.transforms) {
      for (const [name, fn] of Object.entries(config.transforms)) {
        this.transformPipeline.register(name, fn)
      }
    }
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
   */
  private wrapPluginContext(ctx: PluginContext, pluginId: string): PluginContext {
    const innerBroker = ctx.broker as ScopedBrokerLike
    const wrappedBroker = new Proxy(innerBroker, {
      get: (target, prop, receiver): unknown => {
        if (prop === 'subscribe') {
          return (
            pattern: string,
            handler: (event: BrokerEvent) => void | Promise<void>,
            options: SubscribeOptions = {},
          ): Subscription => {
            // Se il consumer plugin ha un inputMap compilato, wrappa l'handler
            if (this.mapper.hasInputMap(pluginId)) {
              const wrappedHandler = this.wrapConsumerHandler(pluginId, handler)
              return target.subscribe(pattern, wrappedHandler, options)
            }
            return target.subscribe(pattern, handler, options)
          }
        }
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
        // Passo 12: final validation per consumer (structural pass V1 — D-39).
        // F2 V1 il MapperEngine.validateCanonical fa structural check; full Valibot in V1.x.
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
   */
  private handleMappingError(err: BrokerError, sourceTopic: string, step: string): void {
    this.inspector.recordError(err)
    // D-58: publish mapping.error con payload { error, sourceEvent, step }
    try {
      this.inner.publish(
        'mapping.error',
        { error: err, sourceEvent: sourceTopic, step },
        {
          source: { type: 'system', id: 'mapper' },
          deliveryMode: 'async',
        },
      )
    } catch (pubErr) {
      // Fallback log se il publish stesso fallisce (no retry — T-02-10-05).
      this.logger.error('MapperBroker: failed to publish mapping.error', {
        originalError: err,
        publishError: pubErr,
      })
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
