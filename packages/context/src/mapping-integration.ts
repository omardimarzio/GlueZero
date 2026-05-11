/**
 * Per-MF MapperEngine + AliasRegistry namespace-scoped integration (D-V2-F10-09 + D-V2-F10-11).
 *
 * @gluezero/context mantiene Map<mfId, MapperEngine> + Map<mfId, AliasRegistry> per
 * isolare il mapping per ogni MF registrato con `descriptor.mapping` valorizzato.
 *
 * **Architecture:**
 * - **Shared cross-MF singletons:** `CanonicalRegistry` + `TransformPipeline` (canonical
 *   model è progetto-wide PRD §13.5 — shared resources cross-MF). Inizializzate UNA volta
 *   al `contextModule().install` via `__initMappingIntegration()`.
 * - **Per-MF instance scoped:** `MapperEngine` + `AliasRegistry` (namespace isolation
 *   `mf:${mfId}`). Creati al `microfrontend.mounted` lifecycle event via `attachMfMapping`.
 *
 * **Reuse F2 API pubblica zero diff `packages/mapper/src/` (D-83 strict):**
 * - `new MapperEngine({canonicalRegistry, aliasRegistry, transformPipeline, validator, logger})`
 *   ctor DI 5-args (F2 verified).
 * - `aliasRegistry.registerScoped(pluginId, localField, canonicalField)` (F2 verified).
 * - `aliasRegistry.unregisterScopedAll(pluginId)` ESPOSTO v1.x (F2 line 235-241 verified).
 *
 * **Cleanup cascade (T-F10-05 leak mitigation):**
 * - `detachMfMapping(mfId)` chiamata da lifecycle hook al `microfrontend.unmounted`/
 *   `destroyed`/`unregistered` → `aliasRegistry.unregisterScopedAll('mf:${mfId}')` +
 *   `engine.unregisterPluginMappings(mfId)` + Map.delete + `clearCollisionsForMf(mfId)`.
 *
 * **Collision policy (D-V2-F10-11):** explicit MF inputMap WINS silent + `logger.warn` UNA
 * SOLA VOLTA per tuple `(mfId, field)` via `collision-tracker.ts` Set dedup.
 *
 * @see D-V2-F10-09 (per-MF MapperEngine instance scoped)
 * @see D-V2-F10-11 (collision policy + dedup)
 * @see T-F10-03 (namespace collision register-time)
 * @see T-F10-05 (MapperEngine instance leak mitigation)
 * @see PRD §13.5, §16 (Mapping per-MF + Canonical Model project-wide)
 * @packageDocumentation
 */
import type { BrokerLogger } from '@gluezero/core'
import {
  AliasRegistry,
  CanonicalRegistry,
  MapperEngine,
  TransformPipeline,
  valibotAdapter,
} from '@gluezero/mapper'
import { clearCollisionsForMf, hasSeenCollision, markCollision } from './collision-tracker'

/**
 * `MapperRule` — singola regola di mapping (sottoinsieme di F2 `MappingRule`).
 *
 * Per F10 W2 P04 espone solo `canonical` per gli alias scoped (esteso in F11+ con
 * transform/required/default).
 *
 * @see PRD §16.2 (MicroFrontendMapping interface)
 */
export interface MapperRule {
  readonly canonical: string
  readonly transform?: string
  readonly required?: boolean
  readonly default?: unknown
}

/**
 * `MicroFrontendMapping` — descrittore mapping per-MF (PRD §16.2, MF-MAP-01).
 *
 * Consumato da `attachMfMapping(broker, mfId, mapping)` al `microfrontend.mounted`
 * lifecycle event. NON è interpretato run-time direttamente — viene "compilato" in
 * un `MapperEngine` istanza per-MF (D-V2-F10-09).
 *
 * @example
 * ```ts
 * const mapping: MicroFrontendMapping = {
 *   inputMap: { customerId: { canonical: 'customer_id' } },
 *   outputMap: { 'event.created': { canonical: 'event_created' } },
 *   contextMap: { currentTenant: 'tenantId' },
 *   namespace: 'mf:customer-dashboard',
 *   strict: true,
 * }
 * ```
 *
 * @see PRD §16.2 (interface), §18.8 (contextMap)
 * @see MF-MAP-01 (REQUIREMENTS.md)
 */
export interface MicroFrontendMapping {
  readonly inputMap?: Record<string, MapperRule>
  readonly outputMap?: Record<string, MapperRule>
  readonly serverMap?: Record<string, MapperRule>
  /** PRD §18.8: alias localizzato per `ctx.context.<localName>` → canonical key */
  readonly contextMap?: Record<string, string>
  readonly strict?: boolean
  /** D-V2-10 extension MAP-17 v1.x — namespace identificatore (default `mf:${mfId}`). */
  readonly namespace?: string
}

