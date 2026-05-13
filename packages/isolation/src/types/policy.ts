/**
 * `MicroFrontendIsolationPolicy` — Policy isolamento 7-chiavi (PRD §21.3).
 *
 * Definisce 7 dimensioni indipendenti di isolamento per ogni MicroFrontend:
 * `dom`, `css`, `js`, `events`, `storage`, `network`, `globals`. Più `options`
 * extension-point per resolver/adapter custom.
 *
 * Cover REQ-IDs: MF-ISO-01 (policy 7-key interface) + MF-ISO-02/03/04/05
 * (resolver merge + applicazione dom/css/storage in W2).
 *
 * ## Resolution chain (D-V2-F13-04-AMENDED + D-V2-F13-17)
 *
 * Priorità (più alta vince): `descriptor.isolation` (per-MF) > `policyDefault`
 * (factory) > `DEFAULT_ISOLATION_POLICY` (PRD §21.3 baseline). Merge effettuato
 * dal `resolveIsolationPolicy` helper (W2 P02).
 *
 * @see prd_2.0.0.md §21.3 — Isolation policy 7-key
 * @see D-V2-F13-17 — Default policy BLOCKING PRD-locked
 * @see D-V2-F13-04-AMENDED — Factory `isolationModule({policyDefault?, resolvers?})`
 */
export interface MicroFrontendIsolationPolicy {
  readonly dom: 'none' | 'mount-root' | 'shadow-dom' | 'iframe'
  readonly css: 'none' | 'scoped' | 'shadow-dom' | 'iframe'
  readonly js: 'shared-window' | 'sandboxed-iframe'
  readonly events: 'broker-only' | 'broker-plus-dom' | 'isolated'
  readonly storage: 'shared' | 'namespaced' | 'blocked'
  readonly network: 'direct-allowed' | 'gateway-only' | 'blocked'
  readonly globals: 'allowed' | 'restricted' | 'isolated'
  readonly options?: Readonly<Record<string, unknown>>
}

/**
 * `ResolvedIsolationPolicy` — Output del policy resolver (merge default+policyDefault+descriptor).
 *
 * Tutti i campi sono required post-merge; `options` sempre presente come oggetto
 * vuoto se omesso dal source layer (resolver garantisce shape completa per facade
 * downstream).
 */
export interface ResolvedIsolationPolicy extends MicroFrontendIsolationPolicy {
  readonly options: Readonly<Record<string, unknown>>
}

/**
 * `DEFAULT_ISOLATION_POLICY` — Baseline PRD §21.3 (D-V2-F13-17 carryover D-V2-13 BLOCKING).
 *
 * Default ragionevoli + permissivi (mount-root + scoped CSS + shared-window + broker-only
 * + storage shared + network direct-allowed + globals allowed). Override:
 * - `policyDefault` (factory `isolationModule({policyDefault: {...}})`) override globale host
 * - `descriptor.isolation` (per-MF, override sia default che policyDefault, more-strict wins)
 *
 * @see prd_2.0.0.md §21.3 — Default policy baseline
 */
export const DEFAULT_ISOLATION_POLICY: ResolvedIsolationPolicy = {
  dom: 'mount-root',
  css: 'scoped',
  js: 'shared-window',
  events: 'broker-only',
  storage: 'shared',
  network: 'direct-allowed',
  globals: 'allowed',
  options: {},
} as const
