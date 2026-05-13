/**
 * F12 W2 Task 3 — Tier-1 barrel sanity test per `@gluezero/compat` index.ts.
 *
 * Wiring sanity W2: verifica che il barrel `src/index.ts` esponga solo le surface
 * pubbliche W1 (`__compatAugmentLoaded`, `getCompatibility`, `GLUEZERO_VERSION`) e
 * NON re-esponga i symbol privati W2 (engine/registry/policy-dispatch/compat-error).
 *
 * NOTA: questo test sarà aggiornato in plan 12-03 quando il barrel completerà i
 * re-export pubblici (compatModule factory + createCompatError + createCheckEngine
 * etc.). Per ora il barrel resta minimale (placeholder W2 commentati in index.ts:80-86).
 *
 * @see plan 12-02 Task 3 Step B
 * @see packages/compat/src/index.ts (barrel W1 minimale)
 */
import { describe, expect, it } from 'vitest'
import * as compatBarrel from '../index'

describe('@gluezero/compat barrel surface W2 sanity', () => {
  it('exports __compatAugmentLoaded marker (audit-grep gate Pattern S1)', () => {
    expect(compatBarrel.__compatAugmentLoaded).toBe(true)
  })

  it('exports getCompatibility helper (W1 carryover F11 P4 type narrowing)', () => {
    expect(typeof compatBarrel.getCompatibility).toBe('function')
  })

  it('exports GLUEZERO_VERSION build-time const (OQ-5 resolved)', () => {
    expect(typeof compatBarrel.GLUEZERO_VERSION).toBe('string')
    expect(compatBarrel.GLUEZERO_VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('does NOT re-export internal helpers W2 (engine/registry/policy/compat-error)', () => {
    // W2 placeholder — barrel completato in plan 12-03 (compatModule factory etc.).
    // Verifica corrente: solo augment marker + types + helper W1.
    const keys = Object.keys(compatBarrel)
    expect(keys.some((k) => k.includes('Registry') || k.includes('Engine'))).toBe(false)
    expect(keys.some((k) => k.includes('createCompatError'))).toBe(false)
    expect(keys.some((k) => k.includes('enforceCompatPolicy'))).toBe(false)
  })
})
