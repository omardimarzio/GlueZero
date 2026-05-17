/**
 * F12 W4 Task 1 — Tier-1 unit suite per `types/descriptor-augment.ts`.
 *
 * Carryover F11 P4: type narrowing `CompatAwareMfDescriptor extends MicroFrontendDescriptor`
 * + helper `getCompatibility(descriptor)` accessor sicuro.
 *
 * Coverage:
 *
 * - Test 1: `getCompatibility(descriptor)` con descriptor che dichiara `compatibility`
 *   ritorna l'oggetto.
 * - Test 2: `getCompatibility(descriptor)` con descriptor SENZA `compatibility?` ritorna
 *   `undefined`.
 * - Test 3: `getCompatibility(descriptor)` con `compatibility: {}` (empty) ritorna oggetto
 *   vuoto (NOT undefined).
 * - Test 4: `CompatAwareMfDescriptor` type narrowing — compile-time assignment safe.
 * - Test 5: `MicroFrontendCompatibility` ha 9 dimensioni readonly inference.
 *
 * @see plan 12-04 Task 1
 * @see types/descriptor-augment.ts
 */
import type { MicroFrontendDescriptor } from '@gluezero/microfrontends'
import { describe, expect, it } from 'vitest'
import type { CompatAwareMfDescriptor, MicroFrontendCompatibility } from '../types'
import { getCompatibility } from '../types/descriptor-augment'

describe('CompatAwareMfDescriptor + getCompatibility (carryover F11 P4)', () => {
  it("Test 1: getCompatibility ritorna l'oggetto compatibility se dichiarato", () => {
    const d = {
      id: 'mf-1',
      name: 'mf-1',
      version: '1.0.0',
      loader: { type: 'esm' as const, url: '/x.js' },
      compatibility: { gluezero: '^2.0.0' },
    } as unknown as MicroFrontendDescriptor
    expect(getCompatibility(d)).toEqual({ gluezero: '^2.0.0' })
  })

  it('Test 2: getCompatibility ritorna undefined se descriptor NON dichiara compatibility', () => {
    const d = {
      id: 'mf-1',
      name: 'mf-1',
      version: '1.0.0',
      loader: { type: 'esm' as const, url: '/x.js' },
    } as unknown as MicroFrontendDescriptor
    expect(getCompatibility(d)).toBeUndefined()
  })

  it('Test 3: getCompatibility ritorna oggetto vuoto se compatibility={}', () => {
    const d = {
      id: 'mf-1',
      name: 'mf-1',
      version: '1.0.0',
      loader: { type: 'esm' as const, url: '/x.js' },
      compatibility: {},
    } as unknown as MicroFrontendDescriptor
    expect(getCompatibility(d)).toEqual({})
    expect(getCompatibility(d)).not.toBeUndefined()
  })

  it('Test 4: CompatAwareMfDescriptor type narrowing compila correttamente', () => {
    const d = {
      id: 'x',
      name: 'x',
      version: '1.0.0',
      loader: { type: 'esm' as const, url: '/x.js' },
    } as unknown as MicroFrontendDescriptor
    const narrowed = d as CompatAwareMfDescriptor
    // Type check (compile-time): narrowed.compatibility è MicroFrontendCompatibility | undefined.
    const _check: MicroFrontendCompatibility | undefined = narrowed.compatibility
    expect(_check).toBeUndefined()
  })

  it('Test 5: MicroFrontendCompatibility ha 9 dimensioni dichiarabili', () => {
    const caps: MicroFrontendCompatibility = {
      gluezero: '^2.0.0',
      canonicalModels: { customer: '^1.0.0' },
      topics: { 'customer.order': '^1.0.0' },
      routes: { r1: '^1.0.0' },
      workers: { w1: '^1.0.0' },
      theme: { tokens: '^1.0.0', roles: '^1.0.0' },
      loaders: { esm: '^1.0.0' },
      framework: { name: 'react', version: '^19.0.0' },
      dependencies: { 'react-dom': '^19.0.0' },
    }
    expect(Object.keys(caps)).toHaveLength(9)
    // Readonly inference: il fact che `caps.gluezero = 'x'` produca TS error è
    // verificabile solo via `tsc --noEmit`. Qui verifichiamo solo che il valore
    // assegnato sia accessibile e match-able.
    expect(caps.gluezero).toBe('^2.0.0')
    expect(caps.framework?.name).toBe('react')
    expect(caps.theme?.tokens).toBe('^1.0.0')
  })

  it('Test 6: getCompatibility funziona con CompatAwareMfDescriptor narrowing dichiarativo', () => {
    const d: CompatAwareMfDescriptor = {
      id: 'mf-narrow',
      name: 'mf-narrow',
      version: '1.0.0',
      loader: { type: 'esm', url: '/x.js' },
      compatibility: {
        canonicalModels: { customer: '^1.0.0' },
        topics: { 'order.created': '^1.0.0' },
      },
    } as unknown as CompatAwareMfDescriptor
    const caps = getCompatibility(d)
    expect(caps).toBeDefined()
    expect(caps?.canonicalModels?.customer).toBe('^1.0.0')
    expect(caps?.topics?.['order.created']).toBe('^1.0.0')
  })
})
