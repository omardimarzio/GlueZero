/**
 * `@gluezero/devtools/mf-inspector` — Subpath additivo F16 (D-V2-F16-19).
 *
 * MF Inspector + 17-fields aggregator hybrid pull+push + per-MF ring buffer 500 +
 * 11 timings collector + pause/resume/flush API globale + Service Locator
 * `SERVICE_MF_INSPECTOR` + Plug-in MIN-3 SnapshotProvider registration su DevtoolsBroker.
 *
 * **Consumer V2.0 quick start:**
 * ```ts
 * import { createDevtoolsBroker } from '@gluezero/devtools'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { mfInspectorModule, SERVICE_MF_INSPECTOR, type MfInspectorService }
 *   from '@gluezero/devtools/mf-inspector'
 *
 * const broker = createDevtoolsBroker({
 *   modules: [microfrontendModule(), mfInspectorModule()],
 * })
 * const snap = broker.getDebugSnapshot()
 * console.log(snap.external?.mf) // 17-fields per MF
 * ```
 *
 * REQ-IDs coperti: MF-DEVTOOLS-01 (17 fields), MF-DEVTOOLS-02 (Snapshot integration
 * via Plug-in MIN-3), MF-DEVTOOLS-03 (11 timings via subscribe lifecycle),
 * MF-DEVTOOLS-04 (ring buffer 500 + pause/resume/flush).
 *
 * @see D-V2-F16-04 (factory carryover F11/F14)
 * @see D-V2-F16-05 (hybrid pull+push)
 * @see D-V2-F16-06 (Service Locator graceful)
 * @see D-V2-F16-07 (29 topics + wildcard)
 * @see D-V2-F16-09 (per-MF ring buffer 500)
 * @see D-V2-F16-10 (pause/resume/flush API)
 * @see D-V2-F16-19 (tsup multi-entry subpath + Pattern S1)
 * @packageDocumentation
 */

// Public factory + options
export { mfInspectorModule, type MfInspectorModuleOptions } from './module'

// Service Locator binding (locale al subpath — RESEARCH §7.3 RESOLVED)
export { SERVICE_MF_INSPECTOR, type MfInspectorService } from './service-locator'

// Public types — consumer narrowing su `DebugSnapshot.external?.mf`
export type {
  MfEvent,
  MfState,
  MicroFrontendDebugSnapshot,
  MicroFrontendTimings,
} from './types'

// Pattern S1 marker (D-V2-F16-19 — augment.ts opt-in side-effect)
export { __mfInspectorAugmentLoaded } from './augment'