/**
 * Shared cross-MF singletons (canonical model project-wide PRD §13.5).
 * Inizializzate al `contextModule().install` via `__initMappingIntegration()`.
 */
let sharedCanonicalRegistry: CanonicalRegistry | undefined
let sharedTransformPipeline: TransformPipeline | undefined
let loggerRef: BrokerLogger | undefined

/**
 * Per-MF instance scoped (D-V2-F10-09).
 * - `perMfMapperEngines` — dispatch table compilata per-MF (F2 D-34 carryover).
 * - `perMfAliasRegistries` — namespace `mf:${mfId}` isolation.
 */
const perMfMapperEngines = new Map<string, MapperEngine>()
const perMfAliasRegistries = new Map<string, AliasRegistry>()

const noopLogger: BrokerLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
}

/**
 * Init shared singletons cross-MF — chiamato da `contextModule().install` PRIMA del
 * primo `attachMfMapping`.
 *
 * Idempotent: chiamate ripetute mantengono singleton (sharedCanonicalRegistry init only-once).
 *
 * @param logger Logger opzionale (default noop). In test passare `mockLogger` con `vi.fn()`.
 *
 * @internal Non esposto dal barrel public — chiamato da `context-module.ts`.
 */
export function __initMappingIntegration(logger?: BrokerLogger): void {
  if (!sharedCanonicalRegistry) sharedCanonicalRegistry = new CanonicalRegistry()
  if (!sharedTransformPipeline) sharedTransformPipeline = new TransformPipeline()
  loggerRef = logger ?? noopLogger
}

function ensureShared(): {
  canonicalRegistry: CanonicalRegistry
  transformPipeline: TransformPipeline
  logger: BrokerLogger
} {
  if (!sharedCanonicalRegistry || !sharedTransformPipeline) {
    throw new Error(
      '@gluezero/context mapping-integration not initialized. ' +
        'contextModule() install must be called first (via createBroker({ modules: [contextModule()] })).',
    )
  }
  return {
    canonicalRegistry: sharedCanonicalRegistry,
    transformPipeline: sharedTransformPipeline,
    logger: loggerRef ?? noopLogger,
  }
}

/**
 * Crea NUOVA `MapperEngine` istanza F2 + `AliasRegistry` namespace-scoped per MF
 * (D-V2-F10-09).
 *
 * Riusa F2 API pubblica via DI 5-args zero diff `packages/mapper/src/` (D-83 strict).
 *
 * **Flow:**
 * 1. Skip se `mapping` undefined o senza `inputMap`/`outputMap` (bundle saving).
 * 2. Crea per-MF `aliasRegistry = new AliasRegistry()`.
 * 3. Crea per-MF `engine = new MapperEngine({...shared singletons + per-MF aliasReg})`.
 * 4. Registra alias scoped via `aliasRegistry.registerScoped('mf:${mfId}', field, rule.canonical)`.
 * 5. Pre-compile dispatch table via `engine.compileMappings(...)` (F2 D-34 — performance O(1)).
 * 6. Memorizza in `perMfMapperEngines` + `perMfAliasRegistries` Maps.
 *
 * **Collision detection (D-V2-F10-11):** se `aliasRegistry.resolve` ritorna `source: 'global'`
 * con canonical diverso da `rule.canonical` → log warn UNA SOLA VOLTA per tuple `(mfId, field)`.
 *
 * @param _broker Broker reference (riservato per future publish topic — F11+).
 * @param mfId Id MF.
 * @param mapping Mapping descriptor opzionale (skip se undefined).
 *
 * @throws `Error` se `__initMappingIntegration()` non chiamato prima.
 *
 * @example
 * ```ts
 * attachMfMapping(broker, 'customer-dashboard', {
 *   inputMap: { customerId: { canonical: 'customer_id' } },
 *   contextMap: { currentTenant: 'tenantId' },
 * })
 * ```
 *
 * @see MF-MAP-01, MF-MAP-02, MF-INT-MAP-01
 * @see D-V2-F10-09 (per-MF instance scoped)
 * @see D-V2-F10-11 (collision dedup)
 */
