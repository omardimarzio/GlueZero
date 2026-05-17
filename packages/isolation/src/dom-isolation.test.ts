/**
 * Tier-1 unit suite per `dom-isolation.ts` (W2 P03 — 5 test).
 *
 * Cover REQ-IDs: MF-ISO-02 (DOM isolation modes mount-root/shadow-dom/iframe/none).
 *
 * Tier-1 jsdom — jsdom supporta `attachShadow({mode:'open'})` da v16+. Tier-3
 * Playwright Chromium W3 P05 verifica scenario reale con styling/inheritance.
 *
 * @see D-V2-F13-14 — Tier-1 jsdom default
 * @see D-V2-F13-05 — shadow-dom Strategy A mutation cast
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyDomIsolation, type MountTarget } from './dom-isolation.js'
import type { ResolvedIsolationPolicy } from './types/policy.js'
import { DEFAULT_ISOLATION_POLICY } from './types/policy.js'

function makeMount(): MountTarget {
  const host = document.createElement('div')
  document.body.appendChild(host)
  return { element: host, context: {} }
}

function policyWithDom(dom: ResolvedIsolationPolicy['dom']): ResolvedIsolationPolicy {
  return { ...DEFAULT_ISOLATION_POLICY, dom }
}

describe('applyDomIsolation', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('dom=mount-root: no-op (mount.element preserved, no shadowRoot)', () => {
    const mount = makeMount()
    const originalEl = mount.element

    applyDomIsolation(mount, 'mf-1', policyWithDom('mount-root'))

    expect(mount.element).toBe(originalEl)
    expect(originalEl.shadowRoot).toBeNull()
    expect((mount.context as { shadowContainer?: ShadowRoot }).shadowContainer).toBeUndefined()
  })

  it('dom=shadow-dom: Strategy A mutation cast — host.shadowRoot popolato + mount.element = innerDiv + context.shadowContainer settato', () => {
    const mount = makeMount()
    const host = mount.element

    applyDomIsolation(mount, 'mf-1', policyWithDom('shadow-dom'))

    // ShadowRoot creato in mode 'open'.
    expect(host.shadowRoot).not.toBeNull()
    // Strategy A mutation cast: mount.element ora punta al div interno (NON più all'host).
    expect(mount.element).not.toBe(host)
    expect(mount.element.tagName).toBe('DIV')
    expect(mount.element.getAttribute('data-gz-mf-container')).toBe('mf-1')
    // Il div interno è figlio del ShadowRoot.
    expect(host.shadowRoot?.firstElementChild).toBe(mount.element)
    // shadowContainer esposto via context-augment W1 P01.
    expect((mount.context as { shadowContainer?: ShadowRoot }).shadowContainer).toBe(
      host.shadowRoot,
    )
  })

  it('dom=iframe: no-op (path separato delegato a applyIframeStub — host preserved, no shadowRoot)', () => {
    const mount = makeMount()
    const originalEl = mount.element

    applyDomIsolation(mount, 'mf-1', policyWithDom('iframe'))

    expect(mount.element).toBe(originalEl)
    expect(originalEl.shadowRoot).toBeNull()
  })

  it("dom=none: console.warn invocato una volta per host element (anti-pattern P-13)", () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const mount = makeMount()

    applyDomIsolation(mount, 'mf-x', policyWithDom('none'))
    applyDomIsolation(mount, 'mf-x', policyWithDom('none'))

    // WeakSet protegge da warn ripetuto sullo stesso element.
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[0]).toContain("dom='none'")
    expect(warnSpy.mock.calls[0]?.[0]).toContain('mf-x')
  })

  it('Strategy A mutation cast: il ref `mount.element` viene mutato in-place (loader F9 ESM riceve container shadowed transparently)', () => {
    const mount = makeMount()
    const hostRef = mount.element

    applyDomIsolation(mount, 'mf-1', policyWithDom('shadow-dom'))

    // Verifica esplicita del ref change in-place (carryover D-V2-F10-XX).
    expect(mount.element).not.toBe(hostRef)
    // L'host originale è ancora nel DOM (Strategy A NON detach).
    expect(document.body.contains(hostRef)).toBe(true)
    // Il loader può ora fare mount.element.appendChild(...) senza penetrare lo style globale.
    const child = document.createElement('span')
    child.textContent = 'mf-content'
    mount.element.appendChild(child)
    expect(hostRef.shadowRoot?.contains(child)).toBe(true)
    expect(document.body.contains(child)).toBe(false) // child è dentro shadowRoot, NON nel light DOM.
  })
})
