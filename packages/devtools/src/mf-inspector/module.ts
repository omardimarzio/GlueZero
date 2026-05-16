/**
 * `@gluezero/devtools/mf-inspector/module` — `mfInspectorModule()` factory (D-V2-F16-04).
 *
 * Pattern carryover diretto F11 `permissions-module.ts` + F14 `fallbacks-module.ts`:
 * 1. Lookup `SERVICE_MICROFRONTENDS` via `ctx.broker.getService(...)` — throw esplicativo se assente
 * 2. Idempotent guard: re-install rileva `SERVICE_MF_INSPECTOR` already registered → warn + return
 * 3. Lookup OPZIONALE 4 service governance (`SERVICE_PERMISSIONS`/`SERVICE_COMPAT`/`SERVICE_ISOLATION`/`SERVICE_FALLBACKS`)
 *    — graceful degradation D-V2-F16-06 (NO throw quando assenti)
 * 4. Crea `createTimingsCollector()` + `createMfPause()` + `createMfAggregator(...)` con opt lookups
 * 5. Subscribe loop sui 29 standard topics F8 (`ALL_MF_TOPICS`) — handler invoca `pauseCtrl.intercept`
 *    → se passthrough → `aggregator.handleEvent(topic, event)` + `timings.recordIfLifecycle(...)`
 * 6. Subscribe wildcard `*` — handler filtra via `event.metadata?.microFrontendId` (MF-OBS-01
 *    attribution) e invoca `aggregator.recordTopic(mfId, event.topic)` per attribution diretta
 * 7. `ctx.registerService(SERVICE_MF_INSPECTOR, service)` — espone API getSnapshot/pause/resume/flush
 * 8. **Plug-in MIN-3 registration:** se `broker.registerSnapshotProvider` è una function (DevtoolsBroker
 *    W1 P01), registra `'mf'` provider che ritorna `aggregator.buildSnapshot()`. Su plain Broker
 *    (F1 core) il guard fa skip silenzioso (graceful).
 * 9. AbortController cleanup cascade D-V2-16: broker shutdown → ctrl.abort() → unsubscribe + state clear
 *
 * **Anti-singleton D-30:** ogni call ritorna nuovo `BrokerModule` instance.
 *
 * **broker.subscribe signature empirical (RESEARCH §7.5 RESOLVED):**
 * `subscribe(pattern, handler, options?: SubscribeOptions)` dove `SubscribeOptions` ha
 * `{signal?, priority?, deliveryMode?, once?}` — `deliveryMode: 'sync' | 'async'` ESISTE
 * (`packages/core/src/types/subscription.ts:37`). F16 usa `{deliveryMode: 'sync'}` carryover
 * F14 fallbacks-module per consistency con F8 lifecycle event ordering.
 *
 * @see D-V2-F16-04 — Factory pattern carryover F11/F14
 * @see D-V2-F16-06 — Service Locator graceful degradation
 * @see D-V2-F16-07 — Subscribe 29 topics + wildcard MF-OBS-01
 * @see MF-DEVTOOLS-01..04 — REQ-ID frozen contract
 * @see packages/fallbacks/src/fallbacks-module.ts — F14 template
 * @packageDocumentation
 */

import type { BrokerModule, BrokerModuleContext, Subscription } from '@gluezero/core'
import {
  SERVICE_COMPAT,
  SERVICE_FALLBACKS,
  SERVICE_ISOLATION,
  SERVICE_MICROFRONTENDS,
  SERVICE_PERMISSIONS,
} from '@gluezero/core'
import type { MicroFrontendsService } from '@gluezero/microfrontends'
import { createMfAggregator } from './aggregator'
import { createMfPause } from './pause'
import { SERVICE_MF_INSPECTOR, type MfInspectorService } from './service-locator'
import { createTimingsCollector } from './timings'
import { ALL_MF_TOPICS } from './topics'
import type { MfEvent } from './types'

const DEFAULT_RING_BUFFER_SIZE = 500

/**
 * Setup-time options per `mfInspectorModule()` (D-V2-F16-09 + D-V2-F16-12).
 *
 * - `ringBufferSize?` — cap ring buffer per-MF (default 500, D-V2-F16-09).
 * - `maxMfs?` — cap cardinality globale N_MF (reserved V2.1, D-V2-F16-12). In V2 baseline
 *   il param è hold-only (non enforced) — documentato per forward-compat API surface.
 *
 * @example Setup minimale (default 500)
 * ```ts
 * mfInspectorModule()
 * ```
 *
 * @example Setup custom ring buffer
 * ```ts
 * mfInspectorModule({ ringBufferSize: 1000 })
 * ```
 */
export interface MfInspectorModuleOptions {
  readonly ringBufferSize?: number
  /** Reserved V2.1 (D-V2-F16-12 cardinality cap N_MF). V2 baseline: hold-only. */
  readonly maxMfs?: number
}

