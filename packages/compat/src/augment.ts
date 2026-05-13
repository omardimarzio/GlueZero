/**
 * `@gluezero/compat/augment` — Side-effect-only intent signaling entry point.
 *
 * Pattern S1 stretto F12 (carryover D-V2-F11-17 lockato F11 — replica D-V2-F10-17 stretto F10).
 *
 * Il file è side-effect-only: documenta l'intent del consumer di usare il modulo
 * `@gluezero/compat` (segnale architetturale) ed esporta il marker
 * `__compatAugmentLoaded` per audit-grep tree-shake fail detection. Il file è
 * preservato dal bundler consumer grazie a `sideEffects: ["./dist/augment.js"]`
 * in `packages/compat/package.json`.
 *
 * NO declaration merging upstream (NO `declare module '@gluezero/microfrontends'`),
 * NO runtime prototype patching — solo marker per audit-grep tree-shake fail detection.
 *
 * Runtime install è SEMPRE esplicito via:
 * `createBroker({ modules: [microfrontendModule(), compatModule()] })`.
 *
 * @example Pattern S1 chained augment imports (opt-in DX)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import '@gluezero/microfrontends/augment'
 * import '@gluezero/compat/augment'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { compatModule } from '@gluezero/compat'
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), compatModule({ compatibilityPolicy: 'warn' })],
 * })
 * ```
 *
 * @example Audit grep tree-shake fail detection post-build
 * ```sh
 * grep "__compatAugmentLoaded" packages/compat/dist/augment.js
 * ```
 *
 * @throws Mai — il modulo è side-effect-only intent signaling puro.
 *
 * @see PRD §6.4 (Pattern S1), §20 (Compatibility module)
 * @see D-V2-F11-17 (Pattern S1 stretto carryover F10)
 * @see packages/permissions/src/augment.ts (F11 reference stretto pattern)
 * @packageDocumentation
 */

/**
 * Marker per audit tree-shake fail detection (carryover Pattern S1 F2/F8/F9/F10/F11).
 *
 * Audit-able runtime check:
 * ```sh
 * grep "__compatAugmentLoaded" packages/compat/dist/augment.js
 * ```
 * Deve restituire match — verifica che il bundler consumer NON abbia tree-shakato
 * il side-effect file (l'array `sideEffects` nel `package.json` deve aver effetto).
 *
 * @see D-V2-F11-17 (Pattern S1 stretto — NO declaration merging, NO prototype patching)
 */
export const __compatAugmentLoaded: true = true
