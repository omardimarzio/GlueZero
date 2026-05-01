// strategies/index.ts — Barrel export per le 3 multi-route policy strategy (D-66).
//
// Le strategy sono pure functions consumate da `RouteResolver.resolve(topic, policy)`.
// Pattern Strategy: `'first-match'` default + `'priority-ordered'` + `'all'` (broadcast).

export { allBroadcast } from './all-broadcast'
export { firstMatch } from './first-match'
export { priorityOrdered } from './priority-ordered'
