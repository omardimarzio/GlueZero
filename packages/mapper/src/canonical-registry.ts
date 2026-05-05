// CanonicalRegistry — registry tipizzato dei canonical schema (PRD §13, REQ MAP-01/MAP-02).
//
// Pattern F1 replicato (vedi packages/core/src/core/topic-registry.ts):
// - Map interno con register/has/list idempotent
// - Observer pattern onRegistered con try/catch swallow per listener isolation (T-02-03-01)
// - list() ritorna copia ordinata (no mutation esterna — T-02-03-02)
//
// Estensioni F2 (rispetto al pattern F1 TopicRegistry):
// - `requires: string[]` resolution check al register (D-36) — throw se requires non risolti
// - `unregister(id)` per cascade plugin (D-26 ext F2 — wired in plan 02-10 broker wrapper)
// - `strict: true` opzione per throw su id collision (utile per detection accidentale)
//
// Listener pattern: il listener riceve il `CanonicalSchema` completo (NON solo l'id) — utile
// per Inspector/MetricsCollector che vogliono accedere ai field count.
//
// Threat coverage:
// - T-02-03-01 (DoS — listener throw rompe register flow): try/catch swallow nel for-loop
//   listeners. Pattern F1 TopicRegistry riga 28-34. Test 8 verifica.
// - T-02-03-02 (Tampering — list() mutation esterna corrompe state interno): spread copy
//   `[...this.schemas.keys()].sort()`. Pattern F1 TopicRegistry riga 42-44. Test 6 verifica.
// - T-02-03-03 (Tampering — schema mutation post-register via get()): tipo `CanonicalSchema`
//   è `readonly` al type-level (vedi types/canonical-schema.ts). Runtime `deepFreeze` opt-in
//   in dev mode → deferred a plan 02-07 mapper-engine (D-04 pattern F1).
// - T-02-03-04 (Repudiation — race register A → B requires A): JS single-threaded, register
//   è atomico. Cross-tick race → caller riconosce throw e ritenta.
// - T-02-03-05 (Information disclosure — listener riceve schema completo): intenzionale per
//   Inspector/Metrics F6. Listener autenticati a livello applicativo.
//
// `exactOptionalPropertyTypes: true` policy: `RegisterOptions.strict` è opzionale; il caller
// passa `{ strict: true }` esplicitamente, default è `false` (no strict mode).
// `isolatedDeclarations: true` enforcement: ogni metodo pubblico ha return type esplicito.

import { createBrokerError } from '@gluezero/core'
import type { CanonicalSchema, CanonicalSchemaId } from './types/canonical-schema'

/**
 * WR-03 iter3: keys riservate JS che NON devono essere accettate come
 * `schema.id` né come field name in `schema.fields`. Coerente con
 * `RESERVED_KEYS` di `mapper-engine.ts:110` e `alias-registry.ts`.
 * Defense-in-depth: blocchiamo la registrazione per prevenire propagation
 * in path che potrebbero accedere `schema.fields[name]` su POJO e
 * triggerare prototype pollution.
 */
const RESERVED_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Opzioni per `CanonicalRegistry.register`.
 *
 * `strict: true` → throw `BrokerError 'canonical.id.duplicate'` se l'id è già registrato.
 * Default (`strict: false` o omesso): comportamento idempotent (return `false` su duplicato).
 */
export interface RegisterOptions {
  readonly strict?: boolean
}

/**
 * Listener observer pattern — riceve il `CanonicalSchema` appena registrato.
 *
 * Listener registrati via `onRegistered(listener)` sono invocati in ordine di registrazione
 * dopo l'inserimento dello schema. Throw del listener viene swallowed (T-02-03-01 mitigation).
 */
export type CanonicalRegistryListener = (schema: CanonicalSchema) => void

/**
 * Registry tipizzato dei canonical schema (REQ MAP-01, MAP-02).
 *
 * Pattern F1 (vedi `TopicRegistry` in `@gluezero/core`) esteso con:
 * - `requires` resolution check al register (D-36)
 * - `unregister(id)` per cascade plugin (D-26 ext F2)
 *
 * @example
 * ```ts
 * const registry = new CanonicalRegistry()
 * registry.register({
 *   id: 'weather' as CanonicalSchemaId,
 *   fields: { location: { type: 'string', required: true } },
 * })
 * registry.has('weather' as CanonicalSchemaId) // true
 * ```
 */
export class CanonicalRegistry {
  private readonly schemas = new Map<string, CanonicalSchema>()
  private readonly listeners = new Set<CanonicalRegistryListener>()

