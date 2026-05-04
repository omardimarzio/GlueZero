// types/progress-payload.ts — schema canonical del progress payload (D-136).
//
// Riferimento decisioni (05-CONTEXT.md):
// - D-136: schema canonical `{ value, message?, partialResult? }` per il payload
//   di progress events emessi dal worker handler verso il broker. Validato via
//   Valibot a runtime in `WorkerHandler` prima di publish (Wave 4 plan 05-06).
// - D-138: il progress payload passa attraverso il mapper F2 (Map server→canonical)
//   come ogni altro evento — il worker emette canonical raw, il mapper resolve
//   eventuali alias F2 nel CanonicalRegistry.
//
// Il payload è registrato come canonical type nel `CanonicalRegistry` F2 al
// register del worker route (Wave 4 plan 05-06 — `__progress__` topic schema).
//
// Pattern role-match con `packages/gateway/src/sse-ws/types/frame-envelope.ts`:
// shape stretto + JSDoc decisionali su contract.

/**
 * Progress payload canonical schema (D-136).
 *
 * Emesso dal `WorkerHandler` ad ogni `onProgress` callback proxied via Comlink
 * (D-135 callback proxy pattern). Pubblicato sul topic
 * `<topic-prefix>.progress` (D-146 auto-derive) o
 * `RouteWorkerDefinition.publishes.progress` (override). Throttled con policy
 * latest-only window `progressThrottleMs` (D-137 default 100ms).
 *
 * Validazione runtime via Valibot prima del publish — payload non-conformi
 * (es. `value` < 0 o > 1, `value` NaN) vengono filtrati con `system.warn`.
 *
 * Contract:
 * - `value` — fraction 0..1 (NON percentage 0..100). Validato `Number.isFinite`
 *   + range check `0 ≤ value ≤ 1`.
 * - `message` — opzionale, label human-readable (es. `'Parsing CSV row 5000/10000'`).
 *   Cap 256 char opzionale (Valibot validation).
 * - `partialResult` — opzionale, preview parziale del risultato (es. partial
 *   parsed records) — NON garantito serializzabile via SCA, è responsabilità
 *   del worker producer assicurarsi del shape (debug only).
 *
 * @example
 * ```ts
 * const progress: ProgressPayload = {
 *   value: 0.5,
 *   message: 'Parsing CSV row 5000/10000',
 *   partialResult: { rowsProcessed: 5000 },
 * }
 * ```
 */
export interface ProgressPayload {
  /** Fraction 0..1 (NON percentage). */
  readonly value: number
  /** Optional label human-readable (es. `'Parsing CSV row 5000/10000'`). */
  readonly message?: string
  /** Optional preview parziale del risultato (debug-only — no SCA contract guarantee). */
  readonly partialResult?: unknown
}
