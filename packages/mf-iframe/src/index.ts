/**
 * `@gluezero/mf-iframe` — Public API barrel (W1 P01 scaffolding).
 *
 * Phase 15 v2.0.0 — Iframe sandbox loader + bridge postMessage (REQ-ID coverage:
 * MF-IFRAME-01..05 + MF-SEC-01..04 + MF-PKG-01..05). **D-V2-09 BLOCKING closure F15.**
 *
 * Surface pubblica popolata progressivamente dalle wave W1-W3 della Phase 15:
 * - W1 (Plan 15-01 — questo): scaffolding ESM-only multi-entry 3-entry (index + augment
 *   + client subpath) + Pattern S1 augment marker + types skeleton
 *   (`IframeLoaderDefinition` + `MfIframeErrorCode` 6-hint + `IframeBridgeMessageType`
 *   9-hint) + 4 topics literal + `iframeLoader` factory stub + `MfIframeError` class skeleton.
 * - W2 (Plan 15-03): iframe creation + sandbox apply + bridge handshake + Valibot 9 schemas
 *   + LRU dedup + replay mitigation + rate-limit + expectedOrigin enforcement +
 *   targetOrigin ban + `IframeAdapter.createSandbox` F13 sblocco + `MfIframeError` body.
 * - W3 (Plan 15-05): Tier-3 Playwright Chromium 2 scenari security + README italiano +
 *   JSDoc enrichment + bundle gate finale 10 KB.
 *
 * Vincoli:
 * - Bundle ≤ 10 KB gzipped (D-V2-F15-14 — single largest F15).
 * - Bundle augment ≤ 1 KB gzipped.
 * - Bundle client subpath ≤ 3 KB gzipped (MF-IFRAME-05).
 * - Pattern S1 augment stretto NO declare module upstream (D-V2-F15-19).
 * - D-83 strict OCTUPLE esteso v2.0.
 *
 * ## Security disclaimer (P-13 governance-not-crypto)
 *
 * ⚠️ L'iframe sandbox è governance + browser native protection, NON sandbox crittografica
 * completa. Renwa Mar 2026 + CVE-2024-49038 mitigation. Vedi PRD §44 + REQ MF-SEC-01..04.
 *
 * @example Install F15 iframe loader (W2/W3 attiva real logic)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { isolationModule } from '@gluezero/isolation'
 * import '@gluezero/mf-iframe/augment'  // F15 — intent signaling
 * import { iframeLoader } from '@gluezero/mf-iframe'
 *
 * const broker = createBroker({
 *   modules: [
 *     microfrontendModule(),
 *     isolationModule({ resolvers: { iframeLoader } }), // F13 sblocco D-V2-F15-21
 *   ],
 * })
 * const service = broker.modules.get('@gluezero/microfrontends')
 * service.registerLoader(iframeLoader())
 * ```
 *
 * @packageDocumentation
 * @see PRD §26 (Iframe Loader + Bridge), §44 (Security)
 */

// Side-effect import — Pattern S1 intent signaling (D-V2-F15-19 stretto).
import './augment'

// Augment marker (tree-shake fail detection).
export { __mfIframeAugmentLoaded } from './augment'

// ===== Runtime exports (Wave 2 — Plan 15-03 fill: D-V2-09 closure) =====

// LoaderAdapter factory (Plan 15-03 W2 fill: body Valibot + LRU + rate-limit + replay
// + expectedOrigin + targetOrigin ban + bridge handshake + IframeAdapter.createSandbox F13 sblocco)
export { iframeLoader } from './iframe-loader'

// Error class + types pubblici (Plan 15-03 W2 fill: completeness)
export {
  type CreateMfIframeErrorParams,
  MfIframeError,
  type MfIframeErrorCode,
} from './errors'

// Type narrowing LoaderDefinition + bridge message types
export type { IframeLoaderDefinition } from './types/descriptor'
export type { IframeBridgeMessageType } from './types/bridge-message'

// Topics literal F15 + type union
export { MF_IFRAME_TOPICS, type MfIframeTopic } from './topics'
