/**
 * `iframe-stub.ts` — D-V2-F13-07 iframe stub F13 vs F15 delegation pattern.
 *
 * Cover REQ-IDs: MF-ISO-02 parziale (DOM mode 'iframe' — F13 stub, F15 full impl).
 *
 * ## Comportamento
 *
 * Per `policy.dom === 'iframe'`:
 *
 *  1. Se `resolvers.iframeLoader === undefined` → throw `BrokerError` con
 *     `code='IFRAME_ADAPTER_REQUIRED'` + `category='microfrontend'`. Caller
 *     `lifecycle-mount-hook` propaga throw → MF FSM transitions to 'failed'
 *     (F8 lifecycle integration via try/catch in registry.ts mount step).
 *
 *  2. Se `resolvers.iframeLoader()` ritorna un oggetto con `createSandbox(...)`:
 *     delega `loader.createSandbox(policy, mfId, mount)` (F15 future delegation).
 *
 *  3. Se signature mismatch (resolver ritorna `undefined` o oggetto senza
 *     `createSandbox`) → throw `BrokerError` con `code='POLICY_INVALID'` +
 *     message diagnostico.
 *
 * Per `policy.dom !== 'iframe'`: no-op (apply chain dom→css→iframe-stub safe).
 *
 * F13 testa SOLO il path throw + 1 stub mock per delega (3 unit test).
 * F15 `@gluezero/mf-iframe` implementerà iframe reale + Tier-3 scenario completo.
 *
 * @see prd_2.0.0.md §21.4 — DOM iframe mode delegate
 * @see D-V2-F13-07 — iframe stub vs F15 delegation
 * @see packages/isolation/src/types/errors.ts — createIsolationPolicyError factory W1 P02
 */
import type { ResolvedIsolationPolicy } from './types/policy.js'
import type { IsolationResolvers } from './types/facades.js'
import type { MountTarget } from './dom-isolation.js'
import { createIsolationPolicyError } from './types/errors.js'

/**
 * Adapter signature aspettata da `resolvers.iframeLoader()` (F15 future).
 *
 * @see prd_2.0.0.md §21.4 — iframe sandbox creation contract
 */
export interface IframeAdapter {
  createSandbox(
    policy: ResolvedIsolationPolicy,
    mfId: string,
    mount: MountTarget,
  ): void
}

/**
 * Duck-typing check: l'oggetto ritornato dal resolver è un valid `IframeAdapter`.
 *
 * @internal
 */
function isIframeAdapter(x: unknown): x is IframeAdapter {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as IframeAdapter).createSandbox === 'function'
  )
}

/**
 * Applica iframe sandbox al mount target se `policy.dom === 'iframe'`.
 *
 * @param mount - Mount target `{element, context}`. L'adapter F15 sostituisce
 *   `element` con un iframe DOM element (Strategy A mutation cast analogo a
 *   shadow-dom — F15 implementation detail).
 * @param mfId - Identificatore del MicroFrontend.
 * @param policy - Policy risolta. Solo `policy.dom === 'iframe'` triggera apply.
 * @param resolvers - Resolver host-provided (`{iframeLoader?}`).
 * @throws BrokerError `IFRAME_ADAPTER_REQUIRED` se iframe loader missing.
 * @throws BrokerError `POLICY_INVALID` se loader returns invalid adapter shape.
 *
 * @example No resolver → throw IFRAME_ADAPTER_REQUIRED
 * ```ts
 * try {
 *   applyIframeStub(mount, 'mf-1', { ...policy, dom: 'iframe' }, {})
 * } catch (e) {
 *   // e.code === 'IFRAME_ADAPTER_REQUIRED'
 *   // e.category === 'microfrontend'
 * }
 * ```
 *
 * @example Valid adapter → delegate
 * ```ts
 * const adapter = { createSandbox: vi.fn() }
 * applyIframeStub(mount, 'mf-1', { ...policy, dom: 'iframe' }, {
 *   iframeLoader: () => adapter,
 * })
 * // adapter.createSandbox è stato invocato con (policy, 'mf-1', mount)
 * ```
 *
 * @see D-V2-F13-07 — iframe stub vs F15 future delegation
 */
export function applyIframeStub(
  mount: MountTarget,
  mfId: string,
  policy: ResolvedIsolationPolicy,
  resolvers: IsolationResolvers,
): void {
  // No-op se policy.dom non è 'iframe' — apply chain safe.
  if (policy.dom !== 'iframe') return

  const loader = resolvers.iframeLoader?.()

  if (loader === undefined) {
    throw createIsolationPolicyError({
      code: 'IFRAME_ADAPTER_REQUIRED',
      message:
        `MicroFrontend '${mfId}' declares dom='iframe' but no iframe adapter is registered. ` +
        "Install '@gluezero/mf-iframe' (F15 future) and provide resolvers.iframeLoader to isolationModule().",
      details: { microFrontendId: mfId, dimension: 'dom' },
    })
  }

  if (!isIframeAdapter(loader)) {
    throw createIsolationPolicyError({
      code: 'POLICY_INVALID',
      message:
        `MicroFrontend '${mfId}' iframe adapter does not implement createSandbox(policy, mfId, mount); ` +
        `got ${typeof loader}.`,
      details: { microFrontendId: mfId, reason: 'iframe-adapter-signature-mismatch' },
    })
  }

  loader.createSandbox(policy, mfId, mount)
}