export function attachMfMapping(
  _broker: unknown,
  mfId: string,
  mapping: MicroFrontendMapping | undefined,
): void {
  if (!mapping) return
  if (!mapping.inputMap && !mapping.outputMap) {
    // Nessun mapping da compilare — skip per evitare engine inutile (bundle saving + perf)
    return
  }
  const { canonicalRegistry, transformPipeline, logger } = ensureShared()

  // Build per-MF AliasRegistry instance (namespace scoped — D-V2-F10-09).
  const aliasReg = new AliasRegistry()

  // Build NEW MapperEngine instance with DI 5-args (D-V2-F10-09 — reuse F2 zero diff).
  const engine = new MapperEngine({
    canonicalRegistry,
    aliasRegistry: aliasReg,
    transformPipeline,
    validator: valibotAdapter,
    logger,
  })

  // Register scoped aliases for inputMap entries con `canonical` field.
  const pluginScopeId = `mf:${mfId}`
  if (mapping.inputMap) {
    for (const [field, rule] of Object.entries(mapping.inputMap)) {
      if (rule.canonical) {
        // Collision detection vs global alias (D-V2-F10-11) — check PRIMA del registerScoped.
        // `resolve` con local namespace vuoto risolve via global se non c'è scoped yet.
        const beforeRes = aliasReg.resolve(pluginScopeId, field)
        if (beforeRes.source === 'global' && beforeRes.canonical !== rule.canonical) {
          if (!hasSeenCollision(mfId, field)) {
            logger.warn(
              `[@gluezero/context] alias override for mf:${mfId} "${field}": explicit wins (was "${beforeRes.canonical}", now "${rule.canonical}")`,
            )
            markCollision(mfId, field)
          }
        }
        // Register scoped (explicit-wins lookup order D-V2-F10-11).
        aliasReg.registerScoped(pluginScopeId, field, rule.canonical)
      }
    }
  }

  // Pre-compile dispatch table (F2 D-34 carryover — performance O(1) lookup runtime).
  // Pass-through mapping fields supportati da `MapperPluginDescriptor` (F2 line 119-123).
  // NB: F2 `inputMap`/`outputMap` types (`InputMap`/`OutputMap`) sono `MappingRule` shape
  // — F10 `MapperRule` è subset compatibile (canonical+transform+required+default).
  const compilePayload: {
    id: string
    inputMap?: unknown
    outputMap?: unknown
  } = { id: mfId }
  if (mapping.inputMap !== undefined) compilePayload.inputMap = mapping.inputMap
  if (mapping.outputMap !== undefined) compilePayload.outputMap = mapping.outputMap
  engine.compileMappings(compilePayload as Parameters<typeof engine.compileMappings>[0])

  perMfMapperEngines.set(mfId, engine)
  perMfAliasRegistries.set(mfId, aliasReg)
}

/**
 * Cleanup per-MF instance + AliasRegistry namespace-scoped (D-V2-F10-09 + T-F10-05).
 *
 * Cascade lifecycle (chiamata da `lifecycle-hooks.ts`):
 * - `microfrontend.unmounted` → detach
 * - `microfrontend.destroyed` → detach (defensive idempotent)
 * - `microfrontend.unregistered` → detach (T-F10-05 leak prevention anche se MF mai mounted)
 *
 * Operazioni:
 * 1. `aliasRegistry.unregisterScopedAll('mf:${mfId}')` — F2 API pubblica v1.x (verified).
 * 2. `engine.unregisterPluginMappings(mfId)` — F2 D-26 ext cascade.
 * 3. `Map.delete(mfId)` per perMfMapperEngines + perMfAliasRegistries.
 * 4. `clearCollisionsForMf(mfId)` — cleanup collision dedup tracker.
 *
 * @param mfId Id MF da cleanup.
 *
 * @see D-V2-F10-09 (cleanup cascade)
 * @see T-F10-05 (leak mitigation)
 */
export function detachMfMapping(mfId: string): void {
  const aliasReg = perMfAliasRegistries.get(mfId)
  if (aliasReg) {
    aliasReg.unregisterScopedAll(`mf:${mfId}`)
  }
  const engine = perMfMapperEngines.get(mfId)
  if (engine) {
    engine.unregisterPluginMappings(mfId)
  }
  perMfMapperEngines.delete(mfId)
  perMfAliasRegistries.delete(mfId)
  clearCollisionsForMf(mfId)
}

/**
 * Accessor pubblico — ritorna MapperEngine per `mfId` (usato da `inspector-wrapper`).
 *
 * @param mfId Id MF.
 * @returns MapperEngine instance se attached, altrimenti `undefined`.
 */
export function getMfMapperEngine(mfId: string): MapperEngine | undefined {
  return perMfMapperEngines.get(mfId)
}

/**
 * Accessor per integration test — ritorna lista mfId con engine attivo.
 *
 * @returns Snapshot readonly degli mfId attualmente registrati.
 */
export function getActiveMfIds(): readonly string[] {
  return Array.from(perMfMapperEngines.keys())
}

/**
 * Test-only reset — NON nel barrel pubblico (D-V2-F9-11).
 *
 * Detach tutti gli MF + reset shared singletons + reset collision tracker.
 *
 * @internal
 */
export function __resetMappingForTest(): void {
  for (const mfId of Array.from(perMfMapperEngines.keys())) {
    detachMfMapping(mfId)
  }
  sharedCanonicalRegistry = undefined
  sharedTransformPipeline = undefined
  loggerRef = undefined
}
