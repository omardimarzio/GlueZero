/**
 * `abortPromise` — Helper interno: Promise che rifiuta quando un `AbortSignal` aborta.
 *
 * Estratto da F9 `packages/mf-esm/src/esm-loader.ts:46-58` come modulo separato per
 * riusabilità in `wc-loader.ts` + `whenDefined-await.ts`. Carryover F9 pattern stretto
 * (D-V2-F15-06 + D-V2-F15-07).
 *
 * **Cleanup esplicito su settle** (`removeEventListener`) mitiga listener leak quando
 * il signal è long-lived ma `Promise.race` viene vinta dal happy path
 * (`customElements.whenDefined` resolve o `import(url)` success).
 *
 * @internal Helper privato — NON esportato dal barrel.
 *
 * @see D-V2-F15-06 — whenDefined race con composite signal
 * @see packages/mf-esm/src/esm-loader.ts (F9 inline helper carryover)
 */

/**
 * Crea una `Promise<never>` che rifiuta con `signal.reason` non appena `signal` aborta.
 *
 * Se il `signal` è già `aborted` al momento della call, rifiuta immediatamente.
 * Listener `addEventListener('abort', ..., { once: true })` + cleanup esplicito
 * via `removeEventListener` se la Promise viene risolta (vinta in Promise.race da
 * happy path) — evita listener leak su long-lived signal.
 *
 * @param signal - `AbortSignal` da osservare.
 * @returns `Promise<never>` che rifiuta su abort con `signal.reason`.
 *
 * @example Uso in Promise.race con import() (wc-loader pattern)
 * ```ts
 * const composite = combineSignals(ctx.signal, AbortSignal.timeout(15000))
 * const module = await Promise.race([
 *   import(url),
 *   abortPromise(composite),
 * ])
 * ```
 *
 * @example Uso in Promise.race con customElements.whenDefined
 * ```ts
 * const composite = combineSignals(ctx.signal, AbortSignal.timeout(15000))
 * const klass = await Promise.race([
 *   customElements.whenDefined(elementName),
 *   abortPromise(composite),
 * ])
 * ```
 *
 * @see D-V2-F15-06 — whenDefined + AbortSignal.timeout race
 */
export function abortPromise(signal: AbortSignal): Promise<never> {
  return new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = (): void => {
      signal.removeEventListener('abort', onAbort)
      reject(signal.reason)
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
