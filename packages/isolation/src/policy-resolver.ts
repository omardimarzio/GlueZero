/**
 * `policy-resolver.ts` — Resolver merge 3-layer per `MicroFrontendIsolationPolicy`
 * (D-V2-F13-04-AMENDED + D-V2-F13-17 + W2 P02 13-02).
 *
 * Cover REQ-IDs: MF-ISO-01 (policy 7-key resolver merge default+policyDefault+declared
 * partial per chiave, per-MF prevale).
 *
 * ## Resolution chain (priorità più alta vince)
 *
 *  1. `DEFAULT_ISOLATION_POLICY` (PRD §21.3 baseline lockato D-V2-F13-17) — applicato
 *     come fallback finale per ogni chiave mancante.
 *  2. `policyDefault` (factory option `isolationModule({policyDefault: {...}})`) —
 *     override host-wide.
 *  3. `declared` (per-MF da `descriptor.isolation`) — override per-MF, prevale su tutto.
 *
 * ## Partial-merge per chiave (D-V2-F13-04-AMENDED)
 *
 * Merge NON è deep clone: ogni delle 7 chiavi di policy è risolta indipendentemente
 * (es. declared può specificare solo `dom='shadow-dom'` senza dover ridichiarare le
 * altre 6 chiavi). `options` field viene mergiato come oggetto piatto
 * `{...DEFAULT.options, ...policyDefault.options, ...declared.options}`.
 *
 * Resolver è puro (no side effect, no I/O). Idempotent — chiamare 2x con stessi
 * input produce output bit-equivalent.
 *
 * @see prd_2.0.0.md §21.3 — Policy 7-key isolation
 * @see D-V2-F13-04-AMENDED — Factory 2-opt + resolver partial-merge
 * @see D-V2-F13-17 — Default policy BLOCKING PRD-locked
 */
import type {
  MicroFrontendIsolationPolicy,
  ResolvedIsolationPolicy,
} from './types/policy.js'
import { DEFAULT_ISOLATION_POLICY } from './types/policy.js'

/**
 * Risolve la policy di isolamento per un MicroFrontend, applicando il merge
 * 3-layer descritto sopra.
 *
 * @param declared - Partial policy dichiarata dal MF (`descriptor.isolation`).
 *   Può essere `undefined` (MF senza override).
 * @param policyDefault - Partial policy host-wide (factory option).
 *   Può essere `undefined` (host senza override).
 * @param _mfId - Identificatore del MF. Reserved per future audit log /
 *   instrumentation. Attualmente NON usato nel calcolo (presente per simmetria API
 *   con `IsolationService.getResolvedPolicy(mfId)`).
 * @returns `ResolvedIsolationPolicy` con tutti i 7 campi populated + `options`
 *   sempre presente come oggetto (mai `undefined`).
 *
 * @example Default-only (nessun override)
 * ```ts
 * resolvePolicy(undefined, undefined, 'mf-1')
 * // → DEFAULT_ISOLATION_POLICY bit-equivalent
 * ```
 *
 * @example Per-MF override (declared prevale)
 * ```ts
 * resolvePolicy({ dom: 'iframe' }, { dom: 'shadow-dom' }, 'mf-1')
 * // → { dom: 'iframe', ...altri 6 default }
 * ```
 *
 * @example Partial-merge per chiave (declared + policyDefault diversi keys)
 * ```ts
 * resolvePolicy({ css: 'shadow-dom' }, { dom: 'shadow-dom' }, 'mf-1')
 * // → { dom: 'shadow-dom' (policyDefault), css: 'shadow-dom' (declared), ...5 default }
 * ```
 */
export function resolvePolicy(
  declared: Partial<MicroFrontendIsolationPolicy> | undefined,
  policyDefault: Partial<MicroFrontendIsolationPolicy> | undefined,
  _mfId: string,
): ResolvedIsolationPolicy {
  const merged: ResolvedIsolationPolicy = {
    dom:
      declared?.dom ?? policyDefault?.dom ?? DEFAULT_ISOLATION_POLICY.dom,
    css:
      declared?.css ?? policyDefault?.css ?? DEFAULT_ISOLATION_POLICY.css,
    js:
      declared?.js ?? policyDefault?.js ?? DEFAULT_ISOLATION_POLICY.js,
    events:
      declared?.events ??
      policyDefault?.events ??
      DEFAULT_ISOLATION_POLICY.events,
    storage:
      declared?.storage ??
      policyDefault?.storage ??
      DEFAULT_ISOLATION_POLICY.storage,
    network:
      declared?.network ??
      policyDefault?.network ??
      DEFAULT_ISOLATION_POLICY.network,
    globals:
      declared?.globals ??
      policyDefault?.globals ??
      DEFAULT_ISOLATION_POLICY.globals,
    options: {
      ...DEFAULT_ISOLATION_POLICY.options,
      ...(policyDefault?.options ?? {}),
      ...(declared?.options ?? {}),
    },
  }
  return merged
}

/**
 * Re-export del baseline `DEFAULT_ISOLATION_POLICY` per consumer convenience.
 *
 * Canonical source: `./types/policy.ts` (lockato PRD §21.3 D-V2-F13-17 BLOCKING).
 */
export { DEFAULT_ISOLATION_POLICY } from './types/policy.js'
