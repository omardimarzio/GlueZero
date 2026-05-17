/**
 * `lifecycle-mount-hook.ts` — D-V2-F13-01 seam hybrid + apply chain dom→css→iframe.
 *
 * Cover REQ-IDs: MF-ISO-02 (DOM/CSS isolation applied pre-mount via subscribe a
 * `microfrontend.mounting` topic F8); MF-ISO-05 parziale (events isolation
 * gestita per descriptor field lock pre-mount — W3 P05 integration end-to-end
 * con context-augment events broker-only/broker-plus-dom/isolated).
 *
 * ## Subscribe `microfrontend.mounting` (F8 lifecycle topic)
 *
 * RESEARCH §3 OQ-1 timing verifica empirica W2: il broker default
 * `deliveryMode='async'` (microtask queue D-01) → handler subscribe invocato
 * pre `loaded.lifecycle.mount(ctx)` chiamata in registry.ts:543 (await rompe
 * la chain sync → microtask gira prima del mount).
 *
 * ## Payload Contract (Auto-fix Rule 1 — Plan-level)
 *
 * F8 `publishLifecycleEvent` (registry.ts:331-352) emette payload MINIMAL
 * `{id, name, version, previousState, state, timestamp, timings}` SENZA campo
 * `mount`. L'hook gestisce due shape:
 *
 *  1. Payload F8 standard (`{id, ...}`): handler skip (no mount field → no apply).
 *  2. Payload augmented (`{id, mount: {element, context}}` o
 *     `{microFrontendId, mount}`): full apply chain dom→css→iframe.
 *
 * La popolazione del campo `mount` è host-side responsibility — Strategy A
 * binding completato in W3 P05 (loader F9 publish secondary topic con mount
 * OR host explicit API `applyIsolationToMount(mfId, mount)`). W2 P03 fornisce
 * il subscribe + apply chain testato; W3 P05 integra timing reale.
 *
 * Per Tier-1 testabilità immediata, `lifecycle-mount-hook` esporta anche
 * `applyMountIsolation(mfId, mount, cache, resolvers)` helper esplicito che
 * caller può invocare direttamente (NO via topic) — Strategy A binding alt.
 *
 * ## AbortSignal cleanup cascade (D-V2-16 carryover)
 *
 *  - `opts.signal.abort()` → handler `subscription.unsubscribe()`.
 *  - Idempotent: chiamare `handle.unsubscribe()` 2x è no-op.
 *
 * @see prd_2.0.0.md §21.4-21.5 — DOM/CSS isolation modes apply
 * @see D-V2-F13-01 — Seam hybrid wrap-context + lifecycle subscribe
 * @see RESEARCH §3 OQ-1 — Timing SYNC verifica empirica
 * @see packages/permissions/src/lifecycle-hooks.ts — F11 TEMPLATE subscribe + cleanup
 */
import type { BrokerEvent } from '@gluezero/core'
import type { ResolvedIsolationPolicy } from './types/policy.js'
import type { IsolationResolvers } from './types/facades.js'
import { applyDomIsolation, type MountTarget } from './dom-isolation.js'
import { applyCssIsolation } from './css-isolation.js'
import { applyIframeStub } from './iframe-stub.js'

/**
 * `PolicyCache` — Contract duck-typed minimal per lookup policy risolte per `mfId`.
 *
 * Decoupling parallel-safe W2 (P03 NON dipende dal file `internal/policy-cache.ts`
 * owned da P02): qualunque implementazione che espone `get(mfId): ResolvedIsolationPolicy | undefined`
 * è compatibile. P02 fornirà l'impl reale popolata da `lifecycle-register-hook`.
 *
 * @internal F13 contract — non esportato come API pubblica (impl detail W2).
 */
export interface PolicyCache {
  get(microFrontendId: string): ResolvedIsolationPolicy | undefined
}

/**
 * `BrokerSubscribeApi` — Subset duck-typed del `Broker.subscribe` necessario
 * per `lifecycle-mount-hook`.
 *
 * Permette test in isolation con mock minimal — NON richiede mount del Broker
 * completo F1 (61+ types/methods).
 *
 * @internal F13 contract.
 */
export interface BrokerSubscribeApi {
  subscribe(
    pattern: string,
    handler: (event: BrokerEvent) => void,
    options?: { signal?: AbortSignal },
  ): { unsubscribe: () => void }
}

/**
 * Options per `installMountHook`.
 */
