// combine-signals.ts — polyfill di `AbortSignal.any()` per target ES2022 (Pitfall 4 fix).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-77: il gateway combina N signal (subscriber + ownController + timeout) in un singolo
//   `AbortSignal` da passare a `fetch`. Pattern Pitfall 4 mitigation — chiusura PITFALLS #2.B.
// - Assumption A1 RESEARCH: target ES2022 nominale; `AbortSignal.any()` è ES2024 — non
//   universalmente disponibile. Questo polyfill usa `AbortSignal.any` se presente sul
//   runtime (Node 20.3+, Chromium 121+, Safari 17+) altrimenti compone via `AbortController`.
//
// Threat coverage:
// - T-03-08-01 (DoS — leak listener): la `addEventListener('abort', ..., { once: true })`
//   garantisce auto-cleanup del listener al primo abort.
// - T-03-08-02 (Tampering — reason cross-leak): preserviamo `signal.reason` originario via
//   `composite.abort(sig.reason)` — il caller può discriminare il source dell'abort.

/**
 * Coordina N signal in un singolo `AbortSignal` composito (D-77, Pitfall 4 fix).
 *
 * Usa `AbortSignal.any()` nativo quando disponibile (Node 20.3+, browser evergreen
 * recenti). Altrimenti compone manualmente via `AbortController` con listener
 * `addEventListener('abort', ..., { once: true })`.
 *
 * Se uno qualunque dei signal è già `aborted` al momento della creazione, il
 * composito è immediatamente abortito con la stessa `reason`.
 *
 * `undefined` entries sono filtrate: utile quando il caller passa un mix di signal
 * obbligatori e opzionali (es. `combineSignals(externalSignal, ownController.signal,
 * timeoutSignal)` dove `externalSignal` può essere `undefined`).
 *
 * @param signals - 0 o più `AbortSignal | undefined`. Le entry `undefined` sono ignorate.
 * @returns `AbortSignal` composito che abort al primo abort tra le N entry valide.
 *
 * @example
 * ```ts
 * const composite = combineSignals(externalSignal, ownController.signal, AbortSignal.timeout(5000))
 * await fetch(url, { signal: composite })
 * ```
 */
export function combineSignals(
  ...signals: ReadonlyArray<AbortSignal | undefined>
): AbortSignal {
  const real = signals.filter((s): s is AbortSignal => s !== undefined)
  // Native AbortSignal.any (ES2024) — preferito quando disponibile per evitare leak listener.
  const Native = (AbortSignal as unknown as { any?: (s: readonly AbortSignal[]) => AbortSignal })
    .any
  if (typeof Native === 'function') return Native.call(AbortSignal, real)
  // Polyfill manuale per ES2022 target.
  const composite = new AbortController()
  for (const sig of real) {
    if (sig.aborted) {
      composite.abort(sig.reason)
      break
    }
    sig.addEventListener('abort', () => composite.abort(sig.reason), { once: true })
  }
  return composite.signal
}
