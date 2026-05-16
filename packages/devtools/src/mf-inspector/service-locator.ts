/**
 * `@gluezero/devtools/mf-inspector/service-locator` — SERVICE_MF_INSPECTOR binding (D-V2-F16-04).
 *
 * **Locale al subpath devtools** (RESEARCH §7.3 RESOLVED): la constant
 * `SERVICE_MF_INSPECTOR` non vive in `@gluezero/core/services` (zero diff `packages/core/src/`)
 * — `mfInspectorModule.install(ctx)` la registra direttamente via `ctx.registerService(...)`
 * e consumer fanno lookup typed `broker.getService<MfInspectorService>(SERVICE_MF_INSPECTOR)`.
 *
 * Pattern carryover F14 `packages/fallbacks/src/service-locator.ts` (binding locale +
 * interface re-export) — ma F14 esporta `SERVICE_FALLBACKS` da `@gluezero/core` (storica).
 * F16 NON usa quel canale: D-83 eccezione devtools/src/ + binding locale evitano impatto
 * cross-package.
 *
 * @see D-V2-F16-04 — Factory carryover F11/F14 + binding locale
 * @see RESEARCH §7.3 RESOLVED — SERVICE_MF_INSPECTOR locale al subpath
 * @see packages/fallbacks/src/service-locator.ts — F14 template (constant re-export)
 * @packageDocumentation
 */

import type { MfEvent, MicroFrontendDebugSnapshot } from './types'

/**
 * Identifier univoco per Service Locator lookup (D-V2-F16-04).
 *
 * Consumer V2.0 fa: `broker.getService<MfInspectorService>(SERVICE_MF_INSPECTOR)`.
 *
 * @see D-V2-F16-04
 */
export const SERVICE_MF_INSPECTOR = 'mf-inspector' as const

/**
 * API esposta dal `mfInspectorModule()` via Service Locator (D-V2-F16-04 + D-V2-F16-10).
 *
 * 4 metodi pubblici:
 * - `getSnapshot()` — invoca `aggregator.buildSnapshot()` (hybrid pull+push 17-field).
 * - `pause()` — interrompe il subscribe handler chain (eventi accodati in queue).
 * - `resume()` — riprende il flusso normale (eventi accodati restano in queue).
 * - `flush()` — drena la queue degli eventi accumulati durante pause + ring buffer
 *   aggregator (ritorno completo MfEvent[]).
 *
 * @example Consumer V2.0 quick start
 * ```ts
 * import { createDevtoolsBroker } from '@gluezero/devtools'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { mfInspectorModule, SERVICE_MF_INSPECTOR, type MfInspectorService } from '@gluezero/devtools/mf-inspector'
 *
 * const broker = createDevtoolsBroker({
 *   modules: [microfrontendModule(), mfInspectorModule()],
 * })
 * const inspector = broker.getService<MfInspectorService>(SERVICE_MF_INSPECTOR)!
 * const snap = inspector.getSnapshot()
 * console.log(snap.microFrontends.length)
 * ```
 *
 * @see D-V2-F16-04
 * @see D-V2-F16-10 — pause/resume/flush API
 */
export interface MfInspectorService {
  readonly getSnapshot: () => { readonly microFrontends: readonly MicroFrontendDebugSnapshot[] }
  readonly pause: () => void
  readonly resume: () => void
  readonly flush: () => readonly MfEvent[]
}
