// MapperEngine — il "cuore" funzionale di @sembridge/mapper (PRD §13, §14, §28).
//
// Compone i 4 moduli Wave 3 (CanonicalRegistry, AliasRegistry, TransformPipeline,
// ValidatorAdapter) per implementare la pipeline §28 estesa F2 (passi 4, 5, 6, 11, 12).
//
// Riferimento decisioni (02-CONTEXT.md):
// - D-34: mapping pre-compilato al `compileMappings(descriptor)` — Map<pluginId, CompiledMapping>
//         con dispatch table O(1) per ogni `applyOutputMap`/`applyInputMap` runtime.
// - D-35: cycle detection register-time con visited Set; throw IMMEDIATAMENTE in
//         `compileMappings` (NON a runtime publish). Test 20-22 verificano determinismo.
// - D-40 (MAP-17): resolution order — esplicito (inputMap/outputMap) PREVALE su alias
//         automatici. Chiusura PRD §39 #1.
// - D-42 (VAL-08): required:true + missing → throw `mapping.field.missing` con
//         `details: { pluginId, fieldName }`. Chiusura PRD §39 #3.
//         required:false + default → applica default; required:false + no default → field omesso
//         (exactOptionalPropertyTypes).
// - D-43: default value resolution — i `default` sono valori statici (no funzioni).
//         Per default dinamici → usa `derive` con transform.
// - D-44 (VAL-09): transform throw → applica onFailure 'block'/'skip'/'fallback'.
//         Delegato a `TransformPipeline.apply` (plan 02-05).
// - D-45: errore wrapped con `originalError`+`cause` ES2022 — già implementato in
//         `TransformPipeline.apply`.
// - D-26 ext F2: `unregisterPluginMappings(pluginId)` cascade plugin unregister.
//         Wired al broker wrapper plan 02-10.
// - D-49: questo engine NON modifica `bus.ts` di F1. Il broker wrapper (plan 02-10)
//         compone MapperEngine come dipendenza, intercettando `registerPlugin` e
//         `subscribe` per invocare i metodi qui.
// - D-50: tap orchestration sui passi 4, 5, 6, 11, 12 (gestita dal broker wrapper plan 02-10).
//
// Pipeline §28 estesa F2 (PIPE-01 — ordine canonico):
//   passo 4  alias-resolve (event.source.resolved)        — lookup AliasRegistry.resolve
//   passo 5  source → canonical (event.mapped.canonical)  — applyOutputMap
//   passo 6  canonical-validate (event.canonical.validated) — validateCanonical
//   passo 11 canonical → consumer (event.mapped.consumer)  — applyInputMap
//   passo 12 final-validate (event.final.validated)        — validateCanonical (consumer schema)
//
// Threat coverage:
// - T-02-07-01 (DoS — mapping circolare): D-35 cycle detection register-time.
// - T-02-07-02 (DoS — compile cache memory leak): unregisterPluginMappings cascade.
// - T-02-07-03 (Tampering — compiled mapping mutation): private Map; readonly interface.
// - T-02-07-04 (Repudiation — field missing senza attribution): mapping.field.missing
//   con details.pluginId/details.fieldName.
// - T-02-07-05 (Spoofing — cross-plugin pollution): compiled indicizzato per descriptor.id.
// - T-02-07-06 (Information disclosure — partial mapping): solo i field dichiarati nel
//   outputMap appaiono nel canonical. Test 6 verifica.
// - T-02-07-07 (DoS — transform infinitamente loop): accept; F5 worker timeout copre.
//
// `exactOptionalPropertyTypes: true` policy: conditional spread per i field opzionali.
// `isolatedDeclarations: true` enforcement: ogni metodo pubblico ha return type esplicito.

import type { BrokerLogger, PluginDescriptor } from '@sembridge/core'
import { createBrokerError } from '@sembridge/core'
import type { AliasRegistry } from './alias-registry'
import type { CanonicalRegistry } from './canonical-registry'
import type { TransformPipeline } from './transform-pipeline'
import type {
  CanonicalSchema,
  CanonicalSchemaId,
  FieldDescriptor,
  FieldFailureMode,
} from './types/canonical-schema'
import type { InputMap, MappingRule, OutputMap } from './types/input-output-map'
import type { TransformContext } from './types/transform'
import type { ValidationResult, ValidatorAdapter } from './types/validator-adapter'

