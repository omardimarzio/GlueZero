/**
 * `@gluezero/mf-web-component` — Public API barrel (W1 P01 scaffolding).
 *
 * Phase 15 v2.0.0 — Web Component (Custom Elements) ESM loader (REQ-ID coverage:
 * MF-WC-01 + MF-PKG-01..05).
 *
 * Surface pubblica popolata progressivamente dalle wave W1-W3 della Phase 15:
 * - W1 (Plan 15-01 — questo): scaffolding ESM-only multi-entry + Pattern S1 augment
 *   marker + types skeleton (`WebComponentLoaderDefinition` + `MfWebComponentErrorCode`
 *   4-hint) + `webComponentLoader` LoaderAdapter stub TODO body + `MfWebComponentError`
 *   class skeleton.
 * - W2 (Plan 15-02): `customElements.whenDefined` + `AbortSignal.timeout` + ESM-only
 *   `import(url)` + contextMode property/attribute/event dispatch + reuse-on-collision
 *   warning + `MfWebComponentError` class body.
 * - W3 (Plan 15-05): Tier-3 Playwright Chromium 2 scenari + README italiano + JSDoc
 *   enrichment + bundle gate finale 3 KB.
 *
 * Vincoli:
 * - Bundle ≤ 3 KB gzipped (D-V2-F15-14).
 * - Bundle augment ≤ 1 KB gzipped.
 * - Pattern S1 augment stretto NO declare module upstream (D-V2-F15-19).
 * - D-83 strict OCTUPLE esteso v2.0: zero diff 8 src/ protetti.
 *
 * @example Install F15 WC loader (W2/W3 attiva real logic)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import '@gluezero/microfrontends/augment'
 * import '@gluezero/mf-web-component/augment'  // F15 — intent signaling
 * import { webComponentLoader } from '@gluezero/mf-web-component'
 *
 * const broker = createBroker({ modules: [microfrontendModule()] })
 * const service = broker.modules.get('@gluezero/microfrontends')
 * service.registerLoader(webComponentLoader)
 * ```
 *
 * @packageDocumentation
 * @see PRD §25 (Web Component Loader), §6.4 (Pattern S1)
 */

// Side-effect import — Pattern S1 intent signaling (D-V2-F15-19 stretto).
// Forza il bundler a preservare augment.ts come side-effect.
import './augment'

// Augment marker (tree-shake fail detection).
export { __mfWcAugmentLoaded } from './augment'

// ===== Runtime exports (Wave 2 — Plan 15-02 fill: webComponentLoader real implementation) =====

// LoaderAdapter (Plan 15-02 W2 fill: body D-V2-F15-05..08 implementation)
export { webComponentLoader } from './wc-loader'

// Error class + types pubblici (Plan 15-02 W2 fill: completeness)
export {
  type CreateMfWebComponentErrorParams,
  MfWebComponentError,
  type MfWebComponentErrorCode,
} from './errors'

// Type narrowing LoaderDefinition (Plan 15-02 W2 fill: discriminated union)
export type { WebComponentLoaderDefinition } from './types/descriptor'
