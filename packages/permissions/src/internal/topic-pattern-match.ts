/**
 * F11 wildcard helper multi-segment.
 *
 * DIVERGE da F1 `TopicTrie.match` (single-segment, `topic-matcher.ts:7-8` D-10).
 * F11 PRD §19.4 + SC1 ROADMAP linea 287 richiede multi-segment
 * (`customer.*` matcha `customer.order.created`).
 *
 * F11 NON può riusare F1 runtime — helper locale ~80 B minified (D-V2-F11-06).
 *
 * **Match semantics F11:**
 *
 * - `'*'` matcha qualunque topic (wildcard globale).
 * - `'customer.order'` matcha solo `customer.order` (esatto).
 * - `'customer.*'` matcha:
 *   - `customer` (prefix base, no trailing segment)
 *   - `customer.order` (single-level)
 *   - `customer.order.created` (multi-level, DIVERGE F1 single-segment)
 *
 * NON matcha false-prefix come `customerOther` (richiesto separatore `.`).
 *
 * @param pattern Pattern singolo (no `!` prefix — gestito da `matchPatterns`).
 * @param topic Topic da testare.
 * @returns `true` se il topic matcha il pattern, `false` altrimenti.
 *
 * @example Match semantics F11
 * ```typescript
 * matchesPattern('*', 'anything')                       // true
 * matchesPattern('customer.order', 'customer.order')    // true exact
 * matchesPattern('customer.*', 'customer')              // true (prefix base)
 * matchesPattern('customer.*', 'customer.order')        // true single-level
 * matchesPattern('customer.*', 'customer.order.created')// true multi-level (DIVERGE F1)
 * matchesPattern('customer.order', 'customer')          // false
 * matchesPattern('customer.*', 'customerOther')         // false (no separator)
 * ```
 *
 * @see prd_2.0.0.md §19.4
 * @see packages/core/src/core/topic-matcher.ts (F1 single-segment DIVERGE)
 */
export function matchesPattern(pattern: string, topic: string): boolean {
  if (pattern === '*') return true
  if (pattern === topic) return true
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2)
    return topic === prefix || topic.startsWith(`${prefix}.`)
  }
  return false
}
