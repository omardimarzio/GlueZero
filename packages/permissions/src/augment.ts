/**
 * `@gluezero/permissions/augment` — Side-effect-only intent signaling entry point.
 *
 * Pattern S1 stretto F11 (D-V2-F11-17 lockato — replica D-V2-F10-17 stretto F10
 * + carryover D-V2-F9-02 stretto F9).
 *
 * Il file è side-effect-only: documenta l'intent del consumer di usare il modulo
 * `@gluezero/permissions` (segnale architetturale) ed esporta il marker
 * `__permissionsAugmentLoaded` per audit-grep tree-shake fail detection. Il file è
 * preservato dal bundler consumer grazie a `sideEffects: ["./dist/augment.js"]`
 * in `packages/permissions/package.json`.
 *
 * NO declaration merging upstream, NO runtime prototype patching — solo marker.
 *
 * Runtime install è SEMPRE esplicito via:
 * `createBroker({ modules: [microfrontendModule(), contextModule(), permissionsModule()] })`.
 *
 * @example Pattern S1 chained augment imports (opt-in DX)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import '@gluezero/microfrontends/augment'
 * import '@gluezero/context/augment'
 * import '@gluezero/permissions/augment'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { contextModule } from '@gluezero/context'
 * import { permissionsModule } from '@gluezero/permissions'
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), contextModule(), permissionsModule()],
 * })
 * ```
 *
 * @example Audit grep tree-shake fail detection post-build
 * ```sh
 * grep "__permissionsAugmentLoaded" packages/permissions/dist/augment.js
 * ```
 *
 * @throws Mai — il modulo è side-effect-only intent signaling puro.
 *
 * @see PRD §6.4 (Pattern S1), §17 (Capabilities), §19 (Permissions)
 * @see D-V2-F11-17 (augment side-effect stretto carryover F10)
 * @see packages/context/src/augment.ts (F10 reference stretto pattern)
 * @packageDocumentation
 */

/**
 * Marker per audit tree-shake fail detection (carryover Pattern S1 F2/F8/F9/F10).
 *
 * Audit-able runtime check:
 * ```sh
 * grep "__permissionsAugmentLoaded" packages/permissions/dist/augment.js
 * ```
 * Deve restituire match — verifica che il bundler consumer NON abbia tree-shakato
 * il side-effect file (l'array `sideEffects` nel `package.json` deve aver effetto).
 *
 * @see D-V2-F11-17 (Pattern S1 stretto F11 — NO declaration merging, NO prototype patching)
 */
export const __permissionsAugmentLoaded: true = true
