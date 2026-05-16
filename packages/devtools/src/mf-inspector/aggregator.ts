/**
 * `@gluezero/devtools/mf-inspector/aggregator` — Hybrid pull+push 17-fields aggregator (D-V2-F16-05).
 *
 * Coordina:
 * - **Pull side** — `MicroFrontendsService.list()` come fonte autoritativa dei MF registrati
 *   + opt Service Locator lookup (F11 permissions, F12 compat, F13 isolation, F14 fallbacks).
 *   Service Locator graceful degradation (D-V2-F16-06): se la lookup-fn è undefined → field
 *   nel snapshot resta undefined, NO throw.
 * - **Push side** — `Map<mfId, MfState>` aggiornato incrementalmente dal subscribe pipeline
 *   (`handleEvent(topic, event)` invocato dal `module.ts` per ogni 29 topics F8 + wildcard).
 *   Per-MF ring buffer 500 FIFO drop-oldest (D-V2-F16-09 topology).
 *
 * `buildSnapshot()` compone i due lati in `MicroFrontendDebugSnapshot[]` (17-field) + applica
 * `structuredClone` defensivo (D-162) prima del return.
 *
 * **`cleanupResources` placeholder `[]`** (RESEARCH §7.1 RESOLVED): in V2 baseline il campo è
 * sempre array vuoto — popolazione richiederebbe instrumentazione `runtime-context-factory.ts`
 * in F8 (diff `packages/microfrontends/src/` — VIOLA D-83 strict). Documentato V2.1+ extension.
 *
 * @see D-V2-F16-05 — hybrid pull+push pattern
 * @see D-V2-F16-06 — Service Locator graceful degradation
 * @see D-V2-F16-09 — per-MF ring buffer 500
 * @see RESEARCH §7.1 RESOLVED — cleanupResources placeholder V2.1 deferral
 * @packageDocumentation
 */

import type { MicroFrontendsService } from '@gluezero/microfrontends'
import { createMfRingBuffer, type MfRingBuffer } from './ring-buffer'
import type { MfEvent, MfState, MicroFrontendDebugSnapshot, MicroFrontendTimings } from './types'

/**
 * Options per `createMfAggregator` factory (D-V2-F16-05 + D-V2-F16-06).
 *
 * - `ringBufferSize` — cap ring buffer per-MF (D-V2-F16-09, default 500 nel chiamante).
 * - `mfService` — fonte autoritativa pull-side dei MF registrati (`MicroFrontendsService.list()`).
 * - `permsLookup?` / `compatLookup?` / `isolationLookup?` / `fallbacksLookup?` / `timingsLookup?`
 *   — opt Service Locator lookups (D-V2-F16-06 graceful). Quando `undefined`, il field
 *   corrispondente nel snapshot resta `undefined` (NO throw).
 */
export interface MfAggregatorOptions {
  readonly ringBufferSize: number
  readonly mfService: MicroFrontendsService
  readonly permsLookup?: (mfId: string) => unknown
  readonly compatLookup?: (mfId: string) => unknown
  readonly isolationLookup?: (mfId: string) => unknown
  readonly fallbacksLookup?: (mfId: string) => unknown
  readonly timingsLookup?: (mfId: string) => MicroFrontendTimings | undefined
}

/**
 * Aggregator pubblico (D-V2-F16-05).
 */
export interface MfAggregator {
  /** Dispatch event al state push + ring buffer. Caller responsibility extract `event.payload?.id`. */
  handleEvent(topic: string, event: unknown): void
  /** Append diretto su ring buffer per `mfId` (es. wildcard subscribe `metadata.microFrontendId`). */
  recordEvent(mfId: string, event: MfEvent): void
  /** Append diretto su `state.topicsPublished` per `mfId` (wildcard attribution). */
  recordTopic(mfId: string, topic: string): void
  /** Read-only get del state push (deep-clone non garantito — uso interno). */
  get(mfId: string): MfState | undefined
  /** Snapshot deep-clone del ring buffer per `mfId`. */
  getRingBuffer(mfId: string): readonly MfEvent[]
  /**
   * Compone snapshot 17-field via hybrid pull+push (D-V2-F16-05). Output deep-cloned via
   * `structuredClone` (D-162). Tutti i MF registrati in `mfService.list()` appaiono nel
   * risultato, anche se `state.get(mfId) === undefined` (case "nessun event push ancora").
   */
  buildSnapshot(): { readonly microFrontends: readonly MicroFrontendDebugSnapshot[] }
  /** Drena tutti i ring buffer (tutti i MF) — usato da `MfInspectorService.flush()`. */
  flush(): readonly MfEvent[]
  /** Lista degli `mfId` osservati push-side (per audit/testing). */
  list(): readonly string[]
  /** Svuota state + buffers (per AbortController cleanup cascade D-V2-16). */
  clear(): void
}

