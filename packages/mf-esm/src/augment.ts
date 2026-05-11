/**
 * `@gluezero/mf-esm/augment` — Side-effect-only auto-install entry point (Pattern S1).
 *
 * Importare questo modulo come side-effect attiva l'auto-registrazione del loader ESM
 * sul prossimo broker creato (D-V2-F9-01). NON aggiunge alcun metodo a `Broker.prototype`
 * (D-V2-F9-02 — vincolo più stretto di F2/F8): la DX consumer è già coperta da
 * `service.load(id)` e `broker.loadMicroFrontend(id)` (esposti da
 * `@gluezero/microfrontends/augment`), quindi F9 NON espande la surface API broker.
 *
 * Il file esiste come "intent signaling puro":
 * - segnala al bundler che il subpath va preservato (sideEffects array nel package.json)
 * - segnala al consumer/audit-grep che l'install runtime avverrà via
 *   `modules: [microfrontendModule(), mfEsmModule()]` nel `createBroker({})`
 *
 * Threat coverage:
 * - T-F9-01 (Tampering — tree-shaker elimina dist/augment.js): mitigato via
 *   `sideEffects` array nel `package.json` (4 entry: dist/src + glob) + marker
 *   `__mfEsmAugmentLoaded` audit-grep post-bundle.
 * - T-F9-02 (Elevation — surface API espansa incontrollatamente): mitigato da
 *   assenza di blocchi TS `decl-module` di augmentation verso `@gluezero/core` —
 *   augment è side-effect-only, NESSUN metodo nuovo su `Broker.prototype`.
 *
 * @example
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { mfEsmModule } from '@gluezero/mf-esm'
 * import '@gluezero/microfrontends/augment'  // Pattern S1 F8 (type augment Broker)
 * import '@gluezero/mf-esm/augment'          // Pattern S1 F9 (intent signaling puro)
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), mfEsmModule()],
 * })
 * // esmLoader registrato — descriptor con loader.type === 'esm' supportato.
 * ```
 *
 * @see PRD §6.4 (Pattern S1), §22 (Loader Registry API), §23 (ESM loader),
 *   D-V2-F9-01 (install pattern), D-V2-F9-02 (NO Broker.prototype augment)
 */

// NOTA — D-V2-F9-02 lockato:
// NESSUN blocco TS `decl-module` verso `@gluezero/core` con interface Broker qui.
// Differenza chiave vs F2/F8: questo augment NON estende `Broker.prototype` né a
// runtime né a type-level. Audit gate strict: la stringa esatta `decl<NUL>are mod` +
// `ule` non deve apparire nel file source (grep strict count === 0).
//
// TODO Wave 2 (Plan 09-04): valutare side-effect import a `./mf-esm-module` come
// signaling addizionale. Per ora il file è puro marker + JSDoc.

/**
 * Marker per audit tree-shake fail detection (T-F9-01 mitigation, carryover
 * Pattern S1 F2 `__mapperAugmentLoaded` / F8 `__mfAugmentLoaded`).
 *
 * Audit-able runtime check:
 * ```sh
 * grep "__mfEsmAugmentLoaded" packages/mf-esm/dist/augment.js
 * ```
 * Deve restituire match — verifica che il bundler consumer NON abbia tree-shakato
 * il side-effect file (l'array `sideEffects` nel `package.json` deve aver effetto).
 *
 * @see T-F9-01 mitigation in `<threat_model>` di `09-01-PLAN.md`
 */
export const __mfEsmAugmentLoaded: true = true