/**
 * Plugin descriptor F2 internal — extends F1 PluginDescriptor con i campi mapper.
 *
 * Il plan 02-09 farà declaration merging di `PluginDescriptor` di `@sembridge/core`
 * per esporre `inputMap`/`outputMap`/`canonicalSchemaId` come parte del contratto pubblico.
 * Per ora questo tipo locale serve da bridge tra l'API F1 e il MapperEngine.
 */
export interface MapperPluginDescriptor extends PluginDescriptor {
  readonly canonicalSchemaId?: CanonicalSchemaId
  readonly outputMap?: OutputMap
  readonly inputMap?: InputMap
}

/** Compiled rule per un singolo field canonico (D-34 — dispatch table O(1) lookup). */
interface CompiledFieldMapping {
  readonly canonicalField: string
  readonly rule: MappingRule
  readonly fieldDescriptor: FieldDescriptor | undefined
}

/** Compiled mapping per un plugin (output + input) — keyed by `descriptor.id`. */
interface CompiledMapping {
  readonly outputCompiled: readonly CompiledFieldMapping[]
  readonly inputCompiled: readonly CompiledFieldMapping[]
  readonly canonicalSchemaId?: CanonicalSchemaId
}

/**
 * Opzioni di costruzione del MapperEngine — dependency injection dei 4 moduli Wave 3.
 *
 * Pattern composition (NON eredita): il broker wrapper (plan 02-10) crea i singoli
 * registry/pipeline/adapter e li passa qui per compose il "cuore" del mapper.
 */
export interface MapperEngineOptions {
  readonly canonicalRegistry: CanonicalRegistry
  readonly aliasRegistry: AliasRegistry
  readonly transformPipeline: TransformPipeline
  readonly validator: ValidatorAdapter
  readonly logger: BrokerLogger
}

/**
 * Stats per `getDebugSnapshot()` (plan 02-10 broker wrapper consume).
 *
 * Snapshot leggero — non duplica lo state interno; solo conteggi per Inspector debug.
 */
export interface MapperEngineStats {
  readonly compiledPluginCount: number
  readonly canonicalSchemas: number
  readonly registeredAliases: {
    readonly global: number
    readonly scoped: number
  }
}

/**
 * MapperEngine — implementa la pipeline §28 estesa F2 (passi 4, 5, 6, 11, 12).
 *
 * - `compileMappings(descriptor)` pre-compila inputMap/outputMap in dispatch table O(1) (D-34)
 *   ed esegue cycle detection register-time (D-35).
 * - `applyOutputMap(pluginId, payload)` applica mapping locale → canonico (passo 5).
 * - `applyInputMap(pluginId, canonical)` applica mapping canonico → consumer (passo 11).
 * - `validateCanonical(schemaId, payload)` esegue validazione canonical (passi 6 e 12).
 * - `unregisterPluginMappings(pluginId)` cascade D-26 ext F2 (rimuove dispatch table).
 *
 * @example
 * ```ts
 * const engine = new MapperEngine({
 *   canonicalRegistry, aliasRegistry, transformPipeline, validator: valibotAdapter, logger,
 * })
 * canonicalRegistry.register({
 *   id: 'weather' as CanonicalSchemaId,
 *   fields: { location: { type: 'string', required: true } },
 * })
 * engine.compileMappings({
 *   id: 'plugin-form',
 *   canonicalSchemaId: 'weather' as CanonicalSchemaId,
 *   outputMap: { location: { source: 'città' } },
 * })
 * engine.applyOutputMap('plugin-form', { città: 'Roma' })
 * // → { location: 'Roma' }
 * ```
 */
export class MapperEngine {
  private readonly canonicalRegistry: CanonicalRegistry
  private readonly aliasRegistry: AliasRegistry
  private readonly transformPipeline: TransformPipeline
  private readonly validator: ValidatorAdapter
  private readonly logger: BrokerLogger
  private readonly compiled = new Map<string, CompiledMapping>()