  /**
   * Registra un canonical schema.
   *
   * Comportamento:
   * - `requires` non risolti → throw `BrokerError 'canonical.requires.unresolved'` (D-36).
   * - id duplicato + `options.strict !== true` → return `false` (idempotent).
   * - id duplicato + `options.strict === true` → throw `BrokerError 'canonical.id.duplicate'`.
   * - Successo → schema inserito + listener invocati (try/catch swallow) → return `true`.
   *
   * @param schema - Canonical schema da registrare.
   * @param options - Opzioni (`strict?: boolean`).
   * @returns `true` se nuovo schema, `false` se id già registrato in modalità non-strict.
   * @throws `BrokerError 'canonical.requires.unresolved'` con `details: { id, missingRequires }`.
   * @throws `BrokerError 'canonical.id.duplicate'` con `details: { id }` (solo se `strict: true`).
   */
  register(schema: CanonicalSchema, options: RegisterOptions = {}): boolean {
    // WR-03 iter3: prototype-pollution guard sulle chiavi JS-reserved. Coerente
    // con mapper-engine.ts RESERVED_KEYS e alias-registry.ts. Defense-in-depth:
    // schema.id usato come Map key è safe (Map non eredita da Object.prototype),
    // ma schema.fields[name] su POJO può triggare pollution se un caller fa
    // `Object.assign({}, schema.fields)` o equivalente.
    if (RESERVED_KEYS.has(schema.id)) {
      throw createBrokerError({
        code: 'canonical.id.reserved',
        category: 'config',
        message: `Canonical schema id "${schema.id}" is a JS-reserved key (__proto__/constructor/prototype) and is not allowed (prototype-pollution guard).`,
        details: { id: schema.id },
      })
    }
    for (const fieldName of Object.keys(schema.fields)) {
      if (RESERVED_KEYS.has(fieldName)) {
        throw createBrokerError({
          code: 'canonical.field.reserved',
          category: 'config',
          message: `Canonical schema "${schema.id}" contains JS-reserved field name "${fieldName}" (__proto__/constructor/prototype) — not allowed (prototype-pollution guard).`,
          details: { id: schema.id, fieldName },
        })
      }
    }

    // D-36: requires resolution check
    if (schema.requires && schema.requires.length > 0) {
      const missing = schema.requires.filter((req) => !this.schemas.has(req))
      if (missing.length > 0) {
        throw createBrokerError({
          code: 'canonical.requires.unresolved',
          category: 'mapping',
          message: `Canonical schema "${schema.id}" requires unresolved schemas: ${missing.join(', ')}`,
          details: { id: schema.id, missingRequires: missing },
        })
      }
    }

    // strict mode: throw on duplicate; non-strict: idempotent return false
    if (this.schemas.has(schema.id)) {
      if (options.strict) {
        throw createBrokerError({
          code: 'canonical.id.duplicate',
          category: 'mapping',
          message: `Canonical schema id "${schema.id}" is already registered.`,
          details: { id: schema.id },
        })
      }
      return false
    }

    this.schemas.set(schema.id, schema)
    for (const listener of this.listeners) {
      try {
        listener(schema)
      } catch {
        // T-02-03-01: swallow per isolare listener (pattern TopicRegistry F1)
      }
    }
    return true
  }

  /**
   * Verifica se uno schema con il dato id è registrato.
   *
   * @param id - Id branded del canonical schema.
   * @returns `true` se registrato, `false` altrimenti.
   */
  has(id: CanonicalSchemaId): boolean {
    return this.schemas.has(id)
  }

  /**
   * Recupera lo schema registrato.
   *
   * @param id - Id branded del canonical schema.
   * @returns Lo schema se presente, `undefined` altrimenti.
   */
  get(id: CanonicalSchemaId): CanonicalSchema | undefined {
    return this.schemas.get(id)
  }

  /**
   * Ritorna la lista degli id registrati ordinata alfabeticamente.
   *
   * Il return è una **copia** spread del Map interno: mutation esterna del result
   * NON corrompe lo state del registry (T-02-03-02 mitigation).
   *
   * @returns Array di id ordinato deterministicamente, fresca copia ad ogni chiamata.
   */
  list(): string[] {
    return [...this.schemas.keys()].sort()
  }

  /**
   * Registra un listener invocato su ogni nuovo `register` (observer pattern).
   *
   * Il listener riceve il `CanonicalSchema` completo. Throw del listener viene
   * swallowed (T-02-03-01 mitigation — pattern F1 TopicRegistry).
   *
   * @param listener - Funzione invocata su ogni nuovo register.
   * @returns Funzione `unsubscribe` idempotente.
   */
  onRegistered(listener: CanonicalRegistryListener): () => void {
    this.listeners.add(listener)
    return (): void => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Rimuove uno schema dal registry (D-26 ext F2 — cascade da plugin unregister).
   *
   * Nessuna cascade integrity policy in V1: schemi che dichiarano questo id in `requires`
   * rimangono registrati (deferred a V2 se servirà).
   *
   * @param id - Id branded del canonical schema.
   * @returns `true` se rimosso, `false` se id non esisteva.
   */
  unregister(id: CanonicalSchemaId): boolean {
    return this.schemas.delete(id)
  }
}