/**
 * Type-helper per probe `DevtoolsBroker.registerSnapshotProvider` (W1 P01 API).
 *
 * Guard `typeof === 'function'` su plain Broker (F1 core) → skip silenzioso.
 */
interface DevtoolsBrokerLike {
  readonly registerSnapshotProvider?: (name: string, fn: () => unknown) => void
}

/**
 * Type-helper per probe `broker.shutdownSignal` (D-V2-16 cleanup cascade).
 */
interface BrokerWithShutdown {
  readonly shutdownSignal?: AbortSignal
}

/**
 * Factory `BrokerModule` per `@gluezero/devtools/mf-inspector` (D-V2-F16-04 + MF-DEVTOOLS-01..04).
 *
 * Install lookup `SERVICE_MICROFRONTENDS` (required throw if absent), idempotent guard,
 * Service Locator opt lookups 4 governance services (graceful), aggregator + timings + pause
 * composition, subscribe 29 topics + wildcard MF-OBS-01, register service + SnapshotProvider
 * (guard plain Broker), AbortController cleanup cascade.
 *
 * @param options - Setup-time options (ringBufferSize default 500, maxMfs reserved V2.1).
 * @returns Nuovo `BrokerModule` (anti-singleton D-30).
 *
 * @throws `Error` se `@gluezero/microfrontends` (`SERVICE_MICROFRONTENDS`) NON installato.
 *
 * @example Quick start (DevtoolsBroker + microfrontendModule + mfInspectorModule)
 * ```ts
 * import { createDevtoolsBroker } from '@gluezero/devtools'
 * import { microfrontendModule } from '@gluezero/microfrontends'
 * import { mfInspectorModule, SERVICE_MF_INSPECTOR } from '@gluezero/devtools/mf-inspector'
 *
 * const broker = createDevtoolsBroker({
 *   modules: [microfrontendModule(), mfInspectorModule()],
 * })
 * // Snapshot via DebugSnapshot.external (Plug-in MIN-3 registered)
 * const snap = broker.getDebugSnapshot()
 * console.log(snap.external?.mf)
 *
 * // Or via Service Locator
 * const inspector = broker.getService<MfInspectorService>(SERVICE_MF_INSPECTOR)!
 * console.log(inspector.getSnapshot().microFrontends.length)
 * ```
 *
 * @example Pause/resume/flush API (D-V2-F16-10)
 * ```ts
 * const inspector = broker.getService<MfInspectorService>(SERVICE_MF_INSPECTOR)!
 * inspector.pause()
 * await broker.publish('microfrontend.mounted', { id: 'mf1' })
 * inspector.resume()
 * const queued = inspector.flush()
 * console.log(queued.length) // events accumulati durante pause
 * ```
 *
 * @see D-V2-F16-04 (factory carryover F11/F14)
 * @see D-V2-F16-07 (29 topics + wildcard)
 * @see MF-DEVTOOLS-01..04 (REQ-ID frozen)
 */
