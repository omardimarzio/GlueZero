// route-handlers/index.ts — Barrel export per i route handler F3 (D-60).
//
// I 3 handler implementati in F3:
// - `localHandler` (sync passthrough — D-60, ROUTE-02)
// - `cacheHandler` (stub F6 — D-60, ROUTE-04)
// - `createCompositeHandler` (workflow factory — D-60, ROUTE-05, Q3 opzione b)
//
// Il 4° handler (`httpHandler`) è declaration-only qui: il plan 03-08 fornirà
// l'implementazione effettiva nel file `http-handler.ts`. L'executor importa
// l'httpHandler come dependency injection (vedi route-executor.ts).

export { cacheHandler } from './cache-handler'
export { createCompositeHandler } from './composite-handler'
export type { CompositeHandlerDeps } from './composite-handler'
export { localHandler } from './local-handler'
