/**
 * Tier-1 unit suite per `createThemeFacade` — 4 test (jsdom).
 *
 * Coverage: getToken via resolver + permission check + adoptedStyleSheets apply
 * (shadow-dom + inherit=true) D-F7-22 pattern + inherit=false no-op.
 *
 * NOTE jsdom CSSStyleSheet constructable: jsdom 29.1.0 supporta `new CSSStyleSheet()`
 * + replaceSync + adoptedStyleSheets shim. Test 3 verifica entry esistente (lunghezza
 * array) — il content effettivo verificato in Tier-3 Playwright Chromium W3 (D-F7-22).
 *
 * @see packages/isolation/src/facades/theme.ts
 */
import { describe, expect, test, vi } from 'vitest'
import { DEFAULT_ISOLATION_POLICY } from '../types/policy.js'
import { createThemeFacade } from './theme.js'

interface PublishedEvent {
  readonly topic: string
  readonly payload: unknown
}

function mockBroker(opts?: {
  permissionResult?: { allowed: boolean; mode: 'off' | 'warn' | 'enforce' }
  noPermissionService?: boolean
}): {
  published: PublishedEvent[]
  publish(topic: string, payload: unknown): void
  getService<T>(key: symbol | string): T | undefined
} {
  const published: PublishedEvent[] = []
  return {
    published,
    publish(topic: string, payload: unknown): void {
      published.push({ topic, payload })
    },
    getService<T>(_key: symbol | string): T | undefined {
      if (opts?.noPermissionService) return undefined
      const result = opts?.permissionResult ?? { allowed: true, mode: 'enforce' as const }
      return {
        check: (): { allowed: boolean; mode: string } => result,
      } as unknown as T
    },
  }
}

function mockThemeService(overrides?: {
  tokens?: Record<string, string>
  roles?: Record<string, string>
}) {
  const tokens = overrides?.tokens ?? { 'color-primary': '#0066cc' }
  const roles = overrides?.roles ?? { active: 'true' }
  return {
    getToken: vi.fn((name: string): string | undefined => tokens[name]),
    getRole: vi.fn((name: string): string | undefined => roles[name]),
    currentTokens: vi.fn((): Record<string, string> => tokens),
    currentRoles: vi.fn((): Record<string, string> => roles),
  }
}

describe('createThemeFacade', () => {
  test('getToken via resolver — invokes themeService.getToken', () => {
    const broker = mockBroker()
    const svc = mockThemeService()
    const theme = createThemeFacade(
      'mf-1',
      DEFAULT_ISOLATION_POLICY,
      { enabled: true },
      { theme: () => svc },
      broker,
      {},
    )
    expect(theme).toBeDefined()
    expect(theme!.getToken('color-primary')).toBe('#0066cc')
    expect(svc.getToken).toHaveBeenCalledWith('color-primary')
  })

  test('permission denied enforce → getToken returns undefined', () => {
    const broker = mockBroker({
      permissionResult: { allowed: false, mode: 'enforce' },
    })
    const svc = mockThemeService()
    const theme = createThemeFacade(
      'mf-1',
      DEFAULT_ISOLATION_POLICY,
      { enabled: true },
      { theme: () => svc },
      broker,
      {},
    )
    const value = theme!.getToken('secret-token')
    expect(value).toBeUndefined()
    expect(svc.getToken).not.toHaveBeenCalled()
  })

  test('adoptedStyleSheets apply for dom=shadow-dom + inherit=true (D-F7-22)', () => {
    const broker = mockBroker()
    const svc = mockThemeService({
      tokens: { 'color-primary': '#0066cc' },
      roles: { active: 'true' },
    })
    const host = document.createElement('div')
    const shadowRoot = host.attachShadow({ mode: 'open' })

    // Pre-check: jsdom shim — graceful skip se CSSStyleSheet constructable NON supportato
    let cssStyleSheetSupported = true
    try {
      new CSSStyleSheet()
    } catch {
      cssStyleSheetSupported = false
    }

    const theme = createThemeFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, dom: 'shadow-dom' },
      { enabled: true, inherit: true },
      { theme: () => svc },
      broker,
      { shadowContainer: shadowRoot },
    )
    expect(theme).toBeDefined()
    expect(theme!.isInheriting()).toBe(true)
    if (cssStyleSheetSupported) {
      expect(svc.currentTokens).toHaveBeenCalled()
      expect(svc.currentRoles).toHaveBeenCalled()
      expect(shadowRoot.adoptedStyleSheets.length).toBe(1)
    }
  })

  test('inherit=false → no-op (NOT apply adoptedStyleSheets) + isInheriting=false', () => {
    const broker = mockBroker()
    const svc = mockThemeService()
    const host = document.createElement('div')
    const shadowRoot = host.attachShadow({ mode: 'open' })

    const theme = createThemeFacade(
      'mf-1',
      { ...DEFAULT_ISOLATION_POLICY, dom: 'shadow-dom' },
      { enabled: true, inherit: false },
      { theme: () => svc },
      broker,
      { shadowContainer: shadowRoot },
    )
    expect(theme).toBeDefined()
    expect(theme!.isInheriting()).toBe(false)
    expect(svc.currentTokens).not.toHaveBeenCalled()
    expect(svc.currentRoles).not.toHaveBeenCalled()
    // adoptedStyleSheets undefined o empty (NON popolato — facade ha skippato apply)
    const sheets = shadowRoot.adoptedStyleSheets
    expect(sheets === undefined || sheets.length === 0).toBe(true)
  })
})
