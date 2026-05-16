// devtools-broker.ts — `DevtoolsBroker` composition wrapper di `RouterBroker`
// (Wave 4b plan 06-08b — D-121 / D-83 strict carryover — F6 vive solo in
// `packages/devtools/src/`).
//
// **Opzione B research §11 / §11.3 — D-83 strict preservation:**
// `DevtoolsBroker` estende `RouterBroker` (F3) via composition wires:
// - Inspector (F6 06-05) capture pipeline §28 step
// - RouteInspector (F6 06-05) aggrega step 9+10
// - MetricsCollector (F6 06-06) counter/gauge/histogram cumulative
// - PauseController (F6 06-07) pauseTopic/resumeTopic/flushQueue
// - MultiplexTap (F6 06-04) chain N tap user + Inspector + Metrics + RouteInspector
// - wrapLegacyTap (F6 06-04) auto-wrap F1 single-tap legacy
//
// Pattern composition identico a `CacheBroker` di F6 (plan 06-08a) e
// `WorkerBroker` di F5 (plan 05-06):
// - `inner: RouterBroker` (F3) — delegato per pub/sub/lifecycle/routing/http
// - publish intercept Opzione B: applica `pauseController.intercept(event)`
//   PRE-RouterBroker. 'queued'/'dropped' skip downstream; 'pass' delegate.
// - post `inner.publish()` emette step 14 attivazione D-161
//   (`event.observed`) ai tap registrati via MultiplexTap.
//
// **Cascade D-126 + LIFE-02 ext F6:**
// - `registerPlugin(desc)` → `inner.registerPlugin` (no auto-register tap —
//   tap utente vivono in `config.taps[]` o `runtime.tap` legacy F1).
// - `unregisterPlugin(id)` → `inner.unregisterPlugin` 1-step (Inspector +
//   Metrics + PauseController NON hanno per-owner state in V1).
//
// Threat coverage:
// - T-06-08b-01 (Logic flaw composition order): mitigate — Devtools è OUTERMOST
//   nella chain createGlueZero per catturare TUTTI gli step §28.
// - T-06-08b-02 (Information Disclosure getDebugSnapshot leak): mitigate via
//   structuredClone (D-162). RESEARCH §15.3 perf budget <50ms su 500 entries.
// - T-06-08b-03 (DoS publish hot-path overhead debug=on): mitigate via D-160
//   lazy-mode tap delegate solo quando enabled (Inspector early-return).

import type { EventTap, PluginDescriptor, Subscription } from '@gluezero/core'
import { RouterBroker, type RouterBrokerConfig } from '@gluezero/routing'
import { createEventInspector, type EventInspector } from './event-inspector'
import { createMetricsCollector, type MetricsCollector } from './metrics-collector'
import { createMultiplexTap } from './multiplex-tap'
import { createPauseController, type PauseController } from './pause-controller'
import { createRouteInspector, type RouteInspector } from './route-inspector'
import {
  createSnapshotProviderRegistry,
  type SnapshotProviderFn,
  type SnapshotProviderRegistry,
} from './snapshot-providers'
import { wrapLegacyTap } from './tap-registry'
import type { DevtoolsConfig } from './types/devtools-config'
import type { MetricsSnapshot } from './types/metrics'
import type { FlushQueueResult } from './types/pause-state'

/**
 * Type del terzo argomento di `RouterBroker.publish` — riusato per propagare
 * `options.source/id/correlationId/priority`. Pattern coerente con `CacheBroker`
 * F6 plan 06-08a e `WorkerBroker` F5.
 */
type RouterPublishOptions = Parameters<RouterBroker['publish']>[2]

/**
 * Estensione opzioni `DevtoolsConfig` per `enableByDefault` esplicito (D-160).
 *
 * NOTA: `enableByDefault` è già definito nel super-tipo `DevtoolsConfig`
 * (`./types/devtools-config.ts`). `initiallyEnabled` è alias dev-friendly per
 * test (cfr. event-inspector / route-inspector).
 */
interface DevtoolsConfigExtended extends DevtoolsConfig {
  /** Alias dev-friendly per `enableByDefault` (carryover pattern Inspector). */
  readonly initiallyEnabled?: boolean
}

