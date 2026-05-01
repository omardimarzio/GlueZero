// strategies/all-broadcast.ts — Strategy 'all' per multi-route policy (D-66, ROUTE-15).
//
// Riferimento decisioni (03-CONTEXT.md):
// - D-66: 'all' è opt-in fan-out broadcast. Tutte le route applicabili eseguono in
//   parallelo (utile per side-effect multipli — audit log + cache + server).

import type { CompiledRoute } from '../route-resolver'

/**
 * Strategy `'all'` (D-66, ROUTE-15) — opt-in fan-out broadcast.
 *
 * Ritorna tutti i match senza alterazione (passthrough dell'input). Il caller
 * (RouteExecutor in plan 03-06+) eseguirà ogni route in parallelo.
 *
 * @param matches - Array di CompiledRoute restituite dal trie wildcard match.
 * @returns L'array originale di match (passthrough).
 *
 * @example
 * ```ts
 * allBroadcast([r1, r2, r3]) // [r1, r2, r3]
 * allBroadcast([])            // []
 * ```
 */
export function allBroadcast(matches: readonly CompiledRoute[]): readonly CompiledRoute[] {
  return matches
}
