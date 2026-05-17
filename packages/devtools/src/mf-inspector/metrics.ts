/**
 * MF Metrics Dispatch — 14 metriche `gluezero.mfs.*` namespaced (D-V2-F16-13/14/15).
 *
 * Composition wrap del F6 `createMetricsCollector` + `createCardinalityTracker` per
 * dispatch granulare per-MF di counter/gauge/histogram a partire dai topic standard F8
 * (29 topic lifecycle/error/governance) + topic future-compat F3/F5/F10. La proiezione
 * `buildEntries()` costruisce `MfMetricsEntry[]` consumabile da
 * `DevtoolsBroker.getMetrics().microFrontends` (D-V2-19 BLOCKING).
 *
 * **Semantica counter (B2 fix):**
 * - **6 counter GLOBALI** (no label `mfId`): `registered`, `mounted`, `failed`,
 *   `permissionDeniedCount`, `compatFailures`, `capMissing` — totale across tutti i MF.
 *   Replicati IDENTICI in ogni `MfMetricsEntry.{field}` per shape consistency.
 * - **5 counter PER-MF** (label `{mfId}` strict): `mountFailuresPerId`, `eventsPerMfId`,
 *   `routeCallsPerMfId`, `workerTasksPerMfId`, `contextWritesPerMfId`.
 * - **1 gauge PER-MF** (label `{mfId}`): `activeSubsPerMfId` — last-write-wins.
 * - **2 histogram PER-MF** (label `{mfId}`): `timeAvgLoad`, `timeAvgMount` — reservoir
 *   Algorithm R Vitter F6 (D-165). Mapping `p95 → p90` carryover F6 reservoir
 *   summary expose `{p50, p90, p99, count, sum}`.
 *
 * **Totale 14 metriche `gluezero.mfs.*`** = 6 globali + 5 per-MF counter + 1 gauge
 * + 2 histogram. Naming dot.case D-163 `gluezero.<package>.<metric>` carryover F6.
 *
 * **B3 fix — route/worker/context empirical findings (RESEARCH §7.5 RESOLVED 2026-05-16):**
 * Grep planner-time `packages/{routing,worker,context}/src/` per `publish.*'gluezero\\.'`:
 * - F3 routing: NESSUN topic `gluezero.routing.*` esplicito emesso in v1.x baseline.
 * - F5 worker: NESSUN topic `gluezero.worker.*` esplicito emesso in v1.x baseline.
 * - F10 context: NESSUN topic `gluezero.context.*` esplicito emesso in v1.x baseline.
 *
 * Pattern matching liberale (forward-compat) per topic future V2.1+:
 * - `topic.startsWith('route.') || topic.includes('routing.dispatched')` → `routeCallsPerMfId`
 * - `topic.startsWith('worker.') || topic.includes('worker.task')` → `workerTasksPerMfId`
 * - `topic.includes('context.write') || topic.includes('context.updated')` → `contextWritesPerMfId`
 *
 * Empirical baseline F16 v2.0: counter restano a 0 — data quality limit V2.0
 * documentato in 16-VERIFICATION.md + README mf-inspector Sezione "Limitations".
 *
 * **Anti-singleton D-30:** ogni `createMfMetricsDispatch()` ritorna nuova istanza.
 *
 * @see D-V2-F16-13 — inline metrics single module
 * @see D-V2-F16-14 — D-V2-19 shape preservation
 * @see D-V2-F16-15 — projection MfMetricsEntry 14-field
 * @see RESEARCH §7.5 RESOLVED — empirical route/worker/context
 * @see MF-OBS-02 — REQ frozen contract (14 metric shape)
 * @see packages/devtools/src/metrics-collector.ts — F6 createMetricsCollector composition
 * @packageDocumentation
 */

import { createCardinalityTracker, type CardinalityTracker } from '../cardinality-cap'
import { createMetricsCollector, type MetricsCollector } from '../metrics-collector'
import type { MfMetricsEntry } from './types'

