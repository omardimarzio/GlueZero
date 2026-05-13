/**
 * Tier-1 unit suite per `css-isolation.ts` (W2 P03 — 4 test).
 *
 * Cover REQ-IDs: MF-ISO-02 parziale (CSS isolation modes scoped/shadow-dom/iframe/none).
 *
 * @see D-V2-F13-06 — scoped CSS data-gz-mf attribute setter
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { applyCssIsolation } from './css-isolation.js'
import type { MountTarget } from './dom-isolation.js'
import type { ResolvedIsolationPolicy } from './types/policy.js'
import { DEFAULT_ISOLATION_POLICY } from './types/policy.js'

function makeMount(): MountTarget {
  const host = document.createElement('div')
  document.body.appendChild(host)
  return { element: host, context: {} }
}

function policyWithCss(css: ResolvedIsolationPolicy['css']): ResolvedIsolationPolicy {
  return { ...DEFAULT_ISOLATION_POLICY, css }
}

describe('applyCssIsolation', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('css=scoped: setAttribute `data-gz-mf=<mfId>` su mount.element', () => {
    const mount = makeMount()

    applyCssIsolation(mount, 'mf-scope-1', policyWithCss('scoped'))

    expect(mount.element.getAttribute('data-gz-mf')).toBe('mf-scope-1')
    expect(mount.element.hasAttribute('data-gz-mf')).toBe(true)
  })

  it('css=shadow-dom: no-op (isolamento garantito dal ShadowRoot di dom-isolation)', () => {
    const mount = makeMount()

    applyCssIsolation(mount, 'mf-1', policyWithCss('shadow-dom'))

    expect(mount.element.hasAttribute('data-gz-mf')).toBe(false)
  })

  it('css=iframe: no-op (iframe = browsing context separato)', () => {
    const mount = makeMount()

    applyCssIsolation(mount, 'mf-1', policyWithCss('iframe'))

    expect(mount.element.hasAttribute('data-gz-mf')).toBe(false)
  })

  it("css=none: no-op (opt-out esplicito, no warning hot-path)", () => {
    const mount = makeMount()

    applyCssIsolation(mount, 'mf-1', policyWithCss('none'))

    expect(mount.element.hasAttribute('data-gz-mf')).toBe(false)
  })
})
