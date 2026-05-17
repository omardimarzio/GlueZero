/**
 * `policy-resolver.test.ts` — Tier-1 unit suite (jsdom) per resolver + cache.
 *
 * Cover REQ-IDs: MF-ISO-01 (7-key policy resolver + partial-merge per chiave).
 *
 * 8 test totali:
 *  1. Default-only (no inputs)
 *  2. policyDefault override singola chiave
 *  3. declared prevale su policyDefault (stessa chiave)
 *  4. Partial-merge per chiave (declared + policyDefault key diversi)
 *  5. Options merge oggetto piatto (declared + policyDefault)
 *  6. Options override declared prevale a parità di key
 *  7. Edge: empty partials `{}` → tutti 7 default
 *  8. PolicyCache set/get/delete/clear + abortSignal cleanup cascade
 */
import { describe, expect, test } from 'vitest'
import {
  DEFAULT_ISOLATION_POLICY,
  resolvePolicy,
} from './policy-resolver.js'
import { createPolicyCache } from './internal/policy-cache.js'

describe('resolvePolicy — 3-layer merge (default + policyDefault + declared)', () => {
  test('1. returns DEFAULT_ISOLATION_POLICY when no declared and no policyDefault', () => {
    const resolved = resolvePolicy(undefined, undefined, 'mf-1')
    expect(resolved).toEqual(DEFAULT_ISOLATION_POLICY)
    // Shape integrity — tutti i 7 campi + options presenti.
    expect(resolved.dom).toBe('mount-root')
    expect(resolved.css).toBe('scoped')
    expect(resolved.js).toBe('shared-window')
    expect(resolved.events).toBe('broker-only')
    expect(resolved.storage).toBe('shared')
    expect(resolved.network).toBe('direct-allowed')
    expect(resolved.globals).toBe('allowed')
    expect(resolved.options).toEqual({})
  })

  test('2. policyDefault overrides single key, others fall back to DEFAULT', () => {
    const resolved = resolvePolicy(
      undefined,
      { dom: 'shadow-dom' },
      'mf-1',
    )
    expect(resolved.dom).toBe('shadow-dom')
    // Altri 6 campi restano default.
    expect(resolved.css).toBe(DEFAULT_ISOLATION_POLICY.css)
    expect(resolved.js).toBe(DEFAULT_ISOLATION_POLICY.js)
    expect(resolved.events).toBe(DEFAULT_ISOLATION_POLICY.events)
    expect(resolved.storage).toBe(DEFAULT_ISOLATION_POLICY.storage)
    expect(resolved.network).toBe(DEFAULT_ISOLATION_POLICY.network)
    expect(resolved.globals).toBe(DEFAULT_ISOLATION_POLICY.globals)
  })

  test('3. declared prevails over policyDefault for the same key (per-MF wins)', () => {
    const resolved = resolvePolicy(
      { dom: 'iframe' },
      { dom: 'shadow-dom' },
      'mf-1',
    )
    expect(resolved.dom).toBe('iframe')
  })

  test('4. partial-merge per chiave: declared + policyDefault different keys', () => {
    const resolved = resolvePolicy(
      { css: 'shadow-dom' },
      { dom: 'shadow-dom' },
      'mf-1',
    )
    expect(resolved.dom).toBe('shadow-dom') // policyDefault
    expect(resolved.css).toBe('shadow-dom') // declared
    // Altre 5 chiavi default.
    expect(resolved.js).toBe(DEFAULT_ISOLATION_POLICY.js)
    expect(resolved.events).toBe(DEFAULT_ISOLATION_POLICY.events)
    expect(resolved.storage).toBe(DEFAULT_ISOLATION_POLICY.storage)
    expect(resolved.network).toBe(DEFAULT_ISOLATION_POLICY.network)
    expect(resolved.globals).toBe(DEFAULT_ISOLATION_POLICY.globals)
  })

  test('5. options merge oggetto piatto (declared + policyDefault chiavi disgiunte)', () => {
    const resolved = resolvePolicy(
      { options: { a: 1 } },
      { options: { b: 2 } },
      'mf-1',
    )
    expect(resolved.options).toEqual({ a: 1, b: 2 })
  })

  test('6. options override: declared prevale a parità di key', () => {
    const resolved = resolvePolicy(
      { options: { a: 3 } },
      { options: { a: 1, b: 2 } },
      'mf-1',
    )
    expect(resolved.options).toEqual({ a: 3, b: 2 })
  })

  test('7. edge: empty partials `{}` resolve to all 7 defaults', () => {
    const resolved = resolvePolicy({}, {}, 'mf-1')
    expect(resolved).toEqual(DEFAULT_ISOLATION_POLICY)
  })
})

describe('createPolicyCache — wrapper Map + AbortSignal cascade cleanup (D-V2-16)', () => {
  test('8. set/get/delete/clear + abortSignal cleared on broker shutdown', () => {
    const ctrl = new AbortController()
    const cache = createPolicyCache({ signal: ctrl.signal })

    cache.set('mf-1', DEFAULT_ISOLATION_POLICY)
    cache.set('mf-2', {
      ...DEFAULT_ISOLATION_POLICY,
      dom: 'shadow-dom',
    })
    expect(cache.size()).toBe(2)
    expect(cache.get('mf-1')).toEqual(DEFAULT_ISOLATION_POLICY)
    expect(cache.get('mf-2')?.dom).toBe('shadow-dom')

    // delete API.
    expect(cache.delete('mf-1')).toBe(true)
    expect(cache.delete('mf-missing')).toBe(false)
    expect(cache.size()).toBe(1)
    expect(cache.get('mf-1')).toBeUndefined()

    // abortSignal cascade — D-V2-16.
    ctrl.abort()
    expect(cache.size()).toBe(0)
  })

  test('cache with already-aborted signal clears immediately', () => {
    const ctrl = new AbortController()
    ctrl.abort() // abort BEFORE construct
    const cache = createPolicyCache({ signal: ctrl.signal })
    cache.set('mf-1', DEFAULT_ISOLATION_POLICY)
    // Edge case: construct con signal già abortito → svuota la map alla construct.
    // L'aggiunta successiva alla cache rimane (signal non re-fire).
    expect(cache.size()).toBe(1)
  })

  test('clear() svuota la cache manualmente (no signal needed)', () => {
    const cache = createPolicyCache()
    cache.set('mf-1', DEFAULT_ISOLATION_POLICY)
    cache.set('mf-2', DEFAULT_ISOLATION_POLICY)
    expect(cache.size()).toBe(2)
    cache.clear()
    expect(cache.size()).toBe(0)
  })
})
