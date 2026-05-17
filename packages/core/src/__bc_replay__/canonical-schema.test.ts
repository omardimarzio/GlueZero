/**
 * v1-bc-replay — PRD §42.2 API #9 freeze: registerCanonicalSchema preserved.
 *
 * NOTE: F8 W1-P02 — `registerCanonicalSchema` è API esposta solo con
 * `@gluezero/mapper` installato (Pattern S1 augment via declaration merging,
 * D-V2-01). Su core PRISTINE l'API NON è disponibile (corretto, opt-in F2).
 *
 * Strategy Variant B (D-V2-F8-08 traceability): `describe.skip` con commento di
 * tracking. Il package F2 quando arriverà avrà la propria suite BC.
 *
 * @see .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-RESEARCH.md §7
 * @see D-V2-F8-08 suite content #5
 */
import { describe, it } from 'vitest'

describe.skip('v1-bc-replay: canonical schema (API #9) — moved to @gluezero/mapper', () => {
  // registerCanonicalSchema esposta solo con `@gluezero/mapper` installato
  // (Pattern S1 augment, D-V2-01).
  // Verifica BC in `packages/mapper/src/__bc_replay__/canonical-schema.test.ts`
  // quando il package F2 sarà disponibile.
  it('registerCanonicalSchema preserves v1.x signature', () => {
    // Implementazione presso @gluezero/mapper (F2 package).
  })
})