/**
 * Default cardinality cap distinct `mfId` labels per metric base (mitigates wildcard
 * mfId explosion T-06-06-01). Pattern carryover F6 D-166 default 100.
 */
const DEFAULT_MF_CARDINALITY_CAP = 100

/**
 * Setup-time options per `createMfMetricsDispatch()` factory.
 *
 * - `collector?` — `MetricsCollector` esterno opzionale (default: new
 *   `createMetricsCollector()` interno). Iniettabile per test/composition.
 * - `cardinalityCap?` — cap distinct `mfId` per metric base name. Default 100.
 */
export interface MfMetricsDispatchOptions {
  readonly collector?: MetricsCollector
  readonly cardinalityCap?: number
}

/**
 * Public API del dispatch metrics MF.
 */
export interface MfMetricsDispatch {
  /**
   * Dispatch evento da topic → counter increment (semantica per-topic):
   * - 6 counter GLOBALI: topic `microfrontend.{registered,mounted,failed,permission.denied,compatibility.failed,capability.missing}`
   * - 1 counter PER-MF tagged: `microfrontend.mount.failed` → `mountFailuresPerId`
   * - 3 counter PER-MF forward-compat: pattern matching liberale route/worker/context (B3 fix)
   */
  handleTopicEvent(topic: string, event: unknown): void
  /** Incrementa `eventsPerMfId{mfId}` (chiamato da wildcard subscribe attribution). */
  incrementEventCounter(mfId: string): void
  /** Osserva durata load → histogram `timeAvgLoad{mfId}` reservoir Algorithm R. */
  observeLoadTime(mfId: string, durationMs: number): void
  /** Osserva durata mount → histogram `timeAvgMount{mfId}` reservoir Algorithm R. */
  observeMountTime(mfId: string, durationMs: number): void
  /** Set gauge `activeSubsPerMfId{mfId}` (last-write-wins). */
  setActiveSubs(mfId: string, count: number): void
  /**
   * Proiezione `MfMetricsEntry[]` per `getMetrics().microFrontends`.
   *
   * Una entry per `mfId` osservato (incluso solo via handleTopicEvent / dispatch).
   * I 6 counter GLOBALI sono replicati IDENTICI in ogni entry; i counter PER-MF
   * sono scoped per `mfId` via label key.
   */
  buildEntries(): readonly MfMetricsEntry[]
  /** Svuota `seenMfs` tracking (AbortController cleanup cascade D-V2-16). */
  clear(): void
}

/**
 * Factory `MfMetricsDispatch` stateless-on-construction (D-30 anti-singleton).
 *
 * Composition wrap del F6 `createMetricsCollector` (counter/gauge/histogram cumulativo)
 * + `createCardinalityTracker` (cap `mfId` distinct combinations per protezione DoS).
 *
 * @param opts - Setup-time options (collector iniettabile + cardinality cap).
 * @returns Nuova istanza `MfMetricsDispatch` con state isolato.
 *
 * @example Quick start (dispatch handler subscribe pipeline)
 * ```ts
 * const dispatch = createMfMetricsDispatch()
 * broker.subscribe('microfrontend.registered', (ev) => dispatch.handleTopicEvent(ev.topic, ev))
 * broker.subscribe('microfrontend.mounted', (ev) => dispatch.handleTopicEvent(ev.topic, ev))
 * // Later — projection per getMetrics().microFrontends:
 * const entries = dispatch.buildEntries()
 * console.log(entries[0]?.mounted) // counter globale replicato
 * ```
 *
 * @example Counter semantica B2 fix (6 globali vs 5 per-MF)
 * ```ts
 * // 2 MF differenti registrati
 * dispatch.handleTopicEvent('microfrontend.registered', { payload: { id: 'mf-a' } })
 * dispatch.handleTopicEvent('microfrontend.registered', { payload: { id: 'mf-b' } })
 * const entries = dispatch.buildEntries()
 * // Counter GLOBALE 'registered' replicato in entrambe le entries
 * console.log(entries[0].registered) // 2
 * console.log(entries[1].registered) // 2
 * ```
 *
 * @throws Nessuna eccezione propagata dal dispatch — `handleTopicEvent` skip silenzioso
 *   quando `event.payload.id`/`microFrontendId` non è una stringa (no-op), e gli
 *   `observe*Time` rispettano il cardinality cap (skip oltre threshold). I sotto-call a
 *   `MetricsCollector.increment/observe/setGauge` di F6 NON throw (cumulative-only D-164).
 */
