// combine-signals.ts — helper interno per OR-merge di N AbortSignal (carryover F9 D-V2-F9-10/11).
//
// Replica locale di `packages/mf-esm/src/internal/combine-signals.ts` (§6.3 dependency
// direction: @gluezero/mf-module-federation NON dipende da @gluezero/mf-esm, quindi
// replica locale ~35 LoC accettabile, ~120 B bundle). Modifiche al file mf-esm DEVONO
// essere propagate qui via diff manuale (no auto-sync).
//
// Riferimento decisioni:
// - D-V2-F9-10 (OR-merge): qualunque dei N signal aborta → composite aborta con
//   `signal.reason` preservato. Caller discrimina source per produrre error code
//   specifico (MF_REMOTE_ENTRY_LOAD_FAILED timeout vs aborted in `mf-loader.ts`).
// - D-V2-F9-11 (location internal/): helper interno, NON re-esportato dal barrel
//   `src/index.ts` per restare tree-shake-friendly + ridurre surface API pubblica.

/**
 * Coordina N signal in un singolo `AbortSignal` composito via OR-merge.
 *
 * Usa `AbortSignal.any()` nativo quando disponibile (Chrome 116+, Safari 17.4+,
 * Firefox 124+ — baseline ES2024). Altrimenti compone manualmente via
 * `AbortController` con listener `addEventListener('abort', ..., { once: true })` +
 * cleanup esplicito (carryover F9 mf-esm pattern).
 *
 * Se uno qualunque dei signal è già `aborted` al momento della creazione, il
 * composite è immediatamente abortito con la stessa `reason` preservata.
 *
 * Le entry `undefined` sono filtrate.
 *
 * @param signals - 0 o più `AbortSignal | undefined`. Le entry `undefined` sono ignorate.
 * @returns `AbortSignal` composito che aborta al primo abort tra le N entry valide.
 *
 * @example
 * ```ts
 * const composite = combineSignals(ctx.signal, AbortSignal.timeout(15000))
 * const factory = await Promise.race([mfRuntime.loadRemote(key), abortPromise(composite)])
 * ```
 *
 * @see F9 mf-esm `packages/mf-esm/src/internal/combine-signals.ts` (source carryover)
 */
export function combineSignals(...signals: ReadonlyArray<AbortSignal | undefined>): AbortSignal {
  const real = signals.filter((s): s is AbortSignal => s !== undefined)
  const Native = (AbortSignal as unknown as { any?: (s: readonly AbortSignal[]) => AbortSignal })
    .any
  if (typeof Native === 'function') return Native.call(AbortSignal, real)
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

/**
 * Promise che rifiuta quando `signal` aborta. Cleanup esplicito su settle.
 *
 * Carryover F9 mf-esm pattern.
 *
 * @internal Helper privato — NON esportato dal barrel.
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
