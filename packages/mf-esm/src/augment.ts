/**
 * `@gluezero/mf-esm/augment` — Side-effect-only intent signaling entry point
 * (Pattern S1 stretto F9, D-V2-F9-02 lockato).
 *
 * Importare questo modulo come side-effect (`import '@gluezero/mf-esm/augment'`):
 * - NON aggiunge alcun metodo al prototype del Broker (D-V2-F9-02 lockato).
 * - NON contiene blocchi TS di module augmentation verso `@gluezero/core`
 *   (vincolo più stretto di F2/F8).
 * - NON esegue auto-install runtime sul broker (impossibile — D-30 anti-singleton:
 *   nessun broker globale esiste; runtime install è sempre esplicito via
 *   `createBroker({ modules: [...] })`).
 *
 * Cosa FA il file (intent signaling puro):
 * - Documenta l'intent del consumer di usare il loader ESM (segnale architetturale).
 * - Esporta `__mfEsmAugmentLoaded` marker per audit grep tree-shake fail detection.
 * - Il file è preservato dal bundler consumer grazie a `sideEffects: ["./dist/augment.js"]`
 *   in `packages/mf-esm/package.json` (T-F9-01 mitigation), anche se il barrel
 *   `@gluezero/mf-esm` non viene direttamente importato.
 *
 * **Pattern reference F2/F8 (post-iter-2 verification):**
 * - `packages/mapper/src/augment.ts` (F2): contiene blocco di module augmentation
 *   verso `@gluezero/core` per estendere `PluginDescriptor` (type extension F2 D-57).
 * - `packages/microfrontends/src/augment.ts` (F8): contiene blocco di module
 *   augmentation verso `@gluezero/core` per estendere l'interface `Broker` con
 *   sugar method types (`registerMicroFrontend?`, `loadMicroFrontend?`, etc.).
 * - `packages/mf-esm/src/augment.ts` (F9): VARIA — NESSUN blocco di module
 *   augmentation (D-V2-F9-02). Solo marker + JSDoc.
 *
 * **Perché NO prototype augment + NO module augmentation block?**
 * - DX consumer già coperta da `service.load(id)` e `broker.loadMicroFrontend(id)`
 *   (esposti da `@gluezero/microfrontends/augment` F8 — D-V2-F9-02).
 * - Surface API broker ridotta = bundle gain + tree-shake friendly.
 * - Cross-loader compatibility: F15 aggiungerà `mf-iframe`/`mf-web-component`/etc.
 *   con stesso pattern stretto F9, mai metodi pubblici su broker per ogni loader.
 *
 * **Semantica "auto-install" in D-V2-F9-01 (chiarito CONTEXT.md iter 2):**
 * "side-effect import preservato da sideEffects whitelist + marker audit-grep".
 * NON significa runtime auto-install sul broker globale (impossibile per D-30
 * anti-singleton). Runtime install è sempre esplicito via
 * `createBroker({ modules: [microfrontendModule(), mfEsmModule()] })`.
 *
 * Threat coverage:
 * - T-F9-01 (Tampering — tree-shaker elimina dist/augment.js): mitigato via
 *   `sideEffects` array nel `package.json` (4 entry: dist/src + glob) + marker
 *   `__mfEsmAugmentLoaded` audit-grep post-bundle.
 * - T-F9-02 (Elevation — surface API espansa incontrollatamente): mitigato da
 *   assenza di blocchi TS di module augmentation verso `@gluezero/core` —
 *   augment è side-effect-only intent signaling puro, NESSUN metodo nuovo su
 *   prototype Broker o type-level extension.
 *
 * @example Pattern S1 chained augment imports (opt-in DX)
 * ```ts
 * import { createBroker } from '@gluezero/core'
 * import '@gluezero/microfrontends/augment'  // F8 — espone broker.loadMicroFrontend(id), etc.
 * import '@gluezero/mf-esm/augment'          // F9 — intent signaling (no DX surface).
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { mfEsmModule } from '@gluezero/mf-esm'
 *
 * const broker = createBroker({
 *   modules: [microfrontendModule(), mfEsmModule()],
 * })
 * // broker.registerMicroFrontend(...) + broker.loadMicroFrontend(id) supportati
 * // grazie all'augment F8 — F9 NON aggiunge ulteriore surface.
 * ```
 *
 * @see PRD §6.4 (Pattern S1), §22 (Loader Registry API), §23 (ESM loader)
 * @see D-V2-F9-01 (install lookup), D-V2-F9-02 (NO prototype augment + NO module
 *   augmentation block)
 * @see packages/mapper/src/augment.ts (F2 pattern reference con module augmentation)
 * @see packages/microfrontends/src/augment.ts (F8 pattern reference con module augmentation)
 * @packageDocumentation
 */

// NOTA — D-V2-F9-02 lockato (vincolo più stretto di F2/F8):
// - NESSUN blocco TS di module augmentation verso il package core qui (vs F2/F8
//   che hanno declaration merging type-only sull'interface PluginDescriptor /
//   sull'interface Broker host).
// - NESSUNA estensione del prototype host a runtime (vs F8 che monkey-patcha
//   l'instance host).
// Audit gate strict (post-build): verificare zero occorrenze dei pattern
// vietati nel file source (gate D-V2-F9-02 enforced in CI Plan 09-04).

/**
 * Marker per audit tree-shake fail detection (T-F9-01 mitigation, carryover
 * Pattern S1 F2 `__augmentLoaded` / F8 `__mfAugmentLoaded`).
 *
 * Audit-able runtime check:
 * ```sh
 * grep "__mfEsmAugmentLoaded" packages/mf-esm/dist/augment.js
 * ```
 * Deve restituire match — verifica che il bundler consumer NON abbia tree-shakato
 * il side-effect file (l'array `sideEffects` nel `package.json` deve aver effetto).
 *
 * @see T-F9-01 mitigation in `<threat_model>` di `09-04-PLAN.md`
 */
export const __mfEsmAugmentLoaded: true = true
