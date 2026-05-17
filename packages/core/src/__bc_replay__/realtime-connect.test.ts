/**
 * v1-bc-replay — PRD §42.2 API #11+#12 freeze: connectRealtime + disconnectRealtime SSE/WS.
 *
 * NOTE: F8 W1-P02 — `connectRealtime`/`disconnectRealtime` esposti da
 * `@gluezero/gateway` (F4 package, subpath `/realtime`). NON in `@gluezero/core`
 * barrel v1.x (verificato in `packages/core/src/index.ts`).
 *
 * Strategy Variant B (D-V2-F8-08 traceability): `describe.skip` con commento di
 * tracking. Il package F4 quando arriverà avrà la propria suite BC.
 *
 * @see .planning/phases/08-extension-runtime-mf-registry-lifecycle-fsm-standard-topics/08-RESEARCH.md §7
 * @see D-V2-F8-08 suite content #6
 */
import { describe, it } from 'vitest'

describe.skip('v1-bc-replay: realtime connect (API #11+#12) — moved to @gluezero/gateway', () => {
  // connectRealtime/disconnectRealtime esposti da @gluezero/gateway/realtime (subpath F4).
  // Verifica BC in `packages/gateway/src/realtime/__bc_replay__/connect.test.ts`
  // quando il package F4 sarà disponibile.
  it('connectRealtime/disconnectRealtime preserve v1.x semantics', () => {
    // Implementazione presso @gluezero/gateway (F4 package).
  })
})