/**
 * Configurazione `DevtoolsBroker` — accetta `RouterBrokerConfig` di F3 +
 * sezione F6 `devtools` + `taps[]` array F6 (auto-wrappato via wrapLegacyTap).
 *
 * Pattern declaration merging: `devtools?: DevtoolsConfig` + `taps?:
 * readonly EventTap[]` aggiunti via `devtools/augment.ts` (plan 06-01).
 * Per chiarezza export-side ridichiariamo il super-set come interface esplicita.
 */
export interface DevtoolsBrokerConfig extends RouterBrokerConfig {
  /** F6 `devtools` config (D-160/D-167/D-170). */
  readonly devtools?: DevtoolsConfigExtended
  /**
   * F6 `taps[]` chain — N tap user-side (D-159). `runtime.tap` legacy F1 viene
   * auto-wrappato dal `wrapLegacyTap` 06-04 e appended al fondo del chain.
   */
  readonly taps?: readonly EventTap[]
}

/**
 * F6 DebugSnapshot — output di `getDebugSnapshot()` (D-162 deep-clone via
 * structuredClone).
 *
 * **F16 W1 P01 extension (D-V2-F16-02):** campo `external?` opzionale popolato
 * sync dai `SnapshotProvider` registrati via `registerSnapshotProvider()`.
 * ASSENTE quando nessun provider registrato (BC §42 API #13 preserve bit-exact
 * v1.x — DevtoolsBroker shape post-F6 invariata + extension MIN-3 trasparente).
 */
export interface DebugSnapshot {
  readonly recentEvents: readonly unknown[]
  readonly recentRoutes: readonly unknown[]
  readonly currentMetrics: MetricsSnapshot
  readonly pausedTopics: readonly string[]
  readonly enabled: boolean
  /**
   * D-V2-F16-02 — `external` field popolato dai SnapshotProvider registrati
   * (es. `mfInspectorModule` registra `'mf' → MicroFrontendDebugSnapshot`).
   * Multi-provider name-keyed shape `Record<string, unknown>`. Consumer fa
   * narrowing locale (es. `external?.mf as MicroFrontendDebugSnapshot`) per
   * preservare D-83 strict (no type coupling devtools→microfrontends).
   *
   * Quando `size() === 0` (nessun provider) il field è ASSENTE dal return
   * value (NON `undefined` explicit) — verifica BC §42 API #13 enforcement.
   *
   * @see D-V2-F16-01 (Registry sede)
   * @see D-V2-F16-02 (shape multi-provider name-keyed)
   */
  readonly external?: Readonly<Record<string, unknown>>
}

const STEP_EVENT_OBSERVED = 'event.observed' // D-161 step 14 §28 reale

/**
 * Default inline NODE_ENV detection (D-160 uniformità cross-component WARNING-5
 * fix). Pattern carryover da event-inspector + route-inspector.
 *
 * Production → false (zero overhead). Browser/dev → true (DX dev-friendly).
 */
function detectDefaultEnabled(): boolean {
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    if (proc != null && proc.env != null) {
      return proc.env['NODE_ENV'] !== 'production'
    }
  } catch {
    /* fallthrough — accesso process eccezione → fallback browser */
  }
  return true
}

