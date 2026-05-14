/**
 * `@gluezero/fallbacks` — Public API barrel.
 *
 * Phase 14 v2.0.0 — Fallback & Error Boundary module (REQ-ID coverage:
 * MF-FALLBACK-01..05 + cross-fase observability MF_GOVERNANCE_TOPICS riuso F8).
 *
 * Surface pubblica popolata progressivamente dalle wave W1-W3 della Phase 14:
 * - W1 (Plan 14-01 — questo): scaffolding ESM-only multi-entry + Pattern S1 augment
 *   marker + types skeleton (`MicroFrontendFallbackPolicy` + `FallbackDefinition`
 *   5-mode + `RetryPolicy` + `CircuitBreakerPolicy` + `MfFallbackErrorCode` 5-hint)
 *   + 3 topics literal + `fallbacksModule({...})` factory stub no-impl + Service
 *   Locator binding `SERVICE_FALLBACKS` riusato F8 + `MicroFrontendError` class
 *   signature definitiva (body completo W1 per typecheck downstream W2).
 * - W2 (Plan 14-02..04): error subscribe + RetryEngine + CircuitBreaker FSM +
 *   FallbackOrchestrator + 4 renderer (html/component/event/custom).
 * - W3 (Plan 14-05): Tier-1 jsdom + Tier-3 Playwright Chromium scenari closure +
 *   README italiano + JSDoc enrichment + bundle gate finale 6 KB + D-83 strict
 *   septuple verifier reale.
 *
 * Vincoli:
 * - Bundle ≤ 6 KB gzipped (D-V2-F14-13).
 * - Bundle augment ≤ 1 KB gzipped.
 * - Pattern S1 augment stretto NO declare module upstream a core (D-V2-F14-19).
 * - Tier-1 jsdom + Tier-3 Playwright Chromium (D-V2-F14-14 closure W3 P05).
 * - D-83 strict SEPTUPLE esteso v2.0: zero diff `packages/core/src/` +
 *   `packages/microfrontends/src/` + `packages/mapper/src/` + `packages/context/src/` +
 *   `packages/permissions/src/` + `packages/compat/src/` + `packages/isolation/src/`.
 *
 * @example Install F14 (W2/W3 attiva real logic)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { fallbacksModule, MicroFrontendError } from '@gluezero/fallbacks'
 * import '@gluezero/fallbacks/augment'
 *
 * const broker = createBroker({
 *   modules: [
 *     microfrontendModule(),
 *     fallbacksModule({
 *       defaultPolicy: { onLoadError: { type: 'html', html: '<div>App unavailable</div>' } },
 *       retryDefault: { attempts: 3, delayMs: 100, backoff: 'exponential', jitter: true },
 *       circuitDefault: { enabled: true, failureThreshold: 3, resetAfterMs: 5000 },
 *     }),
 *   ],
 * })
 * ```
 *
 * @packageDocumentation
 * @see prd_2.0.0.md §29 — Fallback and Error Boundary module
 * @see D-V2-F14-19 — Pattern S1 augment side-effect-only
 */

// Side-effect import — Pattern S1 stretto intent signaling (D-V2-F14-19).
// Forza il bundler a preservare augment.ts come side-effect (declaration narrowing
// FallbackAwareMfDescriptor type-only su MicroFrontendDescriptor).
import './augment.js'

// Augment marker (audit-grep tree-shake fail detection)
export { __fallbacksAugmentLoaded } from './augment.js'

// ===== Types public — PRD §29.3 + §29.5 (W1 — D-V2-F14-06/09/11/13/14/15) =====
export type {
  CircuitBreakerPolicy,
  FallbackDefinition,
  MicroFrontendFallbackPolicy,
  RetryPolicy,
} from './types/policy.js'

export type {
  MfFallbackErrorCode,
  MicroFrontendErrorLifecyclePhase,
} from './types/errors.js'

// Descriptor narrowing + helper accessor (D-V2-F14-19 stretto, NO declaration merging upstream)
export type { FallbackAwareMfDescriptor } from './types/descriptor-augment.js'
export { getFallback } from './types/descriptor-augment.js'

// ===== Topics literal (W1 — D-V2-F14-03) =====
export {
  FALLBACK_EVENT_DEFAULT_TOPIC,
  FALLBACK_RENDERED_TOPIC,
  MF_FALLBACK_TOPICS,
  type MfFallbackTopic,
} from './topics.js'

// ===== Error class (W1 stub signature + body — D-V2-F14-05) =====
export {
  MicroFrontendError,
  type CreateMicroFrontendErrorParams,
} from './microfrontend-error.js'

// ===== BrokerModule factory (W1 stub — W2 P04 real impl — D-V2-F14-04 3-opt) =====
export {
  fallbacksModule,
  type FallbacksModuleOptions,
} from './fallbacks-module.js'

// ===== Service Locator binding (riuso F8 SERVICE_FALLBACKS + FallbacksService signature) =====
export { SERVICE_FALLBACKS, type FallbacksService } from './service-locator.js'
