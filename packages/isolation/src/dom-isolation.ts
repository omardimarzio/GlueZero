/**
 * `dom-isolation.ts` — D-V2-F13-05 shadow-dom Strategy A + D-V2-F13-07 iframe delegation.
 *
 * Cover REQ-IDs: MF-ISO-02 (DOM isolation modes mount-root/shadow-dom/iframe/none).
 *
 * ## Strategy A mutation cast (carryover D-V2-F10-XX)
 *
 * Per `dom='shadow-dom'`:
 *   1. `host.attachShadow({mode:'open'})` crea ShadowRoot sull'host element.
 *   2. Crea inner div container con attribute `data-gz-mf-container=<mfId>`.
 *   3. Sostituisce `mount.element` in-place con il div interno (Strategy A pattern
 *      ratificato in F10 D-V2-F10-XX): loader F9 ESM riceve container shadowed
 *      senza saperlo (transparent — il mount.element ref viene mutato pre-mount).
 *   4. Espone `mount.context.shadowContainer = shadowRoot` via context-augment
 *      (W1 P01 declaration merging additive `MicroFrontendRuntimeContext`).
 *
 * Per `dom='iframe'`: no-op (caller invoca `applyIframeStub` separato per error
 * code separation D-V2-F13-07).
 *
 * Per `dom='mount-root'`: no-op (default PRD §21.3, mount.element preserved come-is).
 *
 * Per `dom='none'`: no-op + dev warning una volta per element (anti-pattern
 * documented README P-13 governance-not-crypto disclaimer).
 *
 * ## Auto-fix Rule 1 (Plan-level): MountTarget shape contract
 *
 * Il PLAN.md assume payload `microfrontend.mounting` con `{microFrontendId, mount: {element, context}}`,
 * ma F8 `publishLifecycleEvent` (registry.ts:331) emette payload minimal
 * `{id, name, version, state, timestamp, timings}` SENZA `mount` field. Auto-fix:
 *   - `MountTarget` interface localmente esposta come contract pubblico.
 *   - `applyDomIsolation` accetta `MountTarget` direttamente (host caller deve
 *     popolare mount + invocare la funzione esplicitamente OR `lifecycle-mount-hook`
 *     legge campo `mount` opzionale dal payload — W3 P05 integration test verifica
 *     end-to-end con Strategy A binding).
 *
 * @see prd_2.0.0.md §21.4 — DOM isolation modes
 * @see D-V2-F13-05 — shadow-dom Strategy A mutation cast
 * @see D-V2-F13-07 — iframe delegation path separato
 * @see packages/microfrontends/src/runtime-context-factory.ts — F10 D-V2-F10-XX carryover
 */
import type { ResolvedIsolationPolicy } from './types/policy.js'

/**
 * `MountTarget` — Shape minimale `{element, context}` accettata da
 * `applyDomIsolation` / `applyCssIsolation` / `applyIframeStub`.
 *
 * `element` è l'host DOM element (mutato in-place per shadow-dom Strategy A).
 * `context` è il runtime context F8 augmentato W1 P01 con `shadowContainer?`
 * (esposto a runtime dopo apply per dom='shadow-dom').
 *
 * Contract pubblico esportato per consumer host che invocano direttamente le
 * apply functions pre-mount (Strategy A binding completato in W3 P05).
 */
export interface MountTarget {
  element: HTMLElement
  context: unknown
}

/**
 * `WARNED_NONE` — WeakSet per emit warning una volta per host element quando
 * `dom='none'` (anti-pattern PRD §21.4 disabled isolation).
 *
 * @internal
 */
const WARNED_NONE = new WeakSet<HTMLElement>()

/**
 * Applica isolamento DOM al mount target secondo `policy.dom`.
 *
 * @param mount - Mount target `{element, context}`. Per `dom='shadow-dom'`
 *   il campo `element` viene mutato in-place al div interno (Strategy A).
 * @param mfId - Identificatore del MicroFrontend (usato come `data-gz-mf-container` attr).
 * @param policy - Policy risolta con `dom` field tra `'mount-root' | 'shadow-dom' | 'iframe' | 'none'`.
 *
 * @example dom='shadow-dom' Strategy A mutation cast
 * ```ts
 * const host = document.createElement('div')
 * const mount: MountTarget = { element: host, context: {} }
 * applyDomIsolation(mount, 'mf-1', { ...policy, dom: 'shadow-dom' })
 * // host.shadowRoot !== null
 * // mount.element === host.shadowRoot.firstElementChild (innerDiv)
 * // mount.element !== host (mutated)
 * ```
 *
 * @example dom='mount-root' no-op
 * ```ts
 * const host = document.createElement('div')
 * const mount: MountTarget = { element: host, context: {} }
 * applyDomIsolation(mount, 'mf-1', { ...policy, dom: 'mount-root' })
 * // mount.element === host (no mutation)
 * // host.shadowRoot === null
 * ```
 *
 * @see D-V2-F13-05 — shadow-dom Strategy A mutation cast (carryover D-V2-F10-XX)
 * @see D-V2-F13-07 — iframe path separato (applyIframeStub)
 */
export function applyDomIsolation(
  mount: MountTarget,
  mfId: string,
  policy: ResolvedIsolationPolicy,
): void {
  const host = mount.element

  switch (policy.dom) {
    case 'mount-root':
      // PRD §21.3 baseline default. Host element preserved come-is.
      return

    case 'iframe':
      // Path separato — caller invoca `applyIframeStub` per error code separation.
      // D-V2-F13-07 + F15 future delegation.
      return

    case 'shadow-dom': {
      // Strategy A mutation cast (D-V2-F10-XX carryover ratificato).
      const shadowRoot = host.attachShadow({ mode: 'open' })
      const innerDiv = host.ownerDocument.createElement('div')
      innerDiv.setAttribute('data-gz-mf-container', mfId)
      shadowRoot.appendChild(innerDiv)

      // Mutation cast: loader F9 ESM riceve il container shadowed transparently.
      ;(mount as { element: HTMLElement }).element = innerDiv

      // Espone shadowContainer via context-augment W1 P01 (declaration merging
      // additive `MicroFrontendRuntimeContext.shadowContainer?: ShadowRoot`).
      ;(mount.context as { shadowContainer?: ShadowRoot }).shadowContainer = shadowRoot
      return
    }

    case 'none': {
      // Anti-pattern documented — warning una volta per host element.
      if (!WARNED_NONE.has(host)) {
        WARNED_NONE.add(host)
        // biome-ignore lint/suspicious/noConsole: dev warning intentional (P-13 governance)
        console.warn(
          `[@gluezero/isolation] dom='none' for mf='${mfId}': DOM isolation disabled. ` +
            'Strongly discouraged — see README P-13 governance-not-crypto disclaimer.',
        )
      }
      return
    }

    default: {
      // Exhaustiveness check — TS errore se policy.dom union si espande senza update.
      const _exhaustive: never = policy.dom
      void _exhaustive
    }
  }
}
