/**
 * Pattern S1 declaration merging — `Broker` augmented con metodi sugar MF (D-V2-01).
 *
 * Side-effect import: `import '@gluezero/microfrontends/augment'` attiva il
 * declaration merging TS (compile-time) — i metodi sugar sono già patchati a
 * runtime dal `module.install()` (`microfrontend-module.ts`).
 *
 * Tutti i metodi sono `?` optional per gracefully degrade quando il modulo non
 * è installato (TS narrows a `undefined`).
 *
 * Vincolo: `package.json` `sideEffects` array referenzia `./dist/augment.js` per
 * impedire tree-shaking accidentale del side-effect file (3-layer T-F8-08
 * mitigation: array sideEffects + `__mfAugmentLoaded` marker + side-effect import).
 *
 * Threat coverage:
 * - T-F8-08 (Tampering — tree-shaker elimina dist/augment.js): mitigate via
 *   sideEffects array nel package.json + `__mfAugmentLoaded` export const audit grep.
 * - T-F8-09 (Information disclosure — augment espone metodi MF a consumer non-modulati):
 *   accept. I metodi sono opzionali `?` e undefined runtime; consumer v1.x senza
 *   modules: zero impatto.
 *
 * @see RESEARCH §9 + PATTERNS §22 + D-V2-01 BLOCKING
 */

import type { ListFilter, LoadOptions, MicroFrontendDebugSnapshot, MountOptions } from './registry'
import type { MicroFrontendDescriptor, MicroFrontendRegistration } from './types/descriptor'
import type { MicroFrontendState } from './types/lifecycle'

declare module '@gluezero/core' {
  interface Broker {
    /**
     * Sugar per `getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS).register(d)`.
     * Attivato via `import '@gluezero/microfrontends/augment'`.
     *
     * @throws `BrokerError` con `code: 'MF_DESCRIPTOR_INVALID'` se descriptor Valibot
     *   validation fail (D-V2-11 BLOCKING).
     */
    registerMicroFrontend?(descriptor: MicroFrontendDescriptor): Promise<void>

    /** Sugar per `service.unregister(id)`. */
    unregisterMicroFrontend?(id: string, options?: { force?: boolean }): Promise<void>

    /** Sugar per `service.get(id)`. */
    getMicroFrontend?(id: string): MicroFrontendRegistration | undefined

    /** Sugar per `service.list(filter?)`. */
    getMicroFrontends?(filter?: ListFilter): readonly MicroFrontendRegistration[]

    /** Sugar per `service.getState(id)`. */
    getMicroFrontendState?(id: string): MicroFrontendState | undefined

    /** Sugar per `service.getSnapshot(id?)`. */
    getMicroFrontendSnapshot?(id?: string): MicroFrontendDebugSnapshot | undefined

    /** Sugar per `service.load(id)` (W3 wired). */
    loadMicroFrontend?(id: string, options?: LoadOptions): Promise<void>

    /** Sugar per `service.mount(id)` (W3 wired). */
    mountMicroFrontend?(id: string, options?: MountOptions): Promise<void>

    /** Sugar per `service.unmount(id)` (W3 wired). */
    unmountMicroFrontend?(id: string): Promise<void>

    /** Sugar per `service.destroy(id)` (W3 wired). */
    destroyMicroFrontend?(id: string, options?: { force?: boolean }): Promise<void>
  }
}

/**
 * Marker for tree-shake fail detection (T-F8-08 mitigation, T-02-09-01 F2 carryover).
 *
 * Audit-able runtime check: `grep "__mfAugmentLoaded" packages/microfrontends/dist/augment.js`
 * deve restituire match — verifica che bundler non abbia tree-shakato il side-effect file.
 */
export const __mfAugmentLoaded: true = true
