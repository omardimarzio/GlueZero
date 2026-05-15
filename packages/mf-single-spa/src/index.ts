/**
 * `@gluezero/mf-single-spa` — Public API barrel (W1 P01 scaffolding).
 *
 * Phase 15 v2.0.0 — single-spa lifecycle adapter (REQ-ID coverage: MF-SS-01 +
 * MF-PKG-01..05). **Experimental @0.x.0 V2.0 GA (D-V2-23 lockato).**
 *
 * Surface pubblica popolata progressivamente dalle wave W1-W3 della Phase 15:
 * - W1 (Plan 15-01 — questo): scaffolding ESM-only multi-entry + Pattern S1 augment
 *   marker + types skeleton (`SingleSpaLoaderDefinition` + `MfSingleSpaErrorCode` 4-hint)
 *   + `singleSpaLoader` stub + `MfSingleSpaError` class skeleton.
 * - W2 (Plan 15-04): lifecycle mapping bootstrap/mount/unmount + topic emit broker.publish
 *   + peer dep runtime check + `MfSingleSpaError` body + NO router replacement enforcement.
 * - W3 (Plan 15-05): Tier-3 Playwright Chromium 2 scenari + README italiano + JSDoc
 *   enrichment + bundle gate finale 3 KB.
 *
 * Vincoli:
 * - Bundle ≤ 3 KB gzipped (D-V2-F15-14).
 * - Bundle augment ≤ 1 KB gzipped.
 * - Pattern S1 augment stretto NO declare module upstream (D-V2-F15-19).
 * - D-83 strict OCTUPLE esteso v2.0.
 * - NO router replacement (REQ MF-SS-01 — GlueZero non sostituisce single-spa routing).
 *
 * @example Install F15 SS loader (W2/W3 attiva real logic)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import '@gluezero/mf-single-spa/augment'  // F15 — intent signaling
 * import { singleSpaLoader } from '@gluezero/mf-single-spa'
 *
 * const broker = createBroker({ modules: [microfrontendModule()] })
 * const service = broker.modules.get('@gluezero/microfrontends')
 * service.registerLoader(singleSpaLoader)
 * ```
 *
 * @packageDocumentation
 * @see PRD §27 (single-spa Adapter experimental @0.x.0)
 */

// Side-effect import — Pattern S1 intent signaling (D-V2-F15-19 stretto).
import './augment'

// Augment marker (tree-shake fail detection).
export { __mfSsAugmentLoaded } from './augment'

// ===== Runtime exports (Wave 2 — Plan 15-04 fill: real implementation) =====

// LoaderAdapter (Plan 15-04 W2 fill: body D-V2-F15-11 implementation)
export { singleSpaLoader } from './ss-loader'

// Error class + types pubblici (Plan 15-04 W2 fill: completeness)
export {
  type CreateMfSingleSpaErrorParams,
  MfSingleSpaError,
  type MfSingleSpaErrorCode,
} from './errors'

// Type narrowing LoaderDefinition
export type { SingleSpaLoaderDefinition } from './types/descriptor'
