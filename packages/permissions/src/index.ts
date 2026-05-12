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

// ===== Runtime exports (W2 P02-P04 — stub W1) =====
// `permissionsModule` factory implemented W2-P03 — re-export aggiunto allora.

// ===== Topics (W2 P02 — stub W1) =====
// `MF_PERMISSION_TOPICS` + `MF_CAPABILITY_TOPICS` populated W2-P02.

// ===== Setup options =====
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