/**
 * Crea un `MfAggregator` stateless-on-construction (D-V2-F16-05).
 *
 * @param opts - Configuration (mfService required + opt Service Locator lookups).
 * @returns Una nuova istanza `MfAggregator`.
 *
 * @example End-to-end con handleEvent + buildSnapshot
 * ```ts
 * const aggregator = createMfAggregator({
 *   ringBufferSize: 500,
 *   mfService,
 *   permsLookup: (id) => permsSvc.getCapabilities(id),
 * })
 * aggregator.handleEvent('microfrontend.failed', {
 *   topic: 'microfrontend.failed',
 *   payload: { id: 'mf1', phase: 'load', message: 'err' },
 * })
 * const snap = aggregator.buildSnapshot()
 * console.log(snap.microFrontends[0].errors.length) // 1
 * ```
 *
 * @example Service Locator graceful degradation (D-V2-F16-06)
 * ```ts
 * const aggregator = createMfAggregator({
 *   ringBufferSize: 500,
 *   mfService,
 *   // permsLookup intentionally undefined — F11 non installato
 * })
 * const snap = aggregator.buildSnapshot()
 * console.log(snap.microFrontends[0].permissions) // undefined (no throw)
 * ```
 *
 * @see D-V2-F16-05
 * @see D-V2-F16-06
 * @see D-V2-F16-09
 */
