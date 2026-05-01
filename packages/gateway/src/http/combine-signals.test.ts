// combine-signals.test.ts — copre il polyfill di AbortSignal.any per ES2022 (Pitfall 4 fix).
//
// Behavior coperti (3 test):
// 1. 3 signal coordinati: abort di uno triggera abort dell'output composito.
// 2. Pre-aborted signal: l'output è già `aborted: true` dal momento della creazione.
// 3. `undefined` filtrate: la funzione accetta `(s | undefined)[]` e ignora gli `undefined`.

import { describe, expect, it } from 'vitest'
import { combineSignals } from './combine-signals'

describe('combine-signals.ts (AbortSignal.any polyfill — D-77, Pitfall 4)', () => {
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

  it('propagates immediately when one signal is already aborted', () => {
    const a = new AbortController()
    a.abort('preemptive')
    const b = new AbortController()
    const composite = combineSignals(a.signal, b.signal)
    expect(composite.aborted).toBe(true)
    expect(composite.reason).toBe('preemptive')
  })

  it('filters undefined entries (variadic input may contain undefined)', () => {
    const a = new AbortController()
    const composite = combineSignals(undefined, a.signal, undefined)
    expect(composite.aborted).toBe(false)
    a.abort('only-one-real')
    expect(composite.aborted).toBe(true)
    expect(composite.reason).toBe('only-one-real')
  })
})
