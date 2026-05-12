/**
 * F11 pattern matching 4 modes + deny-wins order-independent (D-V2-F11-05).
 *
 * 4 modes pattern matching PRD §19.4:
 *
 * - **esatto**: `'customer.order'` matcha solo `customer.order`.
 * - **wildcard finale**: `'customer.*'` matcha `customer` + `customer.X` +
 *   `customer.X.Y.Z` (multi-segment, DIVERGE F1 single-segment — D-V2-F11-06).
 * - **wildcard globale**: `'*'` matcha qualunque topic.
 * - **deny esplicito**: `'!customer.pii.*'` matcha tutto ciò di `customer.pii.*`
 *   ma forza outcome `false` (deny-wins).
 *
 * **Deny-wins always (order-independent)** — D-V2-F11-05:
 * Algoritmo: scan TUTTI i pattern. Se qualunque `!neg` matcha → return `false`
 * (early-exit, P-02 mitigation). Altrimenti `true` se almeno un allow matcha.
 *
 * **Default fail-secure (D-V2-F11-14)**: array vuoto `[]` → `false` (deny-all
 * in mode `enforce` per MF senza `descriptor.permissions`).
 *
 * @see prd_2.0.0.md §19.4 — pattern matching 4 modes
 * @see D-V2-F11-05 (deny-wins order-independent)
 * @see D-V2-F11-06 (multi-segment wildcard DIVERGE F1)
 * @see D-V2-F11-14 (fail-secure default)
 */
import { matchesPattern as matchesSingle } from './internal/topic-pattern-match'

/**
 * Matcha topic contro array di pattern misti (allow + deny `!prefix`).
 *
 * @param patterns Array readonly di pattern (allow + deny `!prefix` mixed).
 * @param topic Topic/resource da testare.
 * @returns `true` se almeno un allow matcha E nessun deny matcha; `false`
 *   altrimenti (deny-wins o no allow match).
 *
 * @example
 * ```typescript
 * matchPatterns(['customer.*', '!customer.pii.*'], 'customer.order.created') // true
 * matchPatterns(['customer.*', '!customer.pii.*'], 'customer.pii.email')     // false (deny-wins)
 * matchPatterns(['!customer.pii.*', 'customer.*'], 'customer.pii.email')     // false (order-independent)
 * matchPatterns(['*'], 'anything.deep.path')                                 // true (global)
 * matchPatterns([], 'customer.order')                                        // false (fail-secure D-V2-F11-14)
 * ```
 */
export function matchPatterns(patterns: readonly string[], topic: string): boolean {
  let allowed = false
  for (const p of patterns) {
    if (p.startsWith('!')) {
      // Deny pattern: early-exit (P-02 mitigation deny-wins order-independent)
      if (matchesSingle(p.slice(1), topic)) return false
    } else if (matchesSingle(p, topic)) {
      allowed = true
    }
  }
  return allowed
}
