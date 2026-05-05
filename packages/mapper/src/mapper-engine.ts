// MapperEngine — il "cuore" funzionale di @gluezero/mapper (PRD §13, §14, §28).
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

import type { BrokerLogger, PluginDescriptor } from '@gluezero/core'
import { createBrokerError } from '@gluezero/core'
import type { AliasRegistry, AliasResolution } from './alias-registry'
import type { CanonicalRegistry } from './canonical-registry'
import type { TransformPipeline } from './transform-pipeline'
import type {
  CanonicalSchema,
  CanonicalSchemaId,
  FieldDescriptor,
  FieldFailureMode,
  FieldType,
} from './types/canonical-schema'
import type { InputMap, MappingRule, OutputMap } from './types/input-output-map'
import type { TransformContext } from './types/transform'
import type { ValidationIssue, ValidationResult, ValidatorAdapter } from './types/validator-adapter'

/**
 * CR-04 fix helper: determina se `value` corrisponde al `FieldType` dichiarato.
 *
 * Mapping FieldType → JS runtime type:
 * - 'string' → typeof === 'string'
 * - 'number' → typeof === 'number' (Number.NaN incluso — Valibot lo accetta come number)
 * - 'boolean' → typeof === 'boolean'
 * - 'object' → object plain (NON null, NON array)
 * - 'array' → Array.isArray
 * - 'any' → sempre `true` (gestito dal caller validateCanonical)
 */
function matchesFieldType(value: unknown, type: FieldType): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number'
    case 'boolean':
      return typeof value === 'boolean'
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    case 'array':
      return Array.isArray(value)
    case 'any':
      return true
    default:
      return false
  }
}