/**
 * F6 DevtoolsBroker — composition wrapper di RouterBroker (D-121, D-83 strict
 * carryover).
 *
 * **Opzione B research §11.3 — D-83 strict preservation:**
 * Il `publish(topic)` override applica `pauseController.intercept(event)`
 * PRE-`inner.publish` (RouterBroker F3). In questo modo F6:
 * - NON modifica `packages/{core,mapper,routing,gateway,worker}/src/`
 * - NON viola D-83 (zero diff cross-package)
 * - Riusa pipeline §28 step 1-13 invariati per il flusso non-paused
 * - Aggiunge step 14 attivazione D-161 (`event.observed`) post inner.publish
 *
 * **Cascade D-126 + LIFE-02 ext F6:**
 * - `registerPlugin(desc)` → `inner.registerPlugin` (delegate trasparente).
 * - `unregisterPlugin(id)` → `inner.unregisterPlugin` (1-step — Inspector,
 *   Metrics, PauseController NON hanno per-owner state in V1).
 *
 * **API esposta (TOOL-03 + TOOL-04):**
 * - `enableDebug() / disableDebug()` — toggle live-mode (Inspector +
 *   RouteInspector).
 * - `getDebugSnapshot()` — deep-clone snapshot { recentEvents, recentRoutes,
 *   currentMetrics, pausedTopics, enabled }.
 * - `getMetrics()` — cumulative MetricsSnapshot (D-164).
 * - `pauseTopic(topic) / resumeTopic(topic) / flushQueue(topic?)` — flow
 *   control D-168/D-169/D-170.
 *
 * @example Quick start (debug enabled di default in dev)
 * ```ts
 * import { createDevtoolsBroker } from '@gluezero/devtools'
 *
 * const broker = createDevtoolsBroker({
 *   devtools: { enableByDefault: true },
 * })
 * broker.subscribe('weather.loaded', (ev) => console.log(ev.payload))
 * await broker.publish('weather.requested', { city: 'Roma' })
 * const snap = broker.getDebugSnapshot()
 * console.log('recent events:', snap.recentEvents)
 * ```
 *
 * @example Tap chain user-side (D-159 multiplex)
 * ```ts
 * const auditTap: EventTap = {
 *   onPipelineStep(step, snap) {
 *     if (step === 'event.observed') console.log(`[AUDIT] ${snap.eventId}`)
 *   },
 * }
 * const broker = createDevtoolsBroker({ taps: [auditTap] })
 * // auditTap riceve TUTTI gli step §28 + le altre tap (Inspector + Metrics) chained
 * ```
 *
 * @example pauseTopic admin flow (D-168/D-169)
 * ```ts
 * broker.pauseTopic('chat.message')
 * await broker.publish('chat.message', { text: 'queued' }) // → accodato FIFO
 * broker.resumeTopic('chat.message') // → replay FIFO
 * // Alternativa: scarta backlog
 * broker.pauseTopic('chat.message')
 * await broker.publish('chat.message', { text: 'stale' })
 * broker.flushQueue('chat.message') // → drop + audit, NO replay
 * ```
 *
 * @throws {Error} `Invalid DevtoolsBrokerConfig: <issues>` — propagato dal
 *   `createDevtoolsBroker` factory se Valibot validation fallisce.
 *
 * @see {@link createDevtoolsBroker} — public factory (no singleton, D-30)
 * @see {@link MultiplexTap} — chain N tap aggregator (D-159)
 * @see {@link EventInspector} — ring buffer 500 (D-167)
 * @see {@link MetricsCollector} — counters/gauges/histograms (D-163..D-166)
 * @see {@link PauseController} — pauseTopic/resumeTopic queue (D-168..D-170)
 * @see RESEARCH §11 / §11.3 — Opzione B rationale + D-83 strict gate
 */
export class DevtoolsBroker {
  private readonly inner: RouterBroker
  private readonly inspector: EventInspector
  private readonly routeInspector: RouteInspector
  private readonly metrics: MetricsCollector
  private readonly pauseController: PauseController
  private readonly aggregateTap: EventTap
  // F16 W1 P01 — MIN-3 SnapshotProvider Registry (D-V2-F16-01)
  private readonly snapshotProviders: SnapshotProviderRegistry

