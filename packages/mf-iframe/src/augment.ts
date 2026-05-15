/**
 * `@gluezero/mf-iframe/augment` — Side-effect-only intent signaling entry point
 * (Pattern S1 stretto F15, D-V2-F15-19 lockato — carryover F9/F10/F11/F12/F13/F14).
 *
 * Importare questo modulo come side-effect (`import '@gluezero/mf-iframe/augment'`):
 * - NON aggiunge alcun metodo al prototype del Broker.
 * - NON contiene blocchi TS di module augmentation verso `@gluezero/core`.
 * - NON esegue auto-install runtime sul broker (D-30 anti-singleton).
 *
 * Cosa FA il file (intent signaling puro):
 * - Documenta l'intent del consumer di usare il loader iframe (segnale architetturale).
 * - Esporta `__mfIframeAugmentLoaded` marker per audit grep tree-shake fail detection.
 *
 * @example Pattern S1 chained augment imports (opt-in DX)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import '@gluezero/microfrontends/augment'
 * import '@gluezero/mf-iframe/augment'             // F15 — intent signaling iframe loader.
 * import { microfrontendModule } from '@gluezero/microfrontends'
 *
 * const broker = createBroker({ modules: [microfrontendModule()] })
 * ```
 *
 * @example Audit tree-shake fail detection post-build
 * ```sh
 * grep "__mfIframeAugmentLoaded" packages/mf-iframe/dist/augment.js
 * ```
 *
 * @throws Mai — side-effect-only intent signaling puro.
 *
 * @see PRD §6.4 (Pattern S1), §22 (Loader Registry API), §26 (Iframe loader + bridge)
 * @see D-V2-F15-19 (Pattern S1 stretto F15 carryover F9..F14)
 * @see packages/mf-esm/src/augment.ts (F9 pattern reference diretto)
 * @packageDocumentation
 */

/**
 * Marker per audit tree-shake fail detection (carryover Pattern S1 F9/F14).
 *
 * ```sh
 * grep "__mfIframeAugmentLoaded" packages/mf-iframe/dist/augment.js
 * ```
 *
 * @see D-V2-F15-19 mitigation tree-shake fail detection
 */
export const __mfIframeAugmentLoaded: true = true
