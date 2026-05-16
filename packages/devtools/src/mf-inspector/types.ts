/**
 * `@gluezero/devtools/mf-inspector` — types pubblici subpath.
 *
 * Definisce le shape esposte dal `mfInspectorModule()` ai consumer V2.0:
 * - `MfEvent` — singolo evento bufferizzato nel per-MF ring buffer (D-V2-F16-09).
 * - `MfState` — stato aggregato per-MF (push side — hybrid pattern D-V2-F16-05).
 * - `MicroFrontendTimings` — 11 timing fields raccolti via subscribe lifecycle
 *   topics F8 (D-V2-F16-09 first-write-wins; ZERO diff `packages/microfrontends/src/`
 *   — Pitfall #1 mitigation). Locale al subpath devtools (esteso vs F8 `MicroFrontendTimings`
 *   7-field; first-write-wins + intermediate `*StartedAt` opzionali).
 * - `MicroFrontendDebugSnapshot` — output finale 17-fields esposto via
 *   `broker.getDebugSnapshot().external?.mf?.microFrontends[]` (D-V2-F16-02).
 *
 * **Decisioni lockate F16 CONTEXT:**
 * - D-V2-F16-05 — Hybrid pull+push aggregator pattern.
 * - D-V2-F16-06 — Service Locator graceful degradation (opt lookups undefined → field absent).
 * - D-V2-F16-09 — Per-MF ring buffer 500 + first-write-wins timings.
 * - D-V2-F16-12 — Cardinality cap N_MF unbounded (reserved V2.1 enforcement).
 *
 * @see D-V2-F16-05 (hybrid pull+push)
 * @see D-V2-F16-06 (graceful degradation)
 * @see D-V2-F16-09 (per-MF ring buffer + timings)
 * @see packages/microfrontends/src/types/lifecycle.ts (F8 `MicroFrontendTimings` 7-field — F16 estende a 11)
 * @packageDocumentation
 */

/**
 * Singolo evento bufferizzato nel ring buffer per-MF (D-V2-F16-09).
 *
 * Push-side artifact: ogni `aggregator.handleEvent(topic, event)` invocato
 * dal subscribe pipeline emette un `MfEvent` nel buffer del corrispondente
 * `mfId`. Snapshot consumer-side via `buildSnapshot()` non espone direttamente
 * questo array — il consumer usa `MfInspectorService.flush()` per drenare.
 *
 * @see D-V2-F16-09 — per-MF ring buffer 500 FIFO drop-oldest
 * @see D-V2-F16-10 — pause/resume/flush API globale
 */
export interface MfEvent {
  readonly topic: string
  readonly payload: unknown
  readonly timestamp: number
  readonly mfId: string
}

/**
 * Stato aggregato push-side per singolo MF (D-V2-F16-05).
 *
 * Popolato incrementalmente dal subscribe pipeline `aggregator.handleEvent`.
 * Compongono i campi push del `MicroFrontendDebugSnapshot` finale (i campi pull
 * arrivano da `MicroFrontendsService.list()` + opt Service Locator lookups).
 *
 * - `topicsPublished` — Set di topic pubblicati da questo MF (wildcard subscribe
 *   filtra via `metadata.microFrontendId` — MF-OBS-01 attribution).
 * - `topicsSubscribed` — reserved V2.1 (richiede instrumentazione subscribe-side
 *   non disponibile in W2 — V2 baseline lascia Set vuoto).
 * - `routeCalls`/`workerTasks`/`contextReads`/`contextWrites` — counter
 *   incrementati per topic match (placeholder W3 P03 metrics refinement).
 * - `errors`/`fallbacksApplied` — array event payload da topic .failed /
 *   .fallback.rendered.
 * - `subscriptionsCreated`/`activeSubscriptions` — counter da
 *   microfrontend.subscription.{created,disposed} topic F8.
 * - `cleanupResources` — placeholder array vuoto (RESOLVED §7.1 — readonly
 *   per design V2 baseline; richiede instrumentazione runtime-context-factory
 *   F8 V2.1 per popolarlo).
 * - `eventCount` — totale `handleEvent` invocations per audit.
 */