/** CR-04 fix helper: descrive il tipo runtime di `value` per ValidationIssue.received. */
function describeRuntimeType(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

/**
 * WR-03 fix: keys riservate JS che NON devono apparire né come canonicalField (in
 * outputMap/inputMap key) né come `rule.source` semplice né come segmento di
 * dot-path. Applicare uno di questi nomi al `result[key]` causerebbe prototype
 * pollution; leggerlo con `source[key]` esporrebbe getter/Object.prototype.
 */
const RESERVED_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Plugin descriptor F2 internal — extends F1 PluginDescriptor con i campi mapper.
 *
 * Il plan 02-09 farà declaration merging di `PluginDescriptor` di `@gluezero/core`
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
   * Resolution order D-40 (CR-02 fix — chiusura PRD §39 #1 / MAP-17 a runtime):
   *   1. Mapping esplicito (`outputMap`) — sempre prevalente
   *   2. Alias plugin-scoped (`aliasRegistry.resolve` con `source: 'scoped'`)
   *   3. Alias globale (`aliasRegistry.resolve` con `source: 'global'`)
   *   4. Name-match — NON applicato implicitamente in F2: solo i campi dichiarati
   *      esplicitamente nel `outputMap` o risolti via alias appaiono nel canonical
   *      (T-02-07-06 partial mapping mantenuto).
   *
   * Se il plugin non ha compileMappings registrato → passthrough (shallow copy).
   * Se ha compileMappings ma outputMap vuoto → applica solo gli alias.
   *
   * @throws `BrokerError 'mapping.field.missing'` se un field required è assente (D-42).
   * @throws `BrokerError 'mapping.transform.failed'` se transform throw + onFailure 'block' (D-44).
   */
  applyOutputMap(pluginId: string, payload: unknown): Record<string, unknown> {
    const compiled = this.compiled.get(pluginId)
    if (!compiled) {
      return this.shallowCopy(payload)
    }
    const result = this.applyMapping(pluginId, payload, compiled.outputCompiled)
    // CR-02 fix: applica resolution order D-40 livelli 2-3 (alias scoped/global).
    this.applyAliasResolution(pluginId, payload, compiled, result)
    return result
  }

  /**
   * Applica il mapping canonico → consumer (passo 11 pipeline §28).
   *
   * Se il plugin non ha compileMappings registrato → passthrough (shallow copy).
   * Se ha compileMappings ma inputMap vuoto → ritorna shallow copy del canonical
   * (NB: gli alias sono `local → canonical` quindi non si applicano alla direzione
   * inversa canonical → consumer; il consumer dichiara la propria forma via inputMap).
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
   * Verifica se un plugin ha mapping compilati (output o input).
   *
   * Usato dal broker wrapper (plan 02-10) per decidere se applicare `applyOutputMap`
   * al publish: se il plugin source NON ha compileMappings registrato, il payload
   * passa invariato al bus (passthrough — coerente con T-02-07-06 partial mapping).
   */
  hasCompiled(pluginId: string): boolean {
    return this.compiled.has(pluginId)
  }

  /**
   * Verifica se un plugin ha un `inputMap` compilato (con almeno una rule).
   *
   * Usato dal broker wrapper (plan 02-10) per decidere se wrappare l'handler del
   * subscribe con `applyInputMap` (passo 11). Plugin senza inputMap → handler diretto
   * sul payload canonico.
   */
  hasInputMap(pluginId: string): boolean {
    const compiled = this.compiled.get(pluginId)
    return compiled !== undefined && compiled.inputCompiled.length > 0
  }

  /**
   * BL-01 iter3: identifica i plugin "canonical-only" — registrati con SOLO
   * `canonicalSchemaId` (no `outputMap`, no `inputMap`) e zero rules compilate.
   *
   * Iter2 (CR-02-RESIDUAL) ha esteso il guard di `compileMappings` a
   * `canonicalSchemaId !== undefined || outputMap || inputMap` per abilitare la
   * canonicalizzazione via alias scoped/global. Side effect: per plugin con SOLO
   * `canonicalSchemaId` (no maps, no aliases applicabili), `applyOutputMap` ritorna
   * `{}` e droppa il payload originale.
   *
   * Il broker wrapper (plan 02-10) usa questo metodo + check sugli alias registry
   * per decidere se applicare un percorso "canonical-only passthrough" (skip
   * applyOutputMap, validate canonical sul payload originale, inner.publish con
   * payload originale invariato — back-compat F1 partial mapping policy T-02-07-06).
   *
   * @returns `true` se il plugin ha `canonicalSchemaId` ma zero rule output/input
   *          compilate; `false` altrimenti (incluso "non compilato").
   */
  isCanonicalOnly(pluginId: string): boolean {
    const compiled = this.compiled.get(pluginId)
    if (!compiled) return false
    if (compiled.canonicalSchemaId === undefined) return false
    return compiled.outputCompiled.length === 0 && compiled.inputCompiled.length === 0
  }

  /**
   * Ritorna il `canonicalSchemaId` dichiarato dal plugin nel descriptor (se presente).
   *
   * Usato dal broker wrapper (plan 02-10) per il step 6 (canonical validation): dopo
   * `applyOutputMap`, il wrapper invoca `validateCanonical(schemaId, canonicalPayload)`
   * per verificare structural compliance.
   */
  getCanonicalSchemaIdFor(pluginId: string): CanonicalSchemaId | undefined {
    return this.compiled.get(pluginId)?.canonicalSchemaId
  }

  /**
   * Valida un payload canonico contro il canonical schema registrato (passi 6 e 12).
   *
   * CR-04 fix: structural enforcement dei `FieldDescriptor` registrati.
   * - Schema non registrato → `{ ok: false, issues: [{ message }] }`.
   * - Payload non-object (string/number/null) → `{ ok: false, issues: [...] }`.
   * - Per ogni `FieldDescriptor` registrato:
   *   - `required: true` + field assente → issue con `path: [name]`, `message: required field missing`.
   *   - field presente + `type` mismatch (escludendo `'any'`) → issue con `path: [name]`,
   *     `expected: type`, `received: typeof val`.
   * - Field extra non dichiarati nello schema → accept silenziosamente (forward-compatible).
   *
   * NB: `field.default` NON è applicato dalla validation (il default è gestito da
   * `applyMapping` D-42); validation valuta lo state finale del canonical.
   *
   * WR-D iter2 — Semantica `null` vs `missing`:
   * Un field `required: true` con valore `null` esplicito (`{ field: null }`) viene
   * trattato come **type mismatch**, NON come "missing". Il check `name in obj`
   * ritorna true (la key esiste), quindi la branch `required && !present` è skipped;
   * poi `matchesFieldType(null, 'string')` ritorna false → issue
   * `expected: 'string', received: 'null'`. "Missing" significa stricly "key non
   * presente nel payload object". Per "required-and-not-null" SQL-like, il consumer
   * deve usare un transform pre-step che valida `null` esplicitamente, oppure
   * dichiarare il field con `type: 'any'`. Documentato nel README §Field policy.
   *
   * V1.x potrà costruire dinamicamente uno schema Valibot da `FieldDescriptor.type` via
   * `this.validator.validate(...)` per typed validation più ricca (es. format string).
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
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return {
        ok: false,
        issues: [
          {
            message: `Canonical payload must be a plain object (received ${payload === null ? 'null' : Array.isArray(payload) ? 'array' : typeof payload})`,
          },
        ],
      }
    }
    const obj = payload as Record<string, unknown>
    const issues: ValidationIssue[] = []
    for (const [name, fd] of Object.entries(schema.fields)) {
      const present = name in obj
      if (fd.required === true && !present) {
        issues.push({ path: [name], message: `required canonical field "${name}" is missing` })
        continue
      }
      if (!present) continue
      const val = obj[name]
      // type 'any' accept tutto. Field undefined valutato come "missing".
      if (fd.type === 'any') continue
      if (val === undefined) continue
      if (!matchesFieldType(val, fd.type)) {
        issues.push({
          path: [name],
          message: `canonical field "${name}" expected ${fd.type}, received ${describeRuntimeType(val)}`,
          expected: fd.type,
          received: describeRuntimeType(val),
        })
      }
    }
    return issues.length === 0 ? { ok: true, value: payload } : { ok: false, issues }
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

  /** Compila un singolo `InputMap`/`OutputMap` in lista di `CompiledFieldMapping`.
   *
   * WR-03 fix: rifiuta keys riservate (`__proto__`, `constructor`, `prototype`)
   * sia come `canonicalField` (chiave del map) sia come `rule.source` semplice
   * (per coerenza, `derive.sources` segmenti checkati nel readPath).
   */
  private compileRules(
    map: InputMap | OutputMap,
    schema: CanonicalSchema | undefined,
  ): CompiledFieldMapping[] {
    const result: CompiledFieldMapping[] = []
    for (const [canonicalField, rule] of Object.entries(map)) {
      if (RESERVED_KEYS.has(canonicalField)) {
        throw createBrokerError({
          code: 'mapping.field.invalid',
          category: 'mapping',
          message: `Reserved canonical field name "${canonicalField}" is not allowed (prototype-pollution guard).`,
          details: { canonicalField },
        })
      }
      if (
        rule.source !== undefined &&
        !rule.source.includes('.') &&
        RESERVED_KEYS.has(rule.source)
      ) {
        throw createBrokerError({
          code: 'mapping.field.invalid',
          category: 'mapping',
          message: `Reserved local field name "${rule.source}" is not allowed as MappingRule.source.`,
          details: { canonicalField, source: rule.source },
        })
      }
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
   * Visita DFS di un singolo field; throw se un suo discendente derive O source
   * richiama un campo già presente nel cammino DFS attivo (`path`).
   *
   * CR-03 fix: la DFS segue sia `rule.derive.sources` (esistente) sia `rule.source`
   * quando questo referenzia un altro field DEL MAP (alias intra-mapping). Questo
   * copre cicli misti `A.derive=[B]; B.source=A` che precedentemente non venivano
   * rilevati (falso negativo critico).
   *
   * Identity self-reference exclusion: `rule.source === field` (es.
   * `location: { source: 'location' }`) è identity rename, NON un ciclo. Skip
   * perché non avanza il path della DFS oltre il field corrente.
   *
   * Edge cases:
   * - `rule.source` con dot-path (es. 'a.b.c') NON viene seguito (è un nested local
   *   path, non un riferimento intra-mapping).
   * - `rule.source` che punta a un nome NON presente nel map → no follow (è un
   *   localField del payload, non un alias intra-mapping).
   * - `rule.source === field` (identity) → no follow.
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
    if (!rule) return
    const newPath = [...path, field]
    if (rule.derive) {
      for (const src of rule.derive.sources) {
        // Skip self-reference identity (es. derive: { sources: [field] }).
        if (src === field) continue
        this.detectCyclesFrom(pluginId, map, src, newPath)
      }
    }
    // CR-03 fix: segui anche rule.source se è un altro field del map (alias intra-mapping).
    if (
      rule.source !== undefined &&
      !rule.source.includes('.') &&
      rule.source !== field // skip identity rename (es. { location: { source: 'location' } })
    ) {
      const mapRecord = map as Record<string, MappingRule>
      if (Object.hasOwn(mapRecord, rule.source)) {
        this.detectCyclesFrom(pluginId, map, rule.source, newPath)
      }
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

  /**
   * CR-02 fix — applica resolution order D-40 livelli 2-3 (alias scoped/global) per i
   * field locali del payload NON coperti da un mapping esplicito.
   *
   * Per ogni `localField` del payload:
   * 1. Se esiste un `MappingRule` esplicito che ha `source === localField` → skip (D-40 livello 1 wins).
   * 2. Altrimenti, consulta `aliasRegistry.resolve(pluginId, localField)`:
   *    - `source: 'scoped'` o `'global'` → applica alias `localField → canonical`.
   *    - `source: 'name-match'` → skip (livello 4 NON applicato — vedi JSDoc applyOutputMap).
   * 3. Se il `canonical` risolto è già stato popolato da un mapping esplicito → skip
   *    (D-40 livello 1 wins anche se l'esplicito ha source diverso ma stesso canonical).
   *
   * NB: questa implementazione iterazione-per-payload garantisce che gli alias siano
   * applicati ANCHE quando il payload ha field non dichiarati nel `outputMap`. La
   * partial-mapping policy (T-02-07-06) resta invariata: solo i field esplicitamente
   * mappati o aliasati appaiono nel canonical.
   */
  private applyAliasResolution(
    pluginId: string,
    payload: unknown,
    compiled: CompiledMapping,
    result: Record<string, unknown>,
  ): void {
    if (payload === null || typeof payload !== 'object') return
    const source = payload as Record<string, unknown>
    // Set di localField già consumati da mapping esplicito (rule.source semplice — non dot-path).
    const explicitLocals = new Set<string>()
    for (const fm of compiled.outputCompiled) {
      if (fm.rule.source !== undefined && !fm.rule.source.includes('.')) {
        explicitLocals.add(fm.rule.source)
      }
      if (fm.rule.derive) {
        for (const s of fm.rule.derive.sources) {
          if (!s.includes('.')) explicitLocals.add(s)
        }
      }
    }
    // Set di canonicalField già esplicitamente mappati (D-40 livello 1 wins).
    const explicitCanonicals = new Set(compiled.outputCompiled.map((fm) => fm.canonicalField))

    for (const localField of Object.keys(source)) {
      // D-40 livello 1: se il localField è già consumato da mapping esplicito, skip.
      if (explicitLocals.has(localField)) continue
      // D-40 livelli 2-3: consulta alias registry.
      let resolution: AliasResolution
      try {
        resolution = this.aliasRegistry.resolve(pluginId, localField)
      } catch {
        // alias.localField.empty (stringa vuota) — skip silenziosamente.
        continue
      }
      // Solo alias automatici (scoped o global) — name-match NON applicato (vedi JSDoc).
      if (resolution.source !== 'scoped' && resolution.source !== 'global') continue
      // Il canonical risolto NON deve essere già popolato esplicitamente (D-40 livello 1 wins).
      if (explicitCanonicals.has(resolution.canonical)) continue
      // Non sovrascrivere risultati già scritti da iterazioni precedenti dello stesso loop.
      if (resolution.canonical in result) continue
      result[resolution.canonical] = source[localField]
    }
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
   *
   * WR-03 fix: segmenti riservati (`__proto__`, `constructor`, `prototype`) ritornano
   * `undefined` invece di seguire il prototype chain (prototype-pollution guard).
   */
  private readPath(source: Record<string, unknown>, path: string): unknown {
    if (!path.includes('.')) {
      if (RESERVED_KEYS.has(path)) return undefined
      return source[path]
    }
    const parts = path.split('.')
    if (parts.some((p) => RESERVED_KEYS.has(p))) return undefined
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
