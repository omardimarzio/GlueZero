/**
 * `RuntimeContext` shape — 11 chiavi standard PRD §18.4 (MF-CTX-02).
 *
 * Tutti i campi sono optional + readonly. Consumer cast/narrow per leggere.
 * Lo shape è il vocabolario canonico standard PRD §18.3 (11 chiavi note):
 * - `tenantId` — identificatore tenant corrente (multitenant context)
 * - `user` — utente autenticato corrente (`RuntimeUser` sub-shape)
 * - `locale` — locale corrente (es. `'it-IT'`, `'en-US'`)
 * - `timezone` — timezone IANA (es. `'Europe/Rome'`)
 * - `permissions` — lista permessi normalizzati
 * - `featureFlags` — feature flags attivi (mappa `nome` → `attivo`)
 * - `theme` — theme corrente (es. `'light'`, `'dark'`)
 * - `direction` — direzione testo (`'ltr'` | `'rtl'`)
 * - `environment` — environment corrente (`'development'` | `'staging'` | `'production'`)
 * - `currentRoute` — route corrente (`RuntimeRouteContext` sub-shape)
 * - `metadata` — metadati custom estensibili dall'app shell
 *
 * Storage strategy (D-V2-F10-07): single internal plain object + spread-copy on update.
 * Consumer non-mutation responsabilità doc-only — treat returned snapshots as immutable.
 *
 * @see PRD §18.3 (chiavi standard), §18.4 (Runtime Context interface)
 * @see MF-CTX-02 (REQUIREMENTS.md)
 * @see D-V2-F10-07 (storage strategy plain object spread-copy)
 */
export interface RuntimeContext {
  readonly tenantId?: string
  readonly user?: RuntimeUser
  readonly locale?: string
  readonly timezone?: string
  readonly permissions?: readonly string[]
  readonly featureFlags?: Readonly<Record<string, boolean>>
  readonly theme?: string
  readonly direction?: 'ltr' | 'rtl'
  readonly environment?: 'development' | 'staging' | 'production'
  readonly currentRoute?: RuntimeRouteContext
  readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * `RuntimeUser` shape — PRD §18.4 (sub-shape `user` field).
 *
 * Sub-shape semplificata per identificare l'utente autenticato corrente. Il campo
 * `id` è obbligatorio (qualsiasi user identificato MUST avere un id stabile).
 * Email, name e roles sono optional per accomodare casi anonimi/parziali.
 * `metadata` permette estensioni custom (claim JWT, custom attributes IdP, etc.).
 *
 * @see PRD §18.4
 */
export interface RuntimeUser {
  readonly id: string
  readonly email?: string
  readonly name?: string
  readonly roles?: readonly string[]
  readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * `RuntimeRouteContext` shape — PRD §18.4 (sub-shape `currentRoute` field).
 *
 * Sub-shape per descrivere la route corrente in modo router-agnostic (compatibile con
 * @gluezero/routing F3, React Router, Vue Router, custom routers). Il campo `path` è
 * obbligatorio (qualsiasi route MUST avere un path string). `params` e `query` sono
 * optional record string→string (no nested objects, no arrays — coerente URL semantics).
 *
 * @see PRD §18.4
 */
export interface RuntimeRouteContext {
  readonly path: string
  readonly params?: Readonly<Record<string, string>>
  readonly query?: Readonly<Record<string, string>>
}
