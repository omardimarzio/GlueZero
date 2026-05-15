/**
 * `combineSignals` — Helper interno OR-merge di N `AbortSignal` (carryover F9
 * `packages/mf-esm/src/internal/combine-signals.ts`).
 *
 * Replica locale per F15 W2 P02 (D-V2-F15-26 file ownership disgiunta — NO modifica
 * `packages/mf-esm/src/` per D-83 strict OCTUPLE indirect coverage). Pattern stretto
 * F9 D-V2-F9-10/11 → F15 D-V2-F15-06 carryover whenDefined race + import(url) timeout.
 *
 * Modifiche al file F9 DEVONO essere propagate qui via diff manuale (no auto-sync).
 *
 * **Riferimento decisioni:**
 * - D-V2-F15-06 (whenDefined + AbortSignal.timeout 15000ms default) — usa OR-merge
 *   `combineSignals(ctx.signal, AbortSignal.timeout(timeoutMs))` per discriminate
 *   timeout vs consumer cancel cascade.
 * - D-V2-F15-07 (ESM-only via import(url)) — stesso pattern F9 esm-loader.ts.
 * - D-V2-F9-10 (OR-merge — carryover): qualunque dei N signal aborta → composite
 *   aborta con `signal.reason` preservato.
 * - D-V2-F9-11 (location internal/): helper interno, NON re-esportato dal barrel
 *   `src/index.ts` per restare tree-shake-friendly + ridurre surface API pubblica.
 *
 * **Threat coverage:**
 * - Listener leak su composite long-lived: mitigato via `cleanup()` esplicito
 *   dopo abort (carryover F9 WR-11 fix iter 2).
 *
 * @internal Helper privato — NON esportato dal barrel.
 */

/**
 * Coordina N signal in un singolo `AbortSignal` composito via OR-merge.
 *
 * Usa `AbortSignal.any()` nativo quando disponibile (Chrome 116+, Safari 17.4+,
 * Firefox 124+ — baseline ES2024). Altrimenti compone manualmente via
 * `AbortController` con listener + cleanup esplicito.
 *
 * Le entry `undefined` sono filtrate: utile per chiamate
 * `combineSignals(ctx.signal, AbortSignal.timeout(timeoutMs))` dove `ctx.signal`
 * può essere opzionale.
 *
 * @param signals - 0 o più `AbortSignal | undefined`. Le entry `undefined` sono ignorate.
 * @returns `AbortSignal` composito che aborta al primo abort tra le N entry valide.
 *
 * @example Compose consumer ctx.signal + timeout interno (wc-loader pattern)
 * ```ts
 * const composite = combineSignals(ctx.signal, AbortSignal.timeout(15000))
 * await Promise.race([customElements.whenDefined(name), abortPromise(composite)])
 * ```
 *
 * @example Zero args → ritorna AbortSignal non-aborted (sentinel)
 * ```ts
 * const composite = combineSignals()
 * console.log(composite.aborted) // false
 * ```
 *
 * @see D-V2-F15-06 (whenDefined + AbortSignal.timeout)
 * @see packages/mf-esm/src/internal/combine-signals.ts (F9 source carryover)
 */
export function combineSignals(...signals: ReadonlyArray<AbortSignal | undefined>): AbortSignal {
  const real = signals.filter((s): s is AbortSignal => s !== undefined)
  // Native AbortSignal.any (ES2024) — preferito per evitare leak listener.
  const Native = (AbortSignal as unknown as { any?: (s: readonly AbortSignal[]) => AbortSignal })
    .any
  if (typeof Native === 'function') return Native.call(AbortSignal, real)
  // Polyfill manuale per ES2022 target.
  const composite = new AbortController()
  const handlers: Array<{ readonly sig: AbortSignal; readonly fn: () => void }> = []
  const cleanup = (): void => {
    for (const h of handlers) h.sig.removeEventListener('abort', h.fn)
    handlers.length = 0
  }
  for (const sig of real) {
    if (sig.aborted) {
      composite.abort(sig.reason)
      cleanup()
      return composite.signal
    }
    const fn = (): void => {
      composite.abort(sig.reason)
      cleanup()
    }
    sig.addEventListener('abort', fn, { once: true })
    handlers.push({ sig, fn })
  }
  composite.signal.addEventListener('abort', cleanup, { once: true })
  return composite.signal
}
