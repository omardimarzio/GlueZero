/**
 * `@gluezero/devtools/mf-inspector/augment` — Side-effect-only intent signaling marker.
 *
 * **Pattern S1 stretto F16 (D-V2-F16-19 — carryover F14 `packages/fallbacks/src/augment.ts`).**
 *
 * NO declaration merging upstream (NON augmenta interface esterne come `@gluezero/core`).
 * NO runtime prototype patching. NO side-effect runtime — solo un marker `true` constant
 * esportato per detection tree-shake-fail (analog F8 `__mfAugmentLoaded` + F14
 * `__fallbacksAugmentLoaded`).
 *
 * **Uso intended:** consumer V2.0 può `import '@gluezero/devtools/mf-inspector/augment'`
 * come side-effect import (sebbene in V2 baseline il subpath non augmenti nessuna
 * interface — reserved per V2.1+ extension).
 *
 * @see D-V2-F16-19 — tsup multi-entry subpath + Pattern S1
 * @see packages/fallbacks/src/augment.ts — F14 template stretto
 * @see packages/microfrontends/src/augment.ts — F8 origine Pattern S1 (declaration merging)
 * @packageDocumentation
 */

/**
 * Marker constant per detection side-effect-import + tree-shake-fail (T-F16-08 mitigation).
 *
 * Se questo simbolo è `undefined` al runtime → il bundler ha tree-shaken il file
 * augment.ts (probabile mis-config `sideEffects` in `package.json`).
 */
export const __mfInspectorAugmentLoaded: true = true