export interface MountHookOptions {
  readonly cache: PolicyCache
  readonly resolvers: IsolationResolvers
  /** Optional AbortSignal per cascade cleanup (D-V2-16). */
  readonly signal?: AbortSignal
}

/**
 * Handle ritornato da `installMountHook` per cleanup manuale.
 */
export interface MountHookHandle {
  readonly unsubscribe: () => void
}

/**
 * Payload shape augmented atteso da `lifecycle-mount-hook` (host-side popolato).
 *
 * @internal
 */
interface MountingPayload {
  readonly id?: string
  readonly microFrontendId?: string
  readonly mount?: MountTarget
}

/**
 * Apply chain dom→css→iframe per un singolo mount.
 *
 * Esposto come helper esplicito per caller host-side che NON usano il subscribe
 * (Strategy A binding alt — invocato direttamente pre-mount dal loader F9 o
 * host application code).
 *
 * @param mfId - Identificatore del MicroFrontend.
 * @param mount - Mount target `{element, context}`. Mutato in-place per
 *   shadow-dom (Strategy A).
 * @param cache - PolicyCache per lookup `ResolvedIsolationPolicy`. Se policy
 *   undefined → console.warn + skip (resolve at register failed o mfId mismatch).
 * @param resolvers - IsolationResolvers per iframe delegate F15.
 * @throws BrokerError `IFRAME_ADAPTER_REQUIRED` / `POLICY_INVALID` se
 *   policy.dom='iframe' senza valid adapter (propagato da applyIframeStub).
 *
 * @example Strategy A binding alt (host explicit API)
 * ```ts
 * const handle = installMountHook(broker, { cache, resolvers })
 * // Da loader F9 / host app code pre-mount:
 * applyMountIsolation('mf-1', { element: host, context: ctx }, cache, resolvers)
 * ```
 */
export function applyMountIsolation(
  mfId: string,
  mount: MountTarget,
  cache: PolicyCache,
  resolvers: IsolationResolvers,
): void {
  const resolved = cache.get(mfId)
  if (!resolved) {
    // biome-ignore lint/suspicious/noConsole: dev warning intentional (P02 register hook missing)
    console.warn(
      `[@gluezero/isolation] No resolved policy for mf='${mfId}' at apply-mount time. ` +
        'Ensure isolationModule install order is before mount and the MF is registered.',
    )
    return
  }

  applyDomIsolation(mount, mfId, resolved)
  applyCssIsolation(mount, mfId, resolved)
  applyIframeStub(mount, mfId, resolved, resolvers)
}

/**
 * Wire del lifecycle mount hook — subscribe a `microfrontend.mounting` F8
 * + apply chain dom→css→iframe per ogni payload con `mount` field augmentato.
 *
 * @param broker - Broker reference (subset `BrokerSubscribeApi` accettato).
 * @param opts - `{cache, resolvers, signal?}` (W1 P01 IsolationResolvers + W2 P02 PolicyCache).
 * @returns Handle con `unsubscribe()` idempotent per cleanup manuale.
 *
 * @example Install hook con AbortSignal cascade
 * ```ts
 * const ctrl = new AbortController()
 * const handle = installMountHook(broker, {
 *   cache: policyCache,
 *   resolvers: { iframeLoader: () => iframeAdapter },
 *   signal: ctrl.signal,
 * })
 * // Cleanup automatico:
 * ctrl.abort()
 * // → handle.unsubscribe() invocato internamente
 * ```
 *
 * @see RESEARCH §3 OQ-1 — Timing SYNC microfrontend.mounting pre-loader invocation
 * @see D-V2-F13-01 — Seam hybrid wrap-context + lifecycle subscribe
 */
export function installMountHook(
  broker: BrokerSubscribeApi,
  opts: MountHookOptions,
): MountHookHandle {
  const subscription = broker.subscribe(
    'microfrontend.mounting',
    (event: BrokerEvent) => {
      const payload = event.payload as MountingPayload | undefined
      if (!payload) return

      const mfId = payload.id ?? payload.microFrontendId
      const mount = payload.mount
      if (!mfId || !mount) {
        // Payload F8 standard senza mount field — skip silently (W3 P05 integra Strategy A binding).
        return
      }

      applyMountIsolation(mfId, mount, opts.cache, opts.resolvers)
    },
  )

  // AbortSignal cascade cleanup D-V2-16.
  if (opts.signal) {
    opts.signal.addEventListener('abort', () => subscription.unsubscribe(), { once: true })
  }

  return { unsubscribe: subscription.unsubscribe }
}
