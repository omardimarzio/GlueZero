// route-handlers/index.ts — Barrel export per i route handler F3 (D-60).
//
// I 4 handler implementati in F3:
// - `localHandler` (sync passthrough — D-60, ROUTE-02)
// - `createHttpHandler` (factory async — D-60, ROUTE-03, ROUTE-06, plan 03-08)
// - `cacheHandler` (stub F6 — D-60, ROUTE-04)
// - `createCompositeHandler` (workflow factory — D-60, ROUTE-05, Q3 opzione b)
//
// Il `httpHandler` è iniettato come dependency dal RouterBroker plan 03-12 nel
// `RouteExecutor` (`route-executor.ts`).

export { cacheHandler } from './cache-handler'
export type { CompositeHandlerDeps } from './composite-handler'
export { createCompositeHandler } from './composite-handler'
export type {
  HttpHandlerDeps,
  HttpHandlerGateway,
  HttpHandlerMapper,
  HttpHandlerRequestSpec,
  HttpHandlerResponseSpec,
  HttpHandlerStrategies,
  HttpHandlerValidationIssue,
  HttpHandlerValidationResult,
  HttpHandlerValidator,
} from './http-handler'
export { createHttpHandler } from './http-handler'
export { localHandler } from './local-handler'
