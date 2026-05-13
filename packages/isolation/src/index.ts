/**
 * `@gluezero/isolation` — Isolation + theme policy + storage/gateway/worker/theme facade per MicroFrontend.
 *
 * Fase 13 v2.0.0 (REQ-ID coverage: MF-ISO-01..XX + MF-INT-THEME-01..04 + MF-INT-GW-01..03
 * + MF-INT-WK-01..02 + MF-INT-CACHE-01 + MF-PIPE-01 cross-fase Tap composition).
 *
 * Surface pubblica popolata progressivamente dalle wave W2-W3 della Phase 13:
 * - W1 (Plan 13-01 — questo): scaffolding ESM-only multi-entry + Pattern S1 augment marker
 *   + types skeleton (7-key policy + 8-key theme + 4 facade + 3-code error union)
 *   + 7 topics literal (1 RIUSO F8 + 6 NEW locali) + `isolationModule({policyDefault?, resolvers?})`
 *   factory stub no-impl + Service Locator binding `SERVICE_ISOLATION` riusato F8
 * - W2 (Plan 13-02..04): isolation engine + DOM/CSS/storage handlers + facade impl
 *   + wrap-context chain + iframe stub IFRAME_ADAPTER_REQUIRED
 * - W3 (Plan 13-05..06): Tier-1 jsdom + Tier-3 Playwright Chromium 6 scenari closure +
 *   README italiano + JSDoc enrichment + bundle gate finale 12 KB
 *
 * Vincoli:
 * - Bundle ≤ 12 KB gzipped (D-V2-F13-13)
 * - Bundle augment ≤ 1 KB gzipped
 * - Pattern S1 augment stretto NO declare module upstream a core (D-V2-F13-20)
 * - Tier-1 jsdom + Tier-3 Playwright Chromium (D-V2-F13-14 + D-V2-F13-23 6 scenari)
 * - D-83 strict SEXTUPLE esteso v2.0: zero diff `packages/core/src/` +
 *   `packages/microfrontends/src/` + `packages/mapper/src/` + `packages/context/src/` +
 *   `packages/permissions/src/` + `packages/compat/src/` + frozen baseline v1.0/v1.1
 *   theme/cache/gateway/worker/mf-esm/devtools/routing
 *
 * @example Install F13 (W2/W3 attiva real logic)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { contextModule } from '@gluezero/context'
 * import { permissionsModule } from '@gluezero/permissions'
 * import { isolationModule } from '@gluezero/isolation'
 *
 * const broker = createBroker({
 *   modules: [
 *     microfrontendModule(),
 *     contextModule(),
 *     permissionsModule(),
 *     isolationModule({
 *       policyDefault: { dom: 'shadow-dom', css: 'shadow-dom', storage: 'namespaced' },
 *       resolvers: {
 *         gateway: () => gatewayService,
 *         worker:  () => workerService,
 *         theme:   () => themeService,
 *       },
 *     }),
 *   ],
 * })
 * ```
 *
 * @packageDocumentation
 * @see prd_2.0.0.md §21 — Isolation
 * @see prd_2.0.0.md §11.2 — Theme policy
 * @see prd_2.0.0.md §33.3 — Gateway integration
 * @see prd_2.0.0.md §34.2 — Worker integration
 */

// Side-effect import — Pattern S1 stretto intent signaling (D-V2-F13-20).
// Forza il bundler a preservare augment.ts come side-effect (declaration merging
// context-augment.ts type-only su MicroFrontendRuntimeContext).
import './augment.js'

// Augment marker (audit-grep tree-shake fail detection)
export { __isolationAugmentLoaded } from './augment.js'

// ===== Types public — PRD §21.3 + §11.2 + §21.7/§33.3/§34.2 =====
export type {
  MicroFrontendIsolationPolicy,
  ResolvedIsolationPolicy,
} from './types/policy.js'
export { DEFAULT_ISOLATION_POLICY } from './types/policy.js'

export type { MicroFrontendThemePolicy } from './types/theme-policy.js'

export type {
  StorageFacade,
  GatewayRequestOptions,
  GatewayFacade,
  WorkerRunOptions,
  WorkerFacade,
  ThemeFacade,
  IsolationResolvers,
} from './types/facades.js'

// Descriptor narrowing + helper accessor (D-83 strict NO declaration merging upstream)
export type { IsolationAwareMfDescriptor } from './types/descriptor-augment.js'
export { getIsolation, getThemePolicy } from './types/descriptor-augment.js'

// Declaration merging side-effect import (forza inclusione context-augment.ts type-only)
import './types/context-augment.js'

// ===== Error factory + codes (W1 P02 — D-V2-F13-22 strict) =====
export {
  createIsolationPolicyError,
  type CreateIsolationPolicyErrorParams,
  type IsolationPolicyErrorCode,
  type IsolationPolicyErrorContext,
  MF_ISOLATION_WARNING,
} from './types/errors.js'

// ===== Topics literal (W1 — D-V2-F13-12) =====
export {
  ISOLATION_WARNING_TOPIC,
  MF_ISOLATION_TOPICS,
  type IsolationTopic,
} from './topics.js'

// ===== BrokerModule factory (W1 stub — W2 P03 real impl) =====
// AMENDMENT D-V2-F13-04-AMENDED — 2-opt `{policyDefault?, resolvers?}` ratificato.
export { isolationModule, type IsolationModuleOptions } from './isolation-module.js'

// ===== Service Locator binding (riuso F8 SERVICE_ISOLATION + IsolationService signature) =====
export { SERVICE_ISOLATION, type IsolationService } from './service-locator.js'

// ===== W2 P03 — DOM/CSS isolation handlers + scopeCss helper + iframe stub + lifecycle mount hook =====
export { applyDomIsolation, type MountTarget } from './dom-isolation.js'
export { applyCssIsolation } from './css-isolation.js'
export { scopeCss } from './scope-css.js'
export { applyIframeStub, type IframeAdapter } from './iframe-stub.js'
export {
  installMountHook,
  applyMountIsolation,
  type MountHookOptions,
  type MountHookHandle,
  type PolicyCache,
  type BrokerSubscribeApi,
} from './lifecycle-mount-hook.js'

// ===== W3 P05 FINAL exports — barrel public API completa =====
export { wrapContextWithIsolation } from './wrap-context.js'
export { resolvePolicy } from './policy-resolver.js'
export {
  detectInconsistentCombinations,
  type IsolationWarning,
  type IsolationWarningCode,
} from './warning-matrix.js'
export {
  installRegisterHook,
  type RegisterHookBroker,
  type RegisterHookOptions,
  type RegisterHookHandle,
} from './lifecycle-register-hook.js'
