/**
 * `applyContext` — 3-mode dispatcher `RuntimeContext` → custom element instance
 * (D-V2-F15-05 lockato, default `'property'`).
 *
 * Mode supportati:
 *
 * - **`'property'`** (default — D-V2-F15-05): `element.glueZeroContext = ctx`
 *   JS property assignment. L'element può intercettare l'assegnazione tramite custom
 *   element setter `set glueZeroContext(value)`. **Reference identity preserved** —
 *   zero serialization overhead + type-safe + supporta shape complete `RuntimeContext`
 *   F10 (`tenantId/user/locale/permissions/featureFlags/theme/direction/environment/
 *   currentRoute/metadata`).
 *
 * - **`'attribute'`**: `element.setAttribute('data-gluezero-context', JSON.stringify(subset))`
 *   con subset minimo serializable `{tenantId, locale, environment, direction}`. 64KB
 *   limit attributo + perdita reference identity + serializzazione lossy (deep features
 *   come `permissions`/`featureFlags` deferred V2.1).
 *
 * - **`'event'`**: `element.dispatchEvent(new CustomEvent('gluezero:context', {detail: {context}}))`
 *   — il consumer registra `addEventListener('gluezero:context', ...)` dentro il custom
 *   element. NO bubbles + NO composed (event boundary stretto sull'element).
 *
 * @see D-V2-F15-05 — Default contextMode property + rationale rejection alternatives
 * @see PRD §25 — Web Component Loader
 * @see REQ MF-WC-01 — contextMode 3-mode dispatch
 */
import { createMfWebComponentError } from './errors'

/**
 * Union literal — modalità di dispatch del `RuntimeContext` al custom element.
 *
 * `'property'` è il default lockato D-V2-F15-05 (reference identity preserved + zero
 * serialization overhead).
 */
export type ContextMode = 'property' | 'attribute' | 'event'

/**
 * Sub-shape minimo serializable per mode `'attribute'`. Serializzazione lossy:
 * `permissions/featureFlags/theme/currentRoute/metadata/user` esclusi (deep features
 * deferred V2.1 — D-V2-F15-05 limitation doc-linked).
 *
 * @internal
 */
interface SerializableContextSubset {
  readonly tenantId?: unknown
  readonly locale?: unknown
  readonly environment?: unknown
  readonly direction?: unknown
}

/**
 * Propaga `context` al `element` secondo `mode`.
 *
 * @param element - HTMLElement target (custom element instance creato lato consumer
 *   via `document.createElement(elementName)` post-`customElements.define`).
 * @param context - Runtime context F10 da propagare (shape opaca `unknown` per non
 *   forzare dipendenza hard `@gluezero/context` — tutta la shape è gestita lato
 *   consumer / custom element).
 * @param mode - Modalità dispatch (`property` default + `attribute` + `event`).
 * @throws `MfWebComponentError` con `code: 'MF_WC_CONTEXT_MODE_INVALID'` se `mode`
 *   non è in `{'property','attribute','event'}`.
 *
 * @example mode property (default D-V2-F15-05)
 * ```ts
 * const el = document.createElement('mf-dashboard')
 * applyContext(el, { tenantId: 'acme', locale: 'it-IT' }, 'property')
 * // (el as any).glueZeroContext === context (reference identity preserved)
 * ```
 *
 * @example mode attribute
 * ```ts
 * const el = document.createElement('mf-analytics')
 * applyContext(el, { tenantId: 'acme', locale: 'it-IT' }, 'attribute')
 * // el.getAttribute('data-gluezero-context') === '{"tenantId":"acme","locale":"it-IT"}'
 * ```
 *
 * @example mode event
 * ```ts
 * const el = document.createElement('mf-cart')
 * el.addEventListener('gluezero:context', (e) => {
 *   const ctx = (e as CustomEvent).detail.context
 * })
 * applyContext(el, { tenantId: 'acme' }, 'event')
 * ```
 */
export function applyContext(element: HTMLElement, context: unknown, mode: ContextMode): void {
  switch (mode) {
    case 'property': {
      // D-V2-F15-05 default: reference identity preserved via JS property setter.
      ;(element as unknown as { glueZeroContext: unknown }).glueZeroContext = context
      return
    }
    case 'attribute': {
      // Subset serializable minimo (D-V2-F15-05 doc-linked limitation V2.1 deep features).
      const ctx = (context ?? {}) as SerializableContextSubset
      const subset: Record<string, unknown> = {}
      if (ctx.tenantId !== undefined) subset['tenantId'] = ctx.tenantId
      if (ctx.locale !== undefined) subset['locale'] = ctx.locale
      if (ctx.environment !== undefined) subset['environment'] = ctx.environment
      if (ctx.direction !== undefined) subset['direction'] = ctx.direction
      element.setAttribute('data-gluezero-context', JSON.stringify(subset))
      return
    }
    case 'event': {
      element.dispatchEvent(
        new CustomEvent('gluezero:context', {
          detail: { context },
          bubbles: false,
          composed: false,
        }),
      )
      return
    }
    default: {
      throw createMfWebComponentError({
        code: 'MF_WC_CONTEXT_MODE_INVALID',
        message: `contextMode "${String(mode)}" non valido (atteso: 'property' | 'attribute' | 'event')`,
        details: { mode: String(mode) },
      })
    }
  }
}
