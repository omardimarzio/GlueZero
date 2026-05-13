/**
 * `@gluezero/isolation/augment` — Side-effect-only intent signaling entry point.
 *
 * Pattern S1 stretto F13 (D-V2-F13-20 lockato — carryover D-V2-F11-17 stretto F11
 * + D-V2-F10-17 stretto F10 + D-V2-F9-02 stretto F9 + D-V2-F12).
 *
 * Il file è side-effect-only: documenta l'intent del consumer di usare il modulo
 * `@gluezero/isolation` (segnale architetturale + abilitazione declaration merging
 * tramite import) ed esporta il marker `__isolationAugmentLoaded` per audit-grep
 * tree-shake fail detection. Il file è preservato dal bundler consumer grazie a
 * `sideEffects: ["./dist/augment.js"]` in `packages/isolation/package.json`.
 *
 * Declaration merging type-only:
 * - `MicroFrontendRuntimeContext` aggiunge `storage?` + `worker?` + `shadowContainer?`
 *   (Pattern S1 type-only — NO modifica `packages/microfrontends/src/`).
 * - `MicroFrontendDescriptor` narrowing via `IsolationAwareMfDescriptor` interface
 *   extension (NO declaration merging upstream, helper accessor `getIsolation`/`getThemePolicy`).
 *
 * NO declaration merging upstream a `@gluezero/core`, NO runtime prototype patching —
 * solo marker + declaration merging type-only su `@gluezero/microfrontends`
 * `MicroFrontendRuntimeContext` (slot dedicato F8 lockato).
 *
 * Runtime install è SEMPRE esplicito via:
 * `createBroker({ modules: [microfrontendModule(), contextModule(), permissionsModule(), isolationModule({...})] })`.
 *
 * @example Pattern S1 chained augment imports (opt-in DX)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import '@gluezero/microfrontends/augment'
 * import '@gluezero/context/augment'
 * import '@gluezero/permissions/augment'
 * import '@gluezero/isolation/augment'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { contextModule } from '@gluezero/context'
 * import { permissionsModule } from '@gluezero/permissions'
 * import { isolationModule } from '@gluezero/isolation'
 *
 * const broker = createBroker({
 *   modules: [
 *     microfrontendModule(),
 *     contextModule(),
 *     permissionsModule(),
 *     isolationModule({
 *       policyDefault: { dom: 'shadow-dom', css: 'shadow-dom' },
 *       resolvers: { gateway: () => gw, worker: () => wk, theme: () => th },
 *     }),
 *   ],
 * })
 * ```
 *
 * @example Audit grep tree-shake fail detection post-build
 * ```sh
 * grep "__isolationAugmentLoaded" packages/isolation/dist/augment.js
 * ```
 *
 * @throws Mai — il modulo è side-effect-only intent signaling puro.
 *
 * @see PRD §6.4 (Pattern S1), §21 (Isolation), §11 (Theme)
 * @see D-V2-F13-20 (augment side-effect stretto carryover F11/F12)
 * @see packages/permissions/src/augment.ts (F11 reference stretto pattern)
 * @packageDocumentation
 */

/**
 * Marker per audit tree-shake fail detection (carryover Pattern S1 F2/F8/F9/F10/F11/F12).
 *
 * Audit-able runtime check:
 * ```sh
 * grep "__isolationAugmentLoaded" packages/isolation/dist/augment.js
 * ```
 * Deve restituire match — verifica che il bundler consumer NON abbia tree-shakato
 * il side-effect file (l'array `sideEffects` nel `package.json` deve aver effetto).
 *
 * @see D-V2-F13-20 (Pattern S1 stretto F13 — NO declaration merging upstream a core,
 *   NO prototype patching, marker side-effect only)
 */
export const __isolationAugmentLoaded: true = true