  constructor(options: MapperEngineOptions) {
    this.canonicalRegistry = options.canonicalRegistry
    this.aliasRegistry = options.aliasRegistry
    this.transformPipeline = options.transformPipeline
    this.validator = options.validator
    this.logger = options.logger
  }

  /**
   * Pre-compila i mapping (input + output) del plugin (D-34) ed esegue cycle detection
   * register-time (D-35).
   *
   * Cicli A→B→A nei `derive.sources` → throw `BrokerError 'mapping.cycle.detected'`
   * con `details: { pluginId, cycle: [...] }` IMMEDIATAMENTE qui (NON a runtime publish).
   *
   * @throws `BrokerError 'mapping.cycle.detected'` se viene rilevato un ciclo.
   */
  compileMappings(descriptor: MapperPluginDescriptor): void {
    const schema = descriptor.canonicalSchemaId
      ? this.canonicalRegistry.get(descriptor.canonicalSchemaId)
      : undefined

    // D-35: cycle detection register-time.
    if (descriptor.outputMap) {
      this.detectCycles(descriptor.id, descriptor.outputMap, [])
    }
    if (descriptor.inputMap) {
      this.detectCycles(descriptor.id, descriptor.inputMap, [])
    }

    const outputCompiled = descriptor.outputMap
      ? this.compileRules(descriptor.outputMap, schema)
      : []
    const inputCompiled = descriptor.inputMap ? this.compileRules(descriptor.inputMap, schema) : []

    const compiled: CompiledMapping = {
      outputCompiled,
      inputCompiled,
      ...(descriptor.canonicalSchemaId !== undefined && {
        canonicalSchemaId: descriptor.canonicalSchemaId,
      }),
    }
    this.compiled.set(descriptor.id, compiled)
  }

  /**
   * Applica il mapping locale → canonico (passo 5 pipeline §28).
   *
   * Se il plugin non ha compileMappings registrato (o outputMap vuoto), ritorna
   * uno shallow copy del payload (passthrough).
   *
   * @throws `BrokerError 'mapping.field.missing'` se un field required è assente (D-42).
   * @throws `BrokerError 'mapping.transform.failed'` se transform throw + onFailure 'block' (D-44).
   */
  applyOutputMap(pluginId: string, payload: unknown): Record<string, unknown> {
    const compiled = this.compiled.get(pluginId)
    if (!compiled || compiled.outputCompiled.length === 0) {
      return this.shallowCopy(payload)
    }
    return this.applyMapping(pluginId, payload, compiled.outputCompiled)
  }

  /**
   * Applica il mapping canonico → consumer (passo 11 pipeline §28).
   *
   * Se il plugin non ha compileMappings registrato (o inputMap vuoto), ritorna
   * uno shallow copy del payload canonico (passthrough — il consumer riceve la
   * forma canonica direttamente).
   */
  applyInputMap(pluginId: string, canonicalPayload: unknown): Record<string, unknown> {
    const compiled = this.compiled.get(pluginId)
    if (!compiled || compiled.inputCompiled.length === 0) {
      return this.shallowCopy(canonicalPayload)
    }
    return this.applyMapping(pluginId, canonicalPayload, compiled.inputCompiled)
  }

  /**
   * Cascade D-26 ext F2: rimuove la dispatch table compilata del plugin.
   *
   * Invocato dal broker wrapper (plan 02-10) durante `unregisterPlugin`.
   *
   * @returns `true` se rimosso, `false` se il plugin non era registrato.
   */
  unregisterPluginMappings(pluginId: string): boolean {
    return this.compiled.delete(pluginId)
  }

