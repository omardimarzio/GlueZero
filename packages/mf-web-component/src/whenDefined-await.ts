/**
 * `awaitDefined` — Helper Promise.race per `customElements.whenDefined(elementName)`
 * con `AbortSignal.timeout(timeoutMs)` cascade composite (D-V2-F15-06 lockato — carryover
 * F9 D-V2-F9-09/10/11 pattern).
 *
 * Lo step `whenDefined` segue lo step `import(definition.url)` in `wc-loader.ts`. Il
 * side-effect `customElements.define()` viene eseguito durante module evaluation
 * dell'`import(url)`, dunque `whenDefined` risolverà immediatamente nel happy path.
 * La race protegge da moduli che NON registrano l'element (timeout scatta →
 * `MF_WC_DEFINE_TIMEOUT`).
 *
 * **Discriminate timeout vs abort:**
 * - `composite.reason.name === 'TimeoutError'` → `MF_WC_DEFINE_TIMEOUT`
 * - altro reason → consumer abort → rethrow `AbortError` (caller può discriminare
 *   in alto via `signal.reason.name`).
 *
 * @see D-V2-F15-06 — customElements.whenDefined + AbortSignal.timeout 15000ms default
 * @see packages/mf-esm/src/esm-loader.ts (F9 template diretto carryover)
 */
import { abortPromise } from './internal/abort-promise'
import { combineSignals } from './internal/combine-signals'
import { createMfWebComponentError } from './errors'

/**
 * Default timeout `customElements.whenDefined` (D-V2-F15-06 + carryover F9 D-V2-F9-01).
 *
 * 15000 ms baseline coerente con PRD §23.4 (import timeout default). Override per-MF
 * via `descriptor.loader.timeoutMs`.
 */
const DEFAULT_TIMEOUT_MS = 15000

/**
 * Attende che `elementName` sia registrato come custom element via `customElements.define()`,
 * con timeout interno + composito `ctx.signal`.
 *
 * Se `timeoutMs` <= 0 o non finito → tratta come default 15000 ms (defensive — evita
 * timeout 0 che fire immediato e bloccherebbe ogni load).
 *
 * @param elementName - Nome del custom element atteso (kebab-case, deve contenere `-`).
 * @param ctxSignal - `AbortSignal` consumer opzionale (cascade da `LoaderContext.signal`).
 * @param timeoutMs - Timeout in millisecondi (default 15000). Valori non-finiti o <=0
 *   fall-back al default.
 * @returns `CustomElementConstructor` registrato.
 *
 * @throws `MfWebComponentError` con `code: 'MF_WC_DEFINE_TIMEOUT'` se l'element non
 *   viene definito entro `timeoutMs`. Details: `{elementName, timeoutMs, elapsedMs}`.
 * @throws Rethrow `AbortError` raw se `ctxSignal` aborta prima del timeout (caller
 *   discrimina via `err.name === 'AbortError'`).
 *
 * @example Happy path — element già definito
 * ```ts
 * // Module load + customElements.define già eseguito
 * const klass = await awaitDefined('mf-dashboard', ctx.signal, 15000)
 * ```
 *
 * @example Timeout → MF_WC_DEFINE_TIMEOUT
 * ```ts
 * try {
 *   await awaitDefined('mf-broken', ctx.signal, 50)
 * } catch (err) {
 *   // err.code === 'MF_WC_DEFINE_TIMEOUT'
 *   // err.details.elementName === 'mf-broken'
 * }
 * ```
 *
 * @example Defensive — timeoutMs <= 0 trattato come default
 * ```ts
 * await awaitDefined('mf-x', undefined, 0) // de facto usa 15000 ms
 * ```
 *
 * @see D-V2-F15-06 — whenDefined + AbortSignal.timeout
 */
export async function awaitDefined(
  elementName: string,
  ctxSignal: AbortSignal | undefined,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<CustomElementConstructor> {
  const effectiveTimeoutMs =
    typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : DEFAULT_TIMEOUT_MS

  const startedAt =
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()

  const timeoutSignal = AbortSignal.timeout(effectiveTimeoutMs)
  const composite = combineSignals(ctxSignal, timeoutSignal)

  try {
    const klass = (await Promise.race([
      customElements.whenDefined(elementName),
      abortPromise(composite),
    ])) as CustomElementConstructor
    return klass
  } catch (err) {
    if (composite.aborted) {
      const reason = composite.reason as { name?: string } | undefined
      const isTimeout = reason !== undefined && reason.name === 'TimeoutError'
      const elapsedMs =
        (typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now()) - startedAt
      if (isTimeout) {
        throw createMfWebComponentError({
          code: 'MF_WC_DEFINE_TIMEOUT',
          message: `customElements.whenDefined("${elementName}") timeout dopo ${effectiveTimeoutMs} ms (elapsed ${elapsedMs.toFixed(0)} ms)`,
          details: { elementName, timeoutMs: effectiveTimeoutMs, elapsedMs },
        })
      }
      // Consumer abort → rethrow raw AbortError (caller discrimina via err.name).
      throw err
    }
    // Errori imprevisti — propaga as-is.
    throw err
  }
}
