/**
 * HTML fallback renderer (D-V2-F14-13).
 *
 * Target chain priority:
 * (a) `mountElement` (passato dal caller — `reg.mount?.element` se bound)
 * (b) `document.querySelector(selector)` (selector da `descriptor.mount.selector`)
 * (c) `null` → warning + skip (`fallbackType:'html-skipped'`)
 *
 * F13 isolation respect: SE `SERVICE_ISOLATION.getResolvedPolicy(mfId).dom === 'shadow-dom'`
 * E `host.shadowRoot` esiste → target = shadowRoot (preserve isolation).
 *
 * W7 fix: signature `mountElement: HTMLElement | ShadowRoot | undefined` per supportare
 * caller F13 che passa direttamente `shadowRoot` (es. mount.context.shadowContainer).
 *
 * NO XSS sanitization runtime — host-controlled config (P-13 governance disclaimer README).
 *
 * @see D-V2-F14-13 — HTML target chain + isolation respect
 * @see prd_2.0.0.md §29.3 — type:'html' rendering
 */
import type { Broker } from '@gluezero/core'

/**
 * Type-import opt (peer optional F13) — duck-typing shape mirror, avoid hard dep.
 *
 * Conforming shape of `IsolationService.getResolvedPolicy` from
 * `packages/isolation/src/service-locator.ts:49-52`. Locale per non importare
 * hard `@gluezero/isolation` (peer optional).
 */
type IsolationServiceLike = {
  readonly getResolvedPolicy: (mfId: string) => { readonly dom?: string } | undefined
}

/**
 * Re-mirror constant da `@gluezero/core` (zero hard dep peer) — coerente con
 * F8 `SERVICE_ISOLATION = 'isolation' as const` (D-V2-02 service locator naming).
 */
const SERVICE_ISOLATION = 'isolation' as const

export interface HtmlRenderResult {
  readonly applied: boolean
  readonly fallbackType: 'html' | 'html-skipped'
  readonly reason?: string
}

/**
 * Applica HTML fallback a `mountElement` (priority a) o `document.querySelector(selector)`
 * (priority b). Se nessun target risolvibile → console.warn + skip.
 *
 * F13 isolation respect: `policy.dom === 'shadow-dom'` + `host.shadowRoot` presente →
 * target = shadowRoot (preserve CSS scoping shadow boundary).
 *
 * @param broker Broker per Service Locator lookup `SERVICE_ISOLATION` opt.
 * @param mfId MicroFrontend ID — passato a `IsolationService.getResolvedPolicy(mfId)`.
 * @param mountElement Priority (a) target. Accetta `HTMLElement | ShadowRoot | undefined`
 *   (W7 fix: caller F13 può passare shadowRoot direct via mount.context.shadowContainer).
 * @param selector Priority (b) fallback querySelector — usato se `mountElement` undefined.
 * @param html Stringa HTML da applicare a `target.innerHTML` (host-controlled config).
 * @returns RenderResult con `applied: boolean` + `fallbackType: 'html' | 'html-skipped'`.
 */
export function renderHtmlFallback(
  broker: Broker,
  mfId: string,
  mountElement: HTMLElement | ShadowRoot | undefined,
  selector: string | undefined,
  html: string,
): HtmlRenderResult {
  // (a) priority mountElement
  let target: HTMLElement | ShadowRoot | null = mountElement ?? null

  // (b) fallback querySelector(selector)
  if (target === null && typeof selector === 'string' && selector.length > 0) {
    target =
      typeof document !== 'undefined'
        ? (document.querySelector<HTMLElement>(selector) ?? null)
        : null
  }

  // (c) null → warn + skip
  if (target === null) {
    // biome-ignore lint/suspicious/noConsole: dev warning intentional (no target)
    console.warn(
      `[fallbacks] no mount target for mfId="${mfId}" — fallback HTML skipped`,
    )
    return { applied: false, fallbackType: 'html-skipped', reason: 'target-not-found' }
  }

  // F13 isolation respect: shadow-dom detection via Service Locator.
  // W3-P05 Rule 1 fix: bind `broker` come `this` per evitare TypeError quando
  // `broker.getService` viene chiamato come funzione standalone (Broker class
  // method `this.services.get`). Carryover safety pattern call/bind.
  const getSvc = (broker as { getService?: <T>(name: string) => T | undefined })
    .getService
  const isolation =
    getSvc !== undefined
      ? (getSvc.call(broker, SERVICE_ISOLATION) as IsolationServiceLike | undefined)
      : undefined
  if (isolation !== undefined) {
    const policy = isolation.getResolvedPolicy(mfId)
    if (
      policy?.dom === 'shadow-dom' &&
      'shadowRoot' in target &&
      (target as HTMLElement).shadowRoot !== null
    ) {
      target = (target as HTMLElement).shadowRoot!
    }
  }

  target.innerHTML = html
  return { applied: true, fallbackType: 'html' }
}
