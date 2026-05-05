// tap-registry.ts — F6 plan 06-04 Task 2.
//
// `createTapRegistry()` runtime tap management (add/remove/list/getMultiplexed)
// + `wrapLegacyTap(config)` helper auto-wrap F1 `runtime.tap` single-tap legacy
// in array F6 `taps[]` per backward-compat zero breaking (D-159).
//
// Pattern Map registry analog F5 worker-registry.ts:104-110 (Map<string, T> +
// id auto-incrementale + handle.id opaque).
//
// Auto-wrap pattern (D-159):
//   - `config.taps` undefined && `config.runtime.tap` present → [legacyTap]
//   - `config.taps` array && `config.runtime.tap` present → [...config.taps, legacyTap]
//   - `config.taps` array && `config.runtime.tap` absent → [...config.taps]
//   - entrambi assenti → []
//
// Ordering F6 first + F1 last: i tap user-side espliciti F6 hanno priorità
// d'ordine, il legacy F1 single-tap è appended al fondo (consistency con
// "additive" semantica del declaration merging).
//
// Threat coverage:
// - T-06-04-03 (Logic flaw auto-wrap perde tap legacy): mitigated — Test 7
//   verifica `runtime.tap + taps[]` coexist (entrambi chiamati post-wrap).

import type { EventTap } from '@sembridge/core'
import { createMultiplexTap } from './multiplex-tap'

/**
 * Handle opaque ritornato da {@link TapRegistry.add}. Usato per
 * {@link TapRegistry.remove}.
 *
 * `id` è una stringa internamente generata (`tap-<n>`); il consumer non deve
 * fare assumption sul formato — è un opaque token.
 */
export interface TapHandle {
  readonly id: string
}

/**
 * F6 TapRegistry — runtime tap management API.
 *
 * Pattern Map registry analog F5 `worker-registry.ts`. Aggiunge tap, rimuove
 * via handle, lista snapshot, esporta MultiplexTap che la pipeline F1 può
 * consumare via `runtime.tap` (single value) per delegare a tutti i tap
 * registrati (D-159).
 *
 * @see {@link createTapRegistry}
 * @see {@link createMultiplexTap}
 */
export interface TapRegistry {
  /**
   * Aggiunge un EventTap al registry. Ritorna un handle opaque per future
   * `remove()`.
   */
  add(tap: EventTap): TapHandle
  /**
   * Rimuove il tap associato all'handle. Ritorna `true` se trovato e rimosso,
   * `false` se l'handle è già stato rimosso o non è mai stato aggiunto.
   */
  remove(handle: TapHandle): boolean
  /**
   * Snapshot readonly dei tap correnti (ordine FIFO di registrazione).
   */
  list(): readonly EventTap[]
  /**
   * Ritorna un EventTap aggregator (via {@link createMultiplexTap}) che invoca
   * tutti i tap correnti con error isolation.
   *
   * **Snapshot semantics**: il MultiplexTap ritornato cattura lo stato del
   * registry al momento della chiamata. Modifiche successive al registry NON
   * sono visibili al MultiplexTap già costruito — chiamare di nuovo
   * `getMultiplexed()` per ottenere un aggregator aggiornato. Pattern intenzionale
   * per perf (no overhead per-step di list rebuild).
   */
  getMultiplexed(): EventTap
}

/**
 * Crea un nuovo {@link TapRegistry} runtime.
 *
 * Internamente usa una `Map<string, EventTap>` con id auto-incrementale
 * (`tap-1`, `tap-2`, …). L'iterazione preserva l'ordine di inserimento (spec
 * Map ECMA-262 § 24.1).
 *
 * @example
 * ```ts
 * const registry = createTapRegistry()
 * const handle = registry.add(eventInspector.tap)
 * registry.add(metricsCollector.tap)
 * const aggregated = registry.getMultiplexed()
 *
 * new RouterBroker({ ...config, runtime: { tap: aggregated } })
 *
 * // Removal a runtime:
 * registry.remove(handle)
 * const updated = registry.getMultiplexed() // nuovo aggregator senza eventInspector
 * ```
 *
 * @returns TapRegistry handle.
 */
export function createTapRegistry(): TapRegistry {
  const taps = new Map<string, EventTap>()
  let nextId = 0
  return {
    add(tap) {
      const id = `tap-${++nextId}`
      taps.set(id, tap)
      return { id }
    },
    remove(handle) {
      return taps.delete(handle.id)
    },
    list() {
      return Array.from(taps.values())
    },
    getMultiplexed() {
      return createMultiplexTap(Array.from(taps.values()))
    },
  }
}

/**
 * Auto-wrap F1 single-tap legacy (`config.runtime.tap`) in array F6 (`config.taps[]`)
 * per backward-compat zero breaking (D-159).
 *
 * Ordering: F6 array first + F1 legacy last. Garantisce che i tap user-side
 * espliciti F6 abbiano priorità d'ordine (FIFO), il legacy F1 single-tap è
 * appended al fondo per consistency con la semantica additive del declaration
 * merging.
 *
 * **Pattern uso**: il `createDevtoolsBroker` F6 (plan 06-08b) chiama
 * `wrapLegacyTap` sul `BrokerConfig` ricevuto e passa l'array consolidato a
 * `createMultiplexTap` per produrre il single tap che la pipeline F1 vede via
 * `runtime.tap`.
 *
 * @example
 * ```ts
 * const userConfig: BrokerConfig = {
 *   runtime: { tap: legacyAnalyticsTap },        // F1 legacy
 *   taps: [eventInspector.tap, metricsCollector.tap], // F6 chain
 * }
 * const consolidated = wrapLegacyTap(userConfig)
 * // → [eventInspector.tap, metricsCollector.tap, legacyAnalyticsTap]
 * const aggregated = createMultiplexTap(consolidated)
 * ```
 *
 * Threat T-06-04-03 mitigation (Logic flaw auto-wrap perde tap legacy):
 * verificato dai test 7 + 8 che `runtime.tap` post-wrap è incluso nell'array
 * risultante.
 *
 * @param config Subset di BrokerConfig con `runtime.tap` (legacy F1) +
 *   `taps` (F6 array).
 * @returns Array consolidato readonly. Ordering: F6 array first, F1 legacy last.
 */
export function wrapLegacyTap(config: {
  readonly runtime?: { readonly tap?: EventTap }
  readonly taps?: readonly EventTap[]
}): readonly EventTap[] {
  const userTaps = config.taps ?? []
  if (config.runtime?.tap) {
    return [...userTaps, config.runtime.tap]
  }
  return [...userTaps]
}
