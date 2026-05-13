/**
 * `createStorageFacade(mfId, policy, broker)` — D-V2-F13-11 + MF-ISO-03 + MF-INT-CACHE-01/02.
 *
 * Backing: `window.localStorage` diretto (NO `@gluezero/cache` backing per F13 —
 * cache v1.0 è LRU in-memory mismatch semantico con persistent localStorage-style
 * API. Defer alignment V2.1 — documentato OQ resolution CONTEXT.md).
 *
 * ## Modes (PRD §21.7)
 *
 * - `storage='namespaced'` → prefisso `gz:mf:<mfId>:<key>` su tutte le operazioni
 *   getItem/setItem/removeItem; `clear()` namespace-restricted (itera
 *   `Object.keys(localStorage).filter(k => k.startsWith(prefix))` — NON svuota
 *   storage globale, sicurezza T-13-W2-P04-02 + test 7).
 * - `storage='blocked'` → factory ritorna `undefined` (ctx.storage = undefined
 *   per intent signaling — MF code path-checked, `if (ctx.storage)` guard).
 * - `storage='shared'` → pass-through senza prefisso (key raw). OMIT third-party
 *   warning (OQ-2 risoluzione: `descriptor.owner.type` NON esiste F8, defer V2.1
 *   documentato JSDoc + README W3 P05/P06).
 *
 * ## Topic emit observability
 *
 * Emit `microfrontend.storage.changed` topic su setItem/removeItem/clear con
 * payload `{microFrontendId, op, key?, scope: 'namespaced'|'shared'}` per devtools
 * F16 observability + audit trail.
 *
 * ## Threat T-13-W2-P04-02 mitigation (prefix collision)
 *
 * Naming convention `gz:mf:<mfId>:<key>` — unique mfId enforcement upstream a F8
 * descriptor registration. Test 7 verifica mf-1 vs mf-10 isolato (clear su mf-1
 * NON tocca mf-10) escludendo bug di matching string accidentale.
 *
 * @example Setup namespaced (PRD §21.3 hardened)
 * ```ts
 * const storage = createStorageFacade('mf-1', {
 *   ...DEFAULT_ISOLATION_POLICY,
 *   storage: 'namespaced',
 * }, broker)
 * storage?.setItem('counter', '42')
 * // localStorage.getItem('gz:mf:mf-1:counter') === '42'
 * // broker.publish('microfrontend.storage.changed', { microFrontendId: 'mf-1', op: 'set', key: 'counter', scope: 'namespaced' })
 * ```
 *
 * @example Setup blocked (defense-in-depth)
 * ```ts
 * const storage = createStorageFacade('mf-1', { ...DEFAULT_ISOLATION_POLICY, storage: 'blocked' }, broker)
 * console.log(storage) // undefined — MF code NON può accedere via ctx.storage
 * ```
 *
 * @see prd_2.0.0.md §21.7 — StorageFacade contract
 * @see D-V2-F13-11 — Storage backing window.localStorage direct (NO cache)
 * @see D-V2-F13-12 — Topic emit observability
 * @see OQ-2 — Third-party shared warning defer V2.1
 *
 * @param mfId MicroFrontend identifier (unique per descriptor registration F8).
 * @param policy ResolvedIsolationPolicy (merged default + policyDefault + descriptor).
 * @param broker Minimal broker shape per topic emit.
 * @returns `StorageFacade | undefined` (undefined per `storage='blocked'`).
 */
import type { ResolvedIsolationPolicy } from '../types/policy.js'
import type { StorageFacade } from '../types/facades.js'

interface Broker {
  publish(topic: string, payload: unknown): void
}

export function createStorageFacade(
  mfId: string,
  policy: ResolvedIsolationPolicy,
  broker: Broker,
): StorageFacade | undefined {
  if (policy.storage === 'blocked') return undefined

  if (policy.storage === 'shared') {
    // OQ-2: descriptor.owner.type warning OMIT per F13 (defer V2.1)
    return {
      getItem(key: string): string | null {
        return window.localStorage.getItem(key)
      },
      setItem(key: string, value: string): void {
        window.localStorage.setItem(key, value)
        broker.publish('microfrontend.storage.changed', {
          microFrontendId: mfId,
          op: 'set',
          key,
          scope: 'shared',
        })
      },
      removeItem(key: string): void {
        window.localStorage.removeItem(key)
        broker.publish('microfrontend.storage.changed', {
          microFrontendId: mfId,
          op: 'remove',
          key,
          scope: 'shared',
        })
      },
      clear(): void {
        // shared mode: pass-through full clear (PRD-spec'd semantic per shared)
        window.localStorage.clear()
        broker.publish('microfrontend.storage.changed', {
          microFrontendId: mfId,
          op: 'clear',
          scope: 'shared',
        })
      },
    }
  }

  // policy.storage === 'namespaced'
  const prefix = `gz:mf:${mfId}:`
  return {
    getItem(key: string): string | null {
      return window.localStorage.getItem(prefix + key)
    },
    setItem(key: string, value: string): void {
      window.localStorage.setItem(prefix + key, value)
      broker.publish('microfrontend.storage.changed', {
        microFrontendId: mfId,
        op: 'set',
        key,
        scope: 'namespaced',
      })
    },
    removeItem(key: string): void {
      window.localStorage.removeItem(prefix + key)
      broker.publish('microfrontend.storage.changed', {
        microFrontendId: mfId,
        op: 'remove',
        key,
        scope: 'namespaced',
      })
    },
    clear(): void {
      // Namespace-restricted iteration: NON svuota storage globale (T-13-W2-P04-02 mitigation)
      const keysToRemove: string[] = []
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (k && k.startsWith(prefix)) keysToRemove.push(k)
      }
      for (const k of keysToRemove) window.localStorage.removeItem(k)
      broker.publish('microfrontend.storage.changed', {
        microFrontendId: mfId,
        op: 'clear',
        scope: 'namespaced',
      })
    },
  }
}