export interface MfState {
  topicsPublished: Set<string>
  topicsSubscribed: Set<string>
  routeCalls: number
  workerTasks: number
  contextReads: number
  contextWrites: number
  errors: Array<{ phase: string; message: string; timestamp: number; code?: string }>
  fallbacksApplied: Array<{ phase: string; type: string; timestamp: number }>
  subscriptionsCreated: number
  activeSubscriptions: number
  cleanupResources: string[]
  eventCount: number
}

/**
 * Timings 11-field raccolti via subscribe lifecycle topics F8 (D-V2-F16-09).
 *
 * **EMPIRICAL VERIFIED 2026-05-16 — RESEARCH §7.2 RESOLVED:**
 * Tutti gli 11 topic lifecycle sono emessi da `publishLifecycleEvent(reg)` in
 * `packages/microfrontends/src/registry.ts` su ogni transition FSM. Mapping
 * completo `TOPIC_TO_FIELD` in `timings.ts`.
 *
 * **First-write-wins semantica (D-V2-F16-09):** quando un topic re-emette
 * (es. transition retry path), il timing field NON viene sovrascritto.
 *
 * **Locale al subpath devtools:** F8 `MicroFrontendTimings` espone solo 7 field
 * (registeredAt + 5 \*At + destroyedAt). F16 introduce 4 intermediate
 * `*StartedAt` opzionali per granularità inspector-side (NO diff F8).
 *
 * @see D-V2-F16-09 (first-write-wins)
 * @see RESEARCH §7.2 RESOLVED (empirical verification 11/11 topic)
 * @see packages/microfrontends/src/types/lifecycle.ts (F8 `MicroFrontendTimings`)
 */
export interface MicroFrontendTimings {
  registeredAt?: number
  loadStartedAt?: number
  loadedAt?: number
  bootstrapStartedAt?: number
  bootstrappedAt?: number
  mountStartedAt?: number
  mountedAt?: number
  unmountStartedAt?: number
  unmountedAt?: number
  destroyStartedAt?: number
  destroyedAt?: number
}

/**
 * Snapshot debug per singolo MF — 17 visible field (D-V2-F16-02 + REQ MF-DEVTOOLS-01).
 *
 * Output dell'aggregator `buildSnapshot().microFrontends[i]`. Esposto al consumer
 * via `broker.getDebugSnapshot().external?.mf?.microFrontends[]` (W1 P01 Registry +
 * W2 P02 module register).
 *
 * **Conta 17 field PRD §30.3:**
 * 1. id, 2. state, 3. version, 4. owner, 5. loaderType, 6. mountTarget,
 * 7. isolation, 8. permissions, 9. capabilities, 10. compatibility, 11. theme,
 * 12. topicsPublished, 13. topicsSubscribed, 14. routeCallsCount, 15. workerTasksCount,
 * 16. errors, 17. fallbacksApplied. (Più 5 ancillari: contextReadCount, contextWriteCount,
 * subscriptionsCreated, cleanupResources, timings, fallbackPolicy — totale 22; ma "17 field
 * core" da PRD §30.3 conta solo le sezioni autoritative.)
 *
 * **Service Locator graceful degradation (D-V2-F16-06):** quando il modulo F11/F12/F13/F14
 * non è installato, i corrispondenti field (permissions/compatibility/isolation/fallbackPolicy)
 * restano `undefined` — `mfInspectorModule.install()` non throw, NON richiede modulo upstream.
 *
 * @see D-V2-F16-02 (external multi-provider name-keyed)
 * @see D-V2-F16-05 (hybrid pull+push composition)
 * @see D-V2-F16-06 (graceful degradation)
 * @see MF-DEVTOOLS-01 (17 visible field REQ frozen)
 */
