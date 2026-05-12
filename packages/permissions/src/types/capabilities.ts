/**
 * `MicroFrontendCapabilities` descriptor (PRD §17.2) + check result (PRD §17.5).
 *
 * Le capability esprimono `requires` (cosa il MF necessita per funzionare) e
 * `provides` (cosa il MF offre ad altri MF). La negoziazione avviene a load-time:
 * se un `require` non è soddisfatto, la policy (`off` / `warn` / `block-load` / `block-mount`)
 * determina il comportamento (D-V2-F11-11/12 — more-strict wins).
 *
 * @see prd_2.0.0.md §17.2 — interfaccia 3-field + policy override
 * @see prd_2.0.0.md §17.5 — CapabilityCheckResult 6-field shape
 */

/**
 * Policy globale o per-MF di handling capability mancanti/incompatibili.
 *
 * - `off`: nessun enforcement (capability solo informative).
 * - `warn`: log warning, ma carica/monta comunque il MF.
 * - `block-load`: il MF non viene caricato (`load()` fallisce con errore).
 * - `block-mount`: il MF viene caricato ma `mount()` fallisce con errore.
 *
 * D-V2-F11-12 risoluzione: more-strict wins quando setup-time vs per-MF
 * divergono (es: setup `warn` + per-MF `block-mount` → `block-mount`).
 */
export type CapabilityPolicy = 'off' | 'warn' | 'block-load' | 'block-mount'

/**
 * Capability richiesta da un MF per funzionare.
 *
 * F11 fa string equality only sulla `version` (D-V2-F11-10 — semver matching deferred F12).
 * `version` opzionale significa "qualunque version va bene" (just-the-name match).
 */
export interface CapabilityRequirement {
  readonly name: string
  /** F11 string equality only (D-V2-F11-10) — semver defer F12. */
  readonly version?: string
}

/**
 * Capability fornita da un MF ad altri MF.
 *
 * `version` REQUIRED per `provides` — non esiste "any version provider".
 */
export interface CapabilityProvision {
  readonly name: string
  /** version REQUIRED for provides (NO 'any version' provider). */
  readonly version: string
}

/**
 * Descriptor capabilities opzionale per `MicroFrontendDescriptor`.
 *
 * @example
 * ```ts
 * const descriptor: PermissionAwareMfDescriptor = {
 *   id: 'mf-customer',
 *   capabilities: {
 *     requires: [{ name: 'auth', version: '1.0' }],
 *     provides: [{ name: 'customer-list', version: '2.1' }],
 *     optional: [{ name: 'analytics' }],
 *     policy: 'block-mount',
 *   },
 * }
 * ```
 */
export interface MicroFrontendCapabilities {
  readonly requires?: readonly CapabilityRequirement[]
  readonly provides?: readonly CapabilityProvision[]
  readonly optional?: readonly CapabilityRequirement[]
  /** per-MF override (D-V2-F11-12 more-strict wins). */
  readonly policy?: CapabilityPolicy
}

/**
 * Dettaglio di incompatibilità capability (required vs provided version mismatch).
 */
export interface CapabilityIncompatibility {
  readonly name: string
  readonly required: string
  readonly provided: string
}

/**
 * Risultato della check di capability per un MF (PRD §17.5 — 6-field shape).
 *
 * - `ok`: true se nessun `requires` è mancante né incompatibile.
 * - `missing`: array nomi capability `requires` non fornite da alcun MF.
 * - `incompatible`: array `{name, required, provided}` per mismatch di versione.
 * - `optionalMissing`: array nomi `optional` non fornite (sempre warning, mai blocco).
 * - `provided`: array `CapabilityProvision[]` aggregato di tutto ciò che è disponibile.
 * - `warnings`: stringhe diagnostiche (optional missing, cross-MF conflict first-wins — OQ-4).
 *
 * @see prd_2.0.0.md §17.5
 */
export interface CapabilityCheckResult {
  readonly ok: boolean
  readonly missing: readonly string[]
  readonly incompatible: readonly CapabilityIncompatibility[]
  readonly optionalMissing: readonly string[]
  readonly provided: readonly CapabilityProvision[]
  /** OQ-4 — diagnostic strings (optional missing, cross-MF conflict first-wins). */
  readonly warnings: readonly string[]
}
