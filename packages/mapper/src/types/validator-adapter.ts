// ValidatorAdapter — interfaccia pluggable per la validazione (PRD §21.2, REQ VAL-03/VAL-04).
//
// Riferimento decisioni (02-CONTEXT.md):
// - D-37: Valibot 1.x come default (già installato in F1).
// - D-38: Adapter pluggable. Adapter Zod/Ajv deferred a V2.
// - D-39: validation injection 3 step pipeline §28 (3 sintassi F1, 6 canonical F2, 12 final F2).
//
// L'adapter è agnostico dello schema (Valibot, Zod, Ajv, custom) — il caller passa lo schema
// nel formato atteso dall'adapter. Il return è una discriminated union così il caller decide
// cosa fare con i risultati (publish `mapping.error`, applica fallback, ecc.).
//
// VINCOLO: NO throw. L'adapter ritorna `{ ok: false, issues }` su fail. Solo il caller
// (mapper-engine al passo 6/12) decide se publish `mapping.error` o applicare D-44 onFailure.
// Differenza con `validateEvent` di F1 (`event-validator.ts`) che invece THROW al fail —
// qui l'adapter è più granulare per supportare `onFailure: 'skip'/'fallback'` (D-44).
//
// Threat coverage:
// - T-02-02-04 (DoS — adapter throw inattesa): contract NO-throw documentato. I 3 adapter
//   ufficiali (Valibot V1, Zod/Ajv V2) wrappano internamente try/catch. Implementazione
//   concreta del Valibot adapter in plan 02-06.

/**
 * Issue di validazione (subset di Valibot.Issue per ergonomia cross-adapter).
 *
 * Mantenuto minimale per essere mappabile da Zod/Ajv adapters in V2 senza breaking change.
 * `path` è la dot-path al field invalido (es. `['user', 'email']`).
 */
export interface ValidationIssue {
  readonly path?: readonly string[]
  readonly message: string
  readonly expected?: string
  readonly received?: string
}

/**
 * Risultato discriminato di una validazione (D-38).
 *
 * Pattern result-object invece di throw: il caller decide se trattare il fail come
 * `mapping.error` (D-58) o applicare fallback policy D-44.
 *
 * @typeParam T - Tipo atteso del valore validato (default `unknown` quando lo schema è opaco).
 */
export type ValidationResult<T = unknown> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] }

/**
 * ValidatorAdapter pluggable (D-37, D-38).
 *
 * Default `valibotAdapter` esportato dal barrel mapper (plan 02-06). V2 supporterà
 * Zod/Ajv come adapter alternativi senza breaking change al contract.
 *
 * NO throw — sempre ritorna ValidationResult.
 *
 * @example (uso interno mapper-engine plan 02-07)
 * ```ts
 * const result = validator.validate(canonicalSchema, payload)
 * if (!result.ok) {
 *   broker.publish('mapping.error', {
 *     issues: result.issues,
 *     sourceEvent: ev.id,
 *     step: 'event.canonical.validated',
 *   })
 *   return  // skip delivery
 * }
 * ```
 */
export interface ValidatorAdapter {
  validate<T = unknown>(schema: unknown, payload: unknown): ValidationResult<T>
}
