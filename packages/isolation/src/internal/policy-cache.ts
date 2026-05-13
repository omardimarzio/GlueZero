/**
 * `internal/policy-cache.ts` — Wrapper `Map<mfId, ResolvedIsolationPolicy>` con
 * AbortSignal cascade cleanup (D-V2-F13-03 + carryover D-V2-16 F11/F12).
 *
 * Cover REQ-IDs: MF-ISO-01 (cache eager resolution at register — supporta query
 * `IsolationService.getResolvedPolicy(mfId)` da P04 facade + devtools F16 futuro).
 *
 * Internal-only — NON esportato dal barrel `src/index.ts` (D-V2-F13-22 strict —
 * solo factory + service-locator + types pubblici).
 *
 * ## AbortSignal cleanup cascade (D-V2-16)
 *
 * Quando il broker host viene shutdown (broker abort signal fires), tutti i moduli
 * subscribe al cascade signal devono rilasciare risorse. La cache si registra al
 * signal e svuota la `Map` interna su `abort`. Pattern coerente F11 LRU cache
 * cleanup + F12 lastReports memo cleanup.
 *
 * @see D-V2-F13-03 — Cache eager resolution at register
 * @see D-V2-16 — Cleanup cascade abortSignal pattern
 * @see packages/permissions/src/lru-cache.ts (F11 reference cleanup pattern)
 */
import type { ResolvedIsolationPolicy } from '../types/policy.js'

/**
 * `PolicyCache` API — wrapper minimale su `Map<string, ResolvedIsolationPolicy>`.
 *
 * Tutti i metodi sono readonly per garantire l'API surface stabile (no monkey patch).
 * Esposto come dependency-injected interface a `installRegisterHook(broker, {cache, ...})`.
 */
export interface PolicyCache {
  /** Inserisce o aggiorna la policy risolta per il `mfId` dato. */
  readonly set: (mfId: string, policy: ResolvedIsolationPolicy) => void
  /** Lookup non destructive — ritorna `undefined` se `mfId` non registrato. */
  readonly get: (mfId: string) => ResolvedIsolationPolicy | undefined
  /** Rimuove l'entry e ritorna `true` se esisteva. */
  readonly delete: (mfId: string) => boolean
  /** Svuota completamente la cache (chiamato anche da abortSignal cascade). */
  readonly clear: () => void
  /** Numero corrente di entry in cache. */
  readonly size: () => number
}

/**
 * Opzioni di costruzione per `createPolicyCache`.
 */
export interface CreatePolicyCacheOptions {
  /**
   * Signal opzionale per cascade cleanup. Quando il signal fires `abort` la cache
   * svuota la `Map` interna (idempotent — chiamato 1x via `{ once: true }`).
   */
  readonly signal?: AbortSignal
}

/**
 * Costruisce una nuova `PolicyCache` indipendente.
 *
 * Anti-singleton (carryover D-30 F1): ogni call ritorna una NUOVA cache. Scenari
 * 2-broker indipendenti (test isolation, multi-tenant host) restano supportati.
 *
 * @param opts - Opzioni di costruzione (`signal` per cascade cleanup).
 * @returns `PolicyCache` istanza pronta all'uso.
 *
 * @example Cache standalone (test scenario)
 * ```ts
 * const cache = createPolicyCache()
 * cache.set('mf-1', resolvedPolicy)
 * expect(cache.get('mf-1')).toEqual(resolvedPolicy)
 * ```
 *
 * @example Cache con cascade cleanup (broker shutdown scenario)
 * ```ts
 * const ctrl = new AbortController()
 * const cache = createPolicyCache({ signal: ctrl.signal })
 * cache.set('mf-1', resolvedPolicy)
 * ctrl.abort()
 * expect(cache.size()).toBe(0) // cleared by cascade
 * ```
 */
export function createPolicyCache(
  opts: CreatePolicyCacheOptions = {},
): PolicyCache {
  const map = new Map<string, ResolvedIsolationPolicy>()

  const cache: PolicyCache = {
    set(mfId, policy) {
      map.set(mfId, policy)
    },
    get(mfId) {
      return map.get(mfId)
    },
    delete(mfId) {
      return map.delete(mfId)
    },
    clear() {
      map.clear()
    },
    size() {
      return map.size
    },
  }

  // AbortSignal cascade cleanup (D-V2-16 + carryover F11/F12).
  if (opts.signal) {
    if (opts.signal.aborted) {
      // Edge case: signal già abortito prima della construct → svuota subito.
      map.clear()
    } else {
      opts.signal.addEventListener(
        'abort',
        () => {
          map.clear()
        },
        { once: true },
      )
    }
  }

  return cache
}