export interface MicroFrontendDebugSnapshot {
  readonly id: string
  readonly state: string
  readonly version: string
  readonly owner?: unknown
  readonly loaderType?: string
  readonly mountTarget?: unknown
  readonly isolation?: unknown
  readonly permissions?: unknown
  readonly capabilities?: unknown
  readonly compatibility?: unknown
  readonly theme?: unknown
  readonly topicsPublished: readonly string[]
  readonly topicsSubscribed: readonly string[]
  readonly routeCallsCount: number
  readonly workerTasksCount: number
  readonly contextReadCount: number
  readonly contextWriteCount: number
  readonly errors: readonly unknown[]
  readonly fallbacksApplied: readonly unknown[]
  readonly timings?: MicroFrontendTimings
  readonly subscriptionsCreated: number
  readonly cleanupResources: readonly string[]
  readonly fallbackPolicy?: unknown
}

/**
 * D-V2-F16-15 — 14 metriche per-MF projection shape (alimenta `getMetrics().microFrontends[]`).
 *
 * **Semantica counter (B2 fix):**
 * - **6 counter GLOBALI** (`registered`, `mounted`, `failed`, `permissionDenied`,
 *   `compatFailures`, `capMissing`): incrementati SENZA label `mfId` → totale across
 *   tutti i MF → REPLICATI IDENTICI in ogni entry per shape consistency.
 * - **5 counter PER-MF** (`mountFailures`, `events`, `routeCalls`, `workerTasks`,
 *   `contextWrites`): incrementati con label `{mfId="..."}` strict → proiezione scoped
 *   per entry.
 * - **1 gauge PER-MF** (`activeSubs`): label `{mfId}` strict — last-write-wins.
 * - **2 histogram PER-MF** (`timeAvgLoad`, `timeAvgMount`): label `{mfId}` strict
 *   — reservoir Algorithm R Vitter F6 (D-165). Mapping `p95 → p90` carryover F6
 *   reservoir summary expose.
 *
 * **Totale 14 metriche shape esposta** = 6 (globali) + 5 (per-MF counter) + 1 (gauge)
 * + 2 (histogram).
 *
 * **B3 data quality limit V2.0** (RESEARCH §7.5 RESOLVED): i counter
 * `routeCalls`, `workerTasks`, `contextWrites` POSSONO restare a 0 in F16 v2.0
 * baseline — i topic `gluezero.{routing,worker,context}.*` NON sono attualmente
 * emessi da F3/F5/F10 in v1.x baseline. Pattern matching liberale forward-compat
 * V2.1+ documentato in `metrics.ts` header.
 *
 * @see D-V2-F16-13 — inline metrics single module
 * @see D-V2-F16-14 — D-V2-19 shape preservation (microFrontends absent/[] lifecycle)
 * @see D-V2-F16-15 — projection MfMetricsEntry 14-field shape
 * @see MF-OBS-02 — REQ frozen contract (14 metric shape)
 * @see RESEARCH §7.5 RESOLVED — empirical route/worker/context findings
 */
export interface MfMetricsEntry {
  readonly id: string
  // 6 counter GLOBALI — replicati IDENTICI in ogni entry (totale across MFs)
  readonly registered: number
  readonly mounted: number
  readonly failed: number
  readonly permissionDenied: number
  readonly compatFailures: number
  readonly capMissing: number
  // 2 histogram PER-MF (label {mfId}) — reservoir Algorithm R Vitter F6
  readonly timeAvgLoad: { readonly p50: number; readonly p95: number; readonly p99: number; readonly count: number }
  readonly timeAvgMount: { readonly p50: number; readonly p95: number; readonly p99: number; readonly count: number }
  // 5 counter PER-MF (label {mfId})
  readonly mountFailures: number
  readonly events: number
  readonly routeCalls: number
  readonly workerTasks: number
  readonly contextWrites: number
  // 1 gauge PER-MF (label {mfId}) — last-write-wins
  readonly activeSubs: number
}
