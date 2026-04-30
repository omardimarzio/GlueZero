// valibotAdapter — implementazione default di ValidatorAdapter usando Valibot 1.x.
// (PRD §21.2, REQ VAL-03/VAL-04/VAL-07).
//
// Riferimento decisioni (02-CONTEXT.md):
// - D-37: Valibot 1.x come default. Già installato in F1 (packages/core/package.json:41)
//   e in F2 mapper (packages/mapper/package.json:41).
// - D-38: Adapter pluggable — interface `ValidatorAdapter` (vedi types/validator-adapter.ts).
//   V2 supporterà Zod/Ajv come adapter alternativi senza breaking change.
// - D-39: usato dal mapper-engine (plan 02-07) ai passi 6 (canonical validation) e 12
//   (final validation per consumer) della pipeline §28.
//
// Differenza con F1 `event-validator.ts` (Rule 4 — vedi 02-PATTERNS.md §6):
// F1 THROW al fail (`event.validation.failed` BrokerError). F2 NO throw — il caller
// decide cosa fare con il `{ ok: false, issues }` (publish `mapping.error`, applica
// D-44 onFailure 'block'/'skip'/'fallback' del field, ecc.).
//
// Issue mapping: subset di `BaseIssue` di Valibot mappato a `ValidationIssue`
// (types/validator-adapter.ts):
//   - path: BaseIssue.path è `[PathItem, ...PathItem[]]`; mappiamo a string[] readonly
//     tramite key extraction (`String(p.key)`).
//   - message: BaseIssue.message stringa human-readable.
//   - expected: BaseIssue.expected (es. 'string', 'number'), opzionale.
//   - received: BaseIssue.received (es. 'number', 'undefined'), opzionale.
//
// Threat coverage:
// - T-02-06-01 (DoS — schema malformato/non-Valibot causa exception in safeParse):
//   try/catch wrapper attorno a `v.safeParse` ritorna `ok: false` con singola issue.
// - T-02-06-02 (Information disclosure — issue messages contengono PII di payload):
//   accept, F2 V1; F6 Inspector con redaction sarà richiesto per produzione (DOC-03).
// - T-02-06-03 (Tampering — adapter muta payload): mitigate, `v.safeParse` ritorna
//   nuova reference su success (Valibot 1.x semantica); test 8 verifica invariant.
// - T-02-06-04 (Repudiation — issue path è `PathItem[]` non `string[]`): mitigate,
//   mapping esplicito `i.path.map(p => String(p.key))` produce `string[]` deterministic.
// - T-02-06-05 (DoS — schema con ricorsione infinita): accept, Valibot 1.x gestisce
//   internamente; trust nel runtime.

import * as v from 'valibot'
import type { ValidationIssue, ValidationResult, ValidatorAdapter } from './types/validator-adapter'

/**
 * Subset minimale di `v.BaseIssue` rilevante per il mapping a `ValidationIssue`.
 *
 * Estratto in interface locale per disaccoppiare il nostro mapping dalla sigla
 * generica di Valibot (`BaseIssue<TInput>` con generics complessi). La struttura
 * runtime di Valibot 1.x corrisponde a queste proprietà.
 */
interface ValibotIssue {
  readonly message: string
  readonly path?: ReadonlyArray<{ readonly key: PropertyKey }>
  readonly expected?: string
  readonly received?: string
}

/**
 * Mappa una `BaseIssue` di Valibot al subset `ValidationIssue` esposto dall'adapter.
 *
 * Costruisce l'oggetto in modo conditional-spread compatibile con
 * `exactOptionalPropertyTypes: true` (i field opzionali assenti NON sono `undefined`
 * espliciti).
 */
function mapIssue(issue: ValibotIssue): ValidationIssue {
  const result: { -readonly [K in keyof ValidationIssue]: ValidationIssue[K] } = {
    message: issue.message,
  }
  if (issue.path) {
    result.path = issue.path.map((p) => String(p.key))
  }
  if (issue.expected !== undefined) {
    result.expected = issue.expected
  }
  if (issue.received !== undefined) {
    result.received = issue.received
  }
  return result as ValidationIssue
}

/**
 * Default `ValidatorAdapter` usando Valibot 1.x (D-37).
 *
 * Pluggable: V2 supporterà Zod/Ajv via adapter alternativo (D-38). Il MapperEngine
 * (plan 02-07) accetta `validator: ValidatorAdapter` come dependency injection
 * — di default usa `valibotAdapter`.
 *
 * NO throw — sempre ritorna `ValidationResult` discriminato (D-38). Il caller decide
 * se trattare il fail come `mapping.error` (D-58) o applicare fallback policy D-44.
 *
 * @example (uso interno mapper-engine)
 * ```ts
 * import * as v from 'valibot'
 * const schema = v.object({ location: v.string(), forecast_date: v.string() })
 * const result = valibotAdapter.validate(schema, { location: 'Roma', forecast_date: '2026-04-30' })
 * if (result.ok) {
 *   // proceed with delivery
 * } else {
 *   broker.publish('mapping.error', { issues: result.issues, ... })
 * }
 * ```
 */
/**
 * WR-08 fix: type guard runtime per verificare che `schema` sia un BaseSchema Valibot.
 *
 * Valibot 1.x espone `~run` come function su tutti i BaseSchema (riferimento:
 * docs Valibot 1.x — `BaseSchema` interface). Controlliamo la presenza di questa
 * proprietà + `kind === 'schema'` come segnale che lo schema è valido per
 * `v.safeParse`. Un cast non-checked può silently passare un object `{}` all'
 * adapter e ritornare ok:true se Valibot non triggera throw — fail-fast invece.
 */
function isValibotSchema(s: unknown): s is v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> {
  if (typeof s !== 'object' || s === null) return false
  const obj = s as { kind?: unknown; '~run'?: unknown }
  return obj.kind === 'schema' && typeof obj['~run'] === 'function'
}

export const valibotAdapter: ValidatorAdapter = {
  validate<T = unknown>(schema: unknown, payload: unknown): ValidationResult<T> {
    // WR-08 fix: type guard preventivo — schema non-Valibot ritorna ok:false
    // immediato invece di rischiare un silent ok:true (es. schema = {} non triggera
    // throw in Valibot 1.x).
    if (!isValibotSchema(schema)) {
      return {
        ok: false,
        issues: [
          {
            message:
              'invalid schema: not a Valibot BaseSchema (missing `~run` function or kind !== "schema").',
          },
        ],
      }
    }
    // Wrap in try/catch per resilienza a schema malformato passato per errore
    // (T-02-06-01). Coerente con contract NO-throw documentato in JSDoc del
    // ValidatorAdapter interface.
    try {
      const result = v.safeParse(schema, payload)
      if (result.success) {
        return { ok: true, value: result.output as T }
      }
      const issues = result.issues.map((i) => mapIssue(i as ValibotIssue))
      return { ok: false, issues }
    } catch (err) {
      // Schema malformato in altro modo: ritorniamo ok: false con singola issue.
      return {
        ok: false,
        issues: [
          {
            message: err instanceof Error ? err.message : String(err),
          },
        ],
      }
    }
  },
}
