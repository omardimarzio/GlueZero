/**
 * `@gluezero/context/augment` — Side-effect-only intent signaling entry point.
 *
 * Pattern S1 stretto F10 (D-V2-F10-17 lockato — replica D-V2-F9-02 stretto).
 *
 * Il file è side-effect-only: documenta l'intent del consumer di usare il modulo
 * `@gluezero/context` (segnale architetturale) ed esporta il marker
 * `__contextAugmentLoaded` per audit-grep tree-shake fail detection. Il file è
 * preservato dal bundler consumer grazie a `sideEffects: ["./dist/augment.js"]`
 * in `packages/context/package.json` (T-F10-W1-02 mitigation).
 *
 * Runtime install è SEMPRE esplicito via:
 * `createBroker({ modules: [microfrontendModule(), contextModule()] })`.
 *
 * Pattern coerente con `packages/mf-esm/src/augment.ts` (F9 reference stretto).
 *
 * @example Pattern S1 chained augment imports (opt-in DX)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import '@gluezero/microfrontends/augment'
 * import '@gluezero/context/augment'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { contextModule } from '@gluezero/context'
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), contextModule()],
 * })
 * ```
 *
 * @example Audit tree-shake fail detection post-build
 * ```sh
 * grep "__contextAugmentLoaded" packages/context/dist/augment.js
 * ```
 *
 * @throws Mai — il modulo è side-effect-only intent signaling puro.
 *
 * @see PRD §6.4 (Pattern S1), §18 (Runtime Context)
 * @see D-V2-F10-17 (augment side-effect stretto carryover F9)
 * @see packages/mf-esm/src/augment.ts (F9 reference stretto pattern)
 * @packageDocumentation
 */

/**
 * Marker per audit tree-shake fail detection (T-F10-W1-02 mitigation, carryover
 * Pattern S1 F2 `__augmentLoaded` / F8 `__mfAugmentLoaded` / F9 `__mfEsmAugmentLoaded`).
 *
 * Audit-able runtime check:
 * ```sh
 * grep "__contextAugmentLoaded" packages/context/dist/augment.js
 * ```
 * Deve restituire match — verifica che il bundler consumer NON abbia tree-shakato
 * il side-effect file (l'array `sideEffects` nel `package.json` deve aver effetto).
 *
 * @see T-F10-W1-02 mitigation in `<threat_model>` di `10-01-PLAN.md`
 */
export const __contextAugmentLoaded: true = true