export function createMfAggregator(opts: MfAggregatorOptions): MfAggregator {
  const state = new Map<string, MfState>()
  const buffers = new Map<string, MfRingBuffer<MfEvent>>()

  /** Crea uno `MfState` inizializzato a default (Set vuoti, counter 0, array vuoti). */
  function createDefaultState(): MfState {
    return {
      topicsPublished: new Set<string>(),
      topicsSubscribed: new Set<string>(),
      routeCalls: 0,
      workerTasks: 0,
      contextReads: 0,
      contextWrites: 0,
      errors: [],
      fallbacksApplied: [],
      subscriptionsCreated: 0,
      activeSubscriptions: 0,
      // RESEARCH §7.1 RESOLVED — placeholder array vuoto (V2.1 deferral popolazione)
      cleanupResources: [],
      eventCount: 0,
    }
  }

  function getOrCreate(mfId: string): MfState {
    let s = state.get(mfId)
    if (s === undefined) {
      s = createDefaultState()
      state.set(mfId, s)
    }
    return s
  }

  function ensureBuffer(mfId: string): MfRingBuffer<MfEvent> {
    let b = buffers.get(mfId)
    if (b === undefined) {
      b = createMfRingBuffer<MfEvent>(opts.ringBufferSize)
      buffers.set(mfId, b)
    }
    return b
  }

  /**
   * Estrae `mfId` da `event.payload` accettando entrambe le shape:
   * - `payload.id` (F8 `MicroFrontendLifecycleEventPayload` — registry.ts line 339)
   * - `payload.microFrontendId` (F14 `microfrontend.fallback.rendered` — fallbacks-module.ts line 289)
   */
  function extractMfId(event: unknown): string | undefined {
    if (event === null || typeof event !== 'object') return undefined
    const ev = event as { payload?: unknown }
    const payload = ev.payload
    if (payload === null || typeof payload !== 'object') return undefined
    const p = payload as { id?: unknown; microFrontendId?: unknown }
    if (typeof p.id === 'string') return p.id
    if (typeof p.microFrontendId === 'string') return p.microFrontendId
    return undefined
  }

  function extractTimestamp(event: unknown): number {
    if (event === null || typeof event !== 'object') return Date.now()
    const ev = event as { metadata?: { timestamp?: unknown }; timestamp?: unknown }
    if (typeof ev.metadata?.timestamp === 'number') return ev.metadata.timestamp
    if (typeof ev.timestamp === 'number') return ev.timestamp
    return Date.now()
  }

  function handleEvent(topic: string, event: unknown): void {
    const mfId = extractMfId(event)
    if (mfId === undefined) return // no-op senza mfId attributable
    const s = getOrCreate(mfId)
    const ts = extractTimestamp(event)
    const payload = (event as { payload?: unknown }).payload

    // Topic categorization (push-side counters/arrays update)
    if (topic.endsWith('.failed') || topic.includes('.failure')) {
      const p = (payload ?? {}) as { phase?: unknown; message?: unknown; code?: unknown; error?: unknown }
      const phaseRaw = p.phase
      const messageRaw =
        p.message ??
        (p.error && typeof p.error === 'object' ? (p.error as { message?: unknown }).message : undefined)
      const codeRaw =
        p.code ??
        (p.error && typeof p.error === 'object' ? (p.error as { code?: unknown }).code : undefined)
      const errEntry: { phase: string; message: string; timestamp: number; code?: string } = {
        phase: typeof phaseRaw === 'string' ? phaseRaw : 'unknown',
        message: typeof messageRaw === 'string' ? messageRaw : '',
        timestamp: ts,
      }
      if (typeof codeRaw === 'string') errEntry.code = codeRaw
      s.errors.push(errEntry)
    } else if (topic === 'microfrontend.fallback.rendered') {
      const p = (payload ?? {}) as { lifecyclePhase?: unknown; fallbackType?: unknown }
      s.fallbacksApplied.push({
        phase: typeof p.lifecyclePhase === 'string' ? p.lifecyclePhase : 'unknown',
        type: typeof p.fallbackType === 'string' ? p.fallbackType : 'unknown',
        timestamp: ts,
      })
    } else if (topic === 'microfrontend.subscription.created') {
      s.subscriptionsCreated++
      s.activeSubscriptions++
    } else if (topic === 'microfrontend.subscription.disposed') {
      s.activeSubscriptions = Math.max(0, s.activeSubscriptions - 1)
    } else if (topic.includes('route')) {
      // Placeholder W3 P03 metrics refinement — route call topic detection
      s.routeCalls++
    } else if (topic.includes('worker')) {
      s.workerTasks++
    } else if (topic.includes('context.write') || topic.includes('context.updated')) {
      s.contextWrites++
    } else if (topic.includes('context.read')) {
      s.contextReads++
    }

    // Track topic come "published da questo MF" (push-side topicsPublished)
    s.topicsPublished.add(topic)

    // Append ring buffer per-MF
    ensureBuffer(mfId).push({ topic, payload, timestamp: ts, mfId })
    s.eventCount++
  }

  function recordEvent(mfId: string, event: MfEvent): void {
    ensureBuffer(mfId).push(event)
    const s = getOrCreate(mfId)
    s.eventCount++
  }

  function recordTopic(mfId: string, topic: string): void {
    const s = getOrCreate(mfId)
    s.topicsPublished.add(topic)
  }

  function buildSnapshot(): { readonly microFrontends: readonly MicroFrontendDebugSnapshot[] } {
    const microFrontends: MicroFrontendDebugSnapshot[] = []
    // EMPIRICAL: F8 service espone `list(filter?): readonly MicroFrontendRegistration[]`
    const list = opts.mfService.list()
    for (const reg of list) {
      const mfId = reg.descriptor.id
      const s = state.get(mfId)
      const descriptor = reg.descriptor as {
        version?: string
        owner?: unknown
        loader?: { type?: string }
        mount?: unknown
        capabilities?: unknown
        theme?: unknown
      }
      const timingsValue = opts.timingsLookup?.(mfId)
      const entry: MicroFrontendDebugSnapshot = {
        id: mfId,
        state: reg.state,
        version: typeof descriptor.version === 'string' ? descriptor.version : 'unknown',
        owner: descriptor.owner,
        ...(typeof descriptor.loader?.type === 'string' && { loaderType: descriptor.loader.type }),
        mountTarget: descriptor.mount,
        // D-V2-F16-06 graceful — undefined lookup → undefined field, NO throw
        isolation: opts.isolationLookup?.(mfId),
        permissions: opts.permsLookup?.(mfId),
        capabilities: descriptor.capabilities,
        compatibility: opts.compatLookup?.(mfId),
        theme: descriptor.theme,
        topicsPublished: Array.from(s?.topicsPublished ?? []),
        topicsSubscribed: Array.from(s?.topicsSubscribed ?? []),
        routeCallsCount: s?.routeCalls ?? 0,
        workerTasksCount: s?.workerTasks ?? 0,
        contextReadCount: s?.contextReads ?? 0,
        contextWriteCount: s?.contextWrites ?? 0,
        errors: s?.errors ?? [],
        fallbacksApplied: s?.fallbacksApplied ?? [],
        subscriptionsCreated: s?.subscriptionsCreated ?? 0,
        // RESEARCH §7.1 RESOLVED — placeholder []
        cleanupResources: s?.cleanupResources ?? [],
        fallbackPolicy: opts.fallbacksLookup?.(mfId),
        ...(timingsValue !== undefined && { timings: timingsValue }),
      }
      microFrontends.push(entry)
    }
    // D-162 defensive deep-clone — mutare return value NON corrompe state interno
    return structuredClone({ microFrontends }) as {
      readonly microFrontends: readonly MicroFrontendDebugSnapshot[]
    }
  }

  function flush(): readonly MfEvent[] {
    const all: MfEvent[] = []
    for (const buf of buffers.values()) {
      for (const ev of buf.snapshot()) all.push(ev)
    }
    return all
  }

  function list(): readonly string[] {
    return Array.from(state.keys())
  }

  function clear(): void {
    state.clear()
    buffers.clear()
  }

  return {
    handleEvent,
    recordEvent,
    recordTopic,
    get(mfId: string): MfState | undefined {
      return state.get(mfId)
    },
    getRingBuffer(mfId: string): readonly MfEvent[] {
      const buf = buffers.get(mfId)
      return buf?.snapshot() ?? []
    },
    buildSnapshot,
    flush,
    list,
    clear,
  }
}