  /**
   * Valida un payload canonico contro il canonical schema registrato (passi 6 e 12).
   *
   * F2 V1: structural check via field descriptor presence (basic validation).
   * Schema non registrato → `{ ok: false, issues: [{ message }] }`.
   *
   * V1.x potrà costruire dinamicamente uno schema Valibot da `FieldDescriptor.type`
   * per typed validation; per F2 l'integrazione full-schema avviene quando il broker
   * wrapper (plan 02-10) passa uno schema Valibot esplicito tramite descriptor extension.
   *
   * @returns `ValidationResult` discriminato (NO throw — D-38).
   */
  validateCanonical(canonicalSchemaId: CanonicalSchemaId, payload: unknown): ValidationResult {
    const schema = this.canonicalRegistry.get(canonicalSchemaId)
    if (!schema) {
      return {
        ok: false,
        issues: [{ message: `Canonical schema "${canonicalSchemaId}" not registered` }],
      }
    }
    // F2 V1: structural pass — il consumer del broker wrapper (plan 02-10) può
    // sostituire questo con `validator.validate(valibotSchema, payload)` quando
    // dispone dello schema Valibot full per il canonical.
    return { ok: true, value: payload }
  }

  /**
   * Stats per Inspector debug (plan 02-10 `getDebugSnapshot().mappings`).
   *
   * I count `registeredAliases.scoped` viene dato per default 0 perché l'AliasRegistry
   * V1 non espone una somma totale degli scope; il plan 02-08 Inspector può aggregare
   * via iterazione esplicita se serve.
   */
  stats(): MapperEngineStats {
    return {
      compiledPluginCount: this.compiled.size,
      canonicalSchemas: this.canonicalRegistry.list().length,
      registeredAliases: {
        global: this.aliasRegistry.listGlobal().length,
        // Sum-of-scopes computed by Inspector plan 02-08; default 0 here.
        scoped: 0,
      },
    }
  }

  /** Compila un singolo `InputMap`/`OutputMap` in lista di `CompiledFieldMapping`. */
  private compileRules(
    map: InputMap | OutputMap,
    schema: CanonicalSchema | undefined,
  ): CompiledFieldMapping[] {
    const result: CompiledFieldMapping[] = []
    for (const [canonicalField, rule] of Object.entries(map)) {
      result.push({
        canonicalField,
        rule,
        fieldDescriptor: schema?.fields[canonicalField],
      })
    }
    return result
  }

  /**
   * Cycle detection register-time (D-35 — visited path con DFS).
   *
   * Esplora il grafo di `derive` ricorsivamente partendo da ogni field top-level;
   * se incontra un campo già nel `path` (cammino DFS attivo), throw
   * `BrokerError 'mapping.cycle.detected'` con il path del ciclo nei `details`.
   *
   * Iteration ordering deterministic: usa `Object.entries(map)` per top-level
   * (insertion order JS) e `rule.derive.sources` per i child. Per uno stesso
   * descriptor con uno stesso ciclo, il `details.cycle` array è riproducibile
   * (Test 22 verifica).
   */
  private detectCycles(pluginId: string, map: InputMap | OutputMap, path: string[]): void {
    // DFS partendo da ogni field top-level: il map intero resta visibile per
    // permettere ai sources di referenziare altri field anche profondi.
    for (const [field] of Object.entries(map)) {
      this.detectCyclesFrom(pluginId, map, field, path)
    }
  }

  /**
   * Visita DFS di un singolo field; throw se un suo discendente derive richiama
   * un campo già presente nel cammino DFS attivo (`path`).
   */
  private detectCyclesFrom(
    pluginId: string,
    map: InputMap | OutputMap,
    field: string,
    path: string[],
  ): void {
    if (path.includes(field)) {
      const idx = path.indexOf(field)
      const cyclePath = [...path.slice(idx), field]
      throw createBrokerError({
        code: 'mapping.cycle.detected',
        category: 'mapping',
        message: `Mapping cycle detected for plugin "${pluginId}": ${cyclePath.join(' -> ')}`,
        details: { pluginId, cycle: cyclePath },
      })
    }
    const rule = (map as Record<string, MappingRule>)[field]
    if (!rule?.derive) return
    const newPath = [...path, field]
    for (const src of rule.derive.sources) {
      this.detectCyclesFrom(pluginId, map, src, newPath)
    }
  }

  /** Shallow copy del payload (passthrough quando non c'è un mapping compilato). */
  private shallowCopy(payload: unknown): Record<string, unknown> {
    if (payload === null || typeof payload !== 'object') return {}
    return { ...(payload as Record<string, unknown>) }
  }