  constructor(config: DevtoolsBrokerConfig = {}) {
    const dt = config.devtools ?? {}
    const initiallyEnabled = dt.enableByDefault ?? dt.initiallyEnabled ?? detectDefaultEnabled()

    // 1. Inspector + RouteInspector — closure factories (D-160 + D-162 + D-167)
    this.inspector = createEventInspector({
      initiallyEnabled,
      ...(dt.eventBufferSize !== undefined && { bufferSize: dt.eventBufferSize }),
    })
    this.routeInspector = createRouteInspector({
      initiallyEnabled,
      ...(dt.routeBufferSize !== undefined && { bufferSize: dt.routeBufferSize }),
    })

    // 2. MetricsCollector — counters/gauges/histograms cumulative (D-163..D-166)
    this.metrics = createMetricsCollector({
      ...(dt.histogramSamples !== undefined && { histogramSamples: dt.histogramSamples }),
      ...(dt.maxLabelCombinations !== undefined && {
        maxLabelCombinations: dt.maxLabelCombinations,
      }),
      onCardinalityOverflow: (info) => {
        // Audit emit via inner.publish (delegate downstream — pipeline F3).
        // Lazy-binding via this.inner (set sotto in step 4) → safe perché
        // onCardinalityOverflow è chiamato solo durante observe/increment
        // runtime, post-construction.
        //
        // NOTE: il topic name segue la convention F1 D-24 (segments lowercase
        // alphanumeric o '*'). Il trattino non è ammesso → usiamo 'cardinalityoverflow'
        // come singolo segmento. La doc PRD §28.3 / RESEARCH §7.4 può essere
        // aggiornata in 06-09b al final gate (DOC-06).
        try {
          this.inner.publish('system.metrics.cardinalityoverflow', info, {
            source: { type: 'system', id: 'devtools-broker' },
          } as RouterPublishOptions)
        } catch {
          /* idempotent — pattern F3 silent */
        }
      },
    })

    // 3. PauseController — pauseTopic/resumeTopic/flushQueue queue (D-168..D-170)
    this.pauseController = createPauseController({
      ...(dt.pauseQueueMaxSize !== undefined && { maxQueueSize: dt.pauseQueueMaxSize }),
      publishFn: (topic, payload) => {
        // Replay (resumeTopic) + audit (flushQueue/overflow) → delegate inner.
        try {
          this.inner.publish(topic, payload, {
            source: { type: 'system', id: 'devtools-broker' },
          } as RouterPublishOptions)
        } catch {
          /* idempotent — pattern F3 silent */
        }
      },
    })

    // 4. MultiplexTap chain (D-159): Inspector + RouteInspector + Metrics +
    //    user taps + legacy F1 runtime.tap (auto-wrap via wrapLegacyTap 06-04).
    const userTaps = wrapLegacyTap({
      ...(config.runtime !== undefined && { runtime: config.runtime }),
      ...(config.taps !== undefined && { taps: config.taps }),
    })
    const allTaps: readonly EventTap[] = [
      this.inspector.tap,
      this.routeInspector.tap,
      this.metrics.tap,
      ...userTaps,
    ]
    this.aggregateTap = createMultiplexTap(allTaps)

    // 5. Compose RouterBroker (F3) — pattern identico CacheBroker → RouterBroker
    //    e WorkerBroker → RouterBroker (D-83 chain F1→F2→F3→F4→F5→F6).
    //    Il MultiplexTap viene installato come `runtime.tap` single value
    //    (compat F1 — RouterBroker non conosce il chain F6).
    this.inner = new RouterBroker({
      ...config,
      runtime: { ...(config.runtime ?? {}), tap: this.aggregateTap },
    })

    // 6. F16 W1 P01 — MIN-3 SnapshotProvider Registry (D-V2-F16-01). Storage
    //    interno Map<string, () => unknown>; invocazione sync in getDebugSnapshot
    //    popola snapshot.external[name]. ASSENTE quando size()===0 (preserve
    //    BC §42 API #13 shape).
    this.snapshotProviders = createSnapshotProviderRegistry()
  }

  // ============================================================================
  // Public API — publish intercept Opzione B (D-83 strict preservation)
  // ============================================================================

