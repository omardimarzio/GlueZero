// strategies/first-match.ts — Strategy 'first-match' per multi-route policy (D-66, ROUTE-15).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-66: 'first-match' è il default ROUTE-15 (chiusura PRD §39 #6). Quando più
//   route matchano lo stesso topic, viene selezionata la prima registrata.
//   In dev mode il warning `routing.ambiguous` è gestito dal RouteResolver.resolve().

import type { CompiledRoute } from '../route-resolver'

/**
 * Strategy `'first-match'` (D-66, ROUTE-15 default — chiusura PRD §39 #6).
 *
 * Ritorna `[primo match]` dell'array (corrispondente all'ordine di registrazione
 * nel dispatch table). Il warning ambiguous è emesso dal `RouteResolver.resolve()`
 * tramite `onAmbiguousRoutes` callback quando `matches.length > 1`.
 *
 * @param matches - Array di CompiledRoute restituite dal trie wildcard match.
 * @returns Array con il primo CompiledRoute (o vuoto se input vuoto).
 *
 * @example
 * ```ts
 * firstMatch([r1, r2, r3]) // [r1]
 * firstMatch([])            // []
 * ```
 */
export function firstMatch(matches: readonly CompiledRoute[]): readonly CompiledRoute[] {
  return matches.length === 0 ? [] : [matches[0]!]
}
