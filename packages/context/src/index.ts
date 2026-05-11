/**
 * `@gluezero/context` — Runtime Context module + per-MF mapping integration per
 * GlueZero v2.0.
 *
 * Surface pubblica popolata progressivamente dalle wave W2-W3 della Phase 10:
 * - W1 (Plan 10-01): scaffolding ESM-only multi-entry + Pattern S1 augment marker + types base
 * - W2 (Plan 10-02): RuntimeContext API (set/replace/get/subscribe/clear) + selector overload + 8 events fire pattern
 * - W2 (Plan 10-03): writableKeys ACL enforcement + MF_CONTEXT_WRITE_DENIED throw + denied topic
 * - W2 (Plan 10-04): per-MF MapperEngine scoped + Inspector EventTap wrapper + contextMap auto-injection LIVE
 * - W3 (Plan 10-05): Tier-1 jsdom closure + README italiano + JSDoc enrichment + bundle gate
 *
 * Vincoli:
 * - Bundle ≤ 4 KB gzipped (D-V2-F10-19)
 * - Pattern S1 augment stretto NO declare module / NO Broker.prototype (D-V2-F10-17)
 * - Tier-1 jsdom only — NO Tier-3 Playwright (D-V2-F10-16)
 * - D-83 strict triple: zero diff `packages/core/src/` + `packages/microfrontends/src/` + `packages/mapper/src/`
 *
 * Internal helpers NON esportati dal barrel (D-V2-F9-11 carryover):
 * - keys-array → auto shallow selector helper (`./internal/`) — W2 P02
 * - acl-enforcer internal validation helpers (`./internal/`) — W2 P03
 * - per-MF MapperEngine Map<mfId, MapperEngine> internal (`./internal/`) — W2 P04
 *
 * @example Quick start
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { contextModule } from '@gluezero/context'
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), contextModule()],
 * })
 * ```
 *
 * @packageDocumentation
 * @see PRD §16 (Mapping per-MF), §18 (Runtime Context), §6.4 (Pattern S1)
 */

// Side-effect import — Pattern S1 stretto intent signaling (D-V2-F10-17).
// Forza il bundler a preservare augment.ts come side-effect (T-F10-W1-02 mitigation).
import './augment'

// Augment marker (T-F10-W1-02 tree-shake fail detection).
export { __contextAugmentLoaded } from './augment'

// ===== Runtime exports (Wave 1 — scaffolding) =====

// BrokerModule factory install lookup service (W1 — D-V2-F10-18, install stub completato in W2)
export { contextModule } from './context-module'

// ===== Type exports (Wave 1 — scaffolding) =====

// RuntimeContext shape 11 chiavi PRD §18.4 (MF-CTX-02) + sub-shapes RuntimeUser + RuntimeRouteContext
export type {
  RuntimeContext,
  RuntimeUser,
  RuntimeRouteContext,
} from './types/runtime-context'

// ===== Runtime exports (Wave 2+ — popolato da P02/P03/P04) =====
// export { setRuntimeContext, replaceRuntimeContext, getRuntimeContext, subscribeRuntimeContext, clearRuntimeContext } from './runtime-context'  // W2 P02
// export { wrapInspectorWithMfAttribution } from './inspector-wrapper'  // W2 P04
// export { type CreateContextErrorParams, createContextError, type ContextErrorCode } from './context-error'  // W2 P03
