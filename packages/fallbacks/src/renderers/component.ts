/**
 * Component fallback renderer (D-V2-F14-14).
 *
 * Service Locator delega a F15 framework adapter:
 * - Adapter presente: `adapter.renderFallbackComponent(component, target, error, ctx)`.
 * - Adapter assente: console.warn + HTML stub `<div data-gz-fallback-stub>` (graceful, non-throw).
 *
 * Pattern Rule 4 stretto carryover F13 `iframe-stub.ts` (Service Locator delega).
 * Diff F13 → F14: NON throw (F14 graceful: fallback è degraded recovery, NON failure
 * escalation). F13 iframe-stub throw perché iframe è apply-chain blocking.
 *
 * @see D-V2-F14-14 — Component-stub via Service Locator F15
 * @see packages/isolation/src/iframe-stub.ts (F13 reference template)
 */
import type { Broker } from '@gluezero/core'
import type { MicroFrontendError } from '../microfrontend-error.js'

/**
 * Service ID per framework adapter F15 (opt, local Symbol — F15 future registra via Service Locator).
 *
 * NOTE: F8 `services.ts` NON pre-dichiara `SERVICE_FRAMEWORK_ADAPTER`. F14 usa string literal
 * locale per evitare diff `packages/core/src/services.ts` (D-83). F15 può rinominare via
 * declaration merging additive senza breaking change.
 */
export const SERVICE_FRAMEWORK_ADAPTER = 'framework-adapter' as const

/**
 * Signature attesa F15 adapter API (placeholder type — F15 esporta tipo reale).
 */
export interface FrameworkAdapterLike {
  readonly renderFallbackComponent?: (
    component: unknown,
    target: HTMLElement,
    error: MicroFrontendError | { message: string },
    ctx?: unknown,
  ) => void
}

export interface ComponentRenderResult {
  readonly applied: boolean
  readonly fallbackType: 'component' | 'component-stub'
}

/**
 * Applica component fallback al target. Se F15 framework adapter è registrato via
 * Service Locator → delega. Altrimenti → console.warn + HTML stub generic con
 * `data-gz-fallback-stub` marker (graceful non-throw).
 *
 * @param broker Broker per Service Locator lookup `SERVICE_FRAMEWORK_ADAPTER` opt.
 * @param mfId MicroFrontend ID (usato in stub HTML attribute `data-gz-mf`).
 * @param target HTMLElement non-null target (caller dispatcher garantisce non-null
 *   prima di chiamare questo renderer).
 * @param component Component opaque (ramo-specific — React.Element, Vue VNode, Svelte
 *   Component, ecc.). Passato a F15 adapter per render reale.
 * @param error MicroFrontendError class o shape minimale `{message}` — passato a F15
 *   adapter per error context display.
 * @returns RenderResult con `applied: true` + `fallbackType: 'component' | 'component-stub'`.
 */
export function renderComponentFallback(
  broker: Broker,
  mfId: string,
  target: HTMLElement,
  component: unknown,
  error: MicroFrontendError | { message: string },
): ComponentRenderResult {
  // W3-P05 Rule 1 fix: bind `broker` come `this` per evitare TypeError quando
  // `broker.getService` viene chiamato come funzione standalone (Broker class
  // method `this.services.get`). Carryover safety pattern call/bind.
  const getSvc = (broker as { getService?: <T>(name: string) => T | undefined })
    .getService
  const adapter =
    getSvc !== undefined
      ? (getSvc.call(broker, SERVICE_FRAMEWORK_ADAPTER) as FrameworkAdapterLike | undefined)
      : undefined

  if (adapter !== undefined && typeof adapter.renderFallbackComponent === 'function') {
    adapter.renderFallbackComponent(component, target, error)
    return { applied: true, fallbackType: 'component' }
  }

  // F15 adapter absent → warning + HTML stub generic (graceful, NON-throw)
  // biome-ignore lint/suspicious/noConsole: dev warning intentional (F15 adapter missing)
  console.warn(
    `[fallbacks] component fallback requires F15 framework adapter; ` +
      `install @gluezero/{react,vue,svelte}. Falling back to HTML stub for mfId="${mfId}"`,
  )
  target.innerHTML =
    `<div data-gz-fallback-stub data-gz-mf="${escapeAttr(mfId)}">` +
    `component fallback requires F15 adapter</div>`
  return { applied: true, fallbackType: 'component-stub' }
}

/**
 * Minimal HTML attribute escape — host-controlled config, governance disclaimer applies.
 *
 * W9 fix: regex estesa a `/[<>"'&`]/g` per copertura completa attribute-context
 * special chars (mfId malevolo input). NB: descriptor.id è validato F8 a registration-time,
 * questa escape è defense-in-depth contro injection accidentale via mfId path.
 */
function escapeAttr(s: string): string {
  return s.replace(/[<>"'&`]/g, (ch) => {
    switch (ch) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      case '&':
        return '&amp;'
      case '`':
        return '&#96;'
      default:
        return ch
    }
  })
}
