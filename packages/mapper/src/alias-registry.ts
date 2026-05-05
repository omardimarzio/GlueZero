// AliasRegistry — registry alias localField → canonicalField (PRD §13.3, REQ MAP-16/MAP-17).
//
// Riferimento decisioni (02-CONTEXT.md):
// - D-40: resolution order — esplicito (delegato a mapper-engine) > scoped > global > name-match.
// - D-41: alias automatico (scoped o global) → ambiguous:true → mapper-engine emette mapping.warn.
//   Il name-match diretto (localField === canonicalField) NON è ambiguo.
// - D-26 ext F2: `unregisterScopedAll(pluginId)` per cascade plugin unregister
//   (wired al broker wrapper in plan 02-10).
//
// Resolution levels gestiti da questo module:
//   2. plugin-scoped → ambiguous:true, source:'scoped'
//   3. global       → ambiguous:true, source:'global'
//   4. name-match   → ambiguous:false, source:'name-match'
// Level 1 (esplicito inputMap/outputMap) vive nel mapper-engine.
// Level 5 (unresolved) emerge se mapper-engine consulta CanonicalRegistry e il field non esiste.
//
// Anti-pattern PITFALLS §3.B (alias globali shadow tra plugin):
// risolto via separazione `globalAliases: Map` vs `pluginScopedAliases: Map<pluginId, Map>`.
//
// Threat coverage:
// - T-02-04-01 (Tampering — listGlobal/listScoped mutation esterna): spread copy + sort.
//   Test "listGlobal/listScoped" verifica che la copia sia fresca ad ogni chiamata.
// - T-02-04-02 (Information disclosure — plugin-b vede alias scoped di plugin-a): scope isolation
//   tramite Map<pluginId, Map>. Test "plugin-b does NOT see scoped alias" verifica.
// - T-02-04-03 (Tampering — silent overwrite di alias conflittuale): registerGlobal/registerScoped
//   throw alias.{global,scoped}.conflict su pair conflittuale; idempotent su pair identico.
// - T-02-04-04 (Repudiation — resolve non riporta source → debug difficile): AliasResolution.source
//   literal union espone esattamente quale livello D-40 ha risolto.
// - T-02-04-05 (Spoofing — plugin malevolo registra alias globale per shadow): registerGlobal è
//   esposto solo via Broker.registerAlias (plan 02-10) con auth applicativo del consumer; conflict
//   throw previene shadow accidentale. Plugin-scoped è sempre la priorità per il plugin proprio.
//
// `exactOptionalPropertyTypes: true` policy: non ci sono campi opzionali in questo module.
// `isolatedDeclarations: true` enforcement: ogni metodo pubblico ha return type esplicito.
//
// Niente import da @gluezero/core: il module è auto-contenuto. Gli errori `alias.*.conflict`
// sono Error nativi (NON BrokerError) — coerente con error handling delegato al consumer
// mapper-engine, che wrappa in BrokerError quando intercetta. Mantiene il registry agnostico.

import type { CanonicalSchemaId } from './types/canonical-schema'

/**
 * WR-03 iter3: keys riservate JS che NON devono essere accettate come
 * `localField` o `canonicalField` in alias (né global né scoped). Coerente
 * con `RESERVED_KEYS` di `mapper-engine.ts:110`. Defense-in-depth: anche se
 * `applyAliasResolution` filtra via mapper-engine, blocchiamo la
 * registrazione per prevenire propagation in path che potrebbero ignorare
 * il filtro (caller third-party che invocano direttamente `resolve`).
 */
const RESERVED_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])

function assertNotReserved(localField: string, canonicalField: string): void {
  if (RESERVED_KEYS.has(localField) || RESERVED_KEYS.has(canonicalField)) {
    throw new Error(
      `alias.field.reserved: localField/canonicalField cannot be a JS-reserved key (__proto__/constructor/prototype) — got localField="${localField}" canonicalField="${canonicalField}" (prototype-pollution guard)`,
    )
  }
}

/**
 * Source identificativa della risoluzione (D-40, D-41).
 *
 * - `'scoped'` — alias plugin-scoped (livello 2 D-40); mapper-engine emette `mapping.warn`.
 * - `'global'` — alias globale (livello 3 D-40); mapper-engine emette `mapping.warn`.
 * - `'name-match'` — localField === canonicalField (livello 4 D-40); NON ambiguo.
 * - `'unresolved'` — riservato al mapper-engine quando `CanonicalRegistry` conferma che il
 *    nome non esiste come schema canonico (livello 5 D-40). Questo registry non emette mai
 *    `'unresolved'` direttamente — il default è `'name-match'` con il localField come canonical.
 */
