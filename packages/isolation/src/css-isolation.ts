/**
 * `css-isolation.ts` — D-V2-F13-06 scoped CSS via `data-gz-mf` attribute setter.
 *
 * Cover REQ-IDs: MF-ISO-02 parziale (CSS isolation modes scoped/shadow-dom/iframe/none).
 *
 * ## Modi e comportamento
 *
 * Per `css='scoped'`: setAttribute `data-gz-mf=<mfId>` su `mount.element` (carrier
 * per `scopeCss(rawCss, mfId)` helper opt-in che prefissa selettori con
 * `[data-gz-mf="<id>"]`). Runtime NON inietta CSS automaticamente — MF chiama
 * esplicitamente `scopeCss` quando necessario (governance-not-crypto P-13).
 *
 * Per `css='shadow-dom'`: no-op (l'isolamento è già naturalmente garantito dal
 * ShadowRoot creato da `dom-isolation.ts` — selettori esterni NON penetrano).
 *
 * Per `css='iframe'`: no-op (iframe è un browsing context separato).
 *
 * Per `css='none'`: no-op (esplicito opt-out anti-pattern, no warning hot-path).
 *
 * @see prd_2.0.0.md §21.5 — CSS isolation modes
 * @see D-V2-F13-06 — minimal scoping con attribute prefix
 */
import type { ResolvedIsolationPolicy } from './types/policy.js'
import type { MountTarget } from './dom-isolation.js'

/**
 * Applica isolamento CSS al mount target secondo `policy.css`.
 *
 * @param mount - Mount target `{element, context}`. Per `css='scoped'` viene
 *   settato `data-gz-mf=<mfId>` sull'element corrente (post `applyDomIsolation`
 *   — l'element potrebbe essere il div interno se `dom='shadow-dom'` ha mutato
 *   il ref via Strategy A).
 * @param mfId - Identificatore del MicroFrontend (valore dell'attribute scoping).
 * @param policy - Policy risolta con `css` field tra `'none' | 'scoped' | 'shadow-dom' | 'iframe'`.
 *
 * @example css='scoped' attribute setter
 * ```ts
 * const host = document.createElement('div')
 * const mount: MountTarget = { element: host, context: {} }
 * applyCssIsolation(mount, 'mf-1', { ...policy, css: 'scoped' })
 * // host.getAttribute('data-gz-mf') === 'mf-1'
 * ```
 *
 * @example css='shadow-dom' no-op (gestito da dom-isolation)
 * ```ts
 * applyCssIsolation(mount, 'mf-1', { ...policy, css: 'shadow-dom' })
 * // mount.element.hasAttribute('data-gz-mf') === false
 * ```
 *
 * @see D-V2-F13-06 — scoped CSS attribute prefix
 */
export function applyCssIsolation(
  mount: MountTarget,
  mfId: string,
  policy: ResolvedIsolationPolicy,
): void {
  switch (policy.css) {
    case 'scoped':
      mount.element.setAttribute('data-gz-mf', mfId)
      return
    case 'shadow-dom':
    case 'iframe':
    case 'none':
      return
    default: {
      // Exhaustiveness check — TS errore se policy.css union si espande senza update.
      const _exhaustive: never = policy.css
      void _exhaustive
    }
  }
}
