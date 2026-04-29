// MappingErrorCode — literal union dei codici errore mapper F2 (D-58, REQ ERR-02 ext).
//
// Riferimento decisioni (02-CONTEXT.md):
// - D-58: i 5 codici emessi via `BrokerEvent 'mapping.error'` con payload
//         `{ error, sourceEvent, step }`.
// - D-59: F2 NON pubblica `<topic>.failed` (quello è F3 route HTTP failure).
//
// I codici sono tutti `category: 'mapping'` (già definita in F1 `ErrorCategory` union).
// NON un nuovo BrokerError subclass — riusa `BrokerError` di F1 con `code` settato a uno
// di questi literal. Helper `isMappingErrorCode` permette runtime narrowing.
//
// Threat coverage:
// - T-02-02-05 (Repudiation — codici aggiunti senza version bump): la literal union è
//   additive (aggiungere codici è non-breaking; rimuoverli sì). Documentazione DOC-03 al
//   plan 02-12 specifica policy.

/**
 * Literal union dei codici errore F2 (D-58).
 *
 * - `'mapping.cycle.detected'` — circular mapping al `registerPlugin` (D-35)
 * - `'mapping.transform.failed'` — transform throw + onFailure 'block' (D-44, D-45)
 * - `'mapping.field.missing'` — field required:true mancante nel source (D-42)
 * - `'mapping.canonical.validation.failed'` — Valibot validation fail al passo 6 (D-39)
 * - `'mapping.consumer.validation.failed'` — Valibot validation fail al passo 12 (D-39)
 *
 * Tutti pubblicati via `BrokerEvent 'mapping.error'` (D-58, REQ ERR-02 extension).
 */
export type MappingErrorCode =
  | 'mapping.cycle.detected'
  | 'mapping.transform.failed'
  | 'mapping.field.missing'
  | 'mapping.canonical.validation.failed'
  | 'mapping.consumer.validation.failed'

const MAPPING_ERROR_CODES: ReadonlySet<string> = new Set<MappingErrorCode>([
  'mapping.cycle.detected',
  'mapping.transform.failed',
  'mapping.field.missing',
  'mapping.canonical.validation.failed',
  'mapping.consumer.validation.failed',
])

/**
 * Type guard runtime per `MappingErrorCode`.
 *
 * Utile per branchare comportamento basato su `error.code` quando si subscribe a `mapping.error`.
 *
 * @example
 * ```ts
 * broker.subscribe('mapping.error', (event) => {
 *   const code = event.payload.error.code
 *   if (isMappingErrorCode(code)) {
 *     // safe narrow: code is MappingErrorCode
 *   }
 * })
 * ```
 */
export function isMappingErrorCode(code: string): code is MappingErrorCode {
  return MAPPING_ERROR_CODES.has(code)
}