export type AliasResolutionSource = 'scoped' | 'global' | 'name-match' | 'unresolved'

/**
 * Risultato di `AliasRegistry.resolve(pluginId, localField)`.
 *
 * `ambiguous: true` SOLO quando un alias automatico (scoped o globale) è stato applicato —
 * il mapper-engine deve emettere `mapping.warn` per debug (D-41). NON un'eccezione: i field
 * required mancanti li gestisce il mapper-engine consultando CanonicalRegistry.
 */
export interface AliasResolution {
  readonly canonical: string
  readonly ambiguous: boolean
  readonly source: AliasResolutionSource
}

/**
 * Registry alias localField → canonicalField (REQ MAP-16, MAP-17).
 *
 * Pattern F1 (vedi `TopicRegistry` in `@gluezero/core`) esteso con due livelli di scope:
 * - `globalAliases: Map<localField, canonicalField>` — visibili a tutti i plugin
 * - `pluginScopedAliases: Map<pluginId, Map<localField, canonicalField>>` — visibili solo
 *   al plugin proprietario (scope isolation, T-02-04-02 mitigation)
 *
 * Il MapperEngine (plan 02-07) chiama `resolve(pluginId, localField)` per scoprire il
 * canonical name di un field se il plugin NON ha dichiarato un mapping esplicito.
 * Resolution order D-40 (livelli 2-4 implementati qui; livelli 1 e 5 nel mapper-engine).
 *
 * @example
 * ```ts
 * const reg = new AliasRegistry()
 * reg.registerGlobal('city', 'location')
 * reg.resolve('plugin-a', 'city') // { canonical: 'location', ambiguous: true, source: 'global' }
 * reg.resolve('plugin-a', 'location') // { canonical: 'location', ambiguous: false, source: 'name-match' }
 * ```
 */
export class AliasRegistry {
  private readonly globalAliases = new Map<string, string>()
  private readonly pluginScopedAliases = new Map<string, Map<string, string>>()

  /**
   * Registra un alias globale visibile a tutti i plugin.
   *
   * Comportamento:
   * - localField nuovo → registra e ritorna `true`.
   * - localField già registrato a `canonicalField` identico → ritorna `false` (idempotent).
   * - localField già registrato a canonical diverso → throw `Error 'alias.global.conflict'`.
   *
   * @param localField - Nome locale del campo (es. 'city').
   * @param canonicalField - Nome canonico target (es. 'location').
   * @returns `true` se nuovo alias, `false` se già registrato identico.
   * @throws `Error('alias.global.conflict: ...')` se localField mappa già a canonical diverso.
   */
  registerGlobal(localField: string, canonicalField: string): boolean {
    // WR-03 iter3: prototype-pollution guard (defense in depth — coerente con
    // mapper-engine.ts RESERVED_KEYS check su compileRules + readPath).
    assertNotReserved(localField, canonicalField)
    const existing = this.globalAliases.get(localField)
    if (existing !== undefined) {
      if (existing === canonicalField) return false
      throw new Error(
        `alias.global.conflict: localField "${localField}" already maps to "${existing}", cannot remap to "${canonicalField}"`,
      )
    }
    this.globalAliases.set(localField, canonicalField)
    return true
  }

  /**
   * Registra un alias plugin-scoped visibile solo al plugin proprietario.
   *
   * Comportamento:
   * - localField nuovo nello scope del plugin → registra e ritorna `true`.
   * - localField già registrato a `canonicalField` identico → ritorna `false` (idempotent).
   * - localField già registrato a canonical diverso → throw `Error 'alias.scoped.conflict'`.
   *
   * Plugin diversi possono registrare alias conflittuali per lo stesso localField:
   * `plugin-a:city → location` e `plugin-b:city → place` coesistono (scope isolation).
   *
   * @param pluginId - Id del plugin proprietario dell'alias.
   * @param localField - Nome locale del campo.
   * @param canonicalField - Nome canonico target.
   * @returns `true` se nuovo alias, `false` se già registrato identico.
   * @throws `Error('alias.scoped.conflict: ...')` se localField mappa già a canonical diverso
   *         nello stesso plugin scope.
   */
  registerScoped(pluginId: string, localField: string, canonicalField: string): boolean {
    // WR-03 iter3: prototype-pollution guard (defense in depth — coerente con
    // mapper-engine.ts RESERVED_KEYS check su compileRules + readPath).
    assertNotReserved(localField, canonicalField)
    let scope = this.pluginScopedAliases.get(pluginId)
    if (!scope) {
      scope = new Map<string, string>()
      this.pluginScopedAliases.set(pluginId, scope)
    }
    const existing = scope.get(localField)
    if (existing !== undefined) {
      if (existing === canonicalField) return false
      throw new Error(
        `alias.scoped.conflict: plugin "${pluginId}" localField "${localField}" already maps to "${existing}", cannot remap to "${canonicalField}"`,
      )
    }
    scope.set(localField, canonicalField)
    return true
  }