export function createMfMetricsDispatch(opts: MfMetricsDispatchOptions = {}): MfMetricsDispatch {
  const collector: MetricsCollector = opts.collector ?? createMetricsCollector()
  const cardCap = opts.cardinalityCap ?? DEFAULT_MF_CARDINALITY_CAP
  const cardinality: CardinalityTracker = createCardinalityTracker({ cap: cardCap })
  const seenMfs = new Set<string>()

  /**
   * Tagged counter increment (label `{mfId}` strict) — soggetto a cardinality cap.
   * Skip silenzioso quando cap raggiunto (drop + audit via tracker).
   */
  function tagged(metricBase: string, mfId: string): void {
    const sig = `{mfId=${JSON.stringify(mfId)}}`
    if (!cardinality.check(`gluezero.mfs.${metricBase}`, sig)) return
    collector.increment(`gluezero.mfs.${metricBase}`, { mfId })
    seenMfs.add(mfId)
  }

  /**
   * Global counter increment (no label `mfId`) — totale across tutti i MF.
   * B2 fix semantica: counter globali replicati identici in ogni `MfMetricsEntry`.
   */
  function globalCounter(metricBase: string, mfId: string): void {
    collector.increment(`gluezero.mfs.${metricBase}`)
    // Traccia mfId solo per buildEntries projection scope (NON per cardinality cap globale)
    seenMfs.add(mfId)
  }

  function extractMfId(event: unknown): string | undefined {
    const payload = (event as { payload?: { id?: unknown; microFrontendId?: unknown } } | undefined)
      ?.payload
    if (payload === undefined) return undefined
    if (typeof payload.id === 'string') return payload.id
    if (typeof payload.microFrontendId === 'string') return payload.microFrontendId
    return undefined
  }

  return {
    handleTopicEvent(topic: string, event: unknown): void {
      const mfId = extractMfId(event)
      if (mfId === undefined) return

      // Dispatch (D-V2-F16-15 + B2 fix counter semantica):
      switch (topic) {
        // 6 counter GLOBALI (no label mfId — totale across MFs)
        case 'microfrontend.registered':
          globalCounter('registered', mfId)
          return
        case 'microfrontend.mounted':
          globalCounter('mounted', mfId)
          return
        case 'microfrontend.failed':
          globalCounter('failed', mfId)
          return
        case 'microfrontend.permission.denied':
          globalCounter('permissionDeniedCount', mfId)
          return
        case 'microfrontend.compatibility.failed':
          globalCounter('compatFailures', mfId)
          return
        case 'microfrontend.capability.missing':
          globalCounter('capMissing', mfId)
          return
        // 1 counter PER-MF tagged (label {mfId})
        case 'microfrontend.mount.failed':
          tagged('mountFailuresPerId', mfId)
          return
        default: {
          // B3 fix — route/worker/context pattern matching liberale forward-compat
          // (RESEARCH §7.5 RESOLVED: NESSUN topic gluezero.* esplicito in F3/F5/F10 v1.x baseline).
          // Counter PUÒ restare 0 in F16 v2.0 baseline — TODO V2.1.
          if (topic.startsWith('route.') || topic.includes('routing.dispatched')) {
            tagged('routeCallsPerMfId', mfId)
            return
          }
          if (topic.startsWith('worker.') || topic.includes('worker.task')) {
            tagged('workerTasksPerMfId', mfId)
            return
          }
          if (topic.includes('context.write') || topic.includes('context.updated')) {
            tagged('contextWritesPerMfId', mfId)
            return
          }
          // Topic non-MF / non-matched → no-op
          return
        }
      }
    },

    incrementEventCounter(mfId: string): void {
      tagged('eventsPerMfId', mfId)
    },

    observeLoadTime(mfId: string, durationMs: number): void {
      const sig = `{mfId=${JSON.stringify(mfId)}}`
      if (!cardinality.check('gluezero.mfs.timeAvgLoad', sig)) return
      collector.observe('gluezero.mfs.timeAvgLoad', durationMs, { mfId })
      seenMfs.add(mfId)
    },

    observeMountTime(mfId: string, durationMs: number): void {
      const sig = `{mfId=${JSON.stringify(mfId)}}`
      if (!cardinality.check('gluezero.mfs.timeAvgMount', sig)) return
      collector.observe('gluezero.mfs.timeAvgMount', durationMs, { mfId })
      seenMfs.add(mfId)
    },

    setActiveSubs(mfId: string, count: number): void {
      const sig = `{mfId=${JSON.stringify(mfId)}}`
      if (!cardinality.check('gluezero.mfs.activeSubsPerMfId', sig)) return
      collector.setGauge('gluezero.mfs.activeSubsPerMfId', count, { mfId })
      seenMfs.add(mfId)
    },

    buildEntries(): readonly MfMetricsEntry[] {
      const snap = collector.getMetrics()
      const entries: MfMetricsEntry[] = []
      const histEmpty = { p50: 0, p95: 0, p99: 0, count: 0 }

      // B2 fix — 6 counter GLOBALI: replicati IDENTICI in ogni entry (no labelKey)
      const globalRegistered = snap.counters['gluezero.mfs.registered'] ?? 0
      const globalMounted = snap.counters['gluezero.mfs.mounted'] ?? 0
      const globalFailed = snap.counters['gluezero.mfs.failed'] ?? 0
      const globalPermDenied = snap.counters['gluezero.mfs.permissionDeniedCount'] ?? 0
      const globalCompatFail = snap.counters['gluezero.mfs.compatFailures'] ?? 0
      const globalCapMissing = snap.counters['gluezero.mfs.capMissing'] ?? 0

      for (const mfId of seenMfs) {
        const labelKey = `{mfId=${JSON.stringify(mfId)}}`
        const tagCounter = (base: string): number =>
          snap.counters[`gluezero.mfs.${base}${labelKey}`] ?? 0
        const histProject = (
          base: string,
        ): { p50: number; p95: number; p99: number; count: number } => {
          const h = snap.histograms[`gluezero.mfs.${base}${labelKey}`]
          if (h === undefined) return histEmpty
          // F6 reservoir summary espone {p50, p90, p99} — mapping p95 → p90
          // (gap accettato RESEARCH §2.7 nota — V2.1 may add p95 explicit)
          return { p50: h.p50, p95: h.p90, p99: h.p99, count: h.count }
        }

        entries.push({
          id: mfId,
          // 6 counter GLOBALI replicati identici
          registered: globalRegistered,
          mounted: globalMounted,
          failed: globalFailed,
          permissionDenied: globalPermDenied,
          compatFailures: globalCompatFail,
          capMissing: globalCapMissing,
          // 2 histogram PER-MF
          timeAvgLoad: histProject('timeAvgLoad'),
          timeAvgMount: histProject('timeAvgMount'),
          // 5 counter PER-MF (label {mfId})
          mountFailures: tagCounter('mountFailuresPerId'),
          events: tagCounter('eventsPerMfId'),
          routeCalls: tagCounter('routeCallsPerMfId'),
          workerTasks: tagCounter('workerTasksPerMfId'),
          contextWrites: tagCounter('contextWritesPerMfId'),
          // 1 gauge PER-MF (label {mfId})
          activeSubs: snap.gauges[`gluezero.mfs.activeSubsPerMfId${labelKey}`] ?? 0,
        })
      }
      return entries
    },

    clear(): void {
      seenMfs.clear()
    },
  }
}
