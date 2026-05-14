/**
 * `@gluezero/fallbacks/augment` — Side-effect-only intent signaling entry point.
 *
 * Pattern S1 stretto F14 (D-V2-F14-19 lockato — carryover D-V2-F13-20 stretto F13
 * + D-V2-F11-17 stretto F11 + D-V2-F10-17 stretto F10 + D-V2-F9-02 stretto F9 +
 * D-V2-F12).
 *
 * Il file è side-effect-only: documenta l'intent del consumer di usare il modulo
 * `@gluezero/fallbacks` (segnale architetturale + abilitazione type-only
 * declaration narrowing tramite import del modulo `./types/descriptor-augment.js`)
 * ed esporta il marker `__fallbacksAugmentLoaded` per audit-grep tree-shake fail
 * detection. Il file è preservato dal bundler consumer grazie a
 * `sideEffects: ["./dist/augment.js"]` in `packages/fallbacks/package.json`.
 *
 * NO declaration merging upstream a `@gluezero/core` o `@gluezero/microfrontends`,
 * NO runtime prototype patching — solo marker + side-effect import del modulo
 * `./types/descriptor-augment.js` che esporta `FallbackAwareMfDescriptor` (interface
 * narrowing locale, NO declare module upstream).
 *
 * Runtime install è SEMPRE esplicito via:
 * `createBroker({ modules: [microfrontendModule(), fallbacksModule({...})] })`.
 *
 * @example Pattern S1 chained augment imports (opt-in DX)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import '@gluezero/microfrontends/augment'
 * import '@gluezero/fallbacks/augment'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { fallbacksModule } from '@gluezero/fallbacks'
 *
 * const broker = createBroker({
 *   modules: [
 *     microfrontendModule(),
 *     fallbacksModule({
 *       defaultPolicy: { onLoadError: { type: 'html', html: '<div>App unavailable</div>' } },
 *       retryDefault: { attempts: 3, delayMs: 100, backoff: 'exponential', jitter: true },
 *     }),
 *   ],
 * })
 * ```
 *
 * @example Audit grep tree-shake fail detection post-build
 * ```sh
 * grep "__fallbacksAugmentLoaded" packages/fallbacks/dist/augment.js
 * ```
 *
 * @throws Mai — il modulo è side-effect-only intent signaling puro.
 *
 * @see prd_2.0.0.md §6.4 (Pattern S1), §29 (Fallback module)
 * @see D-V2-F14-19 (augment side-effect stretto carryover F11/F12/F13)
 * @see packages/isolation/src/augment.ts (F13 reference stretto pattern)
 * @packageDocumentation
 */

// Side-effect import — forza inclusione `FallbackAwareMfDescriptor` interface
// type-only nel bundle augment.js (tree-shake fail-safe via sideEffects array).
import './types/descriptor-augment.js'

/**
 * Marker per audit tree-shake fail detection (carryover Pattern S1 F2/F8/F9/F10/F11/F12/F13).
 *
 * Audit-able runtime check:
 * ```sh
 * grep "__fallbacksAugmentLoaded" packages/fallbacks/dist/augment.js
 * ```
 * Deve restituire match — verifica che il bundler consumer NON abbia tree-shakato
 * il side-effect file (l'array `sideEffects` nel `package.json` deve aver effetto).
 *
 * @see D-V2-F14-19 (Pattern S1 stretto F14 — NO declaration merging upstream a core,
 *   NO prototype patching, marker side-effect only)
 */
export const __fallbacksAugmentLoaded: true = true
