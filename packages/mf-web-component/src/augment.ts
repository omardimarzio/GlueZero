/**
 * `@gluezero/mf-web-component/augment` — Side-effect-only intent signaling entry point
 * (Pattern S1 stretto F15, D-V2-F15-19 lockato — carryover F9/F10/F11/F12/F13/F14).
 *
 * Importare questo modulo come side-effect (`import '@gluezero/mf-web-component/augment'`):
 * - NON aggiunge alcun metodo al prototype del Broker.
 * - NON contiene blocchi TS di module augmentation verso `@gluezero/core` (vincolo più
 *   stretto di F2/F8).
 * - NON esegue auto-install runtime sul broker (impossibile — D-30 anti-singleton).
 *
 * Cosa FA il file (intent signaling puro):
 * - Documenta l'intent del consumer di usare il loader Web Component (segnale architetturale).
 * - Esporta `__mfWcAugmentLoaded` marker per audit grep tree-shake fail detection.
 * - Il file è preservato dal bundler consumer grazie a `sideEffects: ["./dist/augment.js"]`
 *   in `packages/mf-web-component/package.json`, anche se il barrel
 *   `@gluezero/mf-web-component` non viene direttamente importato.
 *
 * @example Pattern S1 chained augment imports (opt-in DX)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import '@gluezero/microfrontends/augment'        // F8 — espone broker.loadMicroFrontend(id), etc.
 * import '@gluezero/mf-web-component/augment'      // F15 — intent signaling (no DX surface).
 * import { microfrontendModule } from '@gluezero/microfrontends'
 *
 * const broker = createBroker({ modules: [microfrontendModule()] })
 * // Loader registrato lato consumer via service.registerLoader(webComponentLoader)
 * ```
 *
 * @example Audit tree-shake fail detection post-build
 * ```sh
 * # Verifica che il bundler NON abbia tree-shakato il side-effect file.
 * grep "__mfWcAugmentLoaded" packages/mf-web-component/dist/augment.js
 * ```
 *
 * @throws Mai — il modulo augment è side-effect-only intent signaling puro.
 *
 * @see PRD §6.4 (Pattern S1), §22 (Loader Registry API), §25 (Web Component loader)
 * @see D-V2-F15-19 (Pattern S1 stretto F15 carryover F9..F14)
 * @see packages/mf-esm/src/augment.ts (F9 pattern reference diretto)
 * @see packages/fallbacks/src/augment.ts (F14 pattern reference più recente)
 * @packageDocumentation
 */

// NOTA — D-V2-F15-19 lockato (vincolo più stretto di F2/F8):
// - NESSUN blocco TS di module augmentation verso `@gluezero/core` qui.
// - NESSUNA estensione del prototype host a runtime.
// Audit gate strict (post-build): verificare zero occorrenze dei pattern vietati
// nel file source (gate D-V2-F15-19 enforced in CI W3 P05 verifier reale).

/**
 * Marker per audit tree-shake fail detection (carryover Pattern S1
 * F9 `__mfEsmAugmentLoaded` / F14 `__microfrontendErrorAugmentLoaded`).
 *
 * Audit-able runtime check:
 * ```sh
 * grep "__mfWcAugmentLoaded" packages/mf-web-component/dist/augment.js
 * ```
 * Deve restituire match — verifica che il bundler consumer NON abbia tree-shakato
 * il side-effect file.
 *
 * @see D-V2-F15-19 mitigation tree-shake fail detection
 */
export const __mfWcAugmentLoaded: true = true