  /**
   * **Opzione B (RESEARCH §11.3) — publish intercept pre-delegate.**
   *
   * 1. Costruisce un BrokerEvent canonico per `pauseController.intercept(event)`.
   * 2. Action 'queued' / 'dropped' → skip downstream (eventi accodati o droppati).
   * 3. Action 'pass' → delegate `inner.publish(topic, payload, options)`.
   * 4. Post inner.publish → emette step 14 attivazione D-161 (`event.observed`)
   *    al MultiplexTap aggregator (Inspector + RouteInspector + Metrics + user
   *    taps).
   *
   * @param topic - Topic dell'evento.
   * @param payload - Payload dell'evento.
   * @param options - Opzioni publish (source, correlationId, priority, id).
   */
  publish(topic: string, payload: unknown, options?: RouterPublishOptions): void | Promise<void> {
    const opts = (options ?? {}) as {
      readonly id?: string
      readonly source?: { type: string; id: string; name?: string }
      readonly correlationId?: string
      readonly priority?: 'low' | 'normal' | 'high' | 'critical'
    }
    const eventId = opts.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const eventForIntercept = {
      id: eventId,
      topic,
      payload,
      timestamp: Date.now(),
      source: opts.source ?? { type: 'plugin', id: 'devtools-broker' },
      ...(opts.correlationId !== undefined && { correlationId: opts.correlationId }),
      ...(opts.priority !== undefined && { priority: opts.priority }),
    } as never

    const action = this.pauseController.intercept(eventForIntercept)
    if (action === 'queued' || action === 'dropped') {
      // Topic paused — skip downstream. Replay/audit gestito dal PauseController.
      return
    }

    // Delegate downstream (pipeline F3 normale).
    this.inner.publish(topic, payload, options)

    // Step 14 attivazione D-161 — emit `event.observed` post inner.publish ai
    // tap registrati. Snapshot minimal pipeline-shape (compat PipelineSnapshot
    // di @gluezero/core). Try/catch swallow — pattern F1 D-20 carryover.
    try {
      const snapshot = {
        eventId,
        topic,
        step: STEP_EVENT_OBSERVED,
        timestamp: Date.now(),
        durationMs: 0,
      } as never
      this.aggregateTap.onPipelineStep(STEP_EVENT_OBSERVED as never, snapshot)
    } catch {
      /* idempotent — pattern F1 D-20 carryover safeTapStep inline */
    }
  }

  /** Delegate `inner.subscribe`. */
  subscribe(...args: Parameters<RouterBroker['subscribe']>): Subscription {
    return this.inner.subscribe(...args)
  }

  /** Delegate `inner.registerRoute` (F3 — D-60 ROUTE-01). */
  registerRoute(
    ...args: Parameters<RouterBroker['registerRoute']>
  ): ReturnType<RouterBroker['registerRoute']> {
    return this.inner.registerRoute(...args)
  }

  /** Delegate `inner.unregisterRoute`. */
  unregisterRoute(
    ...args: Parameters<RouterBroker['unregisterRoute']>
  ): ReturnType<RouterBroker['unregisterRoute']> {
    return this.inner.unregisterRoute(...args)
  }

  /** Delegate `inner.registerCanonicalSchema` (F2). */
  registerCanonicalSchema(
    ...args: Parameters<RouterBroker['registerCanonicalSchema']>
  ): ReturnType<RouterBroker['registerCanonicalSchema']> {
    return this.inner.registerCanonicalSchema(...args)
  }

  // ============================================================================
  // Plugin management (override per cascade D-126 + LIFE-02 ext F6)
  // ============================================================================

  /**
   * Registra un plugin — delegate a `RouterBroker.registerPlugin`. F6 NON
   * auto-registra tap via descriptor (tap user-side vivono in
   * `config.taps[]` o `runtime.tap` legacy).
   */
  async registerPlugin(descriptor: PluginDescriptor): Promise<void> {
    await this.inner.registerPlugin(descriptor)
  }

  /**
   * Unregister plugin — delegate a `RouterBroker.unregisterPlugin` (1-step):
   * Inspector + Metrics + PauseController NON hanno per-owner state in V1.
   * Try/catch isolato pattern F3 router-broker-wrapper.ts:463-485.
   */
  async unregisterPlugin(id: string): Promise<void> {
    try {
      await this.inner.unregisterPlugin(id)
    } catch {
      /* idempotent */
    }
  }

  // ============================================================================
  // Devtools API — TOOL-03 + TOOL-04 (debug toggle + snapshot + metrics + pause)
  // ============================================================================

  /** TOOL-03 — abilita Inspector + RouteInspector (live-mode capture). */
  enableDebug(): void {
    this.inspector.enable()
    this.routeInspector.enable()
  }

