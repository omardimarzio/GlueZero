/**
 * F16 W1 P01 — MIN-3 SnapshotProvider Registry foundation.
 *
 * Closure factory che mantiene una `Map<string, SnapshotProviderFn>` di provider
 * sync invocati a ogni `DevtoolsBroker.getDebugSnapshot()` call. Output dei
 * provider viene assegnato a `snapshot.external[name]` (multi-provider name-keyed).
 *
 * **Decisioni lockate F16 CONTEXT:**
 * - D-V2-F16-01 — Registry sede: API `registerSnapshotProvider(name, fn)` come
 *   metodo sul `DevtoolsBroker`. Storage interno `Map<string, () => unknown>`.
 * - D-V2-F16-02 — Shape `external?: Record<string, unknown>` multi-provider
 *   name-keyed (NO type coupling devtools→microfrontends; consumer fa narrowing
 *   locale `external.mf as MicroFrontendDebugSnapshot`).
 * - D-V2-F16-03 — Sync invocation on-demand a ogni `collect()` call. NO caching.
 *   NO async. Costo O(N_providers) ammortizzato (debug-time ~1-5 provider tipico).
 *
 * **Eccezione D-83 strict septuple esteso esplicita per `packages/devtools/src/`**
 * (F8 CONTEXT linea 41 + research SUMMARY linea 217 lockato). Nessuna modifica
 * a `packages/core/src/` o altri package src/ — solo additive in devtools.
 *
 * **Error handling — try/catch swallow:** provider che `throw` durante `collect()`
 * vengono saltati silenziosamente (NO propagation upstream). Pattern carryover F1
 * D-20 `safeTapStep` + F6 `devtools-broker.ts:230-232` ("/* idempotent — pattern
 * F3 silent *\/").
 *
 * @see D-V2-F16-01 (Registry sede)
 * @see D-V2-F16-02 (external shape multi-provider name-keyed)
 * @see D-V2-F16-03 (sync invocation)
 * @see .planning/research/SUMMARY.md:217 (MIN-3 implementazione baseline lockata)
 * @see packages/devtools/src/cardinality-cap.ts (analog primario closure factory + Map)
 * @packageDocumentation
 */

/**
 * Funzione provider invocata sync da `DevtoolsBroker.getDebugSnapshot()`.
 *
 * Output viene assegnato a `snapshot.external[name]`. Provider che `throw`
 * durante invocazione → skip silenzioso (coerente F1 D-20 `safeTapStep` pattern).
 *
 * @see D-V2-F16-03 (sync invocation on-demand a ogni collect)
 */
export type SnapshotProviderFn = () => unknown

/**
 * Registry MIN-3 — gestisce provider per `external?` field di `DebugSnapshot`.
 *
 * Storage `Map<string, SnapshotProviderFn>` con 4 metodi: register/unregister/
 * collect/size. Lifecycle: register idempotent (overwrite same name); unregister
 * ritorna boolean (true = rimosso, false = name assente); collect itera providers
 * con try/catch swallow + ritorna `Record<string, unknown>`; size ritorna numero
 * provider correnti.
 *
 * @example Lifecycle base
 * ```ts
 * const reg = createSnapshotProviderRegistry()
 * reg.register('mf', () => ({ microFrontends: [...] }))
 * reg.register('theme', () => ({ palette: 'dark' }))
 * console.log(reg.size())       // 2
 * console.log(reg.collect())    // { mf: {...}, theme: {...} }
 * reg.unregister('theme')       // true
 * console.log(reg.size())       // 1
 * ```
 *
 * @see D-V2-F16-01 (Registry sede)
 */
export interface SnapshotProviderRegistry {
  /**
   * Registra un provider per il name dato. Idempotent — re-register stesso name
   * sovrascrive il provider precedente (D-V2-F16-01).
   *
   * @example
   * ```ts
   * reg.register('mf', () => ({ microFrontends: [...] }))
   * ```
   * @see D-V2-F16-01
   */
  register(name: string, fn: SnapshotProviderFn): void
  /**
   * Rimuove il provider per il name dato. Ritorna `true` se rimosso, `false` se
   * il name non era registrato.
   *
   * @example
   * ```ts
   * reg.unregister('mf')      // true (se registrato)
   * reg.unregister('absent')  // false
   * ```
   */
  unregister(name: string): boolean
  /**
   * Invoca sync tutti i provider registrati e ritorna i loro output keyed per
   * name. Provider che `throw` → skip silenzioso (NO propagation upstream).
   * Invocazione sync on-demand a ogni call — NO caching (D-V2-F16-03).
   *
   * @example
   * ```ts
   * const out = reg.collect()  // { mf: {...}, theme: {...} }
   * ```
   * @see D-V2-F16-03 (sync invocation)
   */
  collect(): Record<string, unknown>
  /**
   * Ritorna il numero corrente di provider registrati. Utilizzato dal
   * `DevtoolsBroker.getDebugSnapshot()` per decidere se popolare il campo
   * `external?` (assente quando `size() === 0` → BC §42 API #13 preserve).
   *
   * @example
   * ```ts
   * if (reg.size() > 0) { snapshot.external = reg.collect() }
   * ```
   * @see D-V2-F16-02 (external? absent baseline)
   */
  size(): number
}

/**
 * Crea un Registry MIN-3 stateful (closure factory).
 *
 * Pattern carryover diretto da `packages/devtools/src/cardinality-cap.ts` +
 * `packages/devtools/src/event-inspector.ts:133-172` (closure factory + Map
 * storage + try/catch swallow su invocazione user-side).
 *
 * @returns Una nuova istanza `SnapshotProviderRegistry`.
 *
 * @example Quick start
 * ```ts
 * import { createSnapshotProviderRegistry } from '@gluezero/devtools'
 *
 * const reg = createSnapshotProviderRegistry()
 * reg.register('mf', () => ({ microFrontends: [{ id: 'header', state: 'mounted' }] }))
 * const external = reg.collect()
 * // → { mf: { microFrontends: [{ id: 'header', state: 'mounted' }] } }
 * ```
 *
 * @example Provider che throw → skip silenzioso (D-V2-F16-03 sync invocation)
 * ```ts
 * const reg = createSnapshotProviderRegistry()
 * reg.register('broken', () => { throw new Error('oops') })
 * reg.register('ok', () => ({ value: 1 }))
 * const out = reg.collect()
 * // → { ok: { value: 1 } } — 'broken' skipped silently
 * ```
 *
 * @see D-V2-F16-01
 * @see D-V2-F16-02
 * @see D-V2-F16-03
 */
export function createSnapshotProviderRegistry(): SnapshotProviderRegistry {
  const providers = new Map<string, SnapshotProviderFn>()
  return {
    register(name, fn) {
      providers.set(name, fn)
    },
    unregister(name) {
      return providers.delete(name)
    },
    collect() {
      const result: Record<string, unknown> = {}
      for (const [name, fn] of providers) {
        try {
          result[name] = fn()
        } catch {
          /* skip silent — D-V2-F16-03 + pattern F1 D-20 safeTapStep carryover */
        }
      }
      return result
    },
    size() {
      return providers.size
    },
  }
}
