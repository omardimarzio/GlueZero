/**
 * `@gluezero/devtools/mf-inspector/timings` — Timings collector (D-V2-F16-09).
 *
 * Raccoglie 11 timing field per ogni `mfId` via subscribe lifecycle topics F8.
 * **Pitfall #1 mitigation:** ZERO diff `packages/microfrontends/src/` — il
 * collector vive interamente nel subpath devtools e si aggancia agli already-emitted
 * topic F8.
 *
 * **EMPIRICAL VERIFIED 2026-05-16 — RESEARCH §7.2 RESOLVED:**
 * Tutti gli 11 topic lifecycle SONO emessi da `packages/microfrontends/src/registry.ts`
 * via `publishLifecycleEvent(reg)` (riga 331-352) su ogni transition FSM. Grep planner-time:
 * - `microfrontend.registered` — register()
 * - `microfrontend.loading` / `.loaded` — load() (linee 429, 441)
 * - `microfrontend.bootstrapping` / `.bootstrapped` — bootstrap() (linee 478, 486)
 * - `microfrontend.mounting` / `.mounted` — mount() (linee 538, 546)
 * - `microfrontend.unmounting` / `.unmounted` — unmount() (linee 567, 575)
 * - `microfrontend.destroying` / `.destroyed` — destroy() (linee 624, 630)
 *
 * **First-write-wins semantica (D-V2-F16-09):** se un topic re-emette (es. retry
 * path via `failed → loading` transition), il field corrispondente NON viene
 * sovrascritto. Il primo timestamp osservato rimane autoritativo.
 *
 * @see D-V2-F16-09 — first-write-wins + 11-field topology
 * @see RESEARCH §7.2 RESOLVED — empirical verification 11/11 topic emit
 * @see Pitfall #1 — ZERO diff `packages/microfrontends/src/`
 * @packageDocumentation
 */

import type { MicroFrontendTimings } from './types'

/**
 * Mapping `topic` F8 → `MicroFrontendTimings` field (D-V2-F16-09).
 *
 * **COMPLETO 11 entries** (RESEARCH §7.2 RESOLVED). Topic gerund `*ing` mappa al
 * field `*StartedAt` (semantica "phase started"); topic past tense mappa al field
 * `*At` (semantica "phase completed").
 */
const TOPIC_TO_FIELD: Readonly<Record<string, keyof MicroFrontendTimings>> = {
  'microfrontend.registered': 'registeredAt',
  'microfrontend.loading': 'loadStartedAt',
  'microfrontend.loaded': 'loadedAt',
  'microfrontend.bootstrapping': 'bootstrapStartedAt',
  'microfrontend.bootstrapped': 'bootstrappedAt',
  'microfrontend.mounting': 'mountStartedAt',
  'microfrontend.mounted': 'mountedAt',
  'microfrontend.unmounting': 'unmountStartedAt',
  'microfrontend.unmounted': 'unmountedAt',
  'microfrontend.destroying': 'destroyStartedAt',
  'microfrontend.destroyed': 'destroyedAt',
}

/**
 * Collector di `MicroFrontendTimings` per-MF.
 *
 * Storage: `Map<mfId, MicroFrontendTimings>`. Granularità per-MF garantisce
 * isolamento dei timing tra micro-frontend differenti.
 */
export interface TimingsCollector {
  /**
   * Registra il timestamp per la phase corrispondente al `topic` dato.
   *
   * **No-op se:**
   * - `topic` non è uno dei 11 lifecycle topic mappati (`TOPIC_TO_FIELD` lookup);
   * - il field corrispondente è già popolato (first-write-wins D-V2-F16-09).
   *
   * @param mfId - ID del micro-frontend (`event.payload.id` da `publishLifecycleEvent`).
   * @param topic - Topic emesso (`event.topic`).
   * @param timestamp - `event.metadata.timestamp ?? Date.now()` — caller responsibility.
   */
  recordIfLifecycle(mfId: string, topic: string, timestamp: number): void
  /**
   * Ritorna deep-clone della `MicroFrontendTimings` per il `mfId` dato (o `undefined`
   * se non sono stati ancora registrati eventi). Mutare il return value NON corrompe
   * lo state interno (D-162 carryover).
   */
  get(mfId: string): MicroFrontendTimings | undefined
  /** Svuota tutto lo state (per `module.install` AbortController cascade D-V2-16). */
  clear(): void
}

/**
 * Crea un nuovo `TimingsCollector` stateless-on-construction.
 *
 * @returns Una nuova istanza `TimingsCollector`.
 *
 * @example Quick start
 * ```ts
 * const timings = createTimingsCollector()
 * timings.recordIfLifecycle('mf1', 'microfrontend.registered', 1000)
 * timings.recordIfLifecycle('mf1', 'microfrontend.loading', 2000)
 * timings.recordIfLifecycle('mf1', 'microfrontend.loaded', 3000)
 * console.log(timings.get('mf1'))
 * // { registeredAt: 1000, loadStartedAt: 2000, loadedAt: 3000 }
 * ```
 *
 * @example First-write-wins (D-V2-F16-09)
 * ```ts
 * const timings = createTimingsCollector()
 * timings.recordIfLifecycle('mf1', 'microfrontend.loading', 100)
 * timings.recordIfLifecycle('mf1', 'microfrontend.loading', 200) // ignored
 * console.log(timings.get('mf1')?.loadStartedAt) // 100
 * ```
 *
 * @example Non-lifecycle topic skip
 * ```ts
 * const timings = createTimingsCollector()
 * timings.recordIfLifecycle('mf1', 'microfrontend.failed', 100) // no field
 * console.log(timings.get('mf1')) // undefined
 * ```
 *
 * @see D-V2-F16-09
 * @see RESEARCH §7.2 RESOLVED
 */
export function createTimingsCollector(): TimingsCollector {
  const store = new Map<string, MicroFrontendTimings>()
  return {
    recordIfLifecycle(mfId: string, topic: string, timestamp: number): void {
      const field = TOPIC_TO_FIELD[topic]
      if (field === undefined) return // non-lifecycle topic skip
      let t = store.get(mfId)
      if (t === undefined) {
        t = {}
        store.set(mfId, t)
      }
      // First-write-wins D-V2-F16-09 — NON sovrascrivere field già popolato
      if (t[field] === undefined) {
        t[field] = timestamp
      }
    },
    get(mfId: string): MicroFrontendTimings | undefined {
      const t = store.get(mfId)
      if (t === undefined) return undefined
      // Deep-clone (D-162) — mutare return NON corrompe state interno
      return { ...t }
    },
    clear(): void {
      store.clear()
    },
  }
}
