/**
 * `@gluezero/mf-module-federation/augment` — Side-effect-only intent signaling entry
 * point (Pattern S1 stretto F15, D-V2-F15-19 lockato — carryover F9..F14).
 *
 * Importare questo modulo come side-effect (`import '@gluezero/mf-module-federation/augment'`):
 * - NON aggiunge alcun metodo al prototype del Broker.
 * - NON contiene blocchi TS di module augmentation verso `@gluezero/core`.
 *
 * @example Pattern S1 chained augment imports (opt-in DX)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import '@gluezero/microfrontends/augment'
 * import '@gluezero/mf-module-federation/augment'  // F15 — intent signaling MF loader.
 * ```
 *
 * @example Audit tree-shake fail detection post-build
 * ```sh
 * grep "__mfMfAugmentLoaded" packages/mf-module-federation/dist/augment.js
 * ```
 *
 * @throws Mai — side-effect-only intent signaling puro.
 *
 * @see PRD §6.4 (Pattern S1), §22 (Loader Registry API), §24 (Module Federation loader experimental)
 * @see D-V2-F15-19 (Pattern S1 stretto F15)
 * @packageDocumentation
 */

/**
 * Marker per audit tree-shake fail detection (carryover Pattern S1 F9/F14).
 *
 * ```sh
 * grep "__mfMfAugmentLoaded" packages/mf-module-federation/dist/augment.js
 * ```
 *
 * @see D-V2-F15-19 mitigation tree-shake fail detection
 */
export const __mfMfAugmentLoaded: true = true
