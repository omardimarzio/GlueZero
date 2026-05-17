// combine-signals.ts — helper interno per OR-merge di N AbortSignal (D-V2-F9-10/11).
//
// Replica locale di `packages/gateway/src/http/combine-signals.ts` (§6.3 dependency
// direction: @gluezero/mf-esm NON dipende da @gluezero/gateway, quindi replica locale
// ~35 LoC accettabile, ~120 B bundle). Modifiche al file gateway DEVONO essere
// propagate qui via diff manuale (no auto-sync). Audit-grep gate per drift:
//   diff <(grep -E "^(export|function|const|return|if|for|composite|handlers|cleanup)" \
//          packages/gateway/src/http/combine-signals.ts) \
//        <(grep -E "^(export|function|const|return|if|for|composite|handlers|cleanup)" \
//          packages/mf-esm/src/internal/combine-signals.ts)
//
// Riferimento decisioni (09-CONTEXT.md + 03-CONTEXT.md):
// - D-V2-F9-10 (OR-merge): qualunque dei N signal aborta → composite aborta con
//   `signal.reason` preservato. Caller discrimina source del reason (es. timeout vs
//   consumer cancel) per produrre code errore specifico (MF_LOADER_TIMEOUT vs
//   MF_LOADER_ABORTED in `esm-loader.ts`).
// - D-V2-F9-11 (location internal/): helper interno, NON re-esportato dal barrel
//   `src/index.ts` per restare tree-shake-friendly + ridurre surface API pubblica.
// - D-77 (carryover F3 gateway): pattern stabilito per coordinare N signal in fetch.
//
// Threat coverage:
// - T-F9-03 (DoS — listener leak su composite signal): mitigato via `cleanup()`
//   esplicito dopo abort, replica WR-11 iter 2 fix (analogo T-03-08-01 F3).
// - T-F9-04 (Tampering — signal.reason cross-leak): mitigato propagando reason dal
//   signal sorgente che ha aborted (analogo T-03-08-02 F3).
//
// WR-11 fix iter 2 (leak listener parziale, polyfill path):
// - Se IL COMPOSITE aborta per qualsiasi causa (input signal aborta o caller chiama
//   abort upstream), rimuoviamo TUTTI i listener residui sugli input signal → no leak.
// - Scenario residuo (mitigato ma non eliminato): se tutti gli input signal sono
//   long-lived e il composite NON aborta (es. import() completa con successo), i
//   listener sugli input signal restano fino a che gli input non aborti. Per
//   long-lived external signal con N import successo concatenate, il caller deve
//   preferire `AbortSignal.any` nativo (ES2024) che non leak. Eliminazione completa
//   richiederebbe un'API breaking ritornante `{ signal, dispose }` — trade-off
//   rinviato a V2.1 se profiling rivela impatto reale.

/**
 * Coordina N signal in un singolo `AbortSignal` composito via OR-merge (D-V2-F9-10).
 *
 * Usa `AbortSignal.any()` nativo quando disponibile (Chrome 116+, Safari 17.4+,
 * Firefox 124+ — baseline ES2024). Altrimenti compone manualmente via
 * `AbortController` con listener `addEventListener('abort', ..., { once: true })` +
 * cleanup esplicito (WR-11 fix iter 2 — replica F3 gateway).
 *
 * Se uno qualunque dei signal è già `aborted` al momento della creazione, il
 * composite è immediatamente abortito con la stessa `reason` preservata.
 *
 * Le entry `undefined` sono filtrate: utile per chiamate `combineSignals(ctx.signal,
 * AbortSignal.timeout(timeoutMs))` dove `ctx.signal` può essere opzionale.
 *
 * @param signals - 0 o più `AbortSignal | undefined`. Le entry `undefined` sono ignorate.
 * @returns `AbortSignal` composito che aborta al primo abort tra le N entry valide.
 *
 * @example
 * ```ts
 * // Compose consumer ctx.signal + timeout interno (esm-loader pattern)
 * const composite = combineSignals(ctx.signal, AbortSignal.timeout(15000))
 * const module = await Promise.race([import(url), abortPromise(composite)])
 * ```
 *
 * @example
 * ```ts
 * // Caso edge: zero args → ritorna AbortSignal non-aborted (sentinel)
 * const composite = combineSignals()
 * console.log(composite.aborted) // false
 * ```
 *
 * @see D-V2-F9-10 (OR-merge), D-V2-F9-11 (internal location)
 * @see F3 gateway `packages/gateway/src/http/combine-signals.ts` (source verbatim)
 */
export function combineSignals(...signals: ReadonlyArray<AbortSignal | undefined>): AbortSignal {
  const real = signals.filter((s): s is AbortSignal => s !== undefined)
  // Native AbortSignal.any (ES2024) — preferito quando disponibile per evitare leak listener.
  const Native = (AbortSignal as unknown as { any?: (s: readonly AbortSignal[]) => AbortSignal })
    .any
  if (typeof Native === 'function') return Native.call(AbortSignal, real)
  // Polyfill manuale per ES2022 target.
  // WR-11 fix iter 2: track listener registrati per cleanup quando il composite aborta.
  // Senza cleanup, su long-lived external signal (es. consumer ctx.signal globale) i
  // listener si accumulano linearmente con N import → memory leak. Soluzione: quando
  // il composite aborta (per qualsiasi causa), rimuoviamo tutti i listener sui signal
  // di input residui.
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
  // Cleanup anche se il composite viene abortito da fonte esterna (es. caller chiama
  // controller.abort sul controller upstream non incluso in `signals`). Listener
  // self-cleanup via { once: true }.
  composite.signal.addEventListener('abort', cleanup, { once: true })
  return composite.signal
}
