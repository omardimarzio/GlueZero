/**
 * `createThemeFacade(mfId, policy, themePolicy, resolvers, broker, context)` —
 * D-V2-F13-08 + MF-INT-THEME-01/02/03/04.
 *
 * ThemeFacade espone API minimale read-only su tokens/roles correnti del ThemeService
 * v1.1 (carryover frozen baseline NO modifica `packages/theme/src/`) + applica
 * adoptedStyleSheets per shadow-dom propagation pattern D-F7-22 v1.1.
 *
 * AMENDMENT D-V2-F13-04-AMENDED resolver pattern: usa `resolvers.theme?.()` lazy
 * invece di `getService(SERVICE_THEME)` (Service Locator F8 NON espone questo binding).
 *
 * ## adoptedStyleSheets shadow-dom propagation (D-F7-22 v1.1 carryover)
 *
 * Per `policy.dom='shadow-dom' + themePolicy.inherit=true + context.shadowContainer` presente:
 * 1. Lazy lookup `resolvers.theme?.()` → ThemeService instance.
 * 2. Recupera `tokens = themeService.currentTokens()` + `roles = themeService.currentRoles()`.
 * 3. Costruisce `CSSStyleSheet` via `buildThemeStyleSheet(tokens, roles)` (internal helper).
 * 4. Applica `context.shadowContainer.adoptedStyleSheets = [sheet]` (replace, NON append,
 *    T-13-W2-P04-05 mitigation DoS unbounded sheets).
 *
 * Per `policy.dom='iframe'`: bridge `gz:context:update` postMessage deferred F15 (JSDoc note).
 *
 * ## Permission check (lazy peer optional tolerant)
 *
 * `getToken(name)` invoca `permService?.check({mfId, action:'theme', resource: name})`:
 * - mode='enforce' + denied → ritorna undefined (NON throw — read-only graceful degradation).
 * - mode='warn'/'off' → procedi.
 * - permissions ASSENTE → pass-through silenzioso + warning una volta per broker.
 *
 * `getRole(name)` NO permission check (role è metadata generale, NO sensitivity).
 *
 * @example Setup theme facade + shadow-dom inheritance
 * ```ts
 * const shadowHost = document.createElement('div')
 * const shadowRoot = shadowHost.attachShadow({ mode: 'open' })
 * const theme = createThemeFacade(
 *   'mf-1',
 *   { ...DEFAULT_ISOLATION_POLICY, dom: 'shadow-dom' },
 *   { enabled: true, inherit: true },
 *   { theme: () => themeService },
 *   broker,
 *   { shadowContainer: shadowRoot },
 * )
 * // → shadowRoot.adoptedStyleSheets contiene 1 sheet con :host { --color-primary: ... }
 * theme!.getToken('color-primary') // → from themeService.getToken
 * theme!.isInheriting()            // → true
 * ```
 *
 * @see prd_2.0.0.md §11.2 — Theme policy 8-key + inherit pattern
 * @see D-V2-F13-08 — Theme adoptedStyleSheets propagation internal
 * @see D-F7-22 — v1.1 carryover adoptedStyleSheets pattern
 * @see D-V2-F13-04-AMENDED — Factory 2-opt resolver pattern
 *
 * @param mfId MicroFrontend identifier.
 * @param policy ResolvedIsolationPolicy (per dom='shadow-dom' check).
 * @param themePolicy MicroFrontendThemePolicy | undefined (enabled/inherit).
 * @param resolvers Host-provided lazy resolvers (resolvers.theme?).
 * @param broker Minimal broker (publish + getService).
 * @param context Mount-time context con shadowContainer? (per shadow-dom inherit apply).
 * @returns `ThemeFacade | undefined` (undefined se themePolicy.enabled === false).
 */
import type { ResolvedIsolationPolicy } from '../types/policy.js'
import type { MicroFrontendThemePolicy } from '../types/theme-policy.js'
import type { IsolationResolvers, ThemeFacade } from '../types/facades.js'
import { buildThemeStyleSheet } from '../internal/build-theme-stylesheet.js'

interface Broker {
  publish(topic: string, payload: unknown): void
  getService?<T>(key: symbol | string): T | undefined
}

interface ThemeContext {
  readonly shadowContainer?: ShadowRoot
}

interface ThemeServiceShape {
  getToken(name: string): string | undefined
  getRole(name: string): string | undefined
  currentTokens(): Record<string, string>
  currentRoles(): Record<string, string>
}

interface PermissionCheckResult {
  readonly allowed: boolean
  readonly mode: 'off' | 'warn' | 'enforce'
}

interface PermissionService {
  check(args: {
    readonly mfId: string
    readonly action: string
    readonly resource?: string
  }): PermissionCheckResult
}

const WARNED_NO_PERMISSIONS_THEME = new WeakSet<Broker>()

const SERVICE_PERMISSIONS_KEY = 'permissions'

export function createThemeFacade(
  mfId: string,
  policy: ResolvedIsolationPolicy,
  themePolicy: MicroFrontendThemePolicy | undefined,
  resolvers: IsolationResolvers,
  broker: Broker,
  context: ThemeContext,
): ThemeFacade | undefined {
  if (themePolicy?.enabled === false) return undefined

  const inherit = themePolicy?.inherit === true

  // Apply adoptedStyleSheets per shadow-dom + inherit:true (D-F7-22 v1.1 carryover)
  if (policy.dom === 'shadow-dom' && inherit && context.shadowContainer) {
    const themeService = resolvers.theme?.() as ThemeServiceShape | undefined
    if (themeService) {
      const tokens = themeService.currentTokens()
      const roles = themeService.currentRoles()
      try {
        const sheet = buildThemeStyleSheet(tokens, roles)
        // Replace (NOT append) — T-13-W2-P04-05 mitigation DoS unbounded sheets
        ;(context.shadowContainer as ShadowRoot).adoptedStyleSheets = [sheet]
      } catch {
        // Browser NON supporta CSSStyleSheet constructable (es. jsdom legacy) —
        // graceful degradation: skip apply, getToken/getRole still functional.
      }
    }
  }

  return {
    getToken(name: string): string | undefined {
      // Permission check lazy
      const permService = broker.getService?.<PermissionService>(
        SERVICE_PERMISSIONS_KEY,
      )
      if (permService) {
        const result = permService.check({
          mfId,
          action: 'theme',
          resource: name,
        })
        if (!result.allowed && result.mode === 'enforce') return undefined
      } else if (!WARNED_NO_PERMISSIONS_THEME.has(broker)) {
        WARNED_NO_PERMISSIONS_THEME.add(broker)
        console.warn(
          `[@gluezero/isolation] @gluezero/permissions not installed; theme facade pass-through (mode='off' effective).`,
        )
      }
      const themeService = resolvers.theme?.() as ThemeServiceShape | undefined
      return themeService?.getToken(name)
    },
    getRole(name: string): string | undefined {
      const themeService = resolvers.theme?.() as ThemeServiceShape | undefined
      return themeService?.getRole(name)
    },
    isInheriting(): boolean {
      return inherit
    },
  }
}