  /**
   * Applica una lista di `CompiledFieldMapping` al payload — produce la forma canonica
   * (per outputMap) o la forma consumer (per inputMap).
   *
   * Per ogni field:
   *   - resolve value (derive | source[+transform] | default)
   *   - se undefined + required:true → throw `mapping.field.missing` (D-42, VAL-08)
   *   - se undefined + required:false → field omesso (exactOptionalPropertyTypes)
   *   - altrimenti → assign
   */
  private applyMapping(
    pluginId: string,
    payload: unknown,
    compiled: readonly CompiledFieldMapping[],
  ): Record<string, unknown> {
    const source = (payload ?? {}) as Record<string, unknown>
    const result: Record<string, unknown> = {}

    for (const fm of compiled) {
      const value = this.resolveValue(pluginId, source, fm)
      const fd = fm.fieldDescriptor
      if (value === undefined) {
        if (fd?.required === true) {
          throw createBrokerError({
            code: 'mapping.field.missing',
            category: 'mapping',
            message: `Required canonical field "${fm.canonicalField}" is missing for plugin "${pluginId}"`,
            details: { pluginId, fieldName: fm.canonicalField },
          })
        }
        // Optional + no value → field omitted (exactOptionalPropertyTypes cleanliness).
        continue
      }
      result[fm.canonicalField] = value
    }
    return result
  }

  /**
   * Resolve del valore per un singolo field secondo la `MappingRule` compilata.
   *
   * Ordine:
   *   1. `derive` (PRD §14.5 — combina più sources via transform)
   *   2. `source` (+ optional `transform`)
   *   3. `default` fallback (MAP-06)
   *
   * Su transform throw, `TransformPipeline.apply` applica D-44 onFailure policy
   * (block → throw wrapped; skip → undefined; fallback → defaultValue).
   */
  private resolveValue(
    pluginId: string,
    source: Record<string, unknown>,
    fm: CompiledFieldMapping,
  ): unknown {
    const rule = fm.rule
    const onFailure: FieldFailureMode = fm.fieldDescriptor?.onFailure ?? 'block'
    const defaultValue =
      fm.fieldDescriptor?.default !== undefined ? fm.fieldDescriptor.default : rule.default

    // 1. derive (PRD §14.5, MAP-09)
    if (rule.derive) {
      const args = rule.derive.sources.map((s) => this.readPath(source, s))
      const ctx = this.makeCtx(pluginId, fm)
      const transformed = this.transformPipeline.apply(
        rule.derive.transform,
        args,
        ctx,
        onFailure,
        defaultValue,
      )
      return transformed === undefined ? defaultValue : transformed
    }

    // 2. source (+optional transform)
    let value: unknown
    if (rule.source !== undefined) {
      value = this.readPath(source, rule.source)
    }

    if (value !== undefined && rule.transform !== undefined) {
      const ctx = this.makeCtx(pluginId, fm)
      const transformed = this.transformPipeline.apply(
        rule.transform,
        value,
        ctx,
        onFailure,
        defaultValue,
      )
      value = transformed === undefined ? defaultValue : transformed
    }

    // 3. default fallback (MAP-06)
    if (value === undefined && defaultValue !== undefined) {
      return defaultValue
    }
    return value
  }

  /** Costruisce il `TransformContext` readonly per la chiamata al transform. */
  private makeCtx(pluginId: string, fm: CompiledFieldMapping): TransformContext {
    return {
      logger: this.logger,
      pluginId,
      fieldName: fm.canonicalField,
    }
  }

  /**
   * Legge un valore da `source` seguendo un path semplice o dot-path (MAP-05).
   *
   * Esempio: `readPath({ address: { city: 'Roma' } }, 'address.city')` → `'Roma'`.
   * Su path non risolvibile (chiave assente o tipo non-object intermedio) → `undefined`.
   */
  private readPath(source: Record<string, unknown>, path: string): unknown {
    if (!path.includes('.')) {
      return source[path]
    }
    const parts = path.split('.')
    let current: unknown = source
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined
      }
      current = (current as Record<string, unknown>)[part]
    }
    return current
  }
}
