/**
 * `@gluezero/permissions` — Permission engine sincrono + Capability Registry per MicroFrontend.
 *
 * Fase 11 v2.0.0 (13 REQ-ID: MF-PERM-01..06 + MF-CAP-01..05 + MF-INT-LIFE-03 + MF-PIPE-01).
 *
 * Surface pubblica popolata progressivamente dalle wave W2-W3 della Phase 11:
 * - W1 (Plan 11-01): scaffolding ESM-only multi-entry + Pattern S1 augment marker + types base
 * - W2 (Plan 11-02): permission engine + pattern matching 4 modes + LRU cache 500 + error factory + topics
 * - W2 (Plan 11-03): 10 enforcement points facade + permissionsModule factory
 * - W2 (Plan 11-04): capability registry + negotiation + MF lifecycle hooks
 * - W2 (Plan 11-05): Pipeline §28 extension via composition esterna (Tap)
 * - W3 (Plan 11-06): Tier-1 jsdom closure + README italiano + JSDoc enrichment + bundle gate
 *
 * Vincoli:
 * - Bundle ≤ 5 KB gzipped (D-V2-F11-19)
 * - Pattern S1 augment stretto NO declare module / NO Broker.prototype (D-V2-F11-17)
 * - Tier-1 jsdom only — NO Tier-3 Playwright (D-V2-F11-21)
 * - D-V2-F11-22 strict triple: zero diff `packages/core/src/` + `packages/microfrontends/src/` + `packages/mapper/src/`
 *
 * @example Install
 * ```typescript
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { contextModule } from '@gluezero/context'
 * import { permissionsModule } from '@gluezero/permissions'
 *
 * const broker = createBroker({
 *   modules: [
 *     microfrontendModule(),
 *     contextModule(),
 *     permissionsModule({ permissionMode: 'enforce' }),
 *   ],
 * })
 * ```
 *
 * @packageDocumentation
 * @see prd_2.0.0.md §17 — Capability negotiation
 * @see prd_2.0.0.md §19 — Permission module
 */

// Side-effect import — Pattern S1 stretto intent signaling (D-V2-F11-17).
// Forza il bundler a preservare augment.ts come side-effect.
import './augment'

// Augment marker (audit-grep tree-shake fail detection).
export { __permissionsAugmentLoaded } from './augment'

// ===== Topics (W2 P02 — D-V2-F11-04 literal locale + Pitfall 7) =====
export { MF_CAPABILITY_TOPICS, MF_PERMISSION_TOPICS } from './topics'
export type { CapabilityTopic, PermissionTopic } from './topics'

// ===== Error factory locale (W2 P02 — D-V2-F11-08) =====
export {
  createPermissionError,
  type CreatePermissionErrorParams,
  type PermissionDeniedPayload,
  type PermissionDeniedRequest,
  type PermissionErrorCode,
  publishDeniedTopics,
} from './permission-error'

// ===== Engine API (W2 P02 — D-V2-F11-03 single engine 10 actions) =====
export {
  createPermissionEngine,
  type PermissionAction,
  type PermissionCheckRequest,
  type PermissionEngine,
  type PermissionMode,
} from './permission-engine'

// ===== Capability Registry API (W2 P04 — D-V2-F11-09 global SoT) =====
export {
  type CapabilityRegistry,
  computeCapabilityResult,
  createCapabilityRegistry,
} from './capability-registry'

// ===== Capability policy enforcer (W2 P04 — MF-CAP-04 dispatch 4 valori) =====
// Typically consumato via lifecycle hooks, ma exposed per consumer custom.
export { enforceCapabilityPolicy } from './capability-checker'

// ===== BrokerModule factory + install (W2 P03 — D-V2-F11-18 2 setup-time options) =====
export { permissionsModule } from './permissions-module'

// ===== Enforcement helpers (W2 P03 — typically NON consumati direttamente; exposed per consumer custom) =====
export { wrapContextWithPermissions, wrapServiceWithPermissions } from './enforcement-points'

// ===== Internal helpers NOT exported (D-V2-F9-11 carryover stretto: pattern-matcher, lru-cache, internal/ privati) =====
// `wireLifecycleHooks` (W2 P04) è internal — invocato solo da `permissionsModule().install`.

// ===== Setup options =====
// `PermissionsModuleOptions` viene re-exportata anche da `./permissions-module`
// per coerenza con il modulo che lo definisce (single source of truth W2 P03).
// `./types` mantiene un alias di compat per consumer pre-W2-P03.
export type { PermissionsModuleOptions } from './types'

// ===== Types public — PRD §17/§19 interfaces =====
export type {
  MicroFrontendPermissions,
  PermissionPattern,
  PermissionCategory,
} from './types/permissions'

export type {
  MicroFrontendCapabilities,
  CapabilityRequirement,
  CapabilityProvision,
  CapabilityCheckResult,
  CapabilityIncompatibility,
  CapabilityPolicy,
} from './types/capabilities'

export type {
  PermissionAwareMfDescriptor,
} from './types/descriptor-augment'

export { getPermissions, getCapabilities } from './types/descriptor-augment'
