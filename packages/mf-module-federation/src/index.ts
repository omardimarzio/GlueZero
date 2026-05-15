/**
 * `@gluezero/mf-module-federation` — Public API barrel (W1 P01 scaffolding).
 *
 * Phase 15 v2.0.0 — Module Federation Runtime v0.x loader (REQ-ID coverage:
 * MF-MF-01..02 + MF-PKG-01..05). **Experimental @0.x.0 V2.0 GA (D-V2-23 lockato).**
 *
 * Surface pubblica popolata progressivamente dalle wave W1-W3 della Phase 15:
 * - W1 (Plan 15-01 — questo): scaffolding ESM-only multi-entry + Pattern S1 augment
 *   marker + types skeleton (`ModuleFederationLoaderDefinition` +
 *   `MfModuleFederationErrorCode` 5-hint) + 1 topic literal + `moduleFederationLoader`
 *   stub + `MfModuleFederationError` class skeleton.
 * - W2 (Plan 15-04): remoteEntry.js loader webpack 5 + `@module-federation/runtime` v0.x
 *   init + share scope conflict warn+emit topic + factory result normalize +
 *   `MfModuleFederationError` body.
 * - W3 (Plan 15-05): Tier-3 Playwright Chromium 2 scenari + README italiano + JSDoc
 *   enrichment + bundle gate finale 5 KB.
 *
 * Vincoli:
 * - Bundle ≤ 5 KB gzipped (D-V2-F15-14).
 * - Bundle augment ≤ 1 KB gzipped.
 * - Pattern S1 augment stretto NO declare module upstream (D-V2-F15-19).
 * - D-83 strict OCTUPLE esteso v2.0.
 * - webpack-only V2.0 GA (D-V2-F15-09); rsbuild/vite deferred V2.1.
 *
 * @example Install F15 MF loader (W2/W3 attiva real logic)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import '@gluezero/mf-module-federation/augment'  // F15 — intent signaling
 * import { moduleFederationLoader } from '@gluezero/mf-module-federation'
 *
 * const broker = createBroker({ modules: [microfrontendModule()] })
 * const service = broker.modules.get('@gluezero/microfrontends')
 * service.registerLoader(moduleFederationLoader)
 * ```
 *
 * @packageDocumentation
 * @see PRD §24 (Module Federation Loader experimental @0.x.0)
 */

// Side-effect import — Pattern S1 intent signaling (D-V2-F15-19 stretto).
import './augment'

// Augment marker (tree-shake fail detection).
export { __mfMfAugmentLoaded } from './augment'

// ===== Runtime exports (Wave 2 — Plan 15-04 fill: real implementation) =====

// LoaderAdapter (Plan 15-04 W2 fill: body D-V2-F15-09/10 implementation)
export { moduleFederationLoader } from './mf-loader'

// Error class + types pubblici (Plan 15-04 W2 fill: completeness)
export {
  type CreateMfModuleFederationErrorParams,
  MfModuleFederationError,
  type MfModuleFederationErrorCode,
} from './errors'

// Type narrowing LoaderDefinition
export type { ModuleFederationLoaderDefinition } from './types/descriptor'

// Topics literal F15 + type union
export {
  MF_MODULE_FEDERATION_TOPICS,
  type MfModuleFederationTopic,
} from './topics'