  /**
   * Risolve `localField` per il plugin specifico secondo D-40 (livelli 2-4).
   *
   * Il mapper-engine (plan 02-07) ha già consultato il livello 1 (mapping esplicito)
   * prima di chiamare `resolve`. Il livello 5 (unresolved) viene determinato dal
   * mapper-engine consultando CanonicalRegistry — qui ritorniamo sempre un canonical
   * (defaulting a `name-match` con `localField`).
   *
   * Resolution order:
   * 1. plugin-scoped → `{ ambiguous: true, source: 'scoped' }` (D-41 mapper.warn)
   * 2. global → `{ ambiguous: true, source: 'global' }` (D-41 mapper.warn)
   * 3. name-match → `{ ambiguous: false, source: 'name-match' }` (NON ambiguo)
   *
   * @param pluginId - Id del plugin che richiede la risoluzione.
   * @param localField - Nome locale del campo da risolvere.
   * @returns `AliasResolution` con canonical name, flag di ambiguità, source level.
   * @throws `Error('alias.localField.empty: ...')` se localField è stringa vuota.
   */
  resolve(pluginId: string, localField: string): AliasResolution {
    if (localField === '') {
      throw new Error('alias.localField.empty: localField cannot be an empty string')
    }
    // WR-03 iter3: defense in depth — anche se register è bloccato, resolve è
    // una surface pubblica e potrebbe essere chiamata direttamente da caller
    // third-party con un nome riservato proveniente da input untrusted.
    if (RESERVED_KEYS.has(localField)) {
      throw new Error(
        `alias.field.reserved: localField cannot be a JS-reserved key (__proto__/constructor/prototype) — got "${localField}" (prototype-pollution guard)`,
      )
    }

    // Level 2: scoped
    const scope = this.pluginScopedAliases.get(pluginId)
    if (scope) {
      const scoped = scope.get(localField)
      if (scoped !== undefined) {
        return { canonical: scoped, ambiguous: true, source: 'scoped' }
      }
    }

    // Level 3: global
    const global = this.globalAliases.get(localField)
    if (global !== undefined) {
      return { canonical: global, ambiguous: true, source: 'global' }
    }

    // Level 4: name match (default — no alias needed).
    return { canonical: localField, ambiguous: false, source: 'name-match' }
  }

  /**
   * Cascade D-26 ext F2: rimuove tutti gli alias scoped di un plugin.
   *
   * Invocato dal broker wrapper (plan 02-10) durante `unregisterPlugin` per garantire
   * che il plugin non lasci alias orfani nel registry. Gli alias globali e quelli di
   * altri plugin restano intatti.
   *
   * @param pluginId - Id del plugin di cui rimuovere gli alias scoped.
   * @returns Numero di alias rimossi (0 se il plugin non aveva alias scoped).
   */
  unregisterScopedAll(pluginId: string): number {
    const scope = this.pluginScopedAliases.get(pluginId)
    if (!scope) return 0
    const count = scope.size
    this.pluginScopedAliases.delete(pluginId)
    return count
  }

  /**
   * Ritorna la lista degli alias globali ordinati alfabeticamente per localField.
   *
   * Il return è una **copia** spread del Map interno (T-02-04-01 mitigation):
   * mutation esterna del result NON corrompe lo state del registry.
   *
   * @returns Array di `[localField, canonicalField]` ordinato deterministicamente.
   */
  listGlobal(): [string, string][] {
    return [...this.globalAliases.entries()].sort(([a], [b]) => a.localeCompare(b))
  }

  /**
   * Ritorna la lista degli alias plugin-scoped per il plugin specifico, ordinati
   * alfabeticamente per localField.
   *
   * Il return è una **copia** spread del Map interno (T-02-04-01 mitigation).
   *
   * @param pluginId - Id del plugin di cui listare gli alias.
   * @returns Array di `[localField, canonicalField]` per il plugin (vuoto se non registrato).
   */
  listScoped(pluginId: string): [string, string][] {
    const scope = this.pluginScopedAliases.get(pluginId)
    if (!scope) return []
    return [...scope.entries()].sort(([a], [b]) => a.localeCompare(b))
  }
}

// Ri-export type per convenienza nei consumer interni del mapper (mapper-engine plan 02-07).
export type { CanonicalSchemaId }
