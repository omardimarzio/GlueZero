/**
 * `buildThemeStyleSheet(tokens, roles)` — D-V2-F13-08 + D-F7-22 v1.1 carryover.
 *
 * Helper internal F13 (target ~400 B gzipped) — OQ-1 risoluzione: theme v1.1 NO helper
 * esposto pubblicamente confirmed RESEARCH (zero `tokens-to-css` export in
 * `@gluezero/theme`). F13 implementa internal helper minimal (NO modifica
 * `packages/theme/src/` — D-83 strict frozen baseline v1.1).
 *
 * ## Output structure
 *
 * Costruisce un singolo `CSSStyleSheet` constructable da:
 * 1. `:host { --<token-key>: <value>; ... }` — CSS custom properties per token (PRD §11.2).
 * 2. `:host([data-gz-role-<role>="<value>"]) { /_ role: <role> _/ }` — selector
 *    rules per role (presentation conditional, role tracking). I delimiter CSS
 *    comment reali (slash-star ... star-slash) sono qui rappresentati con
 *    underscore per evitare di chiudere il JSDoc block.
 *
 * Usato da `createThemeFacade` per applicare a `shadowRoot.adoptedStyleSheets` quando
 * `policy.dom='shadow-dom' + themePolicy.inherit=true` (D-F7-22 pattern v1.1).
 *
 * ## Browser compat
 *
 * `CSSStyleSheet` constructable supportato: Chrome 73+, Edge 79+, Firefox 101+, Safari 16.4+.
 * jsdom NON supporta nativamente (v25.1.0+ ha shim parziale — test usa shim/mock).
 * Tier-3 Playwright Chromium W3 verifica reale.
 *
 * @example Apply theme to shadowRoot
 * ```ts
 * const sheet = buildThemeStyleSheet(
 *   { 'color-primary': '#0066cc', 'spacing-md': '16px' },
 *   { active: 'true' },
 * )
 * shadowRoot.adoptedStyleSheets = [sheet]
 * // → :host { --color-primary: #0066cc; --spacing-md: 16px; }
 * //   :host([data-gz-role-active="true"]) { (role: active) }
 * ```
 *
 * @see prd_2.0.0.md §11.2 — Theme policy + CSS custom properties pattern
 * @see D-V2-F13-08 — Theme adoptedStyleSheets propagation
 * @see D-F7-22 — v1.1 carryover adoptedStyleSheets pattern
 * @see OQ-1 — theme helper internal (NO upstream modification)
 *
 * @param tokens Record<token-name, css-value> — CSS custom properties content.
 * @param roles Record<role-name, role-value> — presentation role attributes.
 * @returns Constructed `CSSStyleSheet` con rule `:host` + role selectors.
 */
export function buildThemeStyleSheet(
  tokens: Readonly<Record<string, string>>,
  roles: Readonly<Record<string, string>>,
): CSSStyleSheet {
  const sheet = new CSSStyleSheet()

  const tokenDecls = Object.entries(tokens)
    .map(([k, v]) => `--${k}: ${v}`)
    .join('; ')
  const hostRule = tokenDecls ? `:host { ${tokenDecls}; }` : ''

  const roleRules = Object.entries(roles)
    .map(
      ([role, val]) =>
        `:host([data-gz-role-${role}="${val}"]) { /* role: ${role} */ }`,
    )
    .join('\n')

  const cssText = [hostRule, roleRules].filter(Boolean).join('\n')
  sheet.replaceSync(cssText)
  return sheet
}
