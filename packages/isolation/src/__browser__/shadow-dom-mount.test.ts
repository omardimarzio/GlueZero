/**
 * Tier-3 Playwright Chromium Scenario 1: shadow-dom mount + ShadowRoot reale.
 *
 * D-V2-F13-14 + D-V2-F13-23: jsdom NON modella attachShadow full + adoptedStyleSheets,
 * Chromium reale richiesto per verifica Strategy A mutation cast end-to-end.
 *
 * @see prd_2.0.0.md §21.4 — DOM isolation shadow-dom mode
 * @see D-V2-F13-05 — Strategy A mutation cast
 */
import { describe, expect, it } from 'vitest'
import { applyDomIsolation } from '../dom-isolation.js'
import { DEFAULT_ISOLATION_POLICY } from '../types/policy.js'

describe('Tier-3 Chromium — Scenario 1: shadow-dom mount', () => {
  it('attachShadow crea ShadowRoot reale + inner container con attribute', () => {
    const host = document.createElement('div')
    host.id = 'host-1'
    document.body.appendChild(host)
    const mount = { element: host, context: {} }
    applyDomIsolation(mount, 'mf-1', { ...DEFAULT_ISOLATION_POLICY, dom: 'shadow-dom' })

    expect(host.shadowRoot).not.toBeNull()
    expect(host.shadowRoot?.firstElementChild).toBeInstanceOf(HTMLDivElement)
    const innerDiv = host.shadowRoot?.firstElementChild as HTMLDivElement
    expect(innerDiv.getAttribute('data-gz-mf-container')).toBe('mf-1')
    expect(mount.element).toBe(innerDiv) // Strategy A mutation cast
    expect(mount.element).not.toBe(host) // element ref mutato

    document.body.removeChild(host)
  })

  it('Chromium querySelector real shadow container retrieval', () => {
    const host = document.createElement('div')
    host.id = 'host-2'
    document.body.appendChild(host)
    const mount = { element: host, context: {} }
    applyDomIsolation(mount, 'mf-2', { ...DEFAULT_ISOLATION_POLICY, dom: 'shadow-dom' })

    // Real Chromium shadow piercing query
    const retrieved = document
      .querySelector('#host-2')
      ?.shadowRoot?.querySelector('[data-gz-mf-container]')
    expect(retrieved).not.toBeNull()
    expect((retrieved as HTMLElement).getAttribute('data-gz-mf-container')).toBe('mf-2')

    document.body.removeChild(host)
  })

  it('mount.context.shadowContainer exposed to runtime context', () => {
    const host = document.createElement('div')
    host.id = 'host-3'
    document.body.appendChild(host)
    const mount = { element: host, context: {} as { shadowContainer?: ShadowRoot } }
    applyDomIsolation(mount, 'mf-3', { ...DEFAULT_ISOLATION_POLICY, dom: 'shadow-dom' })

    expect(mount.context.shadowContainer).toBe(host.shadowRoot)
    expect(mount.context.shadowContainer).toBeInstanceOf(ShadowRoot)

    document.body.removeChild(host)
  })
})
