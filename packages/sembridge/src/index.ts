/**
 * `@sembridge/sembridge` — aggregato pubblico (Phase 6 milestone v1.0).
 *
 * Re-exporta tutti i 7 sub-package (`@sembridge/{core,mapper,routing,gateway,
 * worker,cache,devtools}`) + factory `createSemBridge(config)` (Wave 4 plan
 * 06-08). Single import surface per consumer.
 *
 * **Wave 1 placeholder**: questo file viene popolato in Wave 4 (plan 06-08)
 * con:
 * - re-export pubblico di tutti i sub-package (createBroker, createMapperBroker,
 *   createRouterBroker, createRealtimeBroker, createWorkerBroker,
 *   createCacheBroker, createDevtoolsBroker)
 * - `createSemBridge(config)` factory aggregato chain composition (D-30 no
 *   singleton + RESEARCH §11.3 Opzione B)
 *
 * **Plan 06-09 final gate** popola anche `packages/sembridge/README.md` (DOC-02
 * + DOC-05) e `packages/sembridge/EXAMPLES.md` (DOC-05 esempi end-to-end).
 *
 * @example
 * ```ts
 * // Wave 4 — utilizzo aggregato (plan 06-08):
 * import { createSemBridge } from '@sembridge/sembridge'
 *
 * const broker = createSemBridge({
 *   canonicalModel: { schemas: [...] },
 *   routes: [...],
 *   cache: { maxEntries: 500 },
 *   devtools: { enableByDefault: true },
 * })
 * ```
 *
 * @packageDocumentation
 */

// Type re-export (disponibile da Wave 1 per consumer typecheck early-stage)
export type { SemBridgeConfig, SemBridgeFeatures } from './types/sembridge-config'

// Side-effect re-export per attivare augment di tutti i sub-package (deferred a
// Wave 4 plan 06-08 — qui placeholder).
//
// Wave 4 (06-08):
// import '@sembridge/mapper/augment'
// import '@sembridge/routing/augment'
// import '@sembridge/gateway/augment'
// import '@sembridge/gateway/sse-ws/augment'  (se subpath disponibile)
// import '@sembridge/worker/augment'
// import '@sembridge/cache/augment'
// import '@sembridge/devtools/augment'
//
// Runtime factory (Wave 4 06-08):
// export { createSemBridge, type SemBridge } from './sem-bridge'
// export * from '@sembridge/core'
// export * from '@sembridge/mapper'
// export * from '@sembridge/routing'
// export * from '@sembridge/gateway/http'
// export * from '@sembridge/gateway/sse-ws'  (se subpath disponibile)
// export * from '@sembridge/worker'
// export * from '@sembridge/cache'
// export * from '@sembridge/devtools'