  /** TOOL-03 — disabilita Inspector + RouteInspector (zero overhead D-160). */
  disableDebug(): void {
    this.inspector.disable()
    this.routeInspector.disable()
  }

  /**
   * TOOL-04 — snapshot debug deep-clone (D-162 structuredClone) di
   * `{ recentEvents, recentRoutes, currentMetrics, pausedTopics, enabled }`
   * + opzionalmente `external` quando ≥1 SnapshotProvider registrato (F16
   * D-V2-F16-01/02/03).
   *
   * Mutazione del valore ritornato NON corrompe lo state interno
   * (T-06-08b-02 mitigation).
   *
   * **F16 W1 P01 extension:** se `snapshotProviders.size() > 0` invoca sync
   * tutti i provider e popola `external[name] = providerFn()`. Provider che
   * `throw` → skip silenzioso (try/catch swallow nel `collect()`). Quando
   * `size() === 0` il campo `external` è ASSENTE dal raw object (NON aggiunto
   * come `undefined`) → BC §42 API #13 shape preserve.
   *
   * @see D-V2-F16-01 (Registry sede)
   * @see D-V2-F16-02 (external shape multi-provider name-keyed)
   * @see D-V2-F16-03 (sync invocation on-demand)
   */
  getDebugSnapshot(): DebugSnapshot {
    const raw: Record<string, unknown> = {
      recentEvents: this.inspector.getBuffer(),
      recentRoutes: this.routeInspector.getBuffer(),
      currentMetrics: this.metrics.getMetrics(),
      pausedTopics: this.pauseController.getSnapshot().pausedTopics,
      enabled: this.inspector.getSnapshot().enabled,
    }
    // D-V2-F16-02: external? field ASSENTE quando nessun provider (BC §42 API #13 preserve).
    if (this.snapshotProviders.size() > 0) {
      raw['external'] = this.snapshotProviders.collect()
    }
    return structuredClone(raw) as unknown as DebugSnapshot
  }

  /**
   * F16 W1 P01 — MIN-3 SnapshotProvider plug-in registration (D-V2-F16-01).
   *
   * Provider invocato sync a ogni `getDebugSnapshot()` call. Output assegnato
   * a `snapshot.external[name]`. Quando nessun provider registrato → `external?`
   * field assente (bit-exact BC §42 API #13 preserve).
   *
   * Re-register stesso name → overwrite idempotent (D-V2-F16-01). Provider
   * che `throw` durante invocazione → skip silenzioso (pattern F1 D-20).
   *
   * @example Quick start (anticipo W2 mfInspectorModule)
   * ```ts
   * const broker = createDevtoolsBroker({})
   * broker.registerSnapshotProvider('mf', () => ({ microFrontends: [...] }))
   * const snap = broker.getDebugSnapshot()
   * console.log(snap.external?.mf)
   * ```
   *
   * @param name - Identifier univoco del provider (es. `'mf'`, `'theme'`).
   *   Re-register overwrite il provider esistente per lo stesso name.
   * @param fn - Funzione sync invocata a ogni snapshot. Output assegnato a
   *   `external[name]`. Provider che `throw` → skip silenzioso.
   *
   * @see D-V2-F16-01 (Registry sede)
   * @see D-V2-F16-03 (sync invocation)
   * @see {@link createSnapshotProviderRegistry}
   */
  registerSnapshotProvider(name: string, fn: SnapshotProviderFn): void {
    this.snapshotProviders.register(name, fn)
  }

  /** TOOL-05 — cumulative MetricsSnapshot (D-164). */
  getMetrics(): MetricsSnapshot {
    return this.metrics.getMetrics()
  }

  /** TOOL-04 — pauseTopic (D-168). Idempotent. */
  pauseTopic(topic: string): void {
    this.pauseController.pauseTopic(topic)
  }

  /** TOOL-04 — resumeTopic + replay FIFO (D-168). */
  resumeTopic(topic: string): void {
    this.pauseController.resumeTopic(topic)
  }

  /** TOOL-04 — flushQueue + audit emit (D-169). */
  flushQueue(topic?: string): readonly FlushQueueResult[] {
    return this.pauseController.flushQueue(topic)
  }
}
