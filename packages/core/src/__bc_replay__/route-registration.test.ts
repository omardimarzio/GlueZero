/**
 * v1-bc-replay — PRD §42.2 API #7+#8 freeze: registerRoute + unregisterRoute pattern match.
 *
 * NOTE: F8 W1-P02 — routing API NON è esposta da `@gluezero/core` barrel in v1.x
 * (verificato in `packages/core/src/index.ts`). Routing è planned per F3 package
 * `@gluezero/routing` (vedi PROJECT.md roadmap table).
 *
 * Strategy Variant B (D-V2-F8-08 traceability): `describe.skip` con commento di
 * tracking. Il package F3 quando arriverà avrà la propria suite BC.
 *
 * @see .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-RESEARCH.md §7
 * @see D-V2-F8-08 suite content #4
 */
import { describe, it } from 'vitest'

describe.skip('v1-bc-replay: route registration (API #7+#8) — moved to @gluezero/routing', () => {
  // Routing API non esposta da @gluezero/core barrel in v1.x (vedi packages/core/src/index.ts).
  // Quando F3 `@gluezero/routing` sarà disponibile, verifica BC presso
  // `packages/routing/src/__bc_replay__/route-registration.test.ts`.
  // F8 W1-P02 marca skip intenzionale per traceability cross-fase.
  it('registerRoute/unregisterRoute preserve v1.x semantics', () => {
    // Implementazione spostata a @gluezero/routing (F3 package).
  })
})
