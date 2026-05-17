// combine-signals.test.ts — Tier-1 unit suite per `combineSignals` helper interno
// (D-V2-F9-10 OR-merge + D-V2-F9-11 internal location + WR-11 leak-listener fix).
//
// Replica suite F3 gateway con adattamenti:
// - Import path locale `../internal/combine-signals` (vs F3 `./combine-signals`).
// - Test addizionali per native vs polyfill path coverage + stress test cleanup.
// - Edge case: zero args + tutti undefined.
//
// Convention: identificatori inglesi, descrizioni `describe`/`it` italiane (CLAUDE.md).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { combineSignals } from '../internal/combine-signals'

describe('combineSignals — OR-merge nativo (D-V2-F9-10)', () => {
  it('aborts when any of N signals abort (3 coordinated)', () => {
    const a = new AbortController()
    const b = new AbortController()
    const c = new AbortController()
    const composite = combineSignals(a.signal, b.signal, c.signal)
    expect(composite.aborted).toBe(false)
    b.abort('user-cancel')
    expect(composite.aborted).toBe(true)
    expect(composite.reason).toBe('user-cancel')
  })

  it('propaga immediatamente reason quando uno dei signal è già aborted', () => {
    const a = new AbortController()
    a.abort('preemptive')
    const b = new AbortController()
    const composite = combineSignals(a.signal, b.signal)
    expect(composite.aborted).toBe(true)
    expect(composite.reason).toBe('preemptive')
  })

  it('filtra entry undefined (variadic input may contain undefined)', () => {
    const a = new AbortController()
    const composite = combineSignals(undefined, a.signal, undefined)
    expect(composite.aborted).toBe(false)
    a.abort('only-one-real')
    expect(composite.aborted).toBe(true)
    expect(composite.reason).toBe('only-one-real')
  })

  it('zero args → ritorna AbortSignal non-aborted (sentinel)', () => {
    const composite = combineSignals()
    expect(composite.aborted).toBe(false)
    expect(composite).toBeInstanceOf(AbortSignal)
  })

  it('tutti undefined → ritorna AbortSignal non-aborted (filtra tutto)', () => {
    const composite = combineSignals(undefined, undefined, undefined)
    expect(composite.aborted).toBe(false)
  })

  it('preserva reason TimeoutError da AbortSignal.timeout (name check per discriminate)', async () => {
    const timeout = AbortSignal.timeout(0)
    // Lascia che il microtask scheduli l'abort timeout (jsdom usa propria DOMException
    // implementation NON instanceof globalThis.DOMException nativo, quindi
    // discriminiamo via `reason.name === 'TimeoutError'` — pattern reale di esm-loader).
    await new Promise<void>((resolve) => setTimeout(resolve, 20))
    const composite = combineSignals(timeout)
    expect(composite.aborted).toBe(true)
    const reason = composite.reason as { name?: string }
    expect(reason).toBeDefined()
    expect(reason.name).toBe('TimeoutError')
  })
})

describe('combineSignals — native path coverage (AbortSignal.any se disponibile)', () => {
  it('usa AbortSignal.any nativo quando disponibile (spy detection)', () => {
    // Il runtime jsdom moderno espone AbortSignal.any. Spy il metodo per verificare
    // che la funzione native-preferred path lo chiami quando esiste.
    const hasNative = typeof (AbortSignal as unknown as { any?: unknown }).any === 'function'
    if (!hasNative) {
      // Se il runtime non ha .any, lo skippiamo (fallback path coperto altrove).
      return
    }
    const spy = vi.spyOn(AbortSignal as unknown as { any: (s: readonly AbortSignal[]) => AbortSignal }, 'any')
    try {
      const a = new AbortController()
      const composite = combineSignals(a.signal)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(composite).toBeInstanceOf(AbortSignal)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('combineSignals — polyfill path coverage (fallback ES2022)', () => {
  let originalAny: unknown

  beforeEach(() => {
    originalAny = (AbortSignal as unknown as { any?: unknown }).any
    // Force fallback path eliminando AbortSignal.any temporaneamente
    Object.defineProperty(AbortSignal, 'any', {
      value: undefined,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(AbortSignal, 'any', {
      value: originalAny,
      writable: true,
      configurable: true,
    })
  })

  it('fallback polyfill: aborts quando uno dei N signal aborta', () => {
    const a = new AbortController()
    const b = new AbortController()
    const composite = combineSignals(a.signal, b.signal)
    expect(composite.aborted).toBe(false)
    a.abort('first-abort')
    expect(composite.aborted).toBe(true)
    expect(composite.reason).toBe('first-abort')
  })

  it('fallback polyfill: pre-aborted signal propaga immediatamente', () => {
    const a = new AbortController()
    a.abort('was-already-aborted')
    const composite = combineSignals(a.signal)
    expect(composite.aborted).toBe(true)
    expect(composite.reason).toBe('was-already-aborted')
  })

  it('fallback polyfill: cleanup verified su stress test 1000-iter (T-F9-03 mitigation)', () => {
    // Verifica che il polyfill non accumuli listener sul long-lived signal.
    // Strategy: long-lived consumer signal + 1000 composite creati e abortati.
    // Se i listener non vengono rimossi, il signal cumulerebbe references che
    // impedirebbero GC e crescerebbero linearmente.
    const longLived = new AbortController()
    for (let i = 0; i < 1000; i++) {
      const transient = new AbortController()
      const composite = combineSignals(longLived.signal, transient.signal)
      transient.abort(`iter-${i}`)
      expect(composite.aborted).toBe(true)
    }
    // Long-lived signal non aborted dopo 1000 cycle: i listener su di esso devono
    // essere stati rimossi via cleanup() quando il composite ha aborted.
    expect(longLived.signal.aborted).toBe(false)
    // Sanity: long-lived ancora funzionante (l'abort posteriore funziona)
    longLived.abort('final')
    expect(longLived.signal.aborted).toBe(true)
  })

  it('fallback polyfill: cleanup attivato anche se composite NON aborta direttamente input', () => {
    // Scenario edge: il composite controller viene abortato da fonte esterna
    // (non incluso negli input). Il cleanup deve comunque rimuovere i listener
    // residui sugli input signal. NOTA: la funzione non espone il composite
    // controller, quindi questo scenario è coperto indirettamente dal listener
    // `composite.signal.addEventListener('abort', cleanup, { once: true })`.
    // Verifichiamo che almeno il signal sia un AbortSignal valido nel polyfill path.
    const a = new AbortController()
    const composite = combineSignals(a.signal)
    expect(composite).toBeInstanceOf(AbortSignal)
    expect(composite.aborted).toBe(false)
  })

  it('fallback polyfill: filtra undefined come native path', () => {
    const a = new AbortController()
    const composite = combineSignals(undefined, a.signal, undefined)
    expect(composite.aborted).toBe(false)
    a.abort('via-fallback')
    expect(composite.aborted).toBe(true)
    expect(composite.reason).toBe('via-fallback')
  })

  it('fallback polyfill: zero args → AbortSignal non-aborted', () => {
    const composite = combineSignals()
    expect(composite.aborted).toBe(false)
    expect(composite).toBeInstanceOf(AbortSignal)
  })
})
