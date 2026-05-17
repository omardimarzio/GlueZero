/**
 * F12 W3 — Tier-1 barrel sanity test per `@gluezero/compat` index.ts.
 *
 * Wiring sanity W3 (plan 12-03 closure): verifica che il barrel `src/index.ts`
 * esponga la surface completa public (compatModule factory + types + engine +
 * registry + error + topics) e NON re-esponga i internal helpers
 * (`wrapServiceWithCompat`, `wireLifecycleHooks`, `enforceCompatPolicy`,
 * `createSemverChecker`).
 *
 * @see plan 12-03 Task 3 closure
 * @see packages/compat/src/index.ts (barrel W3 completo)
 */
import { describe, expect, it } from 'vitest'
import * as compatBarrel from '../index'

describe('@gluezero/compat barrel surface W3 sanity (plan 12-03 closure)', () => {
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

  it('exports W2 public surface (engine + registry + error + topics)', () => {
    expect(typeof (compatBarrel as any).createCheckEngine).toBe('function')
    expect(typeof (compatBarrel as any).createVersionRegistry).toBe('function')
    expect(typeof (compatBarrel as any).createCompatError).toBe('function')
    expect(typeof (compatBarrel as any).publishCompatTopics).toBe('function')
    expect(Array.isArray((compatBarrel as any).MF_COMPAT_TOPICS)).toBe(true)
  })

  it('exports W3 compatModule factory + types (plan 12-03)', () => {
    expect(typeof (compatBarrel as any).compatModule).toBe('function')
  })

  it('does NOT re-export internal helpers (enforcement-points / lifecycle-hooks / policy-dispatch / semver-checker)', () => {
    const keys = Object.keys(compatBarrel)
    expect(keys.some((k) => k === 'wrapServiceWithCompat')).toBe(false)
    expect(keys.some((k) => k === 'wireLifecycleHooks')).toBe(false)
    expect(keys.some((k) => k === 'enforceCompatPolicy')).toBe(false)
    expect(keys.some((k) => k === 'createSemverChecker')).toBe(false)
  })
})
