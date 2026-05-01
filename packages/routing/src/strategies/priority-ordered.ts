// strategies/priority-ordered.ts — Strategy 'priority-ordered' (D-66, ROUTE-15).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-66: 'priority-ordered' usa il campo `RouteDefinition.priority` per selezionare la
//   route con priority numerica più alta. Tie-breaker: insertion order (Array.prototype.sort
//   è stable da JS ≥ 2019 ECMAScript spec).

import type { CompiledRoute } from '../route-resolver'

/**
 * Strategy `'priority-ordered'` (D-66, ROUTE-15).
 *
 * Ordina i match per `priority` numerica desc; tie-breaker: insertion order
 * (Array.prototype.sort stable). Ritorna `[priority più alta]` (1 elemento).
 *
 * Nota: questa strategy ritorna SEMPRE 1 elemento (il vincitore), non l'intero
 * array ordinato. Per ottenere fan-out broadcast di tutti i match usare la strategy
 * `'all'` (allBroadcast).
 *
 * @param matches - Array di CompiledRoute restituite dal trie wildcard match.
 * @returns Array con la route a priority più alta (o vuoto se input vuoto).
 *
 * @example
 * ```ts
 * priorityOrdered([{priority:1}, {priority:5}, {priority:2}]) // [{priority:5}]
 * priorityOrdered([{priority:0}, {priority:0}])               // [primo elem (tie)]
 * priorityOrdered([])                                          // []
 * ```
 */
export function priorityOrdered(matches: readonly CompiledRoute[]): readonly CompiledRoute[] {
  if (matches.length === 0) return []
  const sorted = [...matches].sort((a, b) => b.priority - a.priority)
  return [sorted[0]!]
}
