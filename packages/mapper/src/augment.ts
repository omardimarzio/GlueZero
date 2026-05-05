// augment.ts — TS declaration merging per estendere @gluezero/core con i tipi F2.
// (D-49, D-50, D-56, D-57 in 02-CONTEXT.md)
//
// Vincolo D-49: NESSUNA modifica a packages/core/src/. Solo TS declaration merging dal
// package mapper. Questo file è il PUNTO UNICO di chiusura dei `unknown` placeholder F1.
//
// Cosa estende:
//   - PluginDescriptor (interface) — aggiunge inputMap, outputMap, canonicalSchemaId
//     come campi opzionali readonly (D-57 — chiude i placeholder F1 in
//     packages/core/src/types/plugin.ts:48-51 commento "F2 will add: inputMap, outputMap").
//   - BrokerConfig (interface) — sostituisce `unknown` placeholder con tipi specifici
//     per le sezioni canonicalModel, aliasRegistry, transforms (D-56 — chiude i
//     placeholder F1 in packages/core/src/types/config.ts:53-58).
//
// Cosa NON estende qui:
//   - PipelineStep (type alias literal): TS NON supporta declaration merging di type
//     alias. Strategia: il barrel `@gluezero/mapper` ri-esporta `F2PipelineStep`
//     come literal union additive con i 5 nuovi step (D-50). Il consumer che usa
//     i tap F2 dichiara `step: PipelineStep | F2PipelineStep`. F1 step da
//     `@gluezero/core` (subset) restano validi senza modifiche.
//
// Side-effect import: `packages/mapper/src/index.ts` importa questo file per side-effect
// (`import './augment'` PRIMA degli export). Il package.json ha
// `sideEffects: ["./dist/augment.js"]` (array) per evitare tree-shaking accidentale del
// side-effect file da bundler aggressivi (T-02-09-01 mitigation).
//
// Audit-able: `__augmentLoaded` const fornisce una runtime check che il modulo è stato
// caricato (utile per test e per debugging consumer-side).
//
// Threat coverage:
// - T-02-09-01 (Tampering — tree-shaker elimina dist/augment.js): mitigate via
//   `sideEffects: ["./dist/augment.js"]` array nel package.json + `__augmentLoaded`
//   export const.
// - T-02-09-02 (Information disclosure — augment espone inputMap/outputMap a consumer
//   che NON usano mapper): accept. I field sono opzionali, readonly, default `undefined`;
//   consumer F1-only non sono impattati.
// - T-02-09-03 (Tampering — augment estende interface non-additive): mitigate. TS
//   interface merging è additive per costruzione. F1 PluginDescriptor con i suoi
//   field (id/version/displayName/onRegister/onMount/onUnmount/onDestroy) rimane
//   intatto; F2 aggiunge SOLO field opzionali. Test backward-compat verifica.
// - T-02-09-04 (Repudiation — augment scope ambiguous): mitigate via JSDoc esplicita
//   "F2 augmentation" + reference D-56/D-57 + reference ai placeholder F1 (commenti
//   nel file source).
// - T-02-09-05 (DoS — PipelineStep type alias non extendibile causa cast workaround):
//   accept. Documentato qui + nel barrel index.ts. F6 potrà refactor PipelineStep da
//   type alias a interface union per veri declaration merging.

import type { CanonicalSchema, CanonicalSchemaId } from './types/canonical-schema'
import type { InputMap, OutputMap } from './types/input-output-map'
import type { TransformFn } from './types/transform'

declare module '@gluezero/core' {
  /**
   * F2 augmentation (D-57): aggiunge `inputMap`, `outputMap`, `canonicalSchemaId` al
   * PluginDescriptor pubblico di `@gluezero/core`.
   *
   * Chiude i placeholder F1 in `packages/core/src/types/plugin.ts:48-51` (commento
   * "F2 will add: inputMap, outputMap, requires, provides").
   *
   * Tutti opzionali e readonly per backward-compat con F1 (T-02-09-03 mitigation):
   * F1 PluginDescriptor minimale `{ id: 'x' }` continua a essere valido dopo l'augmentation.
   */
  interface PluginDescriptor {
    /** Mappa locale → canonico per plugin publisher (PRD §15.2, REQ MAP-03). */
    readonly inputMap?: InputMap
    /** Mappa canonico → locale per plugin consumer (PRD §15.2, REQ MAP-03). */
    readonly outputMap?: OutputMap
    /** Id del canonical schema dichiarato dal plugin (D-57, REQ MAP-02). */
    readonly canonicalSchemaId?: CanonicalSchemaId
  }

  /**
   * F2 augmentation (D-56): sostituisce `unknown` placeholder con tipi specifici per
   * le sezioni `canonicalModel`, `aliasRegistry`, `transforms` di `BrokerConfig`.
   *
   * Chiude i placeholder F1 in `packages/core/src/types/config.ts:53-58` (commento
   * "F2-F6 placeholder sections — validated as unknown").
   *
   * NOTA: TypeScript permette interface merging che SOSTITUISCE field con tipi più
   * specifici (`unknown` → `{ schemas?: ... }` è restringimento, non breaking — il
   * runtime accetta sempre il subset più ristretto).
   */
  interface BrokerConfig {
    /** Sezione canonicalModel (D-56, PRD §27): lista di canonical schemas pre-registrati al boot. */
    canonicalModel?: {
      readonly schemas?: readonly CanonicalSchema[]
    }
    /** Sezione aliasRegistry (D-56, PRD §27): alias canonici globali e plugin-scoped. */
    aliasRegistry?: {
      readonly global?: Readonly<Record<string, string>>
      readonly scoped?: Readonly<Record<string, Readonly<Record<string, string>>>>
    }
    /** Sezione transforms (D-56, PRD §27, REQ MAP-12): transforms registrate al boot via `registerTransform(name, fn)`. */
    transforms?: Readonly<Record<string, TransformFn>>
  }
}

/**
 * Marker const esportato per detection runtime del side-effect import.
 *
 * Esistenza:
 * 1. Forza il file a essere considerato un "module" (vs ambient declarations) — già
 *    soddisfatto dagli `import type` sopra ma double-safety.
 * 2. Permette ai test (`augment.test.ts`) di verificare che `import './augment'` non
 *    venga tree-shaken dal bundler (T-02-09-01 mitigation diretta).
 * 3. Audit-able: `grep "__augmentLoaded" dist/` permette di confermare il side-effect
 *    è presente nel bundle distribuito.
 */
export const __augmentLoaded: true = true