export function mfInspectorModule(options: MfInspectorModuleOptions = {}): BrokerModule {
  return {
    id: 'mf-inspector',
    version: '2.0.0-alpha.0',
    install(ctx: BrokerModuleContext): void {
      const broker = ctx.broker
      const ringBufferSize = options.ringBufferSize ?? DEFAULT_RING_BUFFER_SIZE

      // (1) Lookup SERVICE_MICROFRONTENDS — required (F8 hard requirement)
      const maybeMfService = broker.getService<MicroFrontendsService>(SERVICE_MICROFRONTENDS)
      if (maybeMfService === undefined) {
        throw new Error(
          '@gluezero/devtools/mf-inspector requires @gluezero/microfrontends to be installed first. ' +
            'Add microfrontendModule() before mfInspectorModule() in the modules array.',
        )
      }
      const mfService: MicroFrontendsService = maybeMfService

      // (2) Idempotent guard (carryover F14 pattern)
      const alreadyInstalled = broker.getService<MfInspectorService>(SERVICE_MF_INSPECTOR)
      if (alreadyInstalled !== undefined) {
        // biome-ignore lint/suspicious/noConsole: dev warning intentional (re-install governance)
        console.warn('[mf-inspector] already installed; skipping re-install')
        return
      }

      // (3) Lookup opt services (D-V2-F16-06 graceful degradation — RESEARCH §7.4 RESOLVED)
      // Service shape effettiva:
      //   F11 SERVICE_PERMISSIONS → getCapabilities(id): Set<string> | undefined
      //   F12 SERVICE_COMPAT → getCompatibilityReport(id): CompatReport | undefined
      //   F13 SERVICE_ISOLATION → getResolvedPolicy(id): ResolvedIsolationPolicy | undefined
      //   F14 SERVICE_FALLBACKS → getCircuitState(id): CircuitState | undefined
      const permSvc = broker.getService<{ getCapabilities?: (id: string) => unknown }>(
        SERVICE_PERMISSIONS,
      )
      const compatSvc = broker.getService<{ getCompatibilityReport?: (id: string) => unknown }>(
        SERVICE_COMPAT,
      )
      const isoSvc = broker.getService<{ getResolvedPolicy?: (id: string) => unknown }>(
        SERVICE_ISOLATION,
      )
      const fallSvc = broker.getService<{ getCircuitState?: (id: string) => unknown }>(
        SERVICE_FALLBACKS,
      )

      // (4) Components composition
      const timings = createTimingsCollector()
      const pauseCtrl = createMfPause()
      const aggregator = createMfAggregator({
        ringBufferSize,
        mfService,
        ...(typeof permSvc?.getCapabilities === 'function' && {
          permsLookup: (id: string) => permSvc.getCapabilities!(id),
        }),
        ...(typeof compatSvc?.getCompatibilityReport === 'function' && {
          compatLookup: (id: string) => compatSvc.getCompatibilityReport!(id),
        }),
        ...(typeof isoSvc?.getResolvedPolicy === 'function' && {
          isolationLookup: (id: string) => isoSvc.getResolvedPolicy!(id),
        }),
        ...(typeof fallSvc?.getCircuitState === 'function' && {
          fallbacksLookup: (id: string) => fallSvc.getCircuitState!(id),
        }),
        timingsLookup: (id: string) => timings.get(id),
      })

      // (5) AbortController D-V2-16 cleanup cascade
      const ctrl = new AbortController()
      const subs: Subscription[] = []

      // (6) Subscribe 29 standard topics F8 — pauseCtrl gate + aggregator dispatch + timings record
      for (const topic of ALL_MF_TOPICS) {
        const sub = broker.subscribe(
          topic,
          (event) => {
            if (!pauseCtrl.intercept(event)) return
            aggregator.handleEvent(topic, event)
            const ev = event as {
              payload?: { id?: unknown; microFrontendId?: unknown }
              metadata?: { timestamp?: unknown }
            }
            const mfId =
              typeof ev.payload?.id === 'string'
                ? ev.payload.id
                : typeof ev.payload?.microFrontendId === 'string'
                  ? ev.payload.microFrontendId
                  : undefined
            const ts =
              typeof ev.metadata?.timestamp === 'number' ? ev.metadata.timestamp : Date.now()
            if (typeof mfId === 'string') {
              timings.recordIfLifecycle(mfId, topic, ts)
            }
          },
          { deliveryMode: 'sync' },
        )
        subs.push(sub)
      }

      // (7) Wildcard subscribe — eventsPerMfId attribution (D-V2-F16-07 + MF-OBS-01)
      // Filtra via metadata.microFrontendId (auto-popolato da MfRuntimeContext facade F8)
      const wildcardSub = broker.subscribe(
        '*',
        (event) => {
          if (!pauseCtrl.intercept(event)) return
          const ev = event as { metadata?: { microFrontendId?: unknown }; topic?: unknown }
          const mfId = ev.metadata?.microFrontendId
          if (typeof mfId !== 'string') return
          const topic = typeof ev.topic === 'string' ? ev.topic : 'unknown'
          aggregator.recordTopic(mfId, topic)
        },
        { deliveryMode: 'sync' },
      )
      subs.push(wildcardSub)

      // (8) Service API + register (D-V2-F16-04)
      const service: MfInspectorService = {
        getSnapshot: () => aggregator.buildSnapshot(),
        pause: () => pauseCtrl.pause(),
        resume: () => pauseCtrl.resume(),
        flush: (): readonly MfEvent[] => {
          // Drena sia pause queue sia ring buffer aggregator (concat)
          const pausedQueue = pauseCtrl.flush() as readonly MfEvent[]
          const buffered = aggregator.flush()
          return [...pausedQueue, ...buffered]
        },
      }
      ctx.registerService(SERVICE_MF_INSPECTOR, service)

      // (9) Register as SnapshotProvider su DevtoolsBroker (graceful guard typeof su plain Broker)
      const dvtBroker = broker as unknown as DevtoolsBrokerLike
      if (typeof dvtBroker.registerSnapshotProvider === 'function') {
        dvtBroker.registerSnapshotProvider('mf', () => aggregator.buildSnapshot())
      }

      // (10) Cleanup cascade D-V2-16 — broker shutdown → ctrl.abort() → unsubscribe + state clear
      const onAbort = (): void => {
        for (const sub of subs) sub.unsubscribe()
        aggregator.clear()
        timings.clear()
      }
      if (ctrl.signal.aborted) {
        onAbort()
      } else {
        ctrl.signal.addEventListener('abort', onAbort, { once: true })
      }

      const shutdownSignal = (broker as unknown as BrokerWithShutdown).shutdownSignal
      if (shutdownSignal !== undefined) {
        if (shutdownSignal.aborted) ctrl.abort()
        else shutdownSignal.addEventListener('abort', () => ctrl.abort(), { once: true })
      }

      // Param hold reserved future-use D-V2-F16-12
      void options.maxMfs
    },
  }
}
