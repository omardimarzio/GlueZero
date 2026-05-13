/**
 * Tier-3 Playwright Chromium Scenario 5: adoptedStyleSheets theme propagation reale.
 *
 * D-V2-F13-14 + D-F7-22 v1.1 carryover: jsdom NON supporta `CSSStyleSheet`
 * constructable + `adoptedStyleSheets`, Chromium reale obbligatorio per verifica
 * shadow-dom token inheritance.
 *
 * @see prd_2.0.0.md §11.2 — Theme policy inherit pattern
 * @see D-V2-F13-08 — Theme adoptedStyleSheets propagation internal
 * @see D-F7-22 — v1.1 carryover adoptedStyleSheets pattern
 */
import { describe, expect, it } from 'vitest'
import { createThemeFacade } from '../facades/theme.js'
import { DEFAULT_ISOLATION_POLICY } from '../types/policy.js'

const mockBroker = {
  publish(_topic: string, _payload: unknown): void {},
  getService<T>(_key: string | symbol): T | undefined {
    return undefined
  },
}

const mockThemeService = {
  getToken(name: string): string | undefined {
    return ({ 'color-primary': '#0066cc', 'color-bg': '#f5f5f5' } as Record<string, string>)[name]
  },
  getRole(_name: string): string | undefined {
    return undefined
  },
  currentTokens(): Record<string, string> {
    return { 'color-primary': '#0066cc', 'color-bg': '#f5f5f5' }
  },
  currentRoles(): Record<string, string> {
    return {}
  },
}

describe('Tier-3 Chromium — Scenario 5: adoptedStyleSheets theme propagation', () => {
  it('shadow-dom + inherit=true → shadowRoot.adoptedStyleSheets popolato (length=1)', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const shadowRoot = host.attachShadow({ mode: 'open' })

    const theme = createThemeFacade(
      'mf-theme-1',
      { ...DEFAULT_ISOLATION_POLICY, dom: 'shadow-dom' },
      { enabled: true, inherit: true },
      { theme: (): typeof mockThemeService => mockThemeService },
      mockBroker,
      { shadowContainer: shadowRoot },
    )

    expect(theme).toBeDefined()
    expect(shadowRoot.adoptedStyleSheets.length).toBe(1)
    document.body.removeChild(host)
  })

  it('adoptedStyleSheet contiene :host con --color-primary token', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const shadowRoot = host.attachShadow({ mode: 'open' })

    createThemeFacade(
      'mf-theme-2',
      { ...DEFAULT_ISOLATION_POLICY, dom: 'shadow-dom' },
      { enabled: true, inherit: true },
      { theme: (): typeof mockThemeService => mockThemeService },
      mockBroker,
      { shadowContainer: shadowRoot },
    )

    const sheet = shadowRoot.adoptedStyleSheets[0]
    expect(sheet).toBeDefined()
    const cssText = Array.from(sheet?.cssRules ?? [])
      .map((r) => r.cssText)
      .join('\n')
    expect(cssText).toContain('--color-primary')
    document.body.removeChild(host)
  })

  it('rendering shadowed: var(--color-primary) computed via inherited adoptedStyleSheet', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const shadowRoot = host.attachShadow({ mode: 'open' })

    createThemeFacade(
      'mf-theme-3',
      { ...DEFAULT_ISOLATION_POLICY, dom: 'shadow-dom' },
      { enabled: true, inherit: true },
      { theme: (): typeof mockThemeService => mockThemeService },
      mockBroker,
      { shadowContainer: shadowRoot },
    )

    // Crea un elemento dentro lo shadow root che usa var(--color-primary)
    const inner = document.createElement('div')
    inner.style.color = 'var(--color-primary)'
    inner.textContent = 'shadowed text'
    shadowRoot.appendChild(inner)

    const computed = window.getComputedStyle(inner)
    // #0066cc → rgb(0, 102, 204)
    expect(computed.color).toBe('rgb(0, 102, 204)')
    document.body.removeChild(host)
  })
})
